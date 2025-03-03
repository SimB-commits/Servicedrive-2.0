// src/pages/api/tickets/statuses/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { createTicketStatusSchema, CreateTicketStatusInput } from '@/utils/validation';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`Received ${req.method} request on /api/tickets/statuses`);
  
  try {
    // Rate limiting
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
      case 'GET': {
        try {
          const storeId = session.user.storeId;
          if (storeId === null) {
            return res.status(400).json({ error: 'StoreId saknas i sessionen' });
          }

          const statuses = await prisma.userTicketStatus.findMany({
            where: { storeId: storeId },
            include: { mailTemplate: true } // Inkludera relationen om du vill returnera mailmallens data
          });
          return res.status(200).json(statuses);
        } catch (error) {
          console.error(error);
          return res.status(500).json({ error: 'Server error' });
        }
      }
      case 'POST': {
        try {
          // Validera inkommande data
          const parseResult = createTicketStatusSchema.safeParse(req.body);
          if (!parseResult.success) {
            const errors = parseResult.error.errors.map((err) => ({
              field: err.path.join('.'),
              message: err.message,
            }));
            console.log('Validation errors:', errors);
            return res.status(400).json({ message: 'Valideringsfel', errors });
          }
          const { name, mailTemplateId, color } = parseResult.data as CreateTicketStatusInput;

          // Skapa ny status med mailTemplateId och färg
          const newStatus = await prisma.userTicketStatus.create({
            data: {
              name,
              mailTemplateId: mailTemplateId ? Number(mailTemplateId) : null,
              color,
              storeId: session.user.storeId!,
            },
          });
          console.log('UserTicketStatus created:', newStatus);
          return res.status(201).json(newStatus);
        } catch (error) {
          console.error(error);
          return res.status(500).json({ error: 'Server error' });
        }
      }
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('Error in statuses/index.ts:', error.message);
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
