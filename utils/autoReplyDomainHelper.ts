// utils/autoReplyDomainHelper.ts
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';
import { createDomainAuthentication, verifyDomainAuthentication, getDomainAuthenticationById } from './sendgridDomain';

const prisma = new PrismaClient();

/**
 * Skapar och registrerar en reply-subdomän efter att huvuddomänen har verifierats,
 * men kräver separat DNS-konfiguration och verifiering
 * @param baseDomain Huvuddomän som har verifierats (ex. example.com)
 * @param storeId Butikens ID
 */
export async function createAutoReplyDomain(baseDomain: string, storeId: number): Promise<{
  success: boolean;
  message: string;
  replyDomain?: string;
  domainId?: string;
  dnsRecords?: any[];
  needsVerification?: boolean;
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
      if (existingReplyDomain.status === 'verified') {
        // Om den redan finns och är verifierad, returnera utan att göra något mer
        logger.info('Reply-domän finns redan och är verifierad', { 
          replyDomain, 
          storeId,
          domainId: existingReplyDomain.domainId
        });
        
        return {
          success: true,
          message: 'Reply-domän finns redan och är verifierad',
          replyDomain,
          domainId: existingReplyDomain.domainId
        };
      } else {
        // Om den finns men inte är verifierad, hämta DNS-records för att underlätta verifiering
        try {
          const domainDetails = await getDomainAuthenticationById(existingReplyDomain.domainId);
          
          // Formatera DNS-records för enklare presentation
          const dnsRecords = extractDnsRecords(domainDetails);
          
          logger.info('Reply-domän finns men behöver verifieras', { 
            replyDomain, 
            storeId,
            domainId: existingReplyDomain.domainId
          });
          
          return {
            success: true,
            message: 'Reply-domän finns men behöver verifieras',
            replyDomain,
            domainId: existingReplyDomain.domainId,
            dnsRecords,
            needsVerification: true
          };
        } catch (error) {
          logger.warn('Kunde inte hämta DNS-poster för existerande reply-domän', {
            error: error.message,
            domainId: existingReplyDomain.domainId
          });
          
          // Fortsätt ändå för att kunna se att domänen finns men behöver verifieras
          return {
            success: true,
            message: 'Reply-domän finns men behöver verifieras',
            replyDomain,
            domainId: existingReplyDomain.domainId,
            needsVerification: true
          };
        }
      }
    }
    
    // Skapa reply-domänen i SendGrid
    logger.info('Skapar automatisk reply-domän', { baseDomain, replyDomain, storeId });
    
    // För utvecklingsmiljö, simulera skapande av domän utan faktiska API-anrop
    if (process.env.NODE_ENV !== 'production') {
      // I utvecklingsmiljö, simulera skapande av domän
      const mockDomainId = `reply-${Date.now()}`;
      
      // Skapa en post i databasen för den nya reply-domänen
      const newDomain = await prisma.verifiedDomain.create({
        data: {
          domain: replyDomain,
          domainId: mockDomainId,
          storeId,
          status: 'pending', // I utveckling markerar vi som pending, inte verifierad
          createdAt: new Date()
        }
      });
      
      // Skapa simulerade DNS-poster för utvecklingsläge
      const mockDnsRecords = [
        {
          type: 'MX',
          host: replyDomain,
          data: 'mx.sendgrid.net',
          priority: 10,
          name: 'För hantering av inkommande mail'
        },
        {
          type: 'CNAME',
          host: `em.${replyDomain}`,
          data: 'u12345.wl.sendgrid.net',
          name: 'För verifiering av subdomän'
        },
        {
          type: 'TXT',
          host: replyDomain,
          data: 'v=spf1 include:sendgrid.net ~all',
          name: 'SPF-post för e-postautentisering'
        }
      ];
      
      return {
        success: true,
        message: 'Reply-domän skapad men behöver verifieras (utvecklingsläge)',
        replyDomain,
        domainId: mockDomainId,
        dnsRecords: mockDnsRecords,
        needsVerification: true
      };
    }
    
    // I produktion, gör faktiskt API-anrop till SendGrid
    try {
      // Skapa reply-domänen med 'reply' som subdomän till huvuddomänen
      const domainAuthResult = await createDomainAuthentication(normalizedDomain, 'reply');
      
      if (!domainAuthResult) {
        throw new Error('Kunde inte skapa reply-domän i SendGrid');
      }
      
      // Konvertera domainId till string om nödvändigt
      const domainId = String(domainAuthResult.id);
      
      // Extrahera DNS-poster från resultatet för presentation till användaren
      const dnsRecords = extractDnsRecords(domainAuthResult);
      
      // Spara den nya domänen i databasen med status 'pending'
      const newDomain = await prisma.verifiedDomain.create({
        data: {
          domain: replyDomain,
          domainId: domainId,
          storeId,
          status: 'pending', // Börjar som 'pending' eftersom vi behöver separata DNS-poster
          createdAt: new Date()
        }
      });
      
      // Uppdatera inställningen för att visa att en reply-domän har skapats men behöver verifieras
      await updateReplyDomainSettings(replyDomain, storeId, false);
      
      return {
        success: true,
        message: 'Reply-domän skapad men behöver verifieras',
        replyDomain,
        domainId,
        dnsRecords,
        needsVerification: true
      };
    } catch (error) {
      logger.error('Fel vid skapande av reply-domän', {
        error: error.message,
        baseDomain,
        storeId
      });
      
      return {
        success: false,
        message: `Kunde inte skapa reply-domän: ${error.message}`
      };
    }
  } catch (error) {
    logger.error('Oväntat fel vid skapande av reply-domän', {
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
 * Verifierar en tidigare skapad reply-domän
 * @param domainId ID för reply-domänen som ska verifieras
 * @param storeId Butikens ID
 * @returns Resultat av verifieringen
 */
export async function verifyReplyDomain(domainId: string, storeId: number): Promise<{
  success: boolean;
  message: string;
  verified: boolean;
  domain?: string;
}> {
  try {
    // Kontrollera att domänen finns i databasen
    const domainRecord = await prisma.verifiedDomain.findFirst({
      where: {
        domainId,
        storeId
      }
    });
    
    if (!domainRecord) {
      return {
        success: false,
        message: 'Domänen hittades inte',
        verified: false
      };
    }
    
    // För utvecklingsmiljö, simulera verifiering
    if (process.env.NODE_ENV !== 'production') {
      // I utvecklingsmiljö, simulera lyckad verifiering
      await prisma.verifiedDomain.update({
        where: { id: domainRecord.id },
        data: {
          status: 'verified',
          verifiedAt: new Date()
        }
      });
      
      // Uppdatera inställningen för svarsdomän
      await updateReplyDomainSettings(domainRecord.domain, storeId, true);
      
      return {
        success: true,
        message: 'Reply-domän verifierad (utvecklingsläge)',
        verified: true,
        domain: domainRecord.domain
      };
    }
    
    // I produktion, verifiera mot SendGrid
    try {
      const verifyResult = await verifyDomainAuthentication(domainId);
      const isVerified = verifyResult?.valid || false;
      
      if (isVerified) {
        // Uppdatera status i databasen
        await prisma.verifiedDomain.update({
          where: { id: domainRecord.id },
          data: {
            status: 'verified',
            verifiedAt: new Date()
          }
        });
        
        // Uppdatera inställningen för svarsdomän
        await updateReplyDomainSettings(domainRecord.domain, storeId, true);
        
        return {
          success: true,
          message: 'Reply-domän verifierad',
          verified: true,
          domain: domainRecord.domain
        };
      } else {
        return {
          success: true,
          message: 'Reply-domän kunde inte verifieras. Kontrollera att DNS-posterna är korrekt konfigurerade.',
          verified: false,
          domain: domainRecord.domain
        };
      }
    } catch (error) {
      logger.error('Fel vid verifiering av reply-domän', {
        error: error.message,
        domainId,
        storeId
      });
      
      return {
        success: false,
        message: `Kunde inte verifiera reply-domän: ${error.message}`,
        verified: false,
        domain: domainRecord.domain
      };
    }
  } catch (error) {
    logger.error('Oväntat fel vid verifiering av reply-domän', {
      error: error.message,
      domainId,
      storeId
    });
    
    return {
      success: false,
      message: `Oväntat fel: ${error.message}`,
      verified: false
    };
  }
}

/**
 * Extraherar DNS-poster från ett domänautentiseringsresultat från SendGrid
 * @param domainData Resultat från SendGrid API
 * @returns Formaterade DNS-poster för presentation
 */
function extractDnsRecords(domainData: any): any[] {
  const dnsRecords = [];
  
  if (!domainData || !domainData.dns) {
    return dnsRecords;
  }
  
  // DNS-poster för CNAME-verifiering
  if (domainData.dns.cname) {
    dnsRecords.push({
      type: 'CNAME',
      host: domainData.dns.cname.host,
      data: domainData.dns.cname.data,
      name: 'För domänverifiering'
    });
  }
  
  // DNS-poster för DKIM
  if (domainData.dns.dkim1) {
    dnsRecords.push({
      type: 'CNAME',
      host: domainData.dns.dkim1.host,
      data: domainData.dns.dkim1.data,
      name: 'För DKIM-signering (del 1)'
    });
  }
  
  if (domainData.dns.dkim2) {
    dnsRecords.push({
      type: 'CNAME',
      host: domainData.dns.dkim2.host,
      data: domainData.dns.dkim2.data,
      name: 'För DKIM-signering (del 2)'
    });
  }
  
  // MX-post för mailmottagning
  if (domainData.dns.mail) {
    dnsRecords.push({
      type: 'MX',
      host: domainData.dns.mail.host,
      data: domainData.dns.mail.data,
      priority: 10,
      name: 'För mailmottagning'
    });
  }
  
  // SPF-post för mailautentisering
  if (domainData.dns.spf) {
    dnsRecords.push({
      type: 'TXT',
      host: domainData.dns.spf.host,
      data: domainData.dns.spf.data,
      name: 'SPF-post för mailautentisering'
    });
  }
  
  return dnsRecords;
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
      storeId, 
      verified 
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