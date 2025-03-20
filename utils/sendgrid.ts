// utils/sendgrid.ts
import sgMail from '@sendgrid/mail';
import { logger } from './logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * SendGrid konfiguration - samla alla inställningar på ett ställe
 */
export const sendgridConfig = {
  apiKey: process.env.SENDGRID_API_KEY,
  defaultFromEmail: process.env.EMAIL_FROM || 'no-reply@servicedrive.se',
  companySupportEmail: process.env.SUPPORT_EMAIL || 'support@servicedrive.se',
  maxRetries: 3,
  debugMode: process.env.NODE_ENV !== 'production'
};

// Cache-mekanism för verifierade domäner
let domainCache: Record<number, string[]> = {}; // Lagra domäner per storeId
let lastCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minuter

/**
 * Initialisera domäncachen vid modulstart
 */
const initDomainCache = async () => {
  try {
    // Hämta alla verifierade domäner från databasen
    const dbDomains = await prisma.verifiedDomain.findMany({
      where: { status: 'verified' },
      select: { domain: true, storeId: true }
    });
    
    // Gruppera domäner efter storeId
    domainCache = {};
    dbDomains.forEach(({ domain, storeId }) => {
      if (!domainCache[storeId]) {
        domainCache[storeId] = [];
      }
      domainCache[storeId].push(domain.toLowerCase());
    });
    
    lastCacheTime = Date.now();
    logger.info('Domäncache initialiserad', { 
      stores: Object.keys(domainCache).length,
      totalDomains: dbDomains.length
    });
  } catch (error) {
    logger.error('Fel vid initialisering av domäncache', { error: error.message });
  }
};

/**
 * Uppdatera cachen om nödvändigt
 */
const refreshDomainCache = async () => {
  if (Date.now() - lastCacheTime > CACHE_TTL) {
    await initDomainCache();
  }
};

/**
 * Hämta verifierade domäner för en butik
 */
export const getVerifiedDomains = async (storeId: number): Promise<string[]> => {
  await refreshDomainCache();
  return domainCache[storeId] || [];
};

/**
 * Validerar att en avsändaradress är godkänd för SendGrid
 * Kontrollerar mot domäner i databasen
 */
export const validateSenderEmailByStore = async (email: string, storeId: number): Promise<{ valid: boolean; reason?: string }> => {
  if (!email || !email.includes('@')) {
    return { valid: false, reason: 'Ogiltig e-postadressformat' };
  }
  
  // Om vi är i utvecklingsläge, godkänn alla adresser
  if (process.env.NODE_ENV !== 'production') {
    logger.warn(`Avsändarverifiering kringgås i utvecklingsläge för: ${email}`);
    return { valid: true };
  }
  
  // Uppdatera cachen om nödvändigt
  await refreshDomainCache();
  
  // Extrahera domänen från e-postadressen
  const emailDomain = email.split('@')[1]?.toLowerCase();
  
  // Kontrollera om domänen finns i butikens lista
  if (domainCache[storeId]?.some(domain => emailDomain === domain)) {
    return { valid: true };
  }
  
  // Hämta alla verifierade domäner för denna butik för felmeddelandet
  const domains = domainCache[storeId] || [];
  
  return { 
    valid: false, 
    reason: `Domänen ${emailDomain} är inte verifierad för din butik. Verifierade domäner: ${domains.join(', ') || 'Inga'}`
  };
};

/**
 * Skapa en standard servicedrive.se-domän för butiken om den inte redan finns
 */
export const ensureDefaultDomain = async (storeId: number): Promise<void> => {
  try {
    // Kolla om servicedrive.se redan finns för denna butik
    const existingDomain = await prisma.verifiedDomain.findFirst({
      where: {
        storeId,
        domain: 'servicedrive.se'
      }
    });
    
    // Om den inte finns, skapa den
    if (!existingDomain) {
      await prisma.verifiedDomain.create({
        data: {
          domain: 'servicedrive.se',
          domainId: 'default-servicedrive',
          storeId,
          status: 'verified',
          verifiedAt: new Date()
        }
      });
      
      logger.info(`Lagt till servicedrive.se som verifierad domän för butik ${storeId}`);
      
      // Uppdatera cachen
      await refreshVerifiedDomains();
    }
  } catch (error) {
    logger.error('Fel vid säkerställande av standarddomän', { error: error.message, storeId });
  }
};

