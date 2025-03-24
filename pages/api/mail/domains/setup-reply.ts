// pages/api/mail/domains/setup-reply.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { getDomainAuthenticationById } from '@/utils/sendgridDomain';
import { logger } from '@/utils/logger';
import { z } from 'zod';

// Valideringsschema för subdomän
const replyDomainSchema = z.object({
  parentDomainId: z.string().min(1, 'Parent domän ID krävs'),
  subdomain: z.string().regex(/^[a-z0-9][a-z0-9\-]{0,61}[a-z0-9]$/, {
    message: "Ogiltig subdomän. Använd endast bokstäver (a-z), siffror och bindestreck"
  }).default('reply')
});

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Autentisering
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return res.status(401).json({ error: 'Ej behörig' });
    }

    // Kontrollera att butik finns i sessionen
    if (!session.user.storeId) {
      return res.status(400).json({ error: 'Ingen butik vald' });
    }
    
    const storeId = session.user.storeId;

    // Endast POST är tillåtet för denna endpoint
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // Validera input med Zod
    const parseResult = replyDomainSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return res.status(400).json({ message: 'Valideringsfel', errors });
    }

    const { parentDomainId, subdomain } = parseResult.data;

    // Hämta parent-domänen
    const parentDomain = await prisma.verifiedDomain.findFirst({
      where: {
        domainId: parentDomainId,
        storeId
      }
    });

    if (!parentDomain) {
      return res.status(404).json({ error: 'Föräldradomänen hittades inte' });
    }

    // Kontrollera att parent-domänen är verifierad
    if (parentDomain.status !== 'verified') {
      return res.status(400).json({ 
        error: 'Föräldradomänen är inte verifierad',
        message: 'Endast verifierade domäner kan användas för mail-svar'
      });
    }

    // Kontrollera om subdomänen redan finns
    const existingReplyDomain = await prisma.verifiedDomain.findFirst({
      where: {
        domain: `${subdomain}.${parentDomain.domain}`,
        storeId
      }
    });

    if (existingReplyDomain) {
      return res.status(400).json({ 
        error: 'Denna subdomän finns redan',
        existingId: existingReplyDomain.domainId
      });
    }

    // Generera DNS-records för subdomänen
    // MX-post, CNAME-post, SPF-post
    const dnsRecords = [
      {
        type: 'MX',
        host: `${subdomain}.${parentDomain.domain}`,
        data: 'mx.sendgrid.net',
        priority: 10,
        name: 'För hantering av inkommande mail'
      },
      {
        type: 'CNAME',
        host: `${subdomain}.${parentDomain.domain}`,
        data: 'sendgrid.net',
        name: 'Domänverifiering för SendGrid'
      },
      {
        type: 'TXT',
        host: `${subdomain}.${parentDomain.domain}`,
        data: 'v=spf1 include:sendgrid.net ~all',
        name: 'SPF-post för mailautentisering'
      }
    ];

    // Skapa den nya subdomänen i databasen (preliminärt)
    const newDomain = await prisma.verifiedDomain.create({
      data: {
        domain: `${subdomain}.${parentDomain.domain}`,
        domainId: `reply-${Date.now()}`, // Temporärt ID, uppdateras senare
        storeId,
        status: 'pending',
        createdAt: new Date()
      }
    });

    logger.info('Reply-domän konfiguration startad', {
      domain: `${subdomain}.${parentDomain.domain}`,
      storeId
    });

    return res.status(200).json({
      id: newDomain.domainId,
      domain: newDomain.domain,
      subdomain: subdomain,
      parentDomain: parentDomain.domain,
      dnsRecords: dnsRecords,
      message: 'Domänkonfiguration startad. Lägg till DNS-posterna och verifiera sedan domänen.'
    });
  } catch (error) {
    logger.error('Error in domains/setup-reply.ts:', { error: error.message });
    
    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }
    
    return res.status(500).json({ message: 'Ett internt serverfel uppstod.', details: error.message });
  } finally {
    await prisma.$disconnect();
  }
}