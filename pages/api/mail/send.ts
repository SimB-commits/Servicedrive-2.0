// pages/api/mail/send.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { sendEmail, buildEmailFromTemplate, TemplateVariables } from '@/utils/sendgrid';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate Limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Autentisering
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Endast tillåt POST för mailsändning
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // Validera input
    const { 
      templateId,
      ticketId,
      toEmail, 
      customVariables 
    } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: 'Mail-mallens ID krävs' });
    }

    if (!ticketId && !toEmail) {
      return res.status(400).json({ error: 'Antingen ticketId eller toEmail måste anges' });
    }
    
    // Hämta mail-mallen
    const template = await prisma.mailTemplate.findUnique({
      where: { id: Number(templateId) },
    });

    if (!template) {
      return res.status(404).json({ error: 'Mail-mall hittades inte' });
    }

    // Kontrollera att mallen tillhör användarens butik
    if (template.storeId !== session.user.storeId) {
      return res.status(403).json({ error: 'Mail-mallen tillhör inte din butik' });
    }

    let emailData;
    let variables: TemplateVariables = {};
    let recipientEmail: string;

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
        return res.status(404).json({ error: 'Ärende hittades inte' });
      }

      // Kontrollera att ärendet tillhör användarens butik
      if (ticket.storeId !== session.user.storeId) {
        return res.status(403).json({ error: 'Ärendet tillhör inte din butik' });
      }

      // Sätt mottagaradress från kundens e-post
      recipientEmail = ticket.customer.email;

      // Bygger variabeldata från ärendet
      variables = {
        ärendeID: ticket.id,
        kundNamn: `${ticket.customer.firstName || ''} ${ticket.customer.lastName || ''}`.trim() || ticket.customer.email,
        kundEmail: ticket.customer.email,
        ärendeTyp: ticket.ticketType?.name || '',
        ärendeStatus: ticket.customStatus?.name || ticket.status || '',
        ärendeDatum: ticket.createdAt,
        företagsNamn: process.env.COMPANY_NAME || '',
        // Formatera varnlig deadline om det finns
        deadline: ticket.dueDate || '',
        // Inkludera alla dynamiska fält
        ...(typeof ticket.dynamicFields === 'object' && ticket.dynamicFields !== null
          ? ticket.dynamicFields
          : {}
        ),
        // Lägg till anpassade variabler som skickats med
        ...customVariables
      };
    } else {
      // Använd angivna to-adress och anpassade variabler
      recipientEmail = toEmail;
      variables = {
        ...customVariables,
        företagsNamn: process.env.COMPANY_NAME || '',
      };
    }

    // Bygg emailet baserat på mall och variabler
    emailData = buildEmailFromTemplate(
      template,
      variables,
      recipientEmail,
      process.env.EMAIL_FROM || `no-reply@${req.headers.host}`
    );

    // Skicka emailet
    const [response] = await sendEmail(emailData);
    
    // Logga att vi skickat mailet (kan utökas med en Email-tabell i databasen)
    console.log(`Email skickat till ${recipientEmail} med mall "${template.name}"`);

    // Returnera framgång
    return res.status(200).json({ 
      success: true, 
      messageId: response.headers['x-message-id'],
      message: 'Email skickat' 
    });
  } catch (error: any) {
    console.error('Fel vid skickande av mail:', error.message);

    // Check för SendGrid-specifika fel
    if (error.response && error.response.body) {
      return res.status(error.code || 500).json({ 
        error: 'Fel vid skickande av mail', 
        details: error.response.body.errors 
      });
    }

    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }

    return res.status(500).json({ 
      error: 'Fel vid skickande av mail', 
      message: error.message 
    });
  } finally {
    await prisma.$disconnect();
  }
}
