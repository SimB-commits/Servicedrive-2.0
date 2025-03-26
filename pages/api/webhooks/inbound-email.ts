// pages/api/webhooks/inbound-email.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { logger } from '@/utils/logger';
import rateLimiter from '@/lib/rateLimiterApi';
import { sendNewMessageNotification } from '@/utils/mail-service';
import formidable from 'formidable';
import { IncomingForm } from 'formidable';

// Konfigurera NextJS att inte använda bodyParser för denna route
export const config = {
  api: {
    bodyParser: false,
  },
};

const prisma = new PrismaClient();

// Säkerhetskonstanter
const WEBHOOK_MIN_SIZE = 100; // Minsta storlek för att vara ett giltigt mail (för att undvika skräppost)
const WEBHOOK_MAX_SIZE = 5 * 1024 * 1024; // 5MB maxgräns
const WEBHOOK_SECRET = process.env.SENDGRID_WEBHOOK_SECRET || 'missing-secret'; // Bör ställas in i miljövariabler

/**
 * Verifierar webhook-signaturen från SendGrid enligt SendGrid's dokumentation
 * https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook#security
 */
function verifyWebhookSignature(req: NextApiRequest): boolean {
  // I produktion bör vi använda SendGrid's egna signaturverifikation
  if (process.env.NODE_ENV !== 'production') {
    logger.info('Utvecklingsläge: Skippar webhook-verifiering');
    return true;
  }
  
  const signature = req.headers['x-sendgrid-signature'] as string;
  const timestamp = req.headers['x-sendgrid-request-timestamp'] as string;
  
  // Kontrollera att nödvändiga headers finns
  if (!signature || !timestamp) {
    logger.warn('Webhook saknar nödvändiga headers för verifiering', {
      hasSignature: !!signature,
      hasTimestamp: !!timestamp
    });
    return false;
  }
  
  // Validera att timestamp är rimligt (förhindra replay-attacker)
  const requestTime = parseInt(timestamp, 10);
  const currentTime = Math.floor(Date.now() / 1000);
  
  // Avvisa förfrågningar som är äldre än 5 minuter
  if (isNaN(requestTime) || (currentTime - requestTime) > 300) {
    logger.warn('Webhook-timestamp är för gammalt eller ogiltigt', {
      timestamp,
      currentTime,
      diff: currentTime - requestTime
    });
    return false;
  }
  
  try {
    // Skapa verifikationssträng enligt SendGrid's dokumentation
    // concatenate timestamp + webhook_token
    const verificationString = timestamp + WEBHOOK_SECRET;
    
    // Beräkna förväntad signature med HMAC-SHA256
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(verificationString, 'utf8')
      .digest('hex');
    
    // Jämför med konstant-tid för att förhindra timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    );
  } catch (error) {
    logger.error('Fel vid webhook signaturverifiering', { error });
    return false;
  }
}

/**
 * Extraherar ärende-ID från den inkommande mail-adressen
 * Format: ticket-123@reply.example.com
 */
function extractTicketIdFromEmail(to: string): number | null {
  try {
    // Normalisera adressen först (lowercase och trimma)
    const normalizedTo = to.trim().toLowerCase();
    
    // Använd ett exakt mönster som endast matchar standarddomänen
    // STANDARDISERING: Matchar nu endast formatet ticket-{id}@reply.servicedrive.se
    const match = normalizedTo.match(/^ticket-(\d+)@reply\.servicedrive\.se$/);
    
    if (match && match[1]) {
      const ticketId = parseInt(match[1], 10);
      
      // Validera att det är ett rimligt ärende-ID (inte för stort)
      if (ticketId > 0 && ticketId < 10000000) {
        return ticketId;
      }
    }
    
    // Loggning av ogiltiga adresser ger nu mer specifik vägledning
    logger.warn('Ogiltigt format på mottagaradress - ska vara ticket-{id}@reply.servicedrive.se', { 
      to: normalizedTo,
      valid: false,
      reason: 'format_mismatch'
    });
    return null;
  } catch (error) {
    logger.error('Fel vid extrahering av ticket-ID från email', { error, to });
    return null;
  }
}

/**
 * Parsea inkommande formdata från SendGrid
 */
const parseFormData = (req: NextApiRequest): Promise<{ fields: formidable.Fields, files: formidable.Files }> => {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      maxFileSize: WEBHOOK_MAX_SIZE, // Maximal filstorlek
      keepExtensions: true,         // Behåll filändelser
      allowEmptyFiles: false,       // Tillåt inte tomma filer
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ fields, files });
    });
  });
};

/**
 * Hanterar inkommande mail från SendGrid Inbound Parse
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Endast tillåt POST-metod för webhook
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // Rate limiting baserat på IP för att förhindra överbelastning
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Verifiera webhook-signaturen
    if (!verifyWebhookSignature(req)) {
      logger.warn('Ogiltig webhook-signatur', { ip: req.socket.remoteAddress });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse form data från SendGrid
    const { fields, files } = await parseFormData(req);
    
    // Extrahera relevanta fält från formdata
    // SendGrid skickar alla värden som arrayer, ta första värdet
    const to = fields.to?.[0] || '';
    const from = fields.from?.[0] || '';
    const subject = fields.subject?.[0] || '';
    const text = fields.text?.[0] || '';
    const html = fields.html?.[0] || '';
    
    // Headers kommer som en JSON-sträng, parsa den
    let headers = {};
    try {
      const headersString = fields.headers?.[0] || '{}';
      headers = JSON.parse(headersString);
    } catch (e) {
      logger.warn('Kunde inte parsa headers', { error: e });
      headers = {};
    }
    
    // Construct envelope (if available)
    let envelope = {};
    try {
      const envelopeString = fields.envelope?.[0] || '{}';
      envelope = JSON.parse(envelopeString);
    } catch (e) {
      logger.warn('Kunde inte parsa envelope', { error: e });
      envelope = {};
    }
    
    // Hantera bifogade filer (om sådana finns)
    const attachments = Object.values(files).map(file => {
      if (Array.isArray(file)) {
        return file[0]; // Om det är en array, ta första filen
      }
      return file;
    });
    
    // Logga inkommande mail (med anonymiserad avsändare för GDPR)
    logger.info('Inkommande mail mottaget', {
      from: from.substring(0, 3) + '***@' + from.split('@')[1],
      subject: subject?.substring(0, 30) + (subject?.length > 30 ? '...' : ''),
      hasAttachments: attachments.length > 0,
    });

    // Extrahera ärende-ID från mottagaradressen
    const ticketId = extractTicketIdFromEmail(to);
      if (!ticketId) {
        logger.warn('Kunde inte extrahera ärende-ID från email', { 
          to: to.substring(0, 3) + '***@' + to.split('@')[1],
          valid: false,
          reason: 'Ogiltig adress eller domän',
          expectedFormat: 'ticket-{id}@reply.servicedrive.se'
        });
        return res.status(400).json({ 
          error: 'Invalid ticket reference in email address', 
          message: 'Email måste skickas till en giltig svarsadress i formatet ticket-{id}@reply.servicedrive.se'
        });
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
    
    if (error.constructor?.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await prisma.$disconnect();
  }
}