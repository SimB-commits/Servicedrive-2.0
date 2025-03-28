// pages/api/webhooks/test-inbound-email.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import rateLimiter from '@/lib/rateLimiterApi';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import { sendNewMessageNotification } from '@/utils/mail-service';

const prisma = new PrismaClient();

/**
 * Förbättrad testendpoint för att simulera inkommande mail från SendGrid
 * Inkluderar nu testning av notifikationsmail till handläggare/användare
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Verifiera att användaren är autentiserad och admin
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Endast tillåt POST-metod
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // Validera indata
    const { ticketId, content, subject, testNotification = true } = req.body;
    
    if (!ticketId || isNaN(parseInt(ticketId))) {
      return res.status(400).json({ error: 'ticketId krävs och måste vara ett nummer' });
    }
    
    if (!content) {
      return res.status(400).json({ error: 'content krävs' });
    }

    // Hämta ärendet med all information vi behöver för notifikationstestning
    const ticket = await prisma.ticket.findUnique({
      where: { id: parseInt(ticketId) },
      include: {
        customer: true,
        ticketType: true,
        customStatus: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            email: true, 
            firstName: true,
            lastName: true,
          },
        },
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ärende hittades inte' });
    }

    // Skapa ett nytt meddelande i databasen som simulerar ett kundmail
    const message = await prisma.message.create({
      data: {
        ticketId: parseInt(ticketId),
        content,
        senderId: null, // null för kundmeddelanden
        isFromCustomer: true,
        emailFrom: ticket.customer.email,
        emailTo: `ticket-${ticketId}@reply.servicedrive.se`,
        emailSubject: subject || `Re: Ärende #${ticketId}`,
        emailMessageId: `test-${Date.now()}@reply.servicedrive.se`,
        createdAt: new Date(),
      }
    });

    logger.info('Test-meddelande skapat för att simulera kundmail', { 
      ticketId, 
      messageId: message.id,
      testMode: true
    });

    let notificationResult = null;

    // Om testNotification är sant, testa också notifikationsmail
    if (testNotification) {
      try {
        // Hämta butikens standardavsändaradress om den finns
        const defaultSender = await prisma.senderAddress.findFirst({
          where: {
            storeId: ticket.storeId,
            isDefault: true
          }
        });
        
        // Prioriterade mottagare (samma ordning som i den uppdaterade riktiga implementationen)
        const possibleRecipients = [
          ticket.assignedUser?.email,
          defaultSender?.email,
          ticket.user?.email,
          session.user.email // Lägg till den inloggade användaren för testning som sista alternativ
        ].filter(Boolean).filter((value, index, self) => self.indexOf(value) === index);
        
        // Lägg till information om viken typ av mottagare som valdes
        let recipientType = 'unknown';
        
        // Om vi har minst en mottagare, skicka notifikationen
        if (possibleRecipients.length > 0) {
          // Använd den första tillgängliga adressen som huvudmottagare
          const primaryRecipient = possibleRecipients[0];
          
          // Bestäm vilken typ av mottagare det är (för loggning/testning)
          if (primaryRecipient === ticket.assignedUser?.email) {
            recipientType = 'assigned_user';
          } else if (primaryRecipient === defaultSender?.email) {
            recipientType = 'store_default_sender';
          } else if (primaryRecipient === ticket.user?.email) {
            recipientType = 'ticket_creator';
          } else if (primaryRecipient === session.user.email) {
            recipientType = 'current_user';
          }
          
          // Skicka notifikationen med vår förbättrade funktion
          const notification = await sendNewMessageNotification(
            ticket, 
            message, 
            primaryRecipient
          );
          
          notificationResult = {
            success: true,
            recipient: primaryRecipient,
            recipientType: recipientType,
            truncatedRecipient: primaryRecipient.split('@')[0].substring(0, 2) + '***@' + primaryRecipient.split('@')[1],
            messageId: notification?.headers?.['x-message-id'] || 'unknown'
          };
          
          logger.info('Testnotifikation skickad', { 
            ticketId, 
            messageId: message.id,
            notificationId: notificationResult.messageId,
            recipient: notificationResult.truncatedRecipient,
            recipientType: recipientType,
            testMode: true
          });
        } else {
          notificationResult = {
            success: false,
            reason: 'Ingen mottagare hittades (varken handläggare, standardavsändare eller skapare)'
          };
        }
      } catch (error) {
        logger.error('Fel vid testning av notifikation', {
          error: error instanceof Error ? error.message : 'Okänt fel',
          ticketId,
          messageId: message.id,
          testMode: true
        });
        
        notificationResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Okänt fel'
        };
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Simulerat mail sparat',
      ticketId,
      messageId: message.id,
      customerEmail: ticket.customer.email,
      notificationResult: notificationResult
    });
  } catch (error) {
    logger.error('Fel vid simulering av inkommande mail', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await prisma.$disconnect();
  }
}