// pages/api/tickets/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { sendTicketStatusEmail } from '@/utils/mail-service';
import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Hämta ID-parameter
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Ogiltigt eller saknat ID' });
    }
    const ticketId = Number(id);

    // Autentisering
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Ej inloggad' });
    }

    // Hantera olika HTTP-metoder
    switch (req.method) {
      case 'GET':
        try {
          // Hämta ärende med alla relaterade data
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
                }
              },
              messages: {
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
                  createdAt: 'desc',
                },
              },
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

          // Kontrollera om användaren har rätt att se ärendet
          if (ticket.storeId !== session.user.storeId) {
            return res.status(403).json({ error: 'Åtkomst nekad' });
          }

          return res.status(200).json(ticket);
        } catch (error) {
          logger.error('Fel vid hämtning av ärende', { error: error.message, ticketId });
          return res.status(500).json({ error: 'Serverfel' });
        }

      case 'PUT':
        try {
          // Hämta nuvarande ärende för att kunna jämföra statusar
          const existingTicket = await prisma.ticket.findUnique({
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
              store: true,
            },
          });

          if (!existingTicket) {
            return res.status(404).json({ error: 'Ärende hittades inte' });
          }

          // Kontrollera om användaren har rätt att ändra ärendet
          if (existingTicket.storeId !== session.user.storeId) {
            return res.status(403).json({ error: 'Åtkomst nekad' });
          }

          // Spara nuvarande status för att kunna jämföra senare
          const oldStatus = existingTicket.status;
          const oldCustomStatusId = existingTicket.customStatusId;

          // Parsea inkommande data
          const {
            status,
            dueDate,
            title,
            description,
            dynamicFields,
            customerId,
            assignedTo,
            ticketTypeId,
            // Detta är den viktiga parametern som styr om mail ska skickas
            sendNotification = false, // Default är att inte skicka mail
          } = req.body;

          // Bygg upp uppdateringsdata
          const updateData: any = {
            dynamicFields: dynamicFields || existingTicket.dynamicFields,
          };

          // Uppdatera endast fält som är angivna
          if (title !== undefined) updateData.title = title;
          if (description !== undefined) updateData.description = description;
          if (dueDate !== undefined) {
            updateData.dueDate = dueDate ? new Date(dueDate) : null;
          }
          if (customerId !== undefined) updateData.customerId = customerId;
          if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
          if (ticketTypeId !== undefined) updateData.ticketTypeId = ticketTypeId;

          // Hantera statusuppdatering
          if (status) {
            // Om det är en anpassad status (börjar med "CUSTOM_")
            if (status.startsWith('CUSTOM_')) {
              const customStatusId = Number(status.replace('CUSTOM_', ''));
              updateData.customStatusId = customStatusId;
              updateData.status = null; // Nollställ grund-status om anpassad status används
            } else {
              // Använd grund-status
              updateData.status = status;
              updateData.customStatusId = null; // Nollställ anpassad status om grund-status används
            }
          }

          // Uppdatera ärendet i databasen
          const updatedTicket = await prisma.ticket.update({
            where: { id: ticketId },
            data: updateData,
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
              store: true,
            },
          });

          // Kontrollera om statusen har ändrats
          const statusChanged = oldStatus !== updatedTicket.status || oldCustomStatusId !== updatedTicket.customStatusId;

          // Om statusen har ändrats och sendNotification är true, skicka mail
          if (statusChanged && sendNotification === true) {
            try {
              const mailResult = await sendTicketStatusEmail(updatedTicket, oldStatus, oldCustomStatusId);
              logger.info('Status-mail skickat för ärende', { 
                ticketId, 
                oldStatus, 
                newStatus: updatedTicket.status,
                oldCustomStatusId,
                newCustomStatusId: updatedTicket.customStatusId,
                mailSent: !!mailResult
              });
            } catch (mailError) {
              // Logga felet men fortsätt (vi vill inte att ett misslyckat mail-utskick ska stoppa uppdateringen)
              logger.error('Fel vid skickande av status-mail', { 
                error: mailError.message, 
                ticketId, 
                oldStatus, 
                newStatus: updatedTicket.status 
              });
            }
          } else if (statusChanged) {
            logger.info('Status ändrad utan mailutskick', { 
              ticketId, 
              oldStatus, 
              newStatus: updatedTicket.status,
              sendNotification
            });
          }

          // Returnera det uppdaterade ärendet
          return res.status(200).json(updatedTicket);
        } catch (error) {
          logger.error('Fel vid uppdatering av ärende', { error: error.message, ticketId });
          return res.status(500).json({ error: 'Serverfel' });
        }

      case 'DELETE':
        try {
          // Hämta ärendet för att kontrollera åtkomst
          const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
          });

          if (!ticket) {
            return res.status(404).json({ error: 'Ärende hittades inte' });
          }

          // Kontrollera om användaren har rätt att ta bort ärendet
          if (ticket.storeId !== session.user.storeId) {
            return res.status(403).json({ error: 'Åtkomst nekad' });
          }

          // Ta bort ärendet
          await prisma.ticket.delete({
            where: { id: ticketId },
          });

          return res.status(200).json({ message: 'Ärende borttaget' });
        } catch (error) {
          logger.error('Fel vid borttagning av ärende', { error: error.message, ticketId });
          return res.status(500).json({ error: 'Serverfel' });
        }

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    logger.error('Error in tickets/[id].ts:', { error: error.message });
    
    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }
    
    return res.status(500).json({ message: 'Ett internt serverfel uppstod.' });
  } finally {
    await prisma.$disconnect();
  }
}