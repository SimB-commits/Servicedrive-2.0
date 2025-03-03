import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { createMailTemplateSchema, CreateMailTemplateInput } from '@/utils/validation';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`Received ${req.method} request on /api/mail/templates`);
  
  try {
    // Rate limiting
    const xForwardedFor = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor) || req.socket.remoteAddress || 'unknown';
    await rateLimiter.consume(ip);
    console.log('Rate limiter passed');

    // Autentisering
    const session = await getServerSession(req, res, authOptions);
    console.log('Session:', session);
    if (!session || session.user.role !== 'ADMIN') {
      console.log('Unauthorized or not ADMIN');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Kontrollera storeId
    const storeId = session.user.storeId;
if (storeId === null || storeId === undefined) {
  return res.status(400).json({ error: 'StoreId saknas i sessionen' });
}

    const { method } = req;
    switch (method) {
      case 'GET': {
        try {
          const templates = await prisma.mailTemplate.findMany({
            where: { storeId: storeId },
          });
          return res.status(200).json(templates);
        } catch (error) {
          console.error(error);
          return res.status(500).json({ error: 'Server error' });
        }
      }
      case 'POST': {
        try {
          // Validera inkommande data
          const parseResult = createMailTemplateSchema.safeParse(req.body);
          if (!parseResult.success) {
            const errors = parseResult.error.errors.map((err) => ({
              field: err.path.join('.'),
              message: err.message,
            }));
            console.log('Validation errors:', errors);
            return res.status(400).json({ message: 'Validation error', errors });
          }
          const { name, subject, body } = parseResult.data as CreateMailTemplateInput;

          // Skapa ny mall
          const newTemplate = await prisma.mailTemplate.create({
            data: {
              name,
              subject,
              body,
              storeId: storeId,
            },
          });
          return res.status(201).json(newTemplate);
        } catch (error) {
          console.error(error);
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2002') { // Unik nyckel-konflikt
              return res.status(400).json({ error: 'En mall med samma namn finns redan.' });
            }
          }
          return res.status(500).json({ error: 'Server error' });
        }
      }
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('Error in mail/templates/index.ts:', error.message);
    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'Too many requests. Try again later.' });
    }
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Internal server error' });
    }
  } finally {
    await prisma.$disconnect();
  }
}