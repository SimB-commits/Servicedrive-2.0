// pages/api/stores/switch.ts
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

    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // Get storeId from request body
    const { storeId } = req.body;
    if (!storeId) {
      return res.status(400).json({ error: 'storeId is required' });
    }

    // Validate that the user has access to this store
    const userStore = await prisma.userStore.findFirst({
      where: {
        userId: session.user.id,
        storeId: Number(storeId),
      },
    });

    if (!userStore) {
      return res.status(403).json({ error: 'You do not have access to this store' });
    }

    // Store the preferred storeId for next login
    await prisma.userPreference.upsert({
      where: { userId: session.user.id },
      update: { selectedStoreId: Number(storeId) },
      create: { 
        userId: session.user.id, 
        selectedStoreId: Number(storeId) 
      },
    });

    // Return success - the session update will happen client-side
    return res.status(200).json({ message: 'Store switched successfully' });
  } catch (error: any) {
    console.error('Error in stores/switch.ts:', error.message);

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