// src/pages/api/tickets/types/[id].ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/authOptions';
import { updateTicketTypeSchema, UpdateTicketTypeInput } from '../../../../utils/validation';
import rateLimiter from '@/lib/rateLimiterApi';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('>>> prisma.ticketType.findUnique:', prisma.ticketType.findUnique);
  console.log('>>> prisma.ticketType.findUnique.mock:', (prisma.ticketType.findUnique as any)?.mock);
  const {
    query: { id },
    method,
  } = req;

  //console.log(`Received ${method} request on /api/tickets/types/${id}`);

  try {
    // Rate Limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');
    //console.log('Rate limiter passed');

    // Autentisering
    const session = await getServerSession(req, res, authOptions);
    //console.log('Session:', session);

    if (!session || session.user.role !== 'ADMIN') {
      //console.log('Unauthorized or not ADMIN');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validera att id är ett nummer
    const ticketTypeId = Number(id);
    if (isNaN(ticketTypeId)) {
      //console.log('Invalid TicketType ID');
      return res.status(400).json({ error: 'Ogiltigt TicketType-ID' });
    }

    switch (method) {
      case 'GET':
        try {
          const ticketType = await prisma.ticketType.findUnique({
            where: { id: ticketTypeId },
            include: { fields: true },
          });
          console.log('>>> ticketType efter anrop:', ticketType);

          if (!ticketType || ticketType.storeId !== session.user.storeId) {
            //console.log('TicketType not found or not in user\'s store');
            return res.status(404).json({ error: 'TicketType not found' });
          }

          res.status(200).json(ticketType);
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Server error' });
        }
        break;

      case 'PUT':
        try {
          // Validera inkommande data
          const parseResult = updateTicketTypeSchema.safeParse(req.body);
          if (!parseResult.success) {
            const errors = parseResult.error.errors.map((err) => ({
              field: err.path.join('.'),
              message: err.message,
            }));
            //console.log('Validation errors:', errors);
            return res.status(400).json({ message: 'Valideringsfel', errors });
          }

          const { name, fields } = parseResult.data as UpdateTicketTypeInput;

          // Hämta TicketType
          const ticketType = await prisma.ticketType.findUnique({
            where: { id: ticketTypeId },
            include: { fields: true },
          });

          if (!ticketType || ticketType.storeId !== session.user.storeId) {
            //console.log('TicketType not found or not in user\'s store');
            return res.status(404).json({ error: 'TicketType not found' });
          }

          // Mappa fields om de finns
          let mappedFields = fields?.map((field) => ({
            name: field.name,
            fieldType: field.fieldType,
            isRequired: field.isRequired || false,
          }));

          // Uppdatera TicketType
          const updatedTicketType = await prisma.ticketType.update({
            where: { id: ticketTypeId },
            data: {
              name: name ?? ticketType.name,
              fields: fields
                ? {
                    deleteMany: {}, // Radera befintliga fält
                    create: mappedFields!, // Skapa nya fält
                  }
                : undefined,
            },
            include: { fields: true }, // Inkludera fields i responsen
          });

          //console.log('TicketType updated:', updatedTicketType);
          res.status(200).json(updatedTicketType);
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Server error' });
        }
        break;

        case 'DELETE':
          try {
            const ticketType = await prisma.ticketType.findUnique({
              where: { id: ticketTypeId },
            });
        
            if (!ticketType || ticketType.storeId !== session.user.storeId) {
              //console.log('TicketType not found or not in user\'s store');
              return res.status(404).json({ error: 'TicketType not found' });
            }
        
            // Ta bort TicketType och relaterade fält (cascading delete hanteras av Prisma)
            const deletedTicketType = await prisma.ticketType.delete({
              where: { id: ticketTypeId },
              include: { fields: true }, // Inkludera fält för att bekräfta raderingen
            });
        
            //console.log('TicketType deleted:', deletedTicketType);
            res.status(204).end();
          } catch (error: any) {
            console.error('Error deleting TicketType:', error);
            res.status(500).json({ error: 'Server error', details: error.message });
          }
          break;

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('Error in tickets/types/[id].ts:', error.message);

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
