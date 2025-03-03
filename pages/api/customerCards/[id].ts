// src/pages/api/customercards/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import { updateCustomerCardSchema } from '@/utils/validation';
import rateLimiter from '@/lib/rateLimiterApi';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { method, query } = req;
    const cardId = Number(query.id);
    if (isNaN(cardId)) {
      return res.status(400).json({ message: 'Ogiltigt id' });
    }

    switch (method) {
      case 'GET':
        try {
          const card = await prisma.customerCard.findFirst({
            where: { id: cardId, storeId: session.user.storeId },
          });
          if (!card) {
            return res.status(404).json({ message: 'Kundkortet hittades inte.' });
          }
          return res.status(200).json(card);
        } catch (error) {
          console.error('Error fetching customer card:', error);
          return res.status(500).json({ error: 'Server error' });
        }

      case 'PUT':
        try {
          const parseResult = updateCustomerCardSchema.safeParse(req.body);
          if (!parseResult.success) {
            const errors = parseResult.error.errors.map((err) => ({
              field: err.path.join('.'),
              message: err.message,
            }));
            return res.status(400).json({ message: 'Valideringsfel', errors });
          }
          const updateData = parseResult.data;
          const updatedCard = await prisma.customerCard.updateMany({
            where: { id: cardId, storeId: session.user.storeId },
            data: updateData,
          });
          if (updatedCard.count === 0) {
            return res.status(404).json({ message: 'Kundkortet hittades inte.' });
          }
          const card = await prisma.customerCard.findUnique({ where: { id: cardId } });
          return res.status(200).json(card);
        } catch (error) {
          console.error('Error updating customer card:', error);
          return res.status(500).json({ error: 'Server error' });
        }

      case 'DELETE':
        try {
          const deletedCard = await prisma.customerCard.deleteMany({
            where: { id: cardId, storeId: session.user.storeId },
          });
          if (deletedCard.count === 0) {
            return res.status(404).json({ message: 'Kundkortet hittades inte.' });
          }
          return res.status(200).json({ message: 'Kundkortet togs bort.' });
        } catch (error) {
          console.error('Error deleting customer card:', error);
          return res.status(500).json({ error: 'Server error' });
        }

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('Error in customercards [id]:', error.message);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Ett internt serverfel uppstod.' });
    }
  } finally {
    await prisma.$disconnect();
  }
}
