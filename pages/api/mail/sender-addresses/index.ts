// pages/api/mail/sender-addresses/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { getVerifiedSenderAddresses, validateSenderEmail, saveSenderAddress } from '@/utils/sendgrid';
import { z } from 'zod';
import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

// Valideringsschema för skapande eller uppdatering av avsändaradress
const senderAddressSchema = z.object({
  email: z.string().email('Ogiltig e-postadress'),
  name: z.string().max(100, 'Namnet får max vara 100 tecken').optional(),
  isDefault: z.boolean().optional().default(false)
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

    // Logga begäran för debug-ändamål
    logger.debug(`${req.method} request to /api/mail/sender-addresses`, { 
      storeId,
      method: req.method,
      userId: session.user.id
    });

    switch (req.method) {
      // GET - Hämta alla avsändaradresser för butiken
      case 'GET':
        try {
          // Hämta verifierade avsändaradresser från SendGrid API och/eller databasen
          const addresses = await getVerifiedSenderAddresses(storeId);
          return res.status(200).json(addresses);
        } catch (error) {
          logger.error('Fel vid hämtning av avsändaradresser', {
            error: error.message,
            storeId
          });
          return res.status(500).json({ error: 'Kunde inte hämta avsändaradresser' });
        }

      // POST - Skapa eller uppdatera en avsändaradress
      case 'POST':
        try {
          // Validera inkommande data
          const parseResult = senderAddressSchema.safeParse(req.body);
          if (!parseResult.success) {
            const errors = parseResult.error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
            }));
            return res.status(400).json({ message: 'Valideringsfel', errors });
          }

          const { email, name, isDefault } = parseResult.data;

          // Validera att emailadressen kan användas (är från verifierad domän)
          const validation = validateSenderEmail(email);
          if (!validation.valid) {
            return res.status(400).json({ error: validation.reason });
          }

          // Spara eller uppdatera avsändaradressen
          const result = await saveSenderAddress(
            storeId,
            email,
            name,
            isDefault
          );

          if (result.success) {
            logger.info('Avsändaradress sparad', { 
              email: email.split('@')[0].substring(0, 2) + '***@' + email.split('@')[1],
              isDefault,
              storeId
            });
            
            return res.status(201).json(result.data);
          } else {
            return res.status(400).json({ error: result.error });
          }
        } catch (error) {
          logger.error('Fel vid skapande/uppdatering av avsändaradress', {
            error: error.message,
            storeId
          });
          return res.status(500).json({ error: 'Ett internt fel inträffade' });
        }

      // DELETE - Ta bort en avsändaradress
      case 'DELETE':
        try {
          const { email } = req.body;
          
          if (!email) {
            return res.status(400).json({ error: 'E-postadress måste anges' });
          }
          
          // Kontrollera att adressen finns för denna butik
          const existingAddress = await prisma.senderAddress.findFirst({
            where: {
              storeId,
              email
            }
          });
          
          if (!existingAddress) {
            return res.status(404).json({ error: 'Avsändaradressen hittades inte' });
          }
          
          // Ta bort adressen
          await prisma.senderAddress.delete({
            where: {
              id: existingAddress.id
            }
          });
          
          logger.info('Avsändaradress borttagen', { 
            email: email.split('@')[0].substring(0, 2) + '***@' + email.split('@')[1],
            storeId
          });
          
          return res.status(200).json({ message: 'Avsändaradressen har tagits bort' });
        } catch (error) {
          logger.error('Fel vid borttagning av avsändaradress', {
            error: error.message,
            storeId
          });
          return res.status(500).json({ error: 'Ett internt fel inträffade' });
        }
        
      // PUT - Uppdatera en befintlig avsändaradress
      case 'PUT':
        try {
          const { id, name, isDefault } = req.body;
          
          if (!id) {
            return res.status(400).json({ error: 'Adress-ID måste anges' });
          }
          
          // Kontrollera att adressen finns för denna butik
          const existingAddress = await prisma.senderAddress.findFirst({
            where: {
              id: Number(id),
              storeId
            }
          });
          
          if (!existingAddress) {
            return res.status(404).json({ error: 'Avsändaradressen hittades inte' });
          }
          
          // Om adressen ska vara standard, avaktivera andra standardadresser
          if (isDefault) {
            await prisma.senderAddress.updateMany({
              where: { 
                storeId, 
                isDefault: true 
              },
              data: { 
                isDefault: false 
              }
            });
          }
          
          // Uppdatera adressen
          const updatedAddress = await prisma.senderAddress.update({
            where: {
              id: Number(id)
            },
            data: {
              name: name !== undefined ? name : existingAddress.name,
              isDefault: isDefault !== undefined ? isDefault : existingAddress.isDefault
            }
          });
          
          logger.info('Avsändaradress uppdaterad', { 
            id,
            email: existingAddress.email.split('@')[0].substring(0, 2) + '***@' + existingAddress.email.split('@')[1],
            isDefault: updatedAddress.isDefault,
            storeId
          });
          
          return res.status(200).json(updatedAddress);
        } catch (error) {
          logger.error('Fel vid uppdatering av avsändaradress', {
            error: error.message,
            storeId
          });
          return res.status(500).json({ error: 'Ett internt fel inträffade' });
        }

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error: any) {
    logger.error('Error in sender-addresses/index.ts:', { 
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