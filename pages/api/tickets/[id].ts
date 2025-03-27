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

        case 'PUT': {
          // Logga inkommande data för bättre spårning
          logger.debug(`Inkommande PUT-förfrågan för ärende #${id}`, {
            ticketId: Number(id),
            hasStatus: 'status' in req.body,
            hasCustomStatusId: 'customStatusId' in req.body,
            sendNotification: req.body.sendNotification,
            body: JSON.stringify(req.body).substring(0, 200) // Logga inte hela bodyn för att undvika stora loggposter
          });
        
          // Validera input (befintlig kod)
          
          try {
            // Hämta aktuellt ärende för att spåra statusändringar
            const currentTicket = await prisma.ticket.findUnique({
              where: { id: ticketId },
              select: {
                id: true,
                status: true,
                customStatusId: true
              }
            });
            
            if (!currentTicket) {
              logger.warn(`Kunde inte hitta ärende #${ticketId} för statusuppdatering`);
              return res.status(404).json({ error: 'Ärende hittades inte' });
            }
            
            logger.debug(`Hittade ärende #${ticketId} för statusuppdatering`, {
              currentStatus: currentTicket.status,
              currentCustomStatusId: currentTicket.customStatusId,
              newStatus: req.body.status,
              newCustomStatusId: req.body.customStatusId
            });
            
            // Spara de gamla värdena för att kunna skicka med till mail-funktionen
            const oldStatus = currentTicket.status;
            const oldCustomStatusId = currentTicket.customStatusId;
            
            // Kontrollera om det faktiskt är en statusändring
            const isStatusChange = 
              req.body.status && req.body.status !== oldStatus ||
              req.body.customStatusId !== undefined && req.body.customStatusId !== oldCustomStatusId;
            
            logger.debug(`Statusändring detekterad för ärende #${ticketId}: ${isStatusChange}`, {
              ticketId,
              isStatusChange,
              oldStatus,
              newStatus: req.body.status,
              oldCustomStatusId,
              newCustomStatusId: req.body.customStatusId
            });
        
            // Bygger updateData (befintlig kod)
            const updateData = { ...req.body };
            
            // Uppdatera ärendet i databasen
            logger.debug(`Uppdaterar ärende #${ticketId} i databasen`, {
              ticketId,
              updateFields: Object.keys(updateData)
            });
            
            const updatedTicket = await prisma.ticket.update({
              where: { id: ticketId },
              data: updateData,
              include: {
                customer: true,
                ticketType: true,
                customStatus: {
                  include: {
                    mailTemplate: true,
                  },
                },
                store: true,
                user: true,
                assignedUser: true,
              },
            });
            
            logger.info(`Ärende #${ticketId} uppdaterat`, {
              ticketId,
              status: updatedTicket.status,
              customStatusId: updatedTicket.customStatusId,
              hasCustomStatus: !!updatedTicket.customStatus,
              hasMailTemplate: !!updatedTicket.customStatus?.mailTemplate
            });
        
            // Skicka mail om det är en statusändring och sendNotification inte är false
            // KRITISKT OMRÅDE: Här avgörs om mail ska skickas vid statusuppdatering
            const shouldSendEmail = isStatusChange && req.body.sendNotification !== false;
            
            logger.debug(`Kontrollerar om mail ska skickas för ärende #${ticketId}`, {
              ticketId,
              shouldSendEmail,
              isStatusChange,
              sendNotificationParam: req.body.sendNotification,
              hasCustomStatus: !!updatedTicket.customStatus,
              hasMailTemplate: !!updatedTicket.customStatus?.mailTemplate
            });
            
            if (shouldSendEmail) {
              try {
                logger.info(`Försöker skicka mail för statusuppdatering av ärende #${ticketId}`, {
                  ticketId,
                  oldStatus,
                  newStatus: updatedTicket.status,
                  oldCustomStatusId,
                  newCustomStatusId: updatedTicket.customStatusId
                });
                
                // Anropa sendTicketStatusEmail för att skicka mail
                // KRITISKT OMRÅDE: Här anropas funktionen för att skicka mail
                const mailResult = await sendTicketStatusEmail(
                  updatedTicket, 
                  oldStatus, 
                  oldCustomStatusId
                );
                
                logger.debug(`Resultat av mailsändning för ärende #${ticketId}`, {
                  ticketId,
                  mailSent: !!mailResult,
                  mailError: mailResult === null ? 'Ingen mall hittades' : undefined
                });
                
                // Uppdatera response för att inkludera status om mailsändning
                return res.status(200).json({
                  ...updatedTicket,
                  _mailSent: !!mailResult
                });
              } catch (mailError) {
                logger.error(`Fel vid skickande av mail för statusuppdatering av ärende #${ticketId}`, {
                  ticketId,
                  error: mailError instanceof Error ? mailError.message : "Okänt fel",
                  stack: mailError instanceof Error ? mailError.stack : undefined
                });
                
                // Returnera ändå det uppdaterade ärendet men med mailfel-information
                return res.status(200).json({
                  ...updatedTicket,
                  _mailSent: false,
                  _mailError: mailError instanceof Error ? mailError.message : "Okänt fel"
                });
              }
            } else {
              logger.info(`Inget mail skickas för ärende #${ticketId} (antingen inte statusändring eller sendNotification=false)`, {
                ticketId,
                isStatusChange,
                sendNotification: req.body.sendNotification
              });
            }
        
            return res.status(200).json(updatedTicket);
          } catch (error) {
            logger.error(`Fel vid uppdatering av ärende #${id}`, {
              ticketId: Number(id),
              error: error instanceof Error ? error.message : "Okänt fel",
              stack: error instanceof Error ? error.stack : undefined
            });
            
            // Normal felhantering (befintlig kod)
            return res.status(500).json({
              error: 'Kunde inte uppdatera ärendet', 
              details: error instanceof Error ? error.message : "Okänt fel"
            });
          }
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