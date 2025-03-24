// pages/api/settings/email.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { logger } from '@/utils/logger';
import { z } from 'zod';

const prisma = new PrismaClient();

// Schema för validering av inkommande data
const settingsSchema = z.object({
  replyDomain: z.string().min(8, 'Domännamn måste vara minst 8 tecken'),
});

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

    // GET - Hämta e-postinställningar
    if (req.method === 'GET') {
      // Hämta inställningen för svarsdomän
      const replyDomainSetting = await prisma.setting.findUnique({
        where: {
          key_storeId: {
            key: 'REPLY_DOMAIN',
            storeId
          }
        }
      });

      // Returnera inställningarna
      return res.status(200).json({
        replyDomain: replyDomainSetting?.value || 'reply.servicedrive.se'
      });
    }

    // POST - Uppdatera e-postinställningar
    if (req.method === 'POST') {
      // Validera inkommande data
      const parseResult = settingsSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errors = parseResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        return res.status(400).json({ message: 'Valideringsfel', errors });
      }

      const { replyDomain } = parseResult.data;

      // Om det inte är den delade domänen, validera att den börjar med 'reply.'
      if (replyDomain !== 'reply.servicedrive.se' && !replyDomain.startsWith('reply.')) {
        return res.status(400).json({ error: 'Anpassad svarsdomän måste börja med "reply."' });
      }

      // Verifiera att domänen (utan reply.-prefix) är verifierad i systemet
      if (replyDomain !== 'reply.servicedrive.se') {
        // Extrahera basdomänen (ta bort reply.)
        const baseDomain = replyDomain.substring(6); // "reply.".length = 6
        
        // Kontrollera om basdomänen eller den fullständiga reply-domänen är verifierad
        const verifiedDomain = await prisma.verifiedDomain.findFirst({
          where: {
            OR: [
              { domain: replyDomain, storeId },
              { domain: baseDomain, storeId }
            ],
            status: 'verified'
          }
        });
        
        if (!verifiedDomain) {
          // Kontrollera även om reply-domänen finns men är ej verifierad
          const unverifiedDomain = await prisma.verifiedDomain.findFirst({
            where: {
              OR: [
                { domain: replyDomain, storeId },
                { domain: baseDomain, storeId }
              ]
            }
          });
          
          if (unverifiedDomain) {
            return res.status(400).json({ 
              error: 'Domänen är inte verifierad', 
              message: `Domänen '${unverifiedDomain.domain}' finns i systemet men är inte verifierad. Verifiera domänen först under Domänverifiering.` 
            });
          } else {
            return res.status(400).json({ 
              error: 'Domänen är inte verifierad', 
              message: `Domänen '${baseDomain}' är inte verifierad i systemet. Verifiera domänen först under Domänverifiering.` 
            });
          }
        }
      }

      // Upsert (uppdatera eller skapa) inställningen
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

      // Logga ändringen
      logger.info('Svarsdomän uppdaterad', { 
        storeId, 
        domain: replyDomain,
        userId: session.user.id
      });

      // Returnera framgång
      return res.status(200).json({
        success: true,
        message: 'E-postinställningar uppdaterade framgångsrikt',
        replyDomain
      });
    }

    // För alla andra HTTP-metoder
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    logger.error('Error in settings/email API:', { error: error.message });
    
    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }
    
    return res.status(500).json({ message: 'Ett internt serverfel uppstod.' });
  } finally {
    await prisma.$disconnect();
  }
}