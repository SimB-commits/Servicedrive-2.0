// pages/api/mail/sender-addresses/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { getVerifiedSenderAddresses, validateSenderEmail, saveSenderAddress } from '@/utils/sendgrid';
import { z } from 'zod';

const prisma = new PrismaClient();

// Valideringsschema för skapande av ny avsändaradress
const createSenderAddressSchema = z.object({
  email: z.string().email('Ogiltig e-postadress'),
  name: z.string().min(1, 'Namn krävs').max(50, 'Namnet får max vara 50 tecken').optional(),
  isDefault: z.boolean().optional().default(false)
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate Limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Autentisering
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Kontrollera att butik finns i sessionen
    if (!session.user.storeId) {
      return res.status(400).json({ error: 'Ingen butik vald' });
    }
    
    const storeId = session.user.storeId;

    switch (req.method) {
      case 'GET':
        // Hämta verifierade avsändaradresser
        const senderAddresses = await getVerifiedSenderAddresses(storeId);
        return res.status(200).json(senderAddresses);

      case 'POST':
        // Validera inkommande data
        const parseResult = createSenderAddressSchema.safeParse(req.body);
        if (!parseResult.success) {
          const errors = parseResult.error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          }));
          return res.status(400).json({ message: 'Valideringsfel', errors });
        }

        const { email, name, isDefault } = parseResult.data;

        // Validera att emailadressen kan användas
        const validation = validateSenderEmail(email);
        if (!validation.valid) {
          return res.status(400).json({ error: validation.reason });
        }

        // Spara avsändaradressen
        const result = await saveSenderAddress(
          storeId,
          email,
          name,
          isDefault
        );

        if (result.success) {
          return res.status(201).json(result.data);
        } else {
          return res.status(400).json({ error: result.error });
        }

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('Error in sender-addresses/index.ts:', error.message);

    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }

    return res.status(500).json({ message: 'Ett internt serverfel uppstod.', details: error.message });
  } finally {
    await prisma.$disconnect();
  }
}