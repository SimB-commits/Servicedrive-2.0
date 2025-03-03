// src/pages/api/mail/templates/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { updateMailTemplateSchema, UpdateMailTemplateInput } from '@/utils/validation';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`Received ${req.method} request on /api/mail/templates/[id]`);

  try {
    // Rate limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Autentisering
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validera ID-parameter
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid id parameter' });
    }
    
    const templateId = Number(id);
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    // Säkerställ att storeId finns
    const storeId = session.user.storeId;
    if (storeId === null) {
      return res.status(400).json({ error: 'StoreId saknas i sessionen' });
    }

    switch (req.method) {
      case 'GET': {
        const template = await prisma.mailTemplate.findUnique({
          where: { 
            id: templateId,
            storeId: storeId 
          },
        });
        return template 
          ? res.status(200).json(template)
          : res.status(404).json({ error: 'Template not found' });
      }

      case 'PUT': {
        const parseResult = updateMailTemplateSchema.safeParse(req.body);
        if (!parseResult.success) {
          const errors = parseResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          }));
          return res.status(400).json({ message: 'Validation error', errors });
        }

        const { name, subject, body } = parseResult.data;
        const updatedTemplate = await prisma.mailTemplate.update({
          where: { 
            id: templateId,
            storeId: storeId 
          },
          data: { 
            name: name || undefined,
            subject: subject || undefined,
            body: body || undefined,
          },
        });
        return res.status(200).json(updatedTemplate);
      }

      case 'DELETE': {
        const deletedTemplate = await prisma.mailTemplate.delete({
          where: { 
            id: templateId,
            storeId: storeId 
          },
        });
        return res.status(200).json(deletedTemplate);
      }

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('Error:', error);

    if (error.code === 'P2025') { // Prisma not found error
      return res.status(404).json({ error: 'Template not found' });
    }
    
    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'Too many requests' });
    }

    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  } finally {
    await prisma.$disconnect();
  }
}