// Exportera en funktion för att explicit uppdatera cachen (användbart efter domänoperationer)
export const refreshVerifiedDomains = initDomainCache;

// Initialisera cachen vid modulstart
initDomainCache().catch(err => {
  logger.error('Kunde inte initialisera domäncache', { error: err.message });
});

// Interface för maildata
export interface EmailData {
  to: string | string[];
  from: string;
  fromName?: string; // Namn på avsändaren (visningsnamn)
  subject: string;
  text?: string;
  html: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: any[];
  categories?: string[]; // Användbart för spårning
}

// Interface för sändaradress
export interface SenderAddress {
  id?: number;
  email: string;
  name?: string;
  default?: boolean;
  isVerified: boolean;
}

// Interface för mailmall med variabler
export interface TemplateVariables {
  [key: string]: string | number | boolean | Date | null | undefined;
}

/**
 * Initierar SendGrid med API-nyckel och validerar konfiguration
 * @returns Boolean som indikerar om initialiseringen lyckades
 */
export const initSendGrid = (): boolean => {
  // Validera att API-nyckel finns
  if (!sendgridConfig.apiKey) {
    logger.error('SendGrid API-nyckel saknas i miljövariabler. E-postfunktioner kommer inte att fungera.');
    return false;
  }
  
  try {
    sgMail.setApiKey(sendgridConfig.apiKey);
    logger.info('SendGrid initierad framgångsrikt');
    
    // Varna om inga verifierade domäner är konfigurerade (för avsändarverifiering)
    if (sendgridConfig.verifiedDomains.length === 0 && process.env.NODE_ENV === 'production') {
      logger.warn('Inga verifierade domäner konfigurerade för SendGrid. Sätt SENDGRID_VERIFIED_DOMAINS miljövariabel.');
    }
    
    return true;
  } catch (error) {
    logger.error('Fel vid initiering av SendGrid', { error: error.message });
    return false;
  }
};

/**
 * Validerar att en avsändaradress är godkänd för SendGrid
 * SendGrid kräver verifierade avsändare för att förhindra spoofing
 * @param email Email-adress att validera
 * @returns { valid: boolean, reason?: string } Resultat med eventuell felorsak
 */
export const validateSenderEmail = (email: string): { valid: boolean; reason?: string } => {
  if (!email || !email.includes('@')) {
    return { valid: false, reason: 'Ogiltig e-postadressformat' };
  }
  
  // Om vi är i utvecklingsläge och inga domäner är konfigurerade, godkänn alla
  if (process.env.NODE_ENV !== 'production' && (!sendgridConfig.verifiedDomains || sendgridConfig.verifiedDomains.length === 0)) {
    logger.warn(`Avsändarverifiering kringgås i utvecklingsläge för: ${email}`);
    return { valid: true };
  }
  
  // Kolla om domänen finns i listan över verifierade domäner
  const emailDomain = email.split('@')[1]?.toLowerCase();
  const isVerified = sendgridConfig.verifiedDomains.some(domain => 
    emailDomain === domain.trim().toLowerCase()
  );
  
  if (!isVerified) {
    return { 
      valid: false, 
      reason: `Domänen ${emailDomain} är inte verifierad i SendGrid. Verifierade domäner: ${sendgridConfig.verifiedDomains.join(', ')}`
    };
  }
  
  return { valid: true };
};

/**
 * Hämtar alla verifierade avsändaradresser för en butik
 * @param storeId Butikens ID
 * @returns Lista med verifierade avsändaradresser
 */
