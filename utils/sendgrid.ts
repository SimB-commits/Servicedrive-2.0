// utils/sendgrid.ts
import sgMail from '@sendgrid/mail';
import { logger } from './logger';

/**
 * SendGrid konfiguration - samla alla inställningar på ett ställe
 */
export const sendgridConfig = {
  apiKey: process.env.SENDGRID_API_KEY,
  defaultFromEmail: process.env.EMAIL_FROM || 'no-reply@servicedrive.se',
  verifiedDomains: process.env.SENDGRID_VERIFIED_DOMAINS?.split(',') || [],
  companySupportEmail: process.env.SUPPORT_EMAIL || 'support@servicedrive.se',
  maxRetries: 3,
  debugMode: process.env.NODE_ENV !== 'production'
};

// Interface för maildata
export interface EmailData {
  to: string | string[];
  from: string;
  subject: string;
  text?: string;
  html: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: any[];
  categories?: string[]; // Användbart för spårning
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
 * @returns true om adressen är godkänd, annars false
 */
export const validateSenderEmail = (email: string): boolean => {
  if (!email || !email.includes('@')) {
    return false;
  }
  
  // Om vi är i utvecklingsläge och inga domäner är konfigurerade, godkänn alla
  if (sendgridConfig.debugMode && sendgridConfig.verifiedDomains.length === 0) {
    logger.warn(`Avsändarverifiering kringgås i utvecklingsläge för: ${email}`);
    return true;
  }
  
  // Kolla om domänen finns i listan över verifierade domäner
  const emailDomain = email.split('@')[1]?.toLowerCase();
  const isVerified = sendgridConfig.verifiedDomains.some(domain => 
    emailDomain === domain.trim().toLowerCase()
  );
  
  if (!isVerified) {
    logger.warn(`Ogiltig avsändardomän: ${emailDomain} finns inte bland verifierade domäner.`);
  }
  
  return isVerified;
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
 */
export const buildEmailFromTemplate = (
  template: { subject: string; body: string },
  variables: TemplateVariables,
  toEmail: string,
  fromEmail: string = sendgridConfig.defaultFromEmail
): EmailData => {
  // Behandla både ämne och innehåll för att ersätta variabler
  const processedSubject = processTemplate(template.subject, variables);
  const processedHtml = processTemplate(template.body, variables);
  
  // Skapa en textversion genom att ta bort HTML-taggar
  const textContent = processedHtml.replace(/<[^>]*>/g, '');
  
  return {
    to: toEmail,
    from: fromEmail,
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
    
    // Validera från-email
    if (!validateSenderEmail(emailData.from)) {
      throw new Error(`Ogiltig från-adress: ${emailData.from}. Måste vara en verifierad avsändare i SendGrid.`);
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
  validateSenderEmail,
  config: sendgridConfig
};