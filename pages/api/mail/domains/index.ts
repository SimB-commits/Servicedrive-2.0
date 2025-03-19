// pages/api/mail/domains/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { getDomainAuthentication } from '@/utils/sendgridDomain';
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

    switch (req.method) {
      case 'GET':
        // Hämta alla verifierade domäner
        try {
          // Hämta domäner från SendGrid API
          const domains = await getDomainAuthentication();
          
          // Filtrera domäner baserat på butik genom att matcha mot domäner i databasen
          const storeDomains = await prisma.verifiedDomain.findMany({
            where: { storeId: storeId }
          });
          
          const storeDomainsIds = storeDomains.map(d => d.domainId);
          
          // Filtrera SendGrid-domäner baserat på vilka som finns i databasen för denna butik
          const filteredDomains = domains.filter(domain => 
            storeDomainsIds.includes(domain.id) || 
            storeDomains.some(d => d.domain === domain.domain)
          );
          
          // Formatera responsen
          const response = filteredDomains.map(domain => ({
            id: domain.id,
            domain: domain.domain,
            status: domain.valid ? 'verified' : 'pending',
            verified: domain.valid,
            createdAt: domain.created_at,
            spfStatus: domain.spf?.valid ? 'valid' : 'pending',
            dkimStatus: domain.dkim?.valid ? 'valid' : 'pending',
            subdomains: domain.subdomains || []
          }));
          
          return res.status(200).json(response);
        } catch (error) {
          logger.error('Fel vid hämtning av domäner från SendGrid', {
            error: error.message,
            storeId: storeId
          });
          return res.status(500).json({ error: 'Kunde inte hämta domäner' });
        }

      default:
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error: any) {
    logger.error('Error in domains/index.ts:', { error: error.message });

    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }

    return res.status(500).json({ message: 'Ett internt serverfel uppstod.', details: error.message });
  } finally {
    await prisma.$disconnect();
  }
}