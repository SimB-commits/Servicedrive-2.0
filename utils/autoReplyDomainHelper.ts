// utils/autoReplyDomainHelper.ts
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';
import { createDomainAuthentication, verifyDomainAuthentication } from './sendgridDomain';

const prisma = new PrismaClient();

/**
 * Skapar och verifierar automatiskt en reply-subdomän efter att huvuddomänen har verifierats
 * @param baseDomain Huvuddomän som har verifierats (ex. example.com)
 * @param storeId Butikens ID
 */
export async function createAutoReplyDomain(baseDomain: string, storeId: number): Promise<{
  success: boolean;
  message: string;
  replyDomain?: string;
  domainId?: string;
}> {
  try {
    // Normalisera domännamnet
    const normalizedDomain = baseDomain.toLowerCase().trim();
    
    // Skapa reply-domännamnet
    const replyDomain = `reply.${normalizedDomain}`;
    
    // Kontrollera om reply-domänen redan finns
    const existingReplyDomain = await prisma.verifiedDomain.findFirst({
      where: {
        domain: replyDomain,
        storeId
      }
    });
    
    if (existingReplyDomain) {
      // Om den redan finns, returnera utan att göra något mer
      logger.info('Reply-domän finns redan', { replyDomain, storeId });
      return {
        success: true,
        message: 'Reply-domän finns redan',
        replyDomain,
        domainId: existingReplyDomain.domainId
      };
    }
    
    // Skapa reply-domänen i SendGrid
    logger.info('Skapar automatisk reply-domän', { baseDomain, replyDomain, storeId });
    
    // För att inte göra faktiska API-anrop under utveckling
    if (process.env.NODE_ENV !== 'production') {
      // I utvecklingsmiljö, simulera skapande av domän
      const mockDomainId = `reply-${Date.now()}`;
      
      // Skapa en post i databasen för den nya reply-domänen
      const newDomain = await prisma.verifiedDomain.create({
        data: {
          domain: replyDomain,
          domainId: mockDomainId,
          storeId,
          status: 'verified', // I utveckling markerar vi den som verifierad direkt
          verifiedAt: new Date(),
          createdAt: new Date()
        }
      });
      
      // Uppdatera inställningen för svarsdomän
      await updateReplyDomainSetting(replyDomain, storeId);
      
      return {
        success: true,
        message: 'Automatisk reply-domän skapad (utvecklingsläge)',
        replyDomain,
        domainId: mockDomainId
      };
    }
    
    // I produktion, gör faktiskt API-anrop till SendGrid
    try {
      // Försök skapa domänen med standardinställningar
      const domainAuthResult = await createDomainAuthentication(normalizedDomain, 'reply');
      
      if (!domainAuthResult) {
        throw new Error('Kunde inte skapa reply-domän i SendGrid');
      }
      
      // Konvertera domainId till string om nödvändigt
      const domainId = String(domainAuthResult.id);
      
      // Spara den nya domänen i databasen
      const newDomain = await prisma.verifiedDomain.create({
        data: {
          domain: replyDomain,
          domainId: domainId,
          storeId,
          status: 'pending', // Börja med 'pending' eftersom vi behöver verifiera den
          createdAt: new Date()
        }
      });
      
      // Försök verifiera direkt (i många fall har DNS-posterna redan skapats)
      const verifyResult = await verifyDomainAuthentication(domainId);
      const isVerified = verifyResult?.valid || false;
      
      // Om verifierad, uppdatera status
      if (isVerified) {
        await prisma.verifiedDomain.update({
          where: { id: newDomain.id },
          data: {
            status: 'verified',
            verifiedAt: new Date()
          }
        });
        
        // Uppdatera inställningen för svarsdomän
        await updateReplyDomainSetting(replyDomain, storeId);
        
        return {
          success: true,
          message: 'Automatisk reply-domän skapad och verifierad',
          replyDomain,
          domainId
        };
      }
      
      // Om inte verifierad, returnera ändå framgång men med annan status
      return {
        success: true,
        message: 'Automatisk reply-domän skapad men ej verifierad',
        replyDomain,
        domainId
      };
      
    } catch (error) {
      logger.error('Fel vid skapande av automatisk reply-domän', {
        error: error.message,
        baseDomain,
        storeId
      });
      
      return {
        success: false,
        message: `Kunde inte skapa automatisk reply-domän: ${error.message}`
      };
    }
  } catch (error) {
    logger.error('Oväntat fel vid skapande av automatisk reply-domän', {
      error: error.message,
      baseDomain,
      storeId
    });
    
    return {
      success: false,
      message: `Oväntat fel: ${error.message}`
    };
  }
}

/**
 * Uppdaterar inställningen för svarsdomän i databasen
 */
async function updateReplyDomainSetting(replyDomain: string, storeId: number): Promise<void> {
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
    
    logger.info('Reply-domäninställning uppdaterad och markerad som automatiskt konfigurerad', { replyDomain, storeId });
  } catch (error) {
    logger.error('Fel vid uppdatering av reply-domäninställning', {
      error: error.message,
      replyDomain,
      storeId
    });
    throw error;
  }
}