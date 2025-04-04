// pages/api/customers/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import { updateCustomerSchema } from '@/utils/validation';
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

          // Om e-postadressen ändras, kontrollera att den inte redan används av en annan kund i samma butik
          if (email && email !== customer.email) {
            const existingCustomerWithEmail = await prisma.customer.findFirst({
              where: {
                email: email,
                storeId: session.user.storeId,
                id: { not: customerId }, // Exkludera nuvarande kund från sökningen
              },
            });

            if (existingCustomerWithEmail) {
              return res.status(400).json({ 
                message: 'Valideringsfel', 
                errors: [{ field: 'email', message: 'E-postadressen används redan av en annan kund' }] 
              });
            }
          }

          // Bygga updateData med endast de fält som skickats med
          const updateData: any = {};
          
          if (firstName !== undefined) updateData.firstName = firstName;
          if (lastName !== undefined) updateData.lastName = lastName;
          if (email !== undefined) updateData.email = email;
          if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
          if (address !== undefined) updateData.address = address;
          if (postalCode !== undefined) updateData.postalCode = postalCode;
          if (city !== undefined) updateData.city = city;
          if (country !== undefined) updateData.country = country;
          
          // Hantera dateOfBirth korrekt - tillåt undefined och null
          if (dateOfBirth !== undefined) {
            updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
          }
          
          if (newsletter !== undefined) updateData.newsletter = newsletter;
          if (loyal !== undefined) updateData.loyal = loyal;
          if (dynamicFields !== undefined) updateData.dynamicFields = dynamicFields;

          // Uppdatera kunden
          const updatedCustomer = await prisma.customer.update({
            where: { id: customerId },
            data: updateData,
          });

          res.status(200).json(updatedCustomer);
        } catch (error) {
          console.error('Uppdateringsfel:', error);
          
          // Kontrollera om det är ett Prisma-fel
          if (error.code === 'P2002') {
            // Unikt constraint-fel (t.ex. e-postadress måste vara unik)
            return res.status(400).json({
              message: 'Valideringsfel',
              errors: [{ field: 'email', message: 'E-postadressen används redan av en annan kund' }]
            });
          }
          
          res.status(500).json({ error: 'Server error', details: error.message });
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

          // Använd en transaktion för att ta bort kunden och alla relaterade ärenden
          await prisma.$transaction(async (tx) => {
            // 1. Först ta bort alla meddelanden som tillhör kundens ärenden
            await tx.message.deleteMany({
              where: {
                ticket: {
                  customerId: customerId
                }
              }
            });
            
            // 2. Ta bort alla kundens ärenden
            await tx.ticket.deleteMany({
              where: {
                customerId: customerId
              }
            });
            
            // 3. Till sist ta bort själva kunden
            await tx.customer.delete({
              where: { id: customerId }
            });
          });

          res.status(204).end();
        } catch (error) {
          console.error('Fel vid borttagning:', error);
          res.status(500).json({ error: 'Server error' });
        }
        break;

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('Error in customers/[id].ts:', error.message);

    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }
    
    // Hantera Prisma-fel
    if (error.code === 'P2002') {
      // Unikt constraint-fel (t.ex. e-postadress måste vara unik)
      return res.status(400).json({
        message: 'Valideringsfel',
        errors: [{ field: 'email', message: 'E-postadressen används redan av en annan kund' }]
      });
    }

    // Kontrollera om felet redan har skickats som svar
    if (!res.headersSent) {
      res.status(500).json({ message: 'Ett internt serverfel uppstod.', details: error.message });
    }
  } finally {
    await prisma.$disconnect();
  }
}