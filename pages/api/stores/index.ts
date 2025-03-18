// pages/api/stores/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate Limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Authentication
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    switch (req.method) {
      case 'GET':
        // Get all stores for the current user
        try {
          const userStores = await prisma.userStore.findMany({
            where: { userId: session.user.id },
            include: { store: true },
          });

          const stores = userStores.map(us => us.store);
          return res.status(200).json(stores);
        } catch (error) {
          console.error('Error fetching stores:', error);
          return res.status(500).json({ error: 'Server error' });
        }

      case 'POST':
        // Create a new store for the current user
        try {
          // Validate input
          const { name, company, address } = req.body;
          if (!name || !company || !address) {
            return res.status(400).json({ error: 'Missing required fields' });
          }

          // Create store and UserStore relation in a transaction
          const result = await prisma.$transaction(async (tx) => {
            const newStore = await tx.store.create({
              data: {
                name,
                company,
                address,
              },
            });

            await tx.userStore.create({
              data: {
                userId: session.user.id,
                storeId: newStore.id,
              },
            });

            return newStore;
          });

          return res.status(201).json(result);
        } catch (error) {
          console.error('Error creating store:', error);
          return res.status(500).json({ error: 'Server error' });
        }

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('Error in stores/index.ts:', error.message);

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