// pages/api/mail/domains/[id]/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { deleteDomainAuthentication } from '@/utils/sendgridDomain';
import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

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
    
    // Hämta domän-ID från URL-parametern
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Domän-ID krävs' });
    }

    // Kontrollera att domänen tillhör denna butik
    const domainRecord = await prisma.verifiedDomain.findFirst({
      where: {
        domainId: id,
        storeId: storeId
      }
    });
    
    if (!domainRecord) {
      return res.status(404).json({ error: 'Domänen hittades inte för denna butik' });
    }

    // Hantera olika metoder
    switch (req.method) {
      case 'DELETE':
        try {
          // Ta bort domänen från SendGrid
          const deleteResult = await deleteDomainAuthentication(id);
          
          // Ta bort domänen från databasen även om SendGrid-borttagningen misslyckas
          await prisma.verifiedDomain.delete({
            where: { id: domainRecord.id }
          });
          
          return res.status(200).json({
            message: 'Domänen har tagits bort',
            domain: domainRecord.domain
          });
          
        } catch (error) {
          logger.error('Fel vid borttagning av domän', {
            error: error.message,
            domainId: id,
            storeId: storeId
          });
          
          // Även om SendGrid-borttagningen misslyckas, försök ta bort från databasen
          try {
            await prisma.verifiedDomain.delete({
              where: { id: domainRecord.id }
            });
          } catch (dbError) {
            logger.error('Kunde inte ta bort domän från databasen', {
              error: dbError.message,
              domainId: domainRecord.id
            });
          }
          
          return res.status(500).json({ error: 'Kunde inte ta bort domänen från SendGrid men den har tagits bort från databasen' });
        }

      case 'GET':
        // Returnera domäninformation
        return res.status(200).json({
          id: domainRecord.domainId,
          domain: domainRecord.domain,
          status: domainRecord.status,
          createdAt: domainRecord.createdAt,
          verifiedAt: domainRecord.verifiedAt
        });

      default:
        res.setHeader('Allow', ['GET', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error: any) {
    logger.error('Error in domains/[id]/index.ts:', { error: error.message });

    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }

    return res.status(500).json({ message: 'Ett internt serverfel uppstod.', details: error.message });
  } finally {
    await prisma.$disconnect();
  }
}