export const getVerifiedSenderAddresses = async (storeId: number): Promise<SenderAddress[]> => {
  try {
    // Hämta butikens konfigurerade avsändaradresser från databasen
    const senderAddresses = await prisma.senderAddress.findMany({
      where: { storeId: storeId }
    });
    
    // Om butiken har konfigurerade adresser, returnera dem
    if (senderAddresses.length > 0) {
      return senderAddresses.map(addr => ({
        id: addr.id,
        email: addr.email,
        name: addr.name || undefined,
        default: addr.isDefault,
        isVerified: true  // De är redan verifierade i databasen
      }));
    }
    
    // Om inga adresser är konfigurerade, generera från verifierade domäner
    const defaultAddresses: SenderAddress[] = [];
    
    // Lägg till standardadressen som första alternativ
    const defaultEmail = sendgridConfig.defaultFromEmail;
    if (defaultEmail) {
      const validation = validateSenderEmailByStore(defaultEmail, storeId);
      defaultAddresses.push({
        email: defaultEmail,
        name: 'Servicedrive',
        default: true,
        isVerified: validation.valid
      });
    }
    
    // Lägg till support-adress om den är verifierad
    const supportEmail = sendgridConfig.companySupportEmail;
    if (supportEmail && supportEmail !== defaultEmail) {
      const validation = validateSenderEmailByStore(supportEmail, storeId);
      defaultAddresses.push({
        email: supportEmail,
        name: 'Kundsupport',
        default: false,
        isVerified: validation.valid
      });
    }
    
    // Generera adresser från verifierade domäner
    sendgridConfig.verifiedDomains.forEach(domain => {
      const domain_clean = domain.trim().toLowerCase();
      
      // Skapa några förslag baserat på domänen
      const potentialAddresses = [
        { email: `no-reply@${domain_clean}`, name: 'Automatiskt Utskick' },
        { email: `info@${domain_clean}`, name: 'Information' }
      ];
      
      // Lägg till adresser som inte redan finns
      potentialAddresses.forEach(addr => {
        if (!defaultAddresses.some(a => a.email === addr.email)) {
          defaultAddresses.push({
            ...addr,
            default: false,
            isVerified: true
          });
        }
      });
    });
    
    return defaultAddresses;
  } catch (error) {
    logger.error('Fel vid hämtning av verifierade avsändaradresser', { error: error.message });
    
    // Returnera åtminstone standardadressen vid fel
    return [{
      email: sendgridConfig.defaultFromEmail,
      name: 'Servicedrive',
      default: true,
      isVerified: true
    }];
  }
};

/**
 * Sparar en ny avsändaradress för en butik efter verifiering
 * @param storeId Butikens ID
 * @param email Avsändarens e-postadress
 * @param name Avsändarens visningsnamn
 * @param setDefault Om adressen ska vara standardadress
 * @returns Den sparade avsändaradressen eller ett felmeddelande
 */
export const saveSenderAddress = async (
  storeId: number, 
  email: string, 
  name?: string, 
  setDefault: boolean = false
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    // Validera adressen först
    const validation = validateSenderEmailByStore(email, storeId);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }
    
    // Om denna ska vara standard, avaktivera andra standardadresser
    if (setDefault) {
      await prisma.senderAddress.updateMany({
        where: { storeId, isDefault: true },
        data: { isDefault: false }
      });
    }
    
    // Försök först uppdatera om adressen redan finns
    const existingAddress = await prisma.senderAddress.findFirst({
      where: { storeId, email }
    });
    
    if (existingAddress) {
      // Uppdatera existerande adress
      const updated = await prisma.senderAddress.update({
        where: { id: existingAddress.id },
        data: { name, isDefault: setDefault }
      });
      
      return { success: true, data: updated };
    } else {
      // Skapa ny adress
      const created = await prisma.senderAddress.create({
        data: { storeId, email, name, isDefault: setDefault }
      });
      
      return { success: true, data: created };
    }
  } catch (error) {
    logger.error('Fel vid sparande av avsändaradress', { error: error.message });
    return { success: false, error: 'Kunde inte spara avsändaradressen: ' + error.message };
  }
};

/**
 * Ersätter variabler i malltext med faktiska värden
 * @param template HTML-malltext med variabler som {variabelNamn}
 * @param variables Objekt med variabelvärden
 * @returns HTML-text med ersatta variabler
 */
export const processTemplate = (template: string, variables: TemplateVariables): string => {
  if (!template) return '';
  
  let processedTemplate = template;
  
  // Ersätt alla variabler i mallen
  Object.entries(variables).forEach(([key, value]) => {
    // Konvertera value om det är ett datum
    let displayValue = value;
    
    if (value instanceof Date) {
      displayValue = value.toLocaleDateString('sv-SE');
    } else if (value === null || value === undefined) {
      displayValue = '';
    }
    
    // Ersätt alla förekomster av variabeln
    const regex = new RegExp(`{${key}}`, 'g');
    processedTemplate = processedTemplate.replace(regex, String(displayValue));
  });
  
  return processedTemplate;
};

