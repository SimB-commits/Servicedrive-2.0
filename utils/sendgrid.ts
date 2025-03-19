// utils/sendgrid.ts
import sgMail from '@sendgrid/mail';

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
}

// Interface för mailmall med variabler
export interface TemplateVariables {
  [key: string]: string | number | boolean | Date | null | undefined;
}

/**
 * Initierar SendGrid med API-nyckel
 */
export const initSendGrid = (): void => {
  const apiKey = process.env.SENDGRID_API_KEY;
  
  if (!apiKey) {
    console.error('SendGrid API-nyckel saknas i miljövariabler.');
    return;
  }
  
  sgMail.setApiKey(apiKey);
  console.log('SendGrid initierad.');
};

/**
 * Skickar ett email via SendGrid
 * @param emailData Data för emailet
 * @returns Promise med SendGrid-response
 */
export const sendEmail = async (emailData: EmailData): Promise<[any, any]> => {
  try {
    // Validera från-email
    if (!validateSenderEmail(emailData.from)) {
      throw new Error('Ogiltig från-adress. Måste vara en verifierad avsändare i SendGrid.');
    }
    
    // Initiera om det inte redan är gjort
    if (!process.env.SENDGRID_API_KEY) {
      initSendGrid();
    }
    
    // Skicka emailet
    return await sgMail.send(emailData);
  } catch (error) {
    console.error('Fel vid sändning av email:', error);
    throw error;
  }
};

/**
 * Ersätter variabler i mailmall med faktiska värden
 * @param template HTML-malltext med variabler som {variabelNamn}
 * @param variables Objekt med variabelvärden
 * @returns HTML-text med ersatta variabler
 */
export const processTemplate = (template: string, variables: TemplateVariables): string => {
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
 * Validerar att en avsändaradress är godkänd för SendGrid
 * (SendGrid kräver verifierade avsändare)
 * @param email Email-adress att validera
 * @returns true om adressen är godkänd, annars false
 */
export const validateSenderEmail = (email: string): boolean => {
  // Här kan du lägga till logik för att kontrollera om emailet är verifierat i SendGrid
  // För nu använder vi en enkel check mot tillåtna domäner från miljövariabler
  const verifiedDomains = process.env.SENDGRID_VERIFIED_DOMAINS?.split(',') || [];
  
  if (verifiedDomains.length === 0) {
    // Om inga domäner är konfigurerade, använd DEBUG-läge under utveckling
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }
    return false;
  }
  
  const emailDomain = email.split('@')[1];
  return verifiedDomains.some(domain => emailDomain === domain.trim());
};

/**
 * Bygger ett email från en mailmall med variabeldata
 */
export const buildEmailFromTemplate = (
  template: { subject: string; body: string },
  variables: TemplateVariables,
  toEmail: string,
  fromEmail: string
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
  };
};

export default {
  initSendGrid,
  sendEmail,
  processTemplate,
  buildEmailFromTemplate,
};