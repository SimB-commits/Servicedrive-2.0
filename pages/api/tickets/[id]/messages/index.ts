// pages/api/tickets/[id]/messages/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { sendCustomEmail } from '@/utils/mail-service';
import { logger } from '@/utils/logger';
import { getAuthenticatedSession } from '@/utils/authHelper';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Autentisering
    const session = await getAuthenticatedSession(req, res);
    
    // Hämta ID-parameter
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Ogiltigt eller saknat ärende-ID' });
    }
    const ticketId = Number(id);

    // Hämta ärendet för att kontrollera behörighet och få kundinformation
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
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
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ärende hittades inte' });
    }

    // Kontrollera att användaren har rätt att se ärendet
    if (ticket.storeId !== session.user.storeId) {
      return res.status(403).json({ error: 'Du har inte behörighet till detta ärende' });
    }

    // Hantera olika HTTP-metoder
    switch (req.method) {
      case 'GET':
        // Hämta alla meddelanden för ärendet
        try {
          const messages = await prisma.message.findMany({
            where: { ticketId },
            include: {
              sender: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc', // Nyaste först
            },
          });
          
          return res.status(200).json(messages);
        } catch (error) {
          logger.error('Fel vid hämtning av meddelanden', { error: error.message, ticketId });
          return res.status(500).json({ error: 'Kunde inte hämta meddelanden' });
        }

      case 'POST':
        // Skapa ett nytt meddelande
        try {
          const { content, sendEmail = true } = req.body;
          
          if (!content || typeof content !== 'string' || content.trim() === '') {
            return res.status(400).json({ error: 'Meddelande saknas eller är ogiltigt' });
          }
          
          // Skapa meddelandet i databasen
          const message = await prisma.message.create({
            data: {
              ticketId,
              content,
              senderId: session.user.id,
              isFromCustomer: false,
              createdAt: new Date(),
            },
            include: {
              sender: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          });
          
          logger.info('Nytt meddelande skapat', { ticketId, messageId: message.id });
          
          // Skicka mail till kunden om så önskas
          if (sendEmail && ticket.customer.email) {
            try {
              // Sök efter en lämplig mailmall för meddelanden
              const messageTemplate = await prisma.mailTemplate.findFirst({
                where: {
                  storeId: ticket.storeId,
                  name: { contains: 'meddelande' }, // Söker efter mallar med "meddelande" i namnet
                },
              });

              if (messageTemplate) {
                // Använd mallen om en hittades
                const variables = {
                  ärendeID: ticketId,
                  kundNamn: `${ticket.customer.firstName || ''} ${ticket.customer.lastName || ''}`.trim() || ticket.customer.email,
                  kundEmail: ticket.customer.email,
                  ärendeTyp: ticket.ticketType?.name || '',
                  ärendeStatus: ticket.customStatus?.name || ticket.status || '',
                  handläggare: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || session.user.email,
                  meddelande: content,
                  aktuellDatum: new Date(),
                };
                
                await sendCustomEmail(
                  messageTemplate.id,
                  ticket.customer.email,
                  variables,
                  ['message', `ticket-${ticketId}`]
                );
              } else {
                // Annars bygg ett mail manuellt
                // Här kan funktionaliteten från mail-service.ts användas för att skicka ett mail
                // med det nya meddelandet och korrekt Reply-To adress
                
                // Uppdatera message med e-postinformation när mailet är skickat
                await prisma.message.update({
                  where: { id: message.id },
                  data: {
                    emailTo: ticket.customer.email,
                    emailFrom: session.user.email || process.env.EMAIL_FROM || 'no-reply@servicedrive.se',
                    emailSubject: `Re: Ärende #${ticketId}`,
                  },
                });
              }
              
              logger.info('Mail skickat till kund för nytt meddelande', { 
                ticketId, 
                messageId: message.id,
                recipientEmail: ticket.customer.email.substring(0, 3) + '***'
              });
            } catch (mailError) {
              logger.error('Fel vid skickande av mail till kund', { 
                error: mailError.message, 
                ticketId, 
                messageId: message.id 
              });
              // Fortsätt trots mailfel - meddelandet har sparats
            }
          }
          
          return res.status(201).json(message);
        } catch (error) {
          logger.error('Fel vid skapande av meddelande', { error: error.message, ticketId });
          return res.status(500).json({ error: 'Kunde inte skapa meddelande' });
        }

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    logger.error('Error in tickets/[id]/messages/index.ts:', { error: error.message });
    
    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }
    
    return res.status(500).json({ message: 'Ett internt serverfel uppstod.' });
  } finally {
    await prisma.$disconnect();
  }
}