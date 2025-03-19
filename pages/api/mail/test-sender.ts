// pages/api/mail/test-sender.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import { sendEmail, validateSenderEmail } from '@/utils/sendgrid';
import rateLimiter from '@/lib/rateLimiterApi';
import { logger } from '@/utils/logger';
import { z } from 'zod';

const prisma = new PrismaClient();

// Valideringsschema för testmail
const testMailSchema = z.object({
  senderId: z.number().optional(),
  email: z.string().email('Ogiltig e-postadress').optional(),
  customEmail: z.string().email('Ogiltig e-postadress').optional()
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate Limiting
    const ip = req.socket.remoteAddress || 'unknown';
    await rateLimiter.consume(ip);

    // Autentisering - endast inloggade användare med ADMIN-roll
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Kontrollera att butik finns i sessionen
    if (!session.user.storeId) {
      return res.status(400).json({ error: 'Ingen butik vald' });
    }
    
    const storeId = session.user.storeId;

    // Endast POST-metod är tillåten
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // Validera inkommande data
    const parseResult = testMailSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return res.status(400).json({ message: 'Valideringsfel', errors });
    }

    const { senderId, email, customEmail } = parseResult.data;

    // Mottagaradress är antingen den angivna eller användarens
    const recipientEmail = customEmail || session.user.email;
    
    if (!recipientEmail) {
      return res.status(400).json({ error: 'Ingen mottagaradress tillgänglig' });
    }

    // Hämta avsändaradress baserat på senderId eller använd standardadressen
    let senderEmail = '';
    let senderName = '';

    if (senderId) {
      // Hämta specifik avsändaradress från databasen
      const sender = await prisma.senderAddress.findFirst({
        where: {
          id: senderId,
          storeId
        }
      });

      if (!sender) {
        return res.status(404).json({ error: 'Avsändaradressen hittades inte' });
      }

      senderEmail = sender.email;
      senderName = sender.name || '';
    } else if (email) {
      // Använd angiven e-post
      const validation = validateSenderEmail(email);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.reason });
      }

      senderEmail = email;
    } else {
      // Hämta standardavsändaren för butiken
      const defaultSender = await prisma.senderAddress.findFirst({
        where: {
          storeId,
          isDefault: true
        }
      });

      if (defaultSender) {
        senderEmail = defaultSender.email;
        senderName = defaultSender.name || '';
      } else {
        // Ingen standardavsändare hittades
        return res.status(400).json({ 
          error: 'Ingen standardavsändare konfigurerad',
          message: 'Du behöver ange en avsändaradress eller konfigurera en standardavsändare'
        });
      }
    }

    // Formatera avsändaradress med namn om det finns
    const fromAddress = senderName ? `${senderName} <${senderEmail}>` : senderEmail;

    // Skapa HTML-innehåll för testmailet
    const htmlContent = `
      <h1>Test av standardavsändare</h1>
      <p>Detta mail bekräftar att din konfiguration för avsändaradress fungerar!</p>
      <p>Mail skickat från: <strong>${fromAddress}</strong></p>
      <p>Datum och tid: ${new Date().toLocaleString('sv-SE')}</p>
      <hr>
      <p>Detta är ett testmail från Servicedrive för att verifiera att din avsändaradress fungerar korrekt.</p>
    `;

    // Skicka testmail
    try {
      const result = await sendEmail({
        to: recipientEmail,
        from: fromAddress,
        subject: 'Test av standardavsändare från Servicedrive',
        html: htmlContent,
        text: 'Detta mail bekräftar att din konfiguration för avsändaradress fungerar!',
        categories: ['test', 'sender-test']
      });

      logger.info('Testmail för avsändaradress skickat', {
        sender: senderEmail.split('@')[0].substring(0, 2) + '***@' + senderEmail.split('@')[1],
        recipient: recipientEmail.split('@')[0].substring(0, 2) + '***@' + recipientEmail.split('@')[1],
        storeId
      });

      return res.status(200).json({
        success: true,
        message: 'Testmail skickat!',
        details: {
          sender: fromAddress,
          recipient: recipientEmail,
          messageId: result[0]?.headers['x-message-id'],
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Fel vid skickande av testmail för avsändaradress', {
        error: error.message,
        sender: senderEmail,
        storeId
      });

      return res.status(500).json({
        error: 'Kunde inte skicka testmail',
        message: error.message,
        help: 'Kontrollera att avsändaradressen är korrekt och verifierad.'
      });
    }
  } catch (error: any) {
    logger.error('Error in mail/test-sender.ts:', { 
      error: error.message,
      stack: error.stack?.substring(0, 500) 
    });

    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }

    return res.status(500).json({ message: 'Ett internt serverfel uppstod.' });
  } finally {
    await prisma.$disconnect();
  }
}