// pages/api/mail/domains/[id]/verify.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { getDomainAuthenticationById, verifyDomainAuthentication } from '@/utils/sendgridDomain';
import { logger } from '@/utils/logger';
import { createAutoReplyDomain } from '@/utils/autoReplyDomainHelper';

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

    // Endast POST-metod är tillåten (för att trigga verifiering)
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
      // Hämta aktuell status för domänen från SendGrid
      const domainStatus = await getDomainAuthenticationById(id);
      
      if (!domainStatus) {
        return res.status(404).json({ error: 'Domänen hittades inte i SendGrid' });
      }
      
      let verified = domainStatus.valid || false;
      
      // Om domänen inte redan är verifierad, försök att verifiera den
      if (!verified) {
        const verifyResult = await verifyDomainAuthentication(id);
        verified = verifyResult?.valid || false;
      }
      
      // Uppdatera status i databasen om domänen är verifierad
      if (verified) {
        await prisma.verifiedDomain.update({
          where: { id: domainRecord.id },
          data: {
            status: 'verified',
            verifiedAt: new Date()
          }
        });
        
        // Kontrollera om detta är en basdomän (inte en reply-domän eller annan subdomän)
        // Om det är en basdomän, försök skapa en reply-domän automatiskt
        if (!domainRecord.domain.startsWith('reply.')) {
          // Starta en asynkron process för att skapa reply-domänen
          // Vi väntar inte på resultatet för att inte blockera huvudprocessen
          createAutoReplyDomain(domainRecord.domain, storeId)
            .then(result => {
              if (result.success) {
                logger.info('Automatisk reply-domän skapad', {
                  baseDomain: domainRecord.domain,
                  replyDomain: result.replyDomain,
                  storeId
                });
              } else {
                logger.warn('Kunde inte skapa automatisk reply-domän', {
                  baseDomain: domainRecord.domain,
                  error: result.message,
                  storeId
                });
              }
            })
            .catch(error => {
              logger.error('Fel vid automatiskt skapande av reply-domän', {
                error: error.message,
                baseDomain: domainRecord.domain,
                storeId
              });
            });
        }
        
        // Om domänverifiering lyckades, uppdatera även konfigurationen
        // för att lägga till domänen i listan över verifierade domäner
        const currentDomains = process.env.SENDGRID_VERIFIED_DOMAINS?.split(',') || [];
        
        if (!currentDomains.includes(domainRecord.domain)) {
          // I en verklig produktionsmiljö skulle man uppdatera miljövariabeln eller
          // lagra detta på ett annat sätt. För demo syften, vi simulerar en uppdatering.
          logger.info(`Domän ${domainRecord.domain} skulle läggas till i SENDGRID_VERIFIED_DOMAINS`);
        }
      }
      
      return res.status(200).json({
        id: domainStatus.id,
        domain: domainStatus.domain,
        verified: verified,
        status: verified ? 'verified' : 'pending',
        dkimVerified: domainStatus.dkim?.valid || false,
        spfVerified: domainStatus.spf?.valid || false,
        // Lägg till information om att en reply-domän kommer att skapas
        autoReplyDomain: !domainRecord.domain.startsWith('reply.') && verified,
      });
      
    } catch (error) {
      logger.error('Fel vid verifiering av domän', {
        error: error.message,
        domainId: id,
        storeId: storeId
      });
      
      return res.status(500).json({ error: 'Kunde inte verifiera domänen: ' + error.message });
    }
  } catch (error: any) {
    logger.error('Error in domains/[id]/verify.ts:', { error: error.message });

    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }

    return res.status(500).json({ message: 'Ett internt serverfel uppstod.', details: error.message });
  } finally {
    await prisma.$disconnect();
  }
}