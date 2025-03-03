// pages/api/customers/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import { createCustomerSchema } from '@/utils/validation';
import rateLimiter from '@/lib/rateLimiterApi';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate Limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Autentisering
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { method } = req;

    switch (method) {
      case 'GET':
        try {
          // Hantera sökning om search-parameter skickats med
          const { search } = req.query;
          
          if (search && typeof search === 'string') {
            const customers = await prisma.customer.findMany({
              where: {
                storeId: session.user.storeId,
                OR: [
                  { firstName: { contains: search, mode: 'insensitive' } },
                  { lastName: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } },
                ],
              },
            });
            return res.status(200).json(customers);
          }
          
          // Annars, hämta alla kunder för denna butik
          const customers = await prisma.customer.findMany({
            where: { storeId: session.user.storeId },
          });
          res.status(200).json(customers);
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Server error' });
        }
        break;

      case 'POST':
        try {
          // Validera inkommande data med Zod
          const parseResult = createCustomerSchema.safeParse(req.body);
          console.log('parseResult:', parseResult);

          if (!parseResult.success) {
            const errors = parseResult.error.errors.map((err) => ({
              field: err.path.join('.'),
              message: err.message,
            }));
            return res.status(400).json({ message: 'Valideringsfel', errors });
          }

          // Extrahera alla fält från validerad data
          const { 
            firstName, 
            lastName, 
            email, 
            phoneNumber, 
            address, 
            postalCode, 
            city, 
            country, 
            dateOfBirth, 
            newsletter, 
            loyal, 
            dynamicFields 
          } = parseResult.data;

          // Kontrollera om kunden redan finns inom butiken
          const existingCustomer = await prisma.customer.findFirst({
            where: {
              email,
              storeId: session.user.storeId,
            },
          });

          if (existingCustomer) {
            return res.status(400).json({ message: 'Kund med denna email finns redan.' });
          }

          // Skapa ny kund - säkerställ att varje fält hamnar i rätt kolumn i databasen
          const newCustomer = await prisma.customer.create({
            data: {
              firstName,
              lastName,
              email,
              phoneNumber,
              address,
              postalCode,
              city,
              country,
              dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
              newsletter: newsletter || false,
              loyal: loyal || false,
              dynamicFields: dynamicFields || {},
              storeId: session.user.storeId,
            },
          });

          res.status(201).json(newCustomer);
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
    console.error('Error in index.ts:', error.message);

    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }

    // Kontrollera om felet redan har skickats som svar
    if (!res.headersSent) {
      res.status(500).json({ message: 'Ett internt serverfel uppstod.' });
    }
  } finally {
    await prisma.$disconnect();
  }
}