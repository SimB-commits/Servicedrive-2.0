// pages/api/tickets/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { logger } from '@/utils/logger';
import { sendTicketStatusEmail } from '@/utils/mail-service';
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

    // Olika hantering baserat på HTTP-metod
    switch (req.method) {
      // GET - Hämta ett ärende
      case 'GET':
        try {
          const ticketId = Number(id);
          if (isNaN(ticketId)) {
            return res.status(400).json({ error: 'Ogiltigt ärende-ID' });
          }

          const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            include: {
              customer: true,
              ticketType: {
                include: {
                  fields: true,
                },
              },
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
              messages: {
                orderBy: {
                  createdAt: 'desc',
                },
                take: 5,
              },
            },
          });

          if (!ticket) {
            return res.status(404).json({ error: 'Ärendet hittades inte' });
          }

          // Verifiera att användaren har rätt att se ärendet
          if (ticket.storeId !== session.user.storeId) {
            return res.status(403).json({ error: 'Du har inte behörighet till detta ärende' });
          }

          return res.status(200).json(ticket);
        } catch (error) {
          logger.error('Fel vid hämtning av ärende', { 
            error: error instanceof Error ? error.message : "Okänt fel",
            id 
          });
          return res.status(500).json({ error: 'Kunde inte hämta ärendet' });
        }

      // PUT - Uppdatera ett ärende
      case 'PUT':
        try {
          // Validera ID-parameter
          const ticketId = Number(id);
          if (isNaN(ticketId)) {
            return res.status(400).json({ error: 'Ogiltigt ärende-ID' });
          }

          // Logga inkommande data för felsökning
          logger.debug(`Inkommande PUT-förfrågan för ärende #${ticketId}`, { 
            ticketId, 
            hasStatus: !!req.body.status,
            hasCustomStatusId: !!req.body.customStatusId,
            sendNotification: !!req.body.sendNotification,
            body: JSON.stringify(req.body)
          });

          // Hämta befintligt ärende för att jämföra värden
          const existingTicket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            include: {
              customer: true,
              ticketType: true,
              customStatus: {
                include: { mailTemplate: true }
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

          if (!existingTicket) {
            return res.status(404).json({ error: 'Ärendet hittades inte' });
          }

          // Verifiera att användaren har rätt att uppdatera ärendet
          if (existingTicket.storeId !== session.user.storeId) {
            return res.status(403).json({ error: 'Du har inte behörighet att uppdatera detta ärende' });
          }

          logger.debug(`Hittade ärende #${ticketId} för statusuppdatering`, {
            currentStatus: existingTicket.status,
            currentCustomStatusId: existingTicket.customStatusId,
            newStatus: req.body.status
          });

          // Förbered uppdateringsobjekt
          const updateData: any = {};
          
          // Kopiera alla fält från req.body men exkludera vissa
          const excludedFields = ['sendNotification', 'messages', 'customer', 'customStatus', 'ticketType', 'user', 'assignedUser'];
          
          // Hantera custom vs system status
          // Detta är nyckelförändringen - korrekt hantering av statusbyten
          if (req.body.status) {
            // Kontrollera om status är en systemstatus eller anpassad status
            const isCustomStatus = req.body.status.startsWith('CUSTOM_');
            
            if (isCustomStatus) {
              // För anpassade statusar, extrahera ID och sätt customStatusId
              const customId = Number(req.body.status.replace('CUSTOM_', ''));
              if (!isNaN(customId)) {
                updateData.customStatusId = customId;
                // Använd någon av systemstatusarna som finns i TicketStatus-enum
                // Håll kvar den tidigare systemstatusen om möjligt, annars IN_PROGRESS
                updateData.status = existingTicket.status && 
                                   !existingTicket.status.startsWith('CUSTOM') ? 
                                   existingTicket.status : 'IN_PROGRESS';
              }
            } else {
              // För systemstatusar, sätt status och nollställ customStatusId
              updateData.status = req.body.status;
              updateData.customStatusId = null; // VIKTIGT: Nollställ customStatusId
            }
          }
          
          // Hantera övriga fält i förfrågan
          for (const [key, value] of Object.entries(req.body)) {
            if (!excludedFields.includes(key) && key !== 'status' && key !== 'customStatusId') {
              updateData[key] = value;
            }
          }

          // Jämför status för att avgöra om detta är en statusändring
          const isStatusChange = 
            req.body.status !== undefined && 
            (req.body.status !== existingTicket.status || 
             (req.body.status.startsWith('CUSTOM_') && 
              existingTicket.customStatusId !== updateData.customStatusId));

          logger.debug(`Statusändring detekterad för ärende #${ticketId}: ${isStatusChange}`, {
            ticketId,
            isStatusChange,
            oldStatus: existingTicket.status,
            newStatus: req.body.status,
            oldCustomStatusId: existingTicket.customStatusId,
            newCustomStatusId: updateData.customStatusId
          });

          // Logga vilka fält som kommer att uppdateras
          const updateFields = Object.keys(updateData);
          logger.debug(`Uppdaterar ärende #${ticketId} i databasen med filtrerade fält`, {
            ticketId,
            updateFields,
            excludedFields
          });

          // Utför uppdateringen
          const updatedTicket = await prisma.ticket.update({
            where: { id: ticketId },
            data: updateData,
            include: {
              customer: true,
              ticketType: true,
              customStatus: {
                include: { mailTemplate: true }
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

          logger.info(`Ärende #${ticketId} uppdaterat`, {
            ticketId: updatedTicket.id,
            status: updatedTicket.status,
            customStatusId: updatedTicket.customStatusId,
            hasCustomStatus: !!updatedTicket.customStatus,
            hasMailTemplate: !!(updatedTicket.customStatus?.mailTemplate)
          });

          // Kontrollera om vi ska skicka mail vid statusändring
          // VIKTIGT: Ändra inte logiken för mailutskick, bara korrekt detektering av statustyp
          // Om förfrågan innehåller sendNotification=false, skicka inte mail
          // Annars, använd ticket-servicens logik för att avgöra om mail ska skickas
          const shouldSendEmail = 
            isStatusChange && 
            req.body.sendNotification !== false; // default till true om inte explicit false

          logger.debug(`Kontrollerar om mail ska skickas för ärende #${ticketId}`, {
            ticketId,
            shouldSendEmail,
            isStatusChange,
            sendNotificationParam: req.body.sendNotification,
            hasCustomStatus: !!updatedTicket.customStatus,
            hasSystemStatus: !!updatedTicket.status,
            hasMailTemplate: !!(updatedTicket.customStatus?.mailTemplate)
          });

          // Skicka mail om det är en statusändring och användaren inte explicit valt att inte skicka mail
          // Behåll den befintliga logiken för mailutskick i sendTicketStatusEmail-funktionen
          // som avgör om det finns en lämplig mailmall
          if (shouldSendEmail) {
            try {
              // Använd befintlig funktion utan modifiering för att behålla all mailutskickslogik
              await sendTicketStatusEmail(updatedTicket, existingTicket.status, existingTicket.customStatusId);
              logger.info(`Status-mail skickat för ärende #${ticketId}`, { ticketId });
            } catch (mailError) {
              logger.error(`Fel vid skickande av status-mail för ärende #${ticketId}`, {
                error: mailError instanceof Error ? mailError.message : "Okänt fel",
                ticketId
              });
              // Fortsätt trots mailfel - ärendet har uppdaterats
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
          logger.error(`Fel vid uppdatering av ärende`, {
            error: error instanceof Error ? error.message : "Okänt fel",
            id
          });
          return res.status(500).json({ error: 'Kunde inte uppdatera ärendet' });
        }

      // DELETE - Ta bort ett ärende
      case 'DELETE':
        try {
          const ticketId = Number(id);
          if (isNaN(ticketId)) {
            return res.status(400).json({ error: 'Ogiltigt ärende-ID' });
          }

          // Kontrollera först att ärendet finns och att användaren har rätt att ta bort det
          const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
          });

          if (!ticket) {
            return res.status(404).json({ error: 'Ärendet hittades inte' });
          }

          // Verifiera att användaren har rätt att ta bort ärendet
          if (ticket.storeId !== session.user.storeId) {
            return res.status(403).json({ error: 'Du har inte behörighet att ta bort detta ärende' });
          }

          // Ta bort ärendet
          await prisma.ticket.delete({
            where: { id: ticketId },
          });

          return res.status(200).json({ message: 'Ärendet har tagits bort' });
        } catch (error) {
          logger.error('Fel vid borttagning av ärende', { 
            error: error instanceof Error ? error.message : "Okänt fel",
            id 
          });
          return res.status(500).json({ error: 'Kunde inte ta bort ärendet' });
        }

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    logger.error('Error in tickets/[id].ts:', { 
      error: error instanceof Error ? error.message : "Okänt fel",
      path: `/api/tickets/${id}`,
      method: req.method
    });

    if (error.constructor?.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }

    return res.status(500).json({ message: 'Ett internt serverfel uppstod.' });
  } finally {
    await prisma.$disconnect();
  }
}