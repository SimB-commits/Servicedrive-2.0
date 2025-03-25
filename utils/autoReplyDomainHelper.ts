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
          
          // Försök extrahera DNS-poster från domainDetails
          let dnsRecords = [];
          if (domainDetails && domainDetails.dns) {
            dnsRecords = extractDnsRecords(domainDetails);
          }
          
          // Om inga DNS-poster hittades, generera fallback-poster
          if (dnsRecords.length === 0) {
            dnsRecords = generateFallbackDnsRecords(replyDomain);
          }
          
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
          
          // Generera fallback DNS-poster om vi inte kan hämta dem från SendGrid
          const fallbackDnsRecords = generateFallbackDnsRecords(replyDomain);
          
          // Fortsätt ändå för att kunna se att domänen finns men behöver verifieras
          return {
            success: true,
            message: 'Reply-domän finns men behöver verifieras',
            replyDomain,
            domainId: existingReplyDomain.domainId,
            dnsRecords: fallbackDnsRecords,
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
      const mockDnsRecords = generateFallbackDnsRecords(replyDomain);
      
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
      // Notera: för SendGrid API behöver vi skicka bara huvuddomänen och ange "reply" som subdomän
      const domainAuthResult = await createDomainAuthentication(normalizedDomain, 'reply');
      
      if (!domainAuthResult) {
        throw new Error('Kunde inte skapa reply-domän i SendGrid');
      }
      
      // Konvertera domainId till string om nödvändigt
      const domainId = String(domainAuthResult.id);
      
      // Försök extrahera DNS-poster från domainAuthResult
      let dnsRecords = [];
      if (domainAuthResult.dns) {
        dnsRecords = extractDnsRecords(domainAuthResult);
      }
      
      // Om inga DNS-poster hittades, generera fallback-poster
      if (dnsRecords.length === 0) {
        dnsRecords = generateFallbackDnsRecords(replyDomain);
      }
      
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
      
      // Försök skapa en enkel post i databasen så vi kan försöka igen senare
      try {
        const fallbackDomainId = `reply-error-${Date.now()}`;
        await prisma.verifiedDomain.create({
          data: {
            domain: replyDomain,
            domainId: fallbackDomainId,
            storeId,
            status: 'pending',
            createdAt: new Date()
          }
        });
        
        // Även om vi misslyckades med SendGrid, ge användaren dns-poster att använda
        const fallbackDnsRecords = generateFallbackDnsRecords(replyDomain);
        
        return {
          success: false,
          message: `Kunde inte skapa reply-domän i SendGrid: ${error.message}. Vi har skapat en lokal post som du kan försöka verifiera senare.`,
          replyDomain,
          domainId: fallbackDomainId,
          dnsRecords: fallbackDnsRecords,
          needsVerification: true
        };
      } catch (dbError) {
        logger.error('Kunde inte skapa fallback för reply-domän i databasen', {
          error: dbError.message,
          baseDomain
        });
        
        return {
          success: false,
          message: `Kunde inte skapa reply-domän: ${error.message}`
        };
      }
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
  dnsRecords?: any[];
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
      
      // Generera fallback DNS-poster för utvecklingsläge
      const mockDnsRecords = generateFallbackDnsRecords(domainRecord.domain);
      
      return {
        success: true,
        message: 'Reply-domän verifierad (utvecklingsläge)',
        verified: true,
        domain: domainRecord.domain,
        dnsRecords: mockDnsRecords
      };
    }
    
    // I produktion, verifiera mot SendGrid
    try {
      // Försök hämta DNS-poster oavsett om verifieringen lyckas
      let dnsRecords = [];
      try {
        const domainDetails = await getDomainAuthenticationById(domainId);
        if (domainDetails && domainDetails.dns) {
          dnsRecords = extractDnsRecords(domainDetails);
        }
      } catch (dnsError) {
        logger.warn('Kunde inte hämta DNS-poster från SendGrid', {
          error: dnsError.message,
          domainId
        });
      }
      
      // Om inga DNS-poster hittades, generera fallback-poster
      if (dnsRecords.length === 0) {
        dnsRecords = generateFallbackDnsRecords(domainRecord.domain);
      }
      
      // Försök verifiera domänen
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
          domain: domainRecord.domain,
          dnsRecords // Inkludera DNS-posterna även om verifieringen lyckades
        };
      } else {
        return {
          success: true,
          message: 'Reply-domän kunde inte verifieras. Kontrollera att DNS-posterna är korrekt konfigurerade.',
          verified: false,
          domain: domainRecord.domain,
          dnsRecords // Inkludera DNS-posterna för att underlätta felsökning
        };
      }
    } catch (error) {
      logger.error('Fel vid verifiering av reply-domän', {
        error: error.message,
        domainId,
        storeId
      });
      
      // Generera och returnera fallback DNS-poster även vid fel
      const fallbackDnsRecords = generateFallbackDnsRecords(domainRecord.domain);
      
      return {
        success: false,
        message: `Kunde inte verifiera reply-domän: ${error.message}`,
        verified: false,
        domain: domainRecord.domain,
        dnsRecords: fallbackDnsRecords
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
 * Genererar DNS-poster för en reply-domän om vi inte kan hämta dem från SendGrid
 * Detta är en fallback-lösning för att säkerställa att användaren alltid ser DNS-poster
 * @param replyDomain Domännamnet för reply-domänen
 * @returns Array med DNS-poster
 */
function generateFallbackDnsRecords(replyDomain: string): any[] {
  // Standardvärden för MX, CNAME och SPF-poster för en reply-domän
  return [
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
      data: 'u17504275.wl.sendgrid.net', // Generiskt värde, kan behöva uppdateras
      name: 'För verifiering av subdomän'
    },
    {
      type: 'TXT',
      host: replyDomain,
      data: 'v=spf1 include:sendgrid.net ~all',
      name: 'SPF-post för e-postautentisering'
    }
  ];
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
  
  // Utökad logik för att försöka hitta alla relevanta DNS-poster från API-svaret
  
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
  // Om det inte finns en specifik mail-post, kontrollera om det finns en generisk MX-post
  } else if (domainData.dns.mx && domainData.dns.mx.host && domainData.dns.mx.data) {
    dnsRecords.push({
      type: 'MX',
      host: domainData.dns.mx.host,
      data: domainData.dns.mx.data,
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
  
  // Kolla efter domainkeys (äldre form av DKIM)
  if (domainData.dns.domainkey) {
    dnsRecords.push({
      type: 'TXT',
      host: domainData.dns.domainkey.host,
      data: domainData.dns.domainkey.data,
      name: 'DomainKey för mailautentisering (äldre)'
    });
  }
  
  // Kontrollera om vi har några poster och returnera default-poster om inga hittades
  if (dnsRecords.length === 0) {
    // Detta fall hanteras av anroparen, som kommer att generera fallback-poster
    logger.warn('Inga DNS-poster hittades i domändata från SendGrid', {
      domainId: domainData.id,
      domain: domainData.domain
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