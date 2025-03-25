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
      // Försök verifiera reply-domänen (förbättrad version)
      // Den förbättrade verifyReplyDomain-funktionen returnerar alltid DNS-poster
      const verificationResult = await verifyReplyDomain(domainId, storeId);
      
      if (!verificationResult) {
        throw new Error('Verifiering returnerade inget resultat');
      }
      
      // Logga detaljerad information om verifieringsförsöket
      logger.info('Verifieringsförsök för reply-domän', {
        domainId,
        domain: domainRecord.domain,
        storeId,
        success: verificationResult.success,
        verified: verificationResult.verified,
        dnsRecordsReturned: !!verificationResult.dnsRecords && verificationResult.dnsRecords.length > 0
      });
      
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
          dnsRecords: verificationResult.dnsRecords || [], // Inkludera alltid DNS-poster
          message: 'Reply-domänen har verifierats!'
        });
      } else {
        logger.info('Reply-domän kunde inte verifieras', {
          domainId,
          domain: domainRecord.domain,
          storeId,
          reason: verificationResult.message
        });
        
        return res.status(200).json({
          success: true,
          verified: false,
          domain: domainRecord.domain,
          dnsRecords: verificationResult.dnsRecords || [], // Inkludera alltid DNS-poster även vid misslyckad verifiering
          message: verificationResult.message || 'DNS-posterna har inte verifierats än, kontrollera att de är korrekt konfigurerade.'
        });
      }
    } catch (error) {
      logger.error('Fel vid verifiering av reply-domän', {
        error: error.message,
        domainId,
        domain: domainRecord.domain,
        storeId
      });
      
      // Försök hämta DNS-poster även vid fel, för att hjälpa användaren
      try {
        // Se först om vi kan få DNS-poster via getDomainAuthenticationById
        const domainDetails = await getDomainAuthenticationById(domainId);
        let dnsRecords = [];
        
        if (domainDetails && domainDetails.dns) {
          // Extrahera tillgängliga DNS-poster
          if (domainDetails.dns.mail) {
            dnsRecords.push({
              type: 'MX',
              host: domainDetails.dns.mail.host,
              data: domainDetails.dns.mail.data,
              priority: 10,
              name: 'För mailmottagning'
            });
          }
          
          if (domainDetails.dns.spf) {
            dnsRecords.push({
              type: 'TXT',
              host: domainDetails.dns.spf.host,
              data: domainDetails.dns.spf.data,
              name: 'SPF-post för mailautentisering'
            });
          }
          
          if (domainDetails.dns.cname) {
            dnsRecords.push({
              type: 'CNAME',
              host: domainDetails.dns.cname.host,
              data: domainDetails.dns.cname.data,
              name: 'För domänverifiering'
            });
          }
        }
        
        // Om inga DNS-poster hittades, skapa generiska fallback-poster
        if (dnsRecords.length === 0) {
          dnsRecords = [
            {
              type: 'MX',
              host: domainRecord.domain,
              data: 'mx.sendgrid.net',
              priority: 10,
              name: 'För hantering av inkommande mail'
            },
            {
              type: 'TXT',
              host: domainRecord.domain,
              data: 'v=spf1 include:sendgrid.net ~all',
              name: 'SPF-post för mailautentisering'
            },
            {
              type: 'CNAME',
              host: `em.${domainRecord.domain}`,
              data: 'u17504275.wl.sendgrid.net', // Kan behöva ändras beroende på SendGrid-konfiguration
              name: 'För verifiering av subdomän'
            }
          ];
        }
        
        return res.status(500).json({ 
          error: 'Verifieringsfel', 
          message: `Kunde inte verifiera reply-domänen: ${error.message}`,
          dnsRecords: dnsRecords // Returnera DNS-poster även vid fel
        });
      } catch (dnsError) {
        // Om vi inte kan hämta DNS-poster, returnera generiska fallback-poster
        const fallbackDnsRecords = [
          {
            type: 'MX',
            host: domainRecord.domain,
            data: 'mx.sendgrid.net',
            priority: 10,
            name: 'För hantering av inkommande mail'
          },
          {
            type: 'TXT',
            host: domainRecord.domain,
            data: 'v=spf1 include:sendgrid.net ~all',
            name: 'SPF-post för mailautentisering'
          },
          {
            type: 'CNAME',
            host: `em.${domainRecord.domain}`,
            data: 'u17504275.wl.sendgrid.net', // Kan behöva ändras beroende på SendGrid-konfiguration
            name: 'För verifiering av subdomän'
          }
        ];
        
        return res.status(500).json({ 
          error: 'Verifieringsfel', 
          message: `Kunde inte verifiera reply-domänen: ${error.message}`,
          dnsRecords: fallbackDnsRecords // Returnera fallback-poster även vid fel
        });
      }
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