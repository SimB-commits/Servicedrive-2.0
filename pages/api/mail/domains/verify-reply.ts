// pages/api/mail/domains/verify-reply.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { getDomainAuthenticationById } from '@/utils/sendgridDomain';
import { verifyReplyDomain } from '@/utils/autoReplyDomainHelper';
import { logger } from '@/utils/logger';
import { z } from 'zod';

const prisma = new PrismaClient();

// Schema för validering av förfrågan
const verifyReplySchema = z.object({
  domainId: z.string().min(1, 'Domain ID krävs')
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate Limiting
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

    // Endast POST-metod är tillåten
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // Validera inkommande data med zod
    const parseResult = verifyReplySchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return res.status(400).json({ error: 'Valideringsfel', errors });
    }

    const { domainId } = parseResult.data;

    // Kontrollera att domänen existerar och tillhör butiken
    const domainRecord = await prisma.verifiedDomain.findFirst({
      where: {
        domainId,
        storeId
      }
    });

    if (!domainRecord) {
      return res.status(404).json({ error: 'Domänen hittades inte' });
    }

    // Kontrollera att det faktiskt är en reply-domän
    if (!domainRecord.domain.startsWith('reply.')) {
      return res.status(400).json({ 
        error: 'Ogiltig domän', 
        message: 'Detta API är endast för verifiering av reply-domäner'
      });
    }

    try {
      // Försök verifiera reply-domänen
      const verificationResult = await verifyReplyDomain(domainId, storeId);
      
      if (verificationResult.verified) {
        logger.info('Reply-domän verifierad via API', {
          domainId,
          domain: domainRecord.domain,
          storeId
        });
        
        return res.status(200).json({
          success: true,
          verified: true,
          domain: domainRecord.domain,
          message: 'Reply-domänen har verifierats!'
        });
      } else {
        logger.info('Reply-domän kunde inte verifieras', {
          domainId,
          domain: domainRecord.domain,
          storeId,
          reason: verificationResult.message
        });
        
        // Hämta DNS-records för att hjälpa användaren att konfigurera domänen korrekt
        try {
          const domainDetails = await getDomainAuthenticationById(domainId);
          
          // Formatera DNS-records för enklare presentation
          const dnsRecords = [];
          
          if (domainDetails?.dns) {
            // CNAME-record för verifiering
            if (domainDetails.dns.cname) {
              dnsRecords.push({
                type: 'CNAME',
                host: domainDetails.dns.cname.host,
                data: domainDetails.dns.cname.data,
                name: 'För domänverifiering'
              });
            }
            
            // DKIM-records
            if (domainDetails.dns.dkim1) {
              dnsRecords.push({
                type: 'CNAME',
                host: domainDetails.dns.dkim1.host,
                data: domainDetails.dns.dkim1.data,
                name: 'För DKIM-signering (del 1)'
              });
            }
            
            if (domainDetails.dns.dkim2) {
              dnsRecords.push({
                type: 'CNAME',
                host: domainDetails.dns.dkim2.host,
                data: domainDetails.dns.dkim2.data,
                name: 'För DKIM-signering (del 2)'
              });
            }
            
            // SPF-record
            if (domainDetails.dns.spf) {
              dnsRecords.push({
                type: 'TXT',
                host: domainDetails.dns.spf.host,
                data: domainDetails.dns.spf.data,
                name: 'SPF-post för mailautentisering'
              });
            }
            
            // Mail-record
            if (domainDetails.dns.mail) {
              dnsRecords.push({
                type: 'MX',
                host: domainDetails.dns.mail.host,
                data: domainDetails.dns.mail.data,
                priority: 10,
                name: 'För mailmottagning'
              });
            }
          }
          
          return res.status(200).json({
            success: true,
            verified: false,
            domain: domainRecord.domain,
            message: verificationResult.message,
            dnsRecords
          });
        } catch (dnsError) {
          logger.warn('Kunde inte hämta DNS-poster för reply-domän', {
            error: dnsError.message,
            domainId
          });
          
          return res.status(200).json({
            success: true,
            verified: false,
            domain: domainRecord.domain,
            message: verificationResult.message
          });
        }
      }
    } catch (error) {
      logger.error('Fel vid verifiering av reply-domän', {
        error: error.message,
        domainId,
        domain: domainRecord.domain,
        storeId
      });
      
      return res.status(500).json({ 
        error: 'Verifieringsfel', 
        message: `Kunde inte verifiera reply-domänen: ${error.message}`
      });
    }
  } catch (error: any) {
    logger.error('Error in mail/domains/verify-reply.ts:', { error: error.message });

    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }

    return res.status(500).json({ message: 'Ett internt serverfel uppstod.', details: error.message });
  } finally {
    await prisma.$disconnect();
  }
}