// pages/api/mail/inbound-webhook/setup.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { logger } from '@/utils/logger';

// Simulera SendGrid API (i en riktig implementering skulle vi använda SendGrid's API)
async function setupInboundParse(domain: string, webhookUrl: string): Promise<any> {
  // I en riktig implementation skulle detta anropa SendGrid Inbound Parse API
  // För demonstration simulerar vi detta
  logger.info(`Simulerar anrop till SendGrid för att konfigurera Inbound Parse`, {
    domain,
    webhookUrl: webhookUrl.replace(/^(https?:\/\/)/, '***://')
  });
  
  // Detta är ett simulerat API-svar
  return {
    success: true,
    domain,
    url: webhookUrl,
    spam_check: true,
    message: `Inbound Parse configured for ${domain}`
  };
}

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

    // Endast POST är tillåtet för denna endpoint
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // Validera input
    const { domainId } = req.body;
    if (!domainId) {
      return res.status(400).json({ error: 'domainId krävs' });
    }

    // Hämta domänen från databasen
    const domain = await prisma.verifiedDomain.findFirst({
      where: {
        domainId: String(domainId),
        storeId: session.user.storeId
      }
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domänen hittades inte' });
    }

    // Skapa webhook-URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    if (!baseUrl) {
      return res.status(500).json({ error: 'APP_URL är inte konfigurerad' });
    }

    const webhookUrl = `${baseUrl}/api/webhooks/inbound-email`;
    
    // Kontrollera om domänen är en reply-domän (subdomän)
    const isDomainForReplies = domain.domain.startsWith('reply.');
    if (!isDomainForReplies) {
      return res.status(400).json({ 
        error: 'Endast reply-domäner kan konfigureras för inkommande mail',
        message: 'Domänen måste börja med "reply." för att kunna ta emot kundmeddelanden'
      });
    }

    try {
      // Konfigurera Inbound Parse via SendGrid API
      const setupResult = await setupInboundParse(domain.domain, webhookUrl);
      
      // Om konfigureringen lyckades, uppdatera domänen i databasen
      await prisma.verifiedDomain.update({
        where: { id: domain.id },
        data: {
          inboundParseEnabled: true,
          inboundParseWebhook: webhookUrl,
          updatedAt: new Date()
        }
      });
      
      // Uppdatera inställningarna för mailsvar i systemet
      const settingKey = 'REPLY_DOMAIN';
      
      // Kolla om inställningen redan finns
      const existingSetting = await prisma.setting.findUnique({
        where: {
          key_storeId: {
            key: settingKey,
            storeId: session.user.storeId
          }
        }
      });
      
      if (existingSetting) {
        // Uppdatera den befintliga inställningen
        await prisma.setting.update({
          where: {
            key_storeId: {
              key: settingKey,
              storeId: session.user.storeId
            }
          },
          data: {
            value: domain.domain,
            updatedAt: new Date()
          }
        });
      } else {
        // Skapa en ny inställning
        await prisma.setting.create({
          data: {
            key: settingKey,
            value: domain.domain,
            storeId: session.user.storeId
          }
        });
      }
      
      logger.info('Inbound Parse-konfiguration slutförd', {
        domain: domain.domain,
        storeId: session.user.storeId
      });
      
      return res.status(200).json({
        success: true,
        message: `Inbound mail konfigurerat för ${domain.domain}`,
        domain: domain.domain,
        webhook: webhookUrl.replace(/^(https?:\/\/)/, '***://') // Dölj protokollet för säkerhet
      });
    } catch (setupError) {
      logger.error('Fel vid konfigurering av Inbound Parse', {
        error: setupError.message,
        domain: domain.domain
      });
      
      return res.status(500).json({
        error: 'Kunde inte konfigurera Inbound Parse',
        message: setupError.message
      });
    }
  } catch (error) {
    logger.error('Error in inbound-webhook/setup.ts:', { error: error.message });
    
    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }
    
    return res.status(500).json({ message: 'Ett internt serverfel uppstod.' });
  } finally {
    await prisma.$disconnect();
  }
}