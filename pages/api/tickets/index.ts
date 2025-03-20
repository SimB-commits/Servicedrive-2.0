// src/pages/api/tickets/index.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, TicketStatus } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import { createTicketSchema, CreateTicketInput } from '../../../utils/validation';
import rateLimiter from '@/lib/rateLimiterApi';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`Received ${req.method} request on /api/tickets`);

  try {
    // Rate Limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');
    console.log('Rate limiter passed');

    // Autentisering
    const session = await getServerSession(req, res, authOptions);
    console.log('Session:', session);

    if (!session) {
      console.log('Unauthorized');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { method } = req;

    switch (method) {
      case 'GET':
        try {
          const tickets = await prisma.ticket.findMany({
            where: { storeId: session.user.storeId },
            include: {
              customer: true,
              user: true,
              assignedUser: true,
              ticketType: { include: { fields: true } },
              customStatus: true, // Lägg till denna rad
              messages: true,
            },
          });
          
          res.status(200).json(tickets);
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Server error' });
        }
        break;

      case 'POST':
        try {
          // Validera inkommande data
          const parseResult = createTicketSchema.safeParse(req.body);
          if (!parseResult.success) {
            const errors = parseResult.error.errors.map((err) => ({
              field: err.path.join('.'),
              message: err.message,
            }));
            console.log('Validation errors:', errors);
            return res.status(400).json({ message: 'Valideringsfel', errors });
          }

          const { ticketTypeId, customerId, dynamicFields, dueDate } = parseResult.data as CreateTicketInput;

          // Kontrollera om Customer existerar och tillhör samma store
          const customer = await prisma.customer.findUnique({
            where: { id: customerId },
          });

          if (!customer || customer.storeId !== session.user.storeId) {
            console.log('Invalid Customer');
            return res.status(400).json({ message: 'Ogiltig Customer' });
          }

          // Kontrollera om TicketType existerar och tillhör samma store
          const ticketType = await prisma.ticketType.findUnique({
            where: { id: ticketTypeId },
          });

          if (!ticketType || ticketType.storeId !== session.user.storeId) {
            console.log('Invalid TicketType');
            return res.status(400).json({ message: 'Ogiltig TicketType' });
          }

          // Logga data för debugging
          console.log('Creating ticket with data:', {
            ticketTypeId,
            customerId,
            dynamicFields,
            storeId: session.user.storeId,
            userId: session.user.id,
            status: TicketStatus.OPEN,
          });

          // Skapa Ticket med relation via connect och undvik direkt tilldelning av foreign keys
          const newTicket = await prisma.ticket.create({
            data: {
              dynamicFields,
              status: TicketStatus.OPEN,
              dueDate: dueDate || null, // Använd dueDate om den finns
              store: {
                connect: { id: session.user.storeId },
              },
              user: {
                connect: { id: session.user.id },
              },
              ticketType: {
                connect: { id: ticketTypeId },
              },
              customer: {
                connect: { id: customerId },
              },
              // assignedTo är optionellt, så vi behöver inte inkludera det
            },
            include: {
              ticketType: {
                include: { fields: true },
              },
              customer: true, // Inkludera Customer i svaret
              user: true     // Inkludera User i svaret
            },
          });

          // Importera mailservice och skicka bekräftelsemail
          try {
            const { sendNewTicketEmail } = await import('@/utils/mail-service');
            
            // Försök skicka bekräftelsemail för det nya ärendet
            const mailResponse = await sendNewTicketEmail(newTicket);
            
            if (mailResponse) {
              console.log(`Bekräftelsemail skickat för nytt ärende #${newTicket.id}`);
            }
          } catch (mailError) {
            // Ignorera mailfil men logga det - don't let it affect ticket creation
            console.error(`Fel vid skickande av bekräftelsemail för ärende #${newTicket.id}:`, mailError);
          }

          console.log('Ticket created:', newTicket);
          
          // Returnera ytterligare information för routing
          res.status(201).json({
            ticket: newTicket,
            redirectUrl: `/arenden/${newTicket.id}`
          });
        } catch (error: any) {
          console.error('Create Ticket error:', error);
          res.status(500).json({ error: 'Server error' });
        }
        break;

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('Error in tickets/index.ts:', error.message);

    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }

    if (!res.headersSent) {
      res.status(500).json({ message: 'Ett internt serverfel uppstod.' });
    }
  } finally {
    await prisma.$disconnect();
  }
}
