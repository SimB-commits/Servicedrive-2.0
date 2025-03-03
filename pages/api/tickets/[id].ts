// src/pages/api/tickets/[id].ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, TicketStatus } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import { updateTicketSchema, UpdateTicketInput } from '../../../utils/validation';
import rateLimiter from '@/lib/rateLimiterApi';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const {
    query: { id },
    method,
  } = req;

  console.log(`Received ${method} request on /api/tickets/${id}`);

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

    // Validera att id är ett nummer
    const ticketId = Number(id);
    if (isNaN(ticketId)) {
      console.log('Invalid Ticket ID');
      return res.status(400).json({ error: 'Ogiltigt Ticket-ID' });
    }

    switch (method) {
      case 'GET':
        try {
          const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            include: {
              customer: true,
              user: true,
              assignedUser: true,
              ticketType: {
                include: { fields: true },
              },
              messages: true,
            },
          });

          if (!ticket || ticket.storeId !== session.user.storeId) {
            console.log('Ticket not found or not in user\'s store');
            return res.status(404).json({ error: 'Ticket not found' });
          }

          res.status(200).json(ticket);
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Server error' });
        }
        break;

      // I PUT-fallet i /api/tickets/[id].ts

case 'PUT':
  try {
    // Validera inkommande data
    const parseResult = updateTicketSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      console.log('Validation errors:', errors);
      return res.status(400).json({ message: 'Valideringsfel', errors });
    }

    const { title, description, status, dynamicFields, dueDate } = parseResult.data as UpdateTicketInput;

    // Hämta Ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.storeId !== session.user.storeId) {
      console.log('Ticket not found or not in user\'s store');
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Bygg upp data att uppdatera
    let updateData: any = {
      title: title ?? ticket.title,
      description: description ?? ticket.description,
      dynamicFields: dynamicFields ?? ticket.dynamicFields,
      dueDate: dueDate ?? ticket.dueDate,
    };

    // Om status är dynamisk (börjar med "CUSTOM_"), extrahera id:t och uppdatera customStatusId
    if (status && typeof status === "string" && status.startsWith("CUSTOM_")) {
      const customStatusId = Number(status.replace("CUSTOM_", ""));
      updateData = {
        ...updateData,
        // Sätt ett fallback-värde för enumfältet, t.ex. OPEN
        status: TicketStatus.OPEN,
        customStatusId: customStatusId,
      };
    } else {
      updateData = {
        ...updateData,
        status: status ?? ticket.status,
        customStatusId: null, // Rensa eventuell tidigare dynamisk status
      };
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        customer: true,
        user: true,
        assignedUser: true,
        ticketType: { include: { fields: true } },
        customStatus: true, // Inkludera relationen customStatus så att den visas i UI:t
        messages: true,
      },
    });

    console.log('Ticket updated:', updatedTicket);
    res.status(200).json(updatedTicket);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
  break;


      case 'DELETE':
        try {
          const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
          });

          if (!ticket || ticket.storeId !== session.user.storeId) {
            console.log('Ticket not found or not in user\'s store');
            return res.status(404).json({ error: 'Ticket not found' });
          }

          // Ta bort Ticket
          await prisma.ticket.delete({
            where: { id: ticketId },
          });

          console.log('Ticket deleted:', ticketId);
          res.status(204).end();
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Server error' });
        }
        break;

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('Error in tickets/[id].ts:', error.message);

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
