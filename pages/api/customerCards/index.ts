// src/pages/api/customerCards/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions'; // Justera sökvägen om nödvändigt
import { createCustomerCardSchema } from '@/utils/validation';
import rateLimiter from '@/lib/rateLimiterApi';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate Limiting: Begränsa antalet förfrågningar per användare/IP
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Autentisering: Kontrollera om användaren är inloggad
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { method } = req;
    const storeId = session.user.storeId;

    switch (method) {
      case 'GET': {
        try {
          const customerCards = await prisma.customerCard.findMany({
            where: { storeId: storeId as number },
          });
          return res.status(200).json(customerCards);
        } catch (error) {
          console.error('GET /api/customerCards error:', error);
          return res.status(500).json({ message: 'Server error vid hämtning av kundkort.' });
        }
      }
      
      case 'POST': {
        try {
          // Validate incoming data with Zod
          const parseResult = createCustomerCardSchema.safeParse(req.body);
          console.log('parseResult:', parseResult);
          if (!parseResult.success) {
            const errors = parseResult.error.errors.map((err) => ({
              field: err.path.join('.'),
              message: err.message,
            }));
            return res.status(400).json({ message: 'Valideringsfel', errors });
          }
          const data = parseResult.data;

          // Check if a customer card with the same email already exists for the store (if email is sent)
          if (data.email) {
            const existingCard = await prisma.customerCard.findFirst({
              where: {
                email: data.email,
                storeId,
              },
            });
            if (existingCard) {
              return res.status(400).json({ message: 'Kundkort med denna email finns redan.' });
            }
          }

          // If no customer cards exist for the store, set the new one as default
          const existingCards = await prisma.customerCard.findMany({
            where: { storeId },
          });
          
          const isDefault = existingCards.length === 0;
          const newCard = await prisma.customerCard.create({
            data: {
              firstName: data.firstName || null,
              lastName: data.lastName || null,
              address: data.address || null,
              postalCode: data.postalCode || null,
              city: data.city || null,
              country: data.country || null,
              dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
              email: data.email || null,
              phoneNumber: data.phoneNumber || null,
              newsletter: data.newsletter ?? false,
              loyal: data.loyal ?? false,
              dynamicFields: data.dynamicFields || {},
              storeId: storeId as number,
              isDefault: isDefault,
            },
          });
          
          return res.status(201).json(newCard);
        } catch (error) {
          console.error('POST /api/customerCards error:', error);
          return res.status(500).json({ message: 'Server error vid skapande av kundkort.' });
        }
      }
      
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('Error in /api/customerCards/index.ts:', error.message);
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
