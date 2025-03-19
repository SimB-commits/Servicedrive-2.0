// pages/api/mail/domains/setup.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { createDomainAuthentication } from '@/utils/sendgridDomain';
import { logger } from '@/utils/logger';
import { z } from 'zod';

const prisma = new PrismaClient();

// Zod schema för att validera domännamn
const domainSchema = z.object({
  domain: z.string().min(4).regex(/^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/, {
    message: "Ogiltigt domännamn. Använd ett korrekt formaterat domännamn som exempel.se"
  })
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

    // Endast POST-metod är tillåten
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // Validera inkommande domännamn med Zod
    try {
      const { domain } = domainSchema.parse(req.body);
      
      // Kontrollera om denna domän redan är registrerad för denna butik
      const existingDomain = await prisma.verifiedDomain.findFirst({
        where: {
          domain: domain.toLowerCase(),
          storeId: storeId
        }
      });
      
      if (existingDomain) {
        return res.status(400).json({ 
          error: 'Denna domän är redan registrerad för din butik',
          existingId: existingDomain.domainId
        });
      }
      
      // Skapa en ny domänautentisering i SendGrid
      const domainAuthResult = await createDomainAuthentication(domain);
      
      if (!domainAuthResult) {
        return res.status(500).json({ error: 'Kunde inte starta domänverifiering' });
      }
      
      // Spara domänen i databasen
      await prisma.verifiedDomain.create({
        data: {
          domain: domain.toLowerCase(),
          domainId: domainAuthResult.id,
          storeId: storeId,
          status: 'pending',
          createdAt: new Date()
        }
      });
      
      // Formatera DNS-records för enklare användning i frontend
      const dnsRecords = [];
      
      // CNAME-record för autentisering
      if (domainAuthResult.dns?.cname) {
        const { host, data } = domainAuthResult.dns.cname;
        dnsRecords.push({
          type: 'CNAME',
          host,
          data,
          name: 'För domänverifiering'
        });
      }
      
      // DKIM-records
      if (domainAuthResult.dns?.dkim1) {
        const { host, data } = domainAuthResult.dns.dkim1;
        dnsRecords.push({
          type: 'CNAME',
          host,
          data,
          name: 'För DKIM-signering (del 1)'
        });
      }
      
      if (domainAuthResult.dns?.dkim2) {
        const { host, data } = domainAuthResult.dns.dkim2;
        dnsRecords.push({
          type: 'CNAME',
          host,
          data,
          name: 'För DKIM-signering (del 2)'
        });
      }
      
      // Mail-records om de finns
      if (domainAuthResult.dns?.mail) {
        const { host, data } = domainAuthResult.dns.mail;
        dnsRecords.push({
          type: 'MX',
          host,
          data,
          priority: 10,
          name: 'För mailmottagning (endast om du vill använda SendGrid för inkommande e-post)'
        });
      }
      
      return res.status(200).json({
        id: domainAuthResult.id,
        domain: domain,
        dnsRecords: dnsRecords,
        message: 'Domänverifiering har startats'
      });
      
    } catch (error) {
      // Om det är ett Zod-valideringsfel
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        return res.status(400).json({ message: 'Valideringsfel', errors });
      }
      
      // Andra fel
      logger.error('Fel vid setup av domän', {
        error: error.message,
        storeId: storeId
      });
      
      return res.status(500).json({ error: 'Kunde inte starta domänverifiering: ' + error.message });
    }
  } catch (error: any) {
    logger.error('Error in domains/setup.ts:', { error: error.message });

    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }

    return res.status(500).json({ message: 'Ett internt serverfel uppstod.', details: error.message });
  } finally {
    await prisma.$disconnect();
  }
}