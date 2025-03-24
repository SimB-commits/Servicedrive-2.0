// pages/api/webhooks/inbound-email.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { logger } from '@/utils/logger';
import rateLimiter from '@/lib/rateLimiterApi';
import { sendNewMessageNotification } from '@/utils/mail-service';

const prisma = new PrismaClient();

// Säkerhetskonstanter
const WEBHOOK_MIN_SIZE = 100; // Minsta storlek för att vara ett giltigt mail (för att undvika skräppost)
const WEBHOOK_MAX_SIZE = 5 * 1024 * 1024; // 5MB maxgräns
const WEBHOOK_SECRET = process.env.SENDGRID_WEBHOOK_SECRET || 'missing-secret'; // Bör ställas in i miljövariabler

/**
 * Verifierar webhook-signaturen från SendGrid för att säkerställa att förfrågan faktiskt kommer från SendGrid
 */
function verifyWebhookSignature(req: NextApiRequest): boolean {
  // I produktion bör du använda SendGrid's eget signatursystem
  // I denna implementation använder vi ett enkelt token för demo
  const token = req.headers['x-webhook-token'];
  
  // Validera signatur med constant-time jämförelse (för att motverka timing attacks)
  if (typeof token !== 'string') return false;
  return crypto.timingSafeEqual(
    Buffer.from(token), 
    Buffer.from(WEBHOOK_SECRET)
  );
}

/**
 * Extraherar ärende-ID från den inkommande mail-adressen
 * Format: ticket-123@reply.example.com
 */
function extractTicketIdFromEmail(to: string): number | null {
  try {
    // Matcha formatet ticket-123@reply.*
    const match = to.match(/ticket-(\d+)@reply\./i);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return null;
  } catch (error) {
    logger.error('Fel vid extrahering av ticket-ID från email', { error, to });
    return null;
  }
}

/**
 * Hanterar inkommande mail från SendGrid Inbound Parse
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Endast tillåt POST-metod för webhook
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Kontrollera body size-gränser
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength < WEBHOOK_MIN_SIZE || contentLength > WEBHOOK_MAX_SIZE) {
    logger.warn('Inkommande mail avvisat pga storlek', { contentLength });
    return res.status(413).json({ error: 'Payload too large or too small' });
  }

  try {
    // Rate limiting baserat på IP för att förhindra överbelastning
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Verifiera webhook-signaturen
    if (!verifyWebhookSignature(req)) {
      logger.warn('Ogiltig webhook-signatur', { ip: req.socket.remoteAddress });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse SendGrid's inkommande data
    // OBS: SendGrid Inbound Parse skickar multipart/form-data
    // Du behöver hantera detta med en form-parser eller liknande
    // För denna demo antar vi att req.body redan har parserats
    
    const {
      to, // Mottagarens email (ticket-123@reply.example.com)
      from, // Avsändarens email
      subject, // Mailämne
      text, // Textversionen av meddelandet
      html, // HTML-versionen av meddelandet (om tillgänglig)
      attachments, // Eventuella bifogade filer
      headers, // Mail-headers
      envelope, // SMTP envelope information
    } = req.body;
    
    // Logga inkommande mail (med anonymiserad avsändare för GDPR)
    logger.info('Inkommande mail mottaget', {
      from: from.substring(0, 3) + '***@' + from.split('@')[1],
      subject: subject?.substring(0, 30) + (subject?.length > 30 ? '...' : ''),
      hasAttachments: !!attachments,
    });

    // Extrahera ärende-ID från mottagaradressen
    const ticketId = extractTicketIdFromEmail(to);
    if (!ticketId) {
      logger.warn('Kunde inte extrahera ärende-ID från email', { to });
      return res.status(400).json({ error: 'Invalid ticket reference in email address' });
    }

    // Hitta ärendet i databasen
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        customer: true,
        user: true,
        assignedUser: true,
      }
    });

    if (!ticket) {
      logger.warn('Ärende hittades inte', { ticketId });
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Validera att avsändaren matchar kundens email för ärendet
    // Detta är viktigt för att förhindra att någon skickar mail i någon annans namn
    const isFromCustomer = ticket.customer.email.toLowerCase() === from.toLowerCase();
    if (!isFromCustomer) {
      logger.warn('Avsändare matchar inte kund på ärendet', { 
        ticketId,
        customerEmail: ticket.customer.email.substring(0, 3) + '***',
        fromEmail: from.substring(0, 3) + '***',
      });
      return res.status(403).json({ error: 'Email sender does not match customer email' });
    }

    // Använd text eller html för meddelandeinnehåll (föredra text för säkerhet)
    const content = text || html || '';

    // Skapa ett nytt meddelande i databasen
    const message = await prisma.message.create({
      data: {
        ticketId,
        content,
        senderId: null, // Null för kundmeddelanden (senderId är för användarmeddelanden)
        isFromCustomer: true,
        emailFrom: from,
        emailTo: to,
        emailSubject: subject || `Re: Ärende #${ticketId}`,
        emailMessageId: headers['message-id'] || null,
        emailInReplyTo: headers['in-reply-to'] || null,
        emailReferences: headers['references'] || null,
        createdAt: new Date(),
      }
    });

    logger.info('Meddelande sparat från kund', { 
      ticketId, 
      messageId: message.id,
    });

    // Skicka en notifikation till handläggaren om det nya meddelandet
    if (ticket.assignedUser?.email || ticket.user?.email) {
      try {
        await sendNewMessageNotification(
          ticket, 
          message, 
          ticket.assignedUser?.email || ticket.user?.email
        );
        logger.info('Notifikation skickad till handläggare', { 
          ticketId, 
          messageId: message.id,
        });
      } catch (notificationError) {
        logger.error('Fel vid skickande av notifikation', { 
          error: notificationError,
          ticketId, 
          messageId: message.id,
        });
        // Vi fortsätter trots notifikationsfel - meddelandet har sparats
      }
    }

    // Returnera framgång
    return res.status(200).json({ 
      success: true, 
      message: 'Email processed successfully',
      ticketId,
      messageId: message.id
    });

  } catch (error) {
    logger.error('Fel vid hantering av inkommande mail', { error });
    
    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await prisma.$disconnect();
  }
}