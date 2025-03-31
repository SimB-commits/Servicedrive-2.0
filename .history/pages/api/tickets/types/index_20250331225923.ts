// pages/api/tickets/types/index.ts - modifierad version

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/authOptions';
import { createTicketTypeSchema, CreateTicketTypeInput } from '../../../../utils/validation';
import rateLimiter from '@/lib/rateLimiterApi';
import planRestrictions from '@/utils/planRestrictions'; // Importera planRestrictions

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`Received ${req.method} request on /api/tickets/types`);

  try {
    // Rate Limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');
    console.log('Rate limiter passed');

    // Autentisering
    const session = await getServerSession(req, res, authOptions);
    console.log('Session:', session);

    if (!session || session.user.role !== 'ADMIN') {
      console.log('Unauthorized or not ADMIN');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { method } = req;

    switch (method) {
      case 'GET':
        // Befintlig GET-kod förblir oförändrad
        // ...
        break;

      case 'POST':
        try {
          // Kontrollera planbegränsningar innan vi skapar en ny ärendetyp
          const canCreateResult = await planRestrictions.canCreateTicketType(session.user.storeId);
          if (!canCreateResult.allowed) {
            return res.status(403).json({ 
              error: 'Plan limit reached', 
              message: canCreateResult.message
            });
          }
          
          // Validera inkommande data
          const parseResult = createTicketTypeSchema.safeParse(req.body);
          if (!parseResult.success) {
            const errors = parseResult.error.errors.map((err) => ({
              field: err.path.join('.'),
              message: err.message,
            }));
            console.log('Validation errors:', errors);
            return res.status(400).json({ message: 'Valideringsfel', errors });
          }

          // Befintlig kod för att skapa en ärendetyp
          // ...
          
          // Efter att ärendetypen skapats, uppdatera räknaren
          await planRestrictions.incrementTicketTypeCount(session.user.storeId);
          
          console.log('TicketType created:', newTicketType);
          res.status(201).json(newTicketType);
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Server error' });
        }
        break;

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error: any) {
    // Befintlig felhantering
    // ...
  } finally {
    await prisma.$disconnect();
  }
}