/**
 * Bygger ett email från en mailmall med variabeldata
 * Stöder nu anpassat från-namn
 */
export const buildEmailFromTemplate = (
  template: { subject: string; body: string },
  variables: TemplateVariables,
  toEmail: string,
  fromEmail: string = sendgridConfig.defaultFromEmail,
  fromName?: string
): EmailData => {
  // Behandla både ämne och innehåll för att ersätta variabler
  const processedSubject = processTemplate(template.subject, variables);
  const processedHtml = processTemplate(template.body, variables);
  
  // Skapa en textversion genom att ta bort HTML-taggar
  const textContent = processedHtml.replace(/<[^>]*>/g, '');
  
  // Formatera avsändaradressen med visningsnamn om det finns
  const formattedFrom = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
  
  return {
    to: toEmail,
    from: formattedFrom,
    subject: processedSubject,
    html: processedHtml,
    text: textContent,
    categories: ['template-based'], // Användbart för spårning i SendGrid
  };
};

/**
 * Skickar ett email via SendGrid med automatiska återförsök
 * @param emailData Data för emailet
 * @param retries Antal återförsök (internt använd för rekursion)
 * @returns Promise med SendGrid-response
 */
export const sendEmail = async (
  emailData: EmailData, 
  retries: number = 0
): Promise<[any, any]> => {
  try {
    // Automatisk initiering om det behövs
    if (!sgMail.axios) {
      const initialized = initSendGrid();
      if (!initialized) {
        throw new Error('Kunde inte initialisera SendGrid. Kontrollera API-nyckeln.');
      }
    }
    
    // Extrakt avsändaradress från from-fältet
    let senderEmail = emailData.from;
    
    // Om from innehåller ett namn, extrahera emailadressen
    if (senderEmail.includes('<') && senderEmail.includes('>')) {
      senderEmail = senderEmail.match(/<([^>]+)>/)?.[1] || senderEmail;
    }
    
    // Validera från-email
    const validation = validateSenderEmailByStore(senderEmail, 0);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }
    
    // Ta bort eventuella undefined- eller null-värden i emailData
    const cleanedEmailData = Object.fromEntries(
      Object.entries(emailData).filter(([_, value]) => value !== undefined && value !== null)
    );
    
    // Logga att vi skickar mail (utan känslig information)
    logger.info('Skickar email', { 
      to: typeof cleanedEmailData.to === 'string' 
        ? cleanedEmailData.to.substring(0, 3) + '***' 
        : 'multiple-recipients',
      subject: cleanedEmailData.subject,
      from: senderEmail.split('@')[0].substring(0, 2) + '***@' + senderEmail.split('@')[1],
      templateBased: !!cleanedEmailData.categories?.includes('template-based')
    });
    
    // Skicka emailet
    return await sgMail.send(cleanedEmailData as EmailData);
  } catch (error) {
    // Hantera återförsök för vissa typer av fel
    const isRetryableError = error.code >= 500 || 
      error.response?.body?.errors?.some(e => e.message?.includes('rate limit exceeded'));
    
    if (isRetryableError && retries < sendgridConfig.maxRetries) {
      // Exponentiell backoff (1s, 2s, 4s, etc)
      const backoffTime = Math.pow(2, retries) * 1000;
      logger.warn(`Tillfälligt fel vid e-postsändning. Försöker igen om ${backoffTime}ms`, { 
        retryCount: retries + 1 
      });
      
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      return sendEmail(emailData, retries + 1);
    }
    
    // Strukturerad loggning av fel
    logger.error('Fel vid sändning av email', { 
      error: error.message,
      code: error.code,
      response: error.response?.body ? JSON.stringify(error.response.body).substring(0, 200) : null
    });
    
    throw error;
  }
};

// Exportera en samlad objekt för enklare import
export default {
  initSendGrid,
  sendEmail,
  processTemplate,
  buildEmailFromTemplate,
  validateSenderEmailByStore,
  validateSenderEmail,
  getVerifiedSenderAddresses,
  saveSenderAddress,
  config: sendgridConfig
};
