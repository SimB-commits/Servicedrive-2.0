// src/pages/api/customerCards/[id]/setDefault.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method !== 'PUT') {
      res.setHeader('Allow', ['PUT']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { id } = req.query;
    const cardId = Number(id);
    
    if (isNaN(cardId)) {
      return res.status(400).json({ message: 'Invalid ID' });
    }

    // Verify the card exists and belongs to the user's store
    const card = await prisma.customerCard.findFirst({
      where: { 
        id: cardId,
        storeId: session.user.storeId
      }
    });

    if (!card) {
      return res.status(404).json({ message: 'Customer card template not found' });
    }

    // Transaction to unset all other cards as default and set the current one
    const result = await prisma.$transaction([
      // First, unset isDefault for all cards in this store
      prisma.customerCard.updateMany({
        where: { 
          storeId: session.user.storeId,
          isDefault: true
        },
        data: { isDefault: false }
      }),
      // Then, set the selected card as default
      prisma.customerCard.update({
        where: { id: cardId },
        data: { isDefault: true }
      })
    ]);

    return res.status(200).json({ 
      message: 'Default template updated successfully',
      card: result[1]
    });
  } catch (error: any) {
    console.error('Error in setDefault API:', error.message);
    
    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'Too many requests. Try again later.' });
    }
    
    if (!res.headersSent) {
      return res.status(500).json({ message: 'An internal server error occurred.' });
    }
  } finally {
    await prisma.$disconnect();
  }
}