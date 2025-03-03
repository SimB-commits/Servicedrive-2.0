// src/pages/api/tickets/statuses/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { updateTicketStatusSchema, UpdateTicketStatusInput } from '@/utils/validation';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`Received ${req.method} request on /api/tickets/statuses/[id]`);
  
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

    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid id' });
    }
    const statusId = Number(id);

    const { method } = req;
    switch (method) {
      case 'GET': {
        try {
          const storeId = session.user.storeId;
          if (storeId === null) {
            return res.status(400).json({ error: 'StoreId saknas i sessionen' });
          }
          const statusData = await prisma.userTicketStatus.findFirst({
            where: {
              id: statusId,
              storeId: storeId,
            },
            include: { mailTemplate: true},
          });
          if (!statusData) {
            return res.status(404).json({ error: 'Status not found' });
          }
          return res.status(200).json(statusData);
        } catch (error) {
          console.error(error);
          return res.status(500).json({ error: 'Server error' });
        }
      }
      case 'PUT': {
        try {
          const parseResult = updateTicketStatusSchema.safeParse(req.body);
          if (!parseResult.success) {
            const errors = parseResult.error.errors.map((err) => ({
              field: err.path.join('.'),
              message: err.message,
            }));
            console.log('Validation errors:', errors);
            return res.status(400).json({ message: 'Valideringsfel', errors });
          }
          const { name, mailTemplateId, color } = parseResult.data as UpdateTicketStatusInput;
          const updatedStatus = await prisma.userTicketStatus.update({
            where: { id: statusId },
            data: {
              name: name || undefined,
              mailTemplateId: mailTemplateId !== undefined ? (mailTemplateId !== null ? Number(mailTemplateId) : null) : undefined,
              color: color || undefined,
            },
            include: { mailTemplate: true},
          });
          return res.status(200).json(updatedStatus);
        } catch (error) {
          console.error(error);
          return res.status(500).json({ error: 'Server error' });
        }
      }
      case 'DELETE': {
        try {
          const deletedStatus = await prisma.userTicketStatus.delete({
            where: { id: statusId },
          });
          return res.status(200).json(deletedStatus);
        } catch (error) {
          console.error(error);
          return res.status(500).json({ error: 'Server error' });
        }
      }
      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('Error in statuses/[id].ts:', error.message);
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
