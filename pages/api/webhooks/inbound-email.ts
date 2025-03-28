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
 * Format: ticket-123@reply.servicedrive.se
 */
function extractTicketIdFromEmail(to: string): number | null {
  try {
    // Normalisera adressen först (lowercase och trimma)
    const normalizedTo = to.trim().toLowerCase();
    
    // Använd ett mer generöst uttryck som matchar flera möjliga domäner
    // Detta möjliggör för testning med olika domäner men ändå tar ticket-ID:t
    const match = normalizedTo.match(/^ticket-(\d+)@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/);
    
    if (match && match[1]) {
      const ticketId = parseInt(match[1], 10);
      
      // Validera att det är ett rimligt ärende-ID (inte för stort)
      if (ticketId > 0 && ticketId < 10000000) {
        return ticketId;
      }
    }
    
    // Loggning av ogiltiga adresser
    logger.warn('Ogiltigt format på mottagaradress - ska vara ticket-{id}@reply.domain.com', { 
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
  // Generera en unik request-ID för spårning
  const requestId = `mail_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  // Logga alla inkommande headers för felsökning
  logger.debug('Inkommande webhook headers', {
    requestId,
    headers: Object.keys(req.headers),
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length']
  });
  
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
      logger.warn('Ogiltig webhook-signatur', { 
        ip: req.socket.remoteAddress,
        requestId 
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse form data från SendGrid
    let fields, files;
    try {
      const formData = await parseFormData(req);
      fields = formData.fields;
      files = formData.files;
      
      // Logga för felsökning
      logger.debug('Inkommande data parsing lyckades', {
        requestId,
        fieldKeys: Object.keys(fields),
        hasTo: !!fields.to,
        hasFrom: !!fields.from,
        hasSubject: !!fields.subject,
        hasText: !!fields.text,
        hasHTML: !!fields.html,
        fileCount: Object.keys(files).length
      });
    } catch (parseError) {
      logger.error('Kunde inte parsa form data', { 
        error: parseError, 
        requestId 
      });
      return res.status(400).json({ error: 'Invalid form data' });
    }
    
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
      logger.warn('Kunde inte parsa headers', { 
        error: e, 
        requestId 
      });
      headers = {};
    }
    
    // Logga inkommande mail (med anonymiserad avsändare för GDPR)
    logger.info('Inkommande mail mottaget', {
      from: from ? (from.substring(0, 3) + '***@' + from.split('@')[1]) : 'unknown',
      to: to ? (to.substring(0, 3) + '***@' + to.split('@')[1]) : 'unknown',
      subject: subject?.substring(0, 30) + (subject?.length > 30 ? '...' : ''),
      hasAttachments: Object.keys(files).length > 0,
      requestId
    });

    // Extrahera ärende-ID från mottagaradressen
    const ticketId = extractTicketIdFromEmail(to);
    if (!ticketId) {
      logger.warn('Kunde inte extrahera ärende-ID från email', { 
        to: to ? (to.substring(0, 3) + '***@' + to.split('@')[1]) : 'unknown',
        valid: false,
        reason: 'Ogiltig adress eller format',
        expectedFormat: 'ticket-{id}@reply.domain.com',
        requestId
      });
      return res.status(400).json({ 
        error: 'Invalid ticket reference in email address', 
        message: 'Email måste skickas till en giltig svarsadress i formatet ticket-{id}@reply.domain.com'
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
      logger.warn('Ärende hittades inte', { 
        ticketId, 
        requestId 
      });
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Validera att avsändaren matchar kundens email för ärendet
    // Detta är viktigt för att förhindra att någon skickar mail i någon annans namn
    // Men vi ska vara lite flexibla med jämförelsen (ignorera skiftläge, extra whitespace, etc.)
    
    // Extrahera huvudavsändaradressen från From-fältet (som kan innehålla namn etc.)
    let fromEmail = from.toLowerCase().trim();
    // Om vi har ett namn i From-fältet, extrahera bara mailadressen
    if (fromEmail.includes('<') && fromEmail.includes('>')) {
      const match = fromEmail.match(/<([^>]+)>/);
      if (match && match[1]) {
        fromEmail = match[1].toLowerCase().trim();
      }
    }
    
    const customerEmail = ticket.customer.email.toLowerCase().trim();
    const isFromCustomer = fromEmail === customerEmail;
    
    if (!isFromCustomer) {
      logger.warn('Avsändare matchar inte kund på ärendet', { 
        ticketId,
        customerEmail: customerEmail.substring(0, 3) + '***',
        fromEmail: fromEmail.substring(0, 3) + '***',
        requestId
      });
      
      // För säkerhets skull ger vi dock ett mer generiskt felmeddelande utåt
      return res.status(403).json({ error: 'Email sender does not match customer email' });
    }

    // Använd text eller html för meddelandeinnehåll (föredra text för säkerhet)
    let content = text || html || '';
    
    // Kontrollera om innehållet är för kort (skippa auto-replies, spam, etc.)
    if (content.length < WEBHOOK_MIN_SIZE) {
      logger.warn('Meddelandeinnehåll för kort, kan vara auto-reply eller spam', {
        ticketId,
        contentLength: content.length,
        minLength: WEBHOOK_MIN_SIZE,
        requestId
      });
      
      // Vi godkänner ändå meddelandet, men loggar det som en varning
    }

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
      requestId
    });

    // Skicka en notifikation till handläggaren om det nya meddelandet
    if (ticket.assignedUser?.email || ticket.user?.email) {
      try {
        // Hämta butikens standardavsändaradress om den finns
        const defaultSender = await prisma.senderAddress.findFirst({
          where: {
            storeId: ticket.storeId,
            isDefault: true
          }
        });
        
        // Prioritera mottagare i denna nya ordning:
        // 1. Tilldelad handläggare
        // 2. Butikens standardavsändaradress
        // 3. Användaren som skapade ärendet
        const possibleRecipients = [
          ticket.assignedUser?.email,
          defaultSender?.email,
          ticket.user?.email
        ].filter(Boolean).filter((value, index, self) => self.indexOf(value) === index);
        
        if (possibleRecipients.length > 0) {
          // Använd den första tillgängliga adressen som huvudmottagare
          const primaryRecipient = possibleRecipients[0];
          
          // Skicka notifikationen
          await sendNewMessageNotification(
            ticket, 
            message, 
            primaryRecipient
          );
          
          logger.info('Notifikation skickad till handläggare/mottagare', { 
            ticketId, 
            messageId: message.id,
            recipient: primaryRecipient.substring(0, 2) + '***@' + primaryRecipient.split('@')[1],
            recipientType: primaryRecipient === ticket.assignedUser?.email ? 'assigned_user' : 
                           primaryRecipient === defaultSender?.email ? 'store_default_sender' : 'ticket_creator',
            requestId
          });
        } else {
          logger.warn('Ingen mottagare hittades för kundmeddelande-notifikation', { 
            ticketId, 
            messageId: message.id,
            requestId
          });
        }
      } catch (notificationError) {
        logger.error('Fel vid skickande av notifikation', { 
          error: notificationError instanceof Error ? notificationError.message : 'Okänt fel',
          stack: notificationError instanceof Error ? notificationError.stack?.substring(0, 500) : undefined,
          ticketId, 
          messageId: message.id,
          requestId
        });
        // Vi fortsätter trots notifikationsfel - meddelandet har sparats
      }
    }

    // Returnera framgång
    return res.status(200).json({ 
      success: true, 
      message: 'Email processed successfully',
      ticketId,
      messageId: message.id,
      requestId
    });

  } catch (error) {
    logger.error('Fel vid hantering av inkommande mail', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined, 
      requestId
    });
    
    if (error.constructor?.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await prisma.$disconnect();
  }
}