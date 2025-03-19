// pages/api/mail/sender-addresses/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { validateSenderEmail } from '@/utils/sendgrid';
import { z } from 'zod';
import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

// Valideringsschema för uppdatering av avsändaradress
const updateSenderAddressSchema = z.object({
  name: z.string().max(100, 'Namnet får max vara 100 tecken').optional(),
  isDefault: z.boolean().optional()
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate Limiting
    const ip = req.socket.remoteAddress || 'unknown';
    await rateLimiter.consume(ip);

    // Autentisering - endast inloggade användare med ADMIN-roll
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Kontrollera att butik finns i sessionen
    if (!session.user.storeId) {
      return res.status(400).json({ error: 'Ingen butik vald' });
    }
    
    const storeId = session.user.storeId;
    
    // Validera ID-parametern
    const { id } = req.query;
    if (!id || typeof id !== 'string' || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Ogiltigt ID-format' });
    }
    
    const addressId = parseInt(id);

    // Kontrollera att adressen finns och tillhör denna butik
    const senderAddress = await prisma.senderAddress.findFirst({
      where: {
        id: addressId,
        storeId
      }
    });
    
    if (!senderAddress) {
      return res.status(404).json({ error: 'Avsändaradressen hittades inte' });
    }

    // Logga begäran för debug-ändamål
    logger.debug(`${req.method} request to /api/mail/sender-addresses/${id}`, { 
      storeId,
      method: req.method,
      userId: session.user.id,
      addressId
    });

    switch (req.method) {
      // GET - Hämta information om en specifik avsändaradress
      case 'GET':
        return res.status(200).json(senderAddress);

      // PUT - Uppdatera en befintlig avsändaradress
      case 'PUT':
        try {
          // Validera inkommande data
          const parseResult = updateSenderAddressSchema.safeParse(req.body);
          if (!parseResult.success) {
            const errors = parseResult.error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
            }));
            return res.status(400).json({ message: 'Valideringsfel', errors });
          }

          const { name, isDefault } = parseResult.data;
          
          // Om adressen ska vara standard, avaktivera andra standardadresser
          if (isDefault) {
            await prisma.senderAddress.updateMany({
              where: { 
                storeId, 
                isDefault: true,
                id: { not: addressId }
              },
              data: { 
                isDefault: false 
              }
            });
          }
          
          // Uppdatera avsändaradressen
          const updatedAddress = await prisma.senderAddress.update({
            where: { id: addressId },
            data: { 
              name: name !== undefined ? name : senderAddress.name,
              isDefault: isDefault !== undefined ? isDefault : senderAddress.isDefault
            }
          });
          
          logger.info('Avsändaradress uppdaterad', { 
            id: addressId,
            email: senderAddress.email.split('@')[0].substring(0, 2) + '***@' + senderAddress.email.split('@')[1],
            isDefault: updatedAddress.isDefault,
            storeId
          });
          
          return res.status(200).json(updatedAddress);
        } catch (error) {
          logger.error('Fel vid uppdatering av avsändaradress', {
            error: error.message,
            id: addressId,
            storeId
          });
          return res.status(500).json({ error: 'Ett internt fel inträffade' });
        }

      // DELETE - Ta bort en avsändaradress
      case 'DELETE':
        try {
          // Ta bort adressen
          await prisma.senderAddress.delete({
            where: { id: addressId }
          });
          
          logger.info('Avsändaradress borttagen', { 
            id: addressId,
            email: senderAddress.email.split('@')[0].substring(0, 2) + '***@' + senderAddress.email.split('@')[1],
            storeId
          });
          
          return res.status(200).json({ 
            message: 'Avsändaradressen har tagits bort',
            id: addressId
          });
        } catch (error) {
          logger.error('Fel vid borttagning av avsändaradress', {
            error: error.message,
            id: addressId,
            storeId
          });
          return res.status(500).json({ error: 'Ett internt fel inträffade' });
        }

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error: any) {
    logger.error('Error in sender-addresses/[id].ts:', { 
      error: error.message,
      stack: error.stack?.substring(0, 500) 
    });

    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }

    return res.status(500).json({ message: 'Ett internt serverfel uppstod.' });
  } finally {
    await prisma.$disconnect();
  }
}