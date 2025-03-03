// src/pages/api/customers/[id].ts
//Hanterar specifika kunder baserat på ID

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions'; // Justera sökvägen om nödvändigt
import { updateCustomerSchema } from '../../../utils/validation';
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
    const { id } = req.query;

    // Validera att id är ett nummer
    const customerId = Number(id);
    if (isNaN(customerId)) {
      return res.status(400).json({ error: 'Ogiltigt kund-ID' });
    }

    switch (method) {
      case 'GET':
        try {
          const customer = await prisma.customer.findUnique({
            where: { id: customerId },
          });

          if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
          }

          // Store Check: Säkerställ att kunden tillhör användarens butik
          if (customer.storeId !== session.user.storeId) {
            return res.status(403).json({ error: 'Forbidden' });
          }

          res.status(200).json(customer);
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Server error' });
        }
        break;

      case 'PUT':
        try {
          // Validera inkommande data med Zod
          const parseResult = updateCustomerSchema.safeParse(req.body);

          if (!parseResult.success) {
            const errors = parseResult.error.errors.map((err) => ({
              field: err.path.join('.'),
              message: err.message,
            }));
            return res.status(400).json({ message: 'Valideringsfel', errors });
          }

          const { name, email, phoneNumber } = parseResult.data;

          // Hämta kunden från databasen
          const customer = await prisma.customer.findUnique({
            where: { id: customerId },
          });

          if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
          }

          // Store Check: Säkerställ att kunden tillhör användarens butik
          if (customer.storeId !== session.user.storeId) {
            return res.status(403).json({ error: 'Forbidden' });
          }

          // Uppdatera kunden
          const updatedCustomer = await prisma.customer.update({
            where: { id: customerId },
            data: { name, email, phoneNumber },
          });

          res.status(200).json(updatedCustomer);
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Server error' });
        }
        break;

      case 'DELETE':
        try {
          const customer = await prisma.customer.findUnique({
            where: { id: customerId },
          });

          if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
          }

          // Store Check: Säkerställ att kunden tillhör användarens butik
          if (customer.storeId !== session.user.storeId) {
            return res.status(403).json({ error: 'Forbidden' });
          }

          await prisma.customer.delete({
            where: { id: customerId },
          });

          res.status(204).end();
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Server error' });
        }
        break;

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('Error in [id].ts:', error.message);

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
