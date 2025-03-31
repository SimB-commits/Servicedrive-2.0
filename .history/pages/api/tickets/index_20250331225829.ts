// pages/api/tickets/index.ts - modifierad version

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, TicketStatus } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import { createTicketSchema, CreateTicketInput } from '../../../utils/validation';
import rateLimiter from '@/lib/rateLimiterApi';
import planRestrictions from '@/utils/planRestrictions'; // Importera planRestrictions

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
        // Befintlig GET-kod förblir oförändrad
        // ...
        break;

      case 'POST':
        try {
          // Kontrollera planbegränsningar innan vi skapar ett nytt ärende
          const canCreateResult = await planRestrictions.canCreateTicket(session.user.storeId);
          if (!canCreateResult.allowed) {
            return res.status(403).json({ 
              error: 'Plan limit reached', 
              message: canCreateResult.message
            });
          }
          
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

          // Befintlig kod för att skapa ett ärende
          // ...
          
          // Efter att ärendet skapats, uppdatera räknaren
          await planRestrictions.incrementTicketCount(session.user.storeId);
          
          console.log('Ticket created:', newTicket);
          
          // Returnera både ärendet och URL för omdirigering
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
    // Befintlig felhantering
    // ...
  } finally {
    await prisma.$disconnect();
  }
}