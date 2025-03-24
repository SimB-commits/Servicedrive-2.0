// pages/api/tickets/[id]/messages/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { sendCustomEmail, sendEmail } from '@/utils/mail-service';
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
          logger.error('Fel vid hämtning av meddelanden', { 
            error: error instanceof Error ? error.message : 'Okänt fel', 
            ticketId 
          });
          return res.status(500).json({ error: 'Kunde inte hämta meddelanden' });
        }

      case 'POST':
        // Skapa ett nytt meddelande
        try {
          const { content, sendEmail: shouldSendEmail = true } = req.body;
          
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
          if (shouldSendEmail && ticket.customer.email) {
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
                  handläggare: `${session.user.firstName || ''}`.trim() || session.user.email,
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
                // Bygg ett enkelt mail manuellt om ingen mall finns
                const senderName = `${session.user.firstName || ''}`.trim() || 
                                    session.user.email || 'Servicedrive';
                const senderEmail = session.user.email || process.env.EMAIL_FROM || 'no-reply@servicedrive.se';
                
                // Hitta din standard avsändaradress
                const defaultSender = await prisma.senderAddress.findFirst({
                  where: {
                    storeId: ticket.storeId,
                    isDefault: true
                  }
                });
                
                // Använd standardavsändaren om den finns
                const fromEmail = defaultSender?.email || senderEmail;
                const fromName = defaultSender?.name || senderName;
                
                // Extrahera domänen för reply-to adress
                const domain = fromEmail.split('@')[1];
                const domainParts = domain.split('.');
                const replyDomain = domainParts.length >= 2 
                  ? `reply.${domainParts.slice(-2).join('.')}` 
                  : process.env.REPLY_DOMAIN || 'reply.servicedrive.se';
                
                // Skapa reply-to adress
                const replyTo = `ticket-${ticketId}@${replyDomain}`;
                
                // Bygg mail-innehållet
                const subject = `Re: Ärende #${ticketId}`;
                const htmlContent = `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Meddelande angående ärende #${ticketId}</h2>
                    
                    <div style="padding: 15px; border-left: 4px solid #4a90e2; background-color: #f8f9fa; margin: 20px 0;">
                      ${content}
                    </div>
                    
                    <p>Vänliga hälsningar,<br>${senderName}</p>
                    
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #666; font-size: 12px;">
                      Detta mail har skickats från Servicedrive ärendehanteringssystem.
                      Du kan svara direkt på detta mail för att besvara ärendet.
                    </p>
                  </div>
                `;
                
                // Sätt upp e-postdata
                const emailData = {
                  to: ticket.customer.email,
                  from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
                  subject: subject,
                  html: htmlContent,
                  text: content,
                  replyTo: replyTo,
                  headers: {
                    'X-Ticket-ID': `${ticketId}`,
                    'X-Auto-Response-Suppress': 'OOF, AutoReply',
                  },
                  categories: ['message', `ticket-${ticketId}`]
                };
                
                try {
                  // Skicka mailet
                  const [response] = await sendEmail(emailData);
                  
                  // Uppdatera message med e-postinformation
                  await prisma.message.update({
                    where: { id: message.id },
                    data: {
                      emailTo: ticket.customer.email,
                      emailFrom: fromEmail,
                      emailSubject: subject,
                      emailMessageId: response.headers['x-message-id'],
                      emailReplyTo: replyTo
                    },
                  });
                  
                  logger.info('Mail skickat manuellt till kund för nytt meddelande', { 
                    ticketId, 
                    messageId: message.id,
                    recipientEmail: ticket.customer.email.substring(0, 3) + '***'
                  });
                } catch (mailError) {
                  logger.error('Fel vid skickande av mail till kund', { 
                    error: mailError instanceof Error ? mailError.message : 'Okänt fel', 
                    ticketId, 
                    messageId: message.id 
                  });
                  // Fortsätt trots mailfel - meddelandet har sparats i databasen
                }
              }
            } catch (emailError) {
              logger.error('Fel vid hantering av mail till kund', { 
                error: emailError instanceof Error ? emailError.message : 'Okänt fel', 
                ticketId, 
                messageId: message.id 
              });
              // Fortsätt trots mailfel - meddelandet har sparats i databasen
            }
          }
          
          return res.status(201).json(message);
        } catch (error) {
          logger.error('Fel vid skapande av meddelande', { 
            error: error instanceof Error ? error.message : 'Okänt fel', 
            ticketId 
          });
          return res.status(500).json({ error: 'Kunde inte skapa meddelande' });
        }

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    logger.error('Error in tickets/[id]/messages/index.ts:', { 
      error: error instanceof Error ? error.message : 'Okänt fel' 
    });
    
    if (error instanceof Error && error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }
    
    return res.status(500).json({ message: 'Ett internt serverfel uppstod.' });
  } finally {
    await prisma.$disconnect();
  }
}