// pages/api/mail/send.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { sendCustomEmail } from '@/utils/mail-service';
import { logger } from '@/utils/logger';
import { validateSenderEmail } from '@/utils/sendgrid';
import { TemplateVariables } from '@/utils/sendgrid';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Generera en unik request-ID för spårning genom hela flödet
  const requestId = `mail_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  
  try {
    // Rate Limiting - skyddar mot överbelastning
    const ip = req.socket.remoteAddress || (
      Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for']
    ) || 'unknown';
    
    await rateLimiter.consume(ip);
    logger.debug(`Rate limiter passed`, { requestId, ip: ip.substring(0, 3) + '***' });

    // Autentisering - kontrollera att användaren är inloggad
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      logger.warn(`Unauthorized mail send attempt`, { requestId });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Endast tillåt POST för mailsändning
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      logger.warn(`Method ${req.method} not allowed`, { requestId });
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // Validera input - säkerhet och robusthet
    const { 
      templateId,
      ticketId,
      toEmail, 
      customVariables,
      fromEmail,
      fromName
    } = req.body;

    // Kontrollera obligatoriska fält
    if (!templateId) {
      logger.warn(`Missing templateId in request`, { requestId });
      return res.status(400).json({ error: 'Mail-mallens ID krävs' });
    }

    if (!ticketId && !toEmail) {
      logger.warn(`Missing recipient information`, { requestId });
      return res.status(400).json({ error: 'Antingen ticketId eller toEmail måste anges' });
    }
    
    // Validera e-postadress om den är angiven
    if (toEmail && !/^\S+@\S+\.\S+$/.test(toEmail)) {
      logger.warn(`Invalid email format`, { requestId });
      return res.status(400).json({ error: 'Ogiltig e-postadress' });
    }
    
    // Validera avsändaradress om den är angiven
    if (fromEmail) {
      const validation = validateSenderEmail(fromEmail);
      if (!validation.valid) {
        logger.warn(`Invalid sender email format`, { requestId, reason: validation.reason });
        return res.status(400).json({ error: `Ogiltig avsändaradress: ${validation.reason}` });
      }
    }
    
    // Validera anpassade variabler är i rätt format
    if (customVariables && typeof customVariables !== 'object') {
      logger.warn(`Invalid custom variables format`, { requestId });
      return res.status(400).json({ error: 'Anpassade variabler måste vara ett objekt' });
    }
    
    // Hämta mail-mallen
    const template = await prisma.mailTemplate.findUnique({
      where: { id: Number(templateId) },
    });

    if (!template) {
      logger.warn(`Template not found: ${templateId}`, { requestId });
      return res.status(404).json({ error: 'Mail-mall hittades inte' });
    }

    // Kontrollera att mallen tillhör användarens butik
    if (template.storeId !== session.user.storeId) {
      logger.warn(`Template belongs to different store`, { 
        requestId, 
        templateId, 
        templateStoreId: template.storeId, 
        userStoreId: session.user.storeId 
      });
      return res.status(403).json({ error: 'Mail-mallen tillhör inte din butik' });
    }

    let recipientEmail: string;
    let variables: TemplateVariables = {
      företagsNamn: process.env.COMPANY_NAME || '',
      ...customVariables
    };
    let categories = ['manual-send', `user-${session.user.id}`];

    // Om ticketId finns, hämta ärendedata för variabler
    if (ticketId) {
      const ticket = await prisma.ticket.findUnique({
        where: { id: Number(ticketId) },
        include: {
          customer: true,
          ticketType: true,
          customStatus: true,
          user: true,
          assignedUser: true,
        }
      });

      if (!ticket) {
        logger.warn(`Ticket not found: ${ticketId}`, { requestId });
        return res.status(404).json({ error: 'Ärende hittades inte' });
      }

      // Kontrollera att ärendet tillhör användarens butik
      if (ticket.storeId !== session.user.storeId) {
        logger.warn(`Ticket belongs to different store`, { requestId });
        return res.status(403).json({ error: 'Ärendet tillhör inte din butik' });
      }

      // Sätt mottagaradress från kundens e-post
      recipientEmail = ticket.customer.email;
      
      // Lägg till kategorier för spårning
      categories.push(`ticket-${ticket.id}`);

      // Bygg variabeldata från ärendet
      variables = {
        ...variables,
        ärendeID: ticket.id,
        kundNamn: `${ticket.customer.firstName || ''} ${ticket.customer.lastName || ''}`.trim() || ticket.customer.email,
        kundEmail: ticket.customer.email,
        ärendeTyp: ticket.ticketType?.name || '',
        ärendeStatus: ticket.customStatus?.name || ticket.status || '',
        ärendeDatum: ticket.createdAt,
        deadline: ticket.dueDate || '',
        // Inkludera alla dynamiska fält
        ...(typeof ticket.dynamicFields === 'object' && ticket.dynamicFields !== null
          ? ticket.dynamicFields
          : {}
        )
      };
    } else {
      // Använd angiven to-adress
      recipientEmail = toEmail;
    }

    // Hämta avsändaradress från databasen om ett ID är angivet
    let senderEmail = fromEmail;
    let senderName = fromName;

    if (!senderEmail && session.user.storeId) {
      // Försök hitta standardavsändaren för denna butik
      const defaultSender = await prisma.senderAddress.findFirst({
        where: {
          storeId: session.user.storeId,
          isDefault: true
        }
      });

      if (defaultSender) {
        senderEmail = defaultSender.email;
        senderName = defaultSender.name || undefined;
      }
    }

    // Skicka emailet via vår service
    logger.info(`Sending email via API request`, { 
      requestId,
      templateId,
      ticketId: ticketId || null,
      userId: session.user.id,
      fromEmail: senderEmail ? senderEmail.split('@')[0].substring(0, 2) + '***@' + senderEmail.split('@')[1] : 'default',
      hasFromName: !!senderName
    });
    
    const response = await sendCustomEmail(
      Number(templateId),
      recipientEmail,
      variables,
      categories,
      senderEmail,
      senderName
    );
    
    // Lagra information om mailet i databasen (om önskat)
    /*
    await prisma.emailLog.create({
      data: {
        userId: session.user.id,
        ticketId: ticketId ? Number(ticketId) : null,
        emailType: 'MANUAL',
        templateId: Number(templateId),
        recipientEmail,
        sentAt: new Date(),
        messageId: response.headers['x-message-id'] || undefined
      }
    });
    */
    
    // Returnera framgång
    return res.status(200).json({ 
      success: true, 
      messageId: response.headers['x-message-id'],
      message: 'Email skickat' 
    });
  } catch (error: any) {
    // Strukturerad felhantering och loggning
    logger.error(`Error sending email via API`, { 
      requestId, 
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });

    // Hantera olika typer av fel
    if (error.response && error.response.body) {
      // SendGrid-specifika fel
      const sendgridErrors = error.response.body.errors || [];
      
      // Felkod 4xx -> Klientfel, 5xx -> Serverfel
      const statusCode = error.code >= 500 ? 500 : error.code >= 400 ? error.code : 500;
      
      return res.status(statusCode).json({ 
        error: 'Fel vid skickande av mail', 
        details: sendgridErrors.map((e: any) => e.message).join(', ')
      });
    }

    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }

    // Generiska fel
    return res.status(500).json({ 
      error: 'Fel vid skickande av mail', 
      message: process.env.NODE_ENV === 'production' 
        ? 'Ett internt serverfel inträffade' 
        : error.message 
    });
  } finally {
    await prisma.$disconnect();
  }
}