// pages/api/mail/domains/[id]/verify.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { getDomainAuthenticationById, verifyDomainAuthentication } from '@/utils/sendgridDomain';
import { logger } from '@/utils/logger';
import { createAutoReplyDomain, verifyReplyDomain } from '@/utils/autoReplyDomainHelper';

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

    // Kontrollera om detta är en reply-domän (subdomän som börjar med "reply.")
    const isReplyDomain = domainRecord.domain.startsWith('reply.');

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
        
        // Olika hantering beroende på om det är en basdomän eller reply-domän
        if (isReplyDomain) {
          // För reply-domän: Uppdatera inställningarna för e-postsvar
          await updateReplyDomainSettings(domainRecord.domain, storeId, true);
          
          return res.status(200).json({
            id: domainStatus.id,
            domain: domainStatus.domain,
            verified: verified,
            status: verified ? 'verified' : 'pending',
            isReplyDomain: true,
            dkimVerified: domainStatus.dkim?.valid || false,
            spfVerified: domainStatus.spf?.valid || false,
          });
        } else {
          // För basdomän: Starta processen för att skapa reply-domän
          // Returnera resultatet innan reply-domänskapandet är klart
          // (reply-domänen kräver separat verifiering)
          const autoReplyResult = await createAutoReplyDomain(domainRecord.domain, storeId);
          
          return res.status(200).json({
            id: domainStatus.id,
            domain: domainStatus.domain,
            verified: verified,
            status: verified ? 'verified' : 'pending',
            dkimVerified: domainStatus.dkim?.valid || false,
            spfVerified: domainStatus.spf?.valid || false,
            // Lägg till information om reply-domänen
            autoReplyDomain: autoReplyResult.success,
            replyDomainInfo: {
              domain: autoReplyResult.replyDomain,
              domainId: autoReplyResult.domainId,
              status: autoReplyResult.needsVerification ? 'pending' : 'verified',
              dnsRecords: autoReplyResult.dnsRecords || [],
              message: autoReplyResult.message
            }
          });
        }
      } else {
        // Om verifieringen misslyckades
        return res.status(200).json({
          id: domainStatus.id,
          domain: domainStatus.domain,
          verified: false,
          status: 'pending',
          isReplyDomain,
          dkimVerified: domainStatus.dkim?.valid || false,
          spfVerified: domainStatus.spf?.valid || false,
          message: 'Domänen kunde inte verifieras. Kontrollera att DNS-posterna är korrekt inställda.'
        });
      }
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

/**
 * Uppdaterar inställningen för svarsdomän i databasen
 */
async function updateReplyDomainSettings(replyDomain: string, storeId: number, verified: boolean): Promise<void> {
  try {
    // Uppdatera eller skapa inställningen för reply-domän
    await prisma.setting.upsert({
      where: {
        key_storeId: {
          key: 'REPLY_DOMAIN',
          storeId
        }
      },
      update: {
        value: replyDomain,
        updatedAt: new Date()
      },
      create: {
        key: 'REPLY_DOMAIN',
        value: replyDomain,
        storeId
      }
    });
    
    // Markera denna reply-domän som automatiskt konfigurerad
    await prisma.setting.upsert({
      where: {
        key_storeId: {
          key: 'REPLY_DOMAIN_AUTO_CONFIGURED',
          storeId
        }
      },
      update: {
        value: 'true',
        updatedAt: new Date()
      },
      create: {
        key: 'REPLY_DOMAIN_AUTO_CONFIGURED',
        value: 'true',
        storeId
      }
    });
    
    // Uppdatera verifieringsstatus
    await prisma.setting.upsert({
      where: {
        key_storeId: {
          key: 'REPLY_DOMAIN_VERIFIED',
          storeId
        }
      },
      update: {
        value: verified.toString(),
        updatedAt: new Date()
      },
      create: {
        key: 'REPLY_DOMAIN_VERIFIED',
        value: verified.toString(),
        storeId
      }
    });
    
    logger.info(`Reply-domäninställning uppdaterad (${verified ? 'verifierad' : 'ej verifierad'})`, { 
      replyDomain, 
      storeId 
    });
  } catch (error) {
    logger.error('Fel vid uppdatering av reply-domäninställning', {
      error: error.message,
      replyDomain,
      storeId
    });
    throw error;
  }
}