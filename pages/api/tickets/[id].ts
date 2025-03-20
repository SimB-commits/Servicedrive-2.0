// pages/api/tickets/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { sendTicketStatusEmail } from '@/utils/mail-service';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`Received ${req.method} request on /api/tickets/${req.query.id}`);
  
  try {
    // Rate limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');
    console.log('Rate limiter passed');

    // Autentisering
    const session = await getServerSession(req, res, authOptions);
    console.log('Session:', session);
    if (!session) {
      console.log('Unauthorized');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Ogiltigt ID' });
    }
    const ticketId = parseInt(id);

    const { method } = req;
    switch (method) {
      case 'GET': {
        try {
          const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            include: {
              customer: true,
              ticketType: {
                include: {
                  fields: true,
                },
              },
              customStatus: {
                include: {
                  mailTemplate: true,
                },
              },
              user: true,
              messages: {
                orderBy: {
                  createdAt: 'desc',
                },
              },
            },
          });

          if (!ticket) {
            return res.status(404).json({ error: 'Ärende hittades inte' });
          }

          return res.status(200).json(ticket);
        } catch (error) {
          console.error(error);
          return res.status(500).json({ error: 'Serverfel' });
        }
      }
      case 'PUT': {
        try {
          // Spara gamla status innan uppdatering
          const currentTicket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            include: {
              customer: true,
              ticketType: true,
              customStatus: {
                include: {
                  mailTemplate: true,
                },
              },
              user: true,
              assignedUser: true,
            },
          });

          if (!currentTicket) {
            return res.status(404).json({ error: 'Ärende hittades inte' });
          }

          const oldStatus = currentTicket.status;
          const oldCustomStatusId = currentTicket.customStatusId;

          // Extrahera sendEmail-flaggan från request-body, defaulta till true om inte angiven
          const { sendEmail = true, ...updateData } = req.body;

          // Kod för att avgöra om customStatusId ska uppdateras baserat på status
          let updatedStatus = updateData.status;
          let customStatusId = undefined;

          // Om status är i formatet CUSTOM_X, konvertera till customStatusId
          if (updatedStatus && updatedStatus.startsWith('CUSTOM_')) {
            try {
              const statusId = parseInt(updatedStatus.replace('CUSTOM_', ''));
              if (!isNaN(statusId)) {
                customStatusId = statusId;
                updatedStatus = undefined; // Ta bort status om vi använder customStatusId
              }
            } catch (e) {
              console.error('Kunde inte tolka custom status:', e);
            }
          }

          // Uppdatera ärendet
          const updatedTicket = await prisma.ticket.update({
            where: { id: ticketId },
            data: {
              dynamicFields: updateData.dynamicFields,
              status: updatedStatus,
              customStatusId: customStatusId,
              // Andra fält som kan uppdateras
              dueDate: updateData.dueDate,
            },
            include: {
              customer: true,
              ticketType: {
                include: {
                  fields: true,
                },
              },
              customStatus: {
                include: {
                  mailTemplate: true,
                },
              },
              user: true,
              assignedUser: true,
              messages: {
                orderBy: {
                  createdAt: 'desc',
                },
              },
            },
          });

          // Skicka mail ENDAST om:
          // 1. sendEmail-flaggan är true OCH
          // 2. Status har ändrats OCH
          // 3. Det finns en kopplad mailmall
          let emailSent = false;
          
          const statusHasChanged = 
            updatedTicket.status !== oldStatus || 
            updatedTicket.customStatusId !== oldCustomStatusId;
          
          const hasMailTemplate = updatedTicket.customStatus?.mailTemplate !== null;
          
          if (sendEmail && statusHasChanged && hasMailTemplate) {
            try {
              console.log('Skickar statusmail...');
              await sendTicketStatusEmail(updatedTicket, oldStatus, oldCustomStatusId);
              emailSent = true;
              console.log('Statusmail skickat');
            } catch (emailError) {
              console.error('Fel vid skickande av statusmail:', emailError);
              // Vi låter uppdateringen lyckas även om mailutskicket misslyckas
            }
          } else if (!sendEmail) {
            console.log('Mail skickas inte enligt användarens val');
          } else if (!statusHasChanged) {
            console.log('Mail skickas inte eftersom status inte har ändrats');
          } else if (!hasMailTemplate) {
            console.log('Mail skickas inte eftersom det inte finns någon kopplad mailmall');
          }

          return res.status(200).json({ 
            ...updatedTicket, 
            emailSent // Inkludera information om mail skickades
          });
        } catch (error) {
          console.error(error);
          return res.status(500).json({ error: 'Serverfel' });
        }
      }
      case 'DELETE': {
        try {
          await prisma.ticket.delete({
            where: { id: ticketId },
          });
          return res.status(200).json({ message: 'Ärende raderat' });
        } catch (error) {
          console.error(error);
          return res.status(500).json({ error: 'Serverfel' });
        }
      }
      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('Error in tickets/[id].ts:', error.message);
    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Ett internt serverfel uppstod.' });
    }
  } finally {
    await prisma.$disconnect();
  }
}