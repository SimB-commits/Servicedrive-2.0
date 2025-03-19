// utils/mail-service.ts
import { PrismaClient, Ticket, MailTemplate, UserTicketStatus } from '@prisma/client';
import { buildEmailFromTemplate, sendEmail, TemplateVariables } from './sendgrid';
import { logger } from './logger';

const prisma = new PrismaClient();

/**
 * Anonymiserade versioner av kundnamn för loggning (GDPR-kompatibelt)
 */
const getAnonymizedCustomerName = (customer: any): string => {
  if (!customer) return 'unknown';
  
  if (customer.firstName || customer.lastName) {
    const firstInitial = customer.firstName ? customer.firstName.charAt(0) + '.' : '';
    const lastInitial = customer.lastName ? customer.lastName.charAt(0) + '.' : '';
    return `${firstInitial}${lastInitial}`.trim();
  }
  
  if (customer.email) {
    const parts = customer.email.split('@');
    if (parts.length === 2) {
      return `${parts[0].charAt(0)}***@${parts[1].split('.')[0]}`;
    }
  }
  
  return `customer_${customer.id}`;
};

/**
 * Skickar mail baserat på ärendets status om det finns en kopplad mailmall
 * @param ticket Ärende med inkluderade relationer (customer, customStatus, etc.)
 * @param oldStatus Tidigare status (om tillgängligt)
 * @returns Promise med resultat av mailsändning, eller null om ingen mall är kopplad
 */
export const sendTicketStatusEmail = async (
  ticket: Ticket & { 
    customer: any; 
    ticketType?: any; 
    customStatus?: UserTicketStatus & { mailTemplate?: MailTemplate };
    user?: any;
    assignedUser?: any;
  },
  oldStatus?: string
): Promise<any | null> => {
  try {
    // Om ärendet har en anpassad status med mailmall
    const mailTemplate = ticket.customStatus?.mailTemplate;
    
    // Om ingen mailmall är kopplad till status, avbryt
    if (!mailTemplate) {
      logger.debug(`Ingen mailmall kopplad till status för ärende #${ticket.id}`);
      return null;
    }
    
    // Kontrollera om vi har kundens e-postadress
    if (!ticket.customer?.email) {
      logger.warn(`Kund saknar e-postadress för ärende #${ticket.id}, kan inte skicka mail`);
      return null;
    }
    
    // Bygg variabeldata från ärendet
    const variables = buildTicketVariables(ticket);
    
    // Lägg till gammal status om det finns
    if (oldStatus) {
      variables.gammalStatus = oldStatus;
    }
    
    // Skicka mail med statusmallen
    return await sendTemplatedEmail(
      ticket.customer.email,
      mailTemplate,
      variables,
      ['status-update', `ticket-${ticket.id}`]
    );
  } catch (error) {
    logger.error(`Fel vid skickande av statusmail för ärende #${ticket.id}`, {
      error: error.message,
      ticketId: ticket.id
    });
    throw error;
  }
};

/**
 * Skickar bekräftelsemail när ett nytt ärende skapas om det finns en standardmall
 * @param ticket Nytt ärende med inkluderade relationer
 * @returns Promise med resultat av mailsändning, eller null om ingen mall hittades
 */
export const sendNewTicketEmail = async (
  ticket: Ticket & { 
    customer: any; 
    ticketType?: any;
    user?: any;
  }
): Promise<any | null> => {
  try {
    // Om kunden saknar e-postadress, avbryt
    if (!ticket.customer?.email) {
      logger.warn(`Kund saknar e-postadress för ärende #${ticket.id}, kan inte skicka bekräftelsemail`);
      return null;
    }
    
    // Hämta storeId från ärendet
    const storeId = ticket.storeId;
    
    // Hämta mallens inställningar för bekräftelsemail vid nya ärenden
    const mailTemplateSetting = await prisma.mailTemplateSettings.findUnique({
      where: {
        storeId_usage: {
          storeId,
          usage: 'NEW_TICKET'
        }
      },
      include: {
        template: true
      }
    });
    
    // Om ingen inställning finns eller ingen mall är vald, avbryt
    if (!mailTemplateSetting?.template) {
      // Fallback till miljövariabel (bakåtkompatibilitet)
      const ticketConfirmationTemplateId = process.env.NEW_TICKET_TEMPLATE_ID;
      
      let fallbackTemplate = null;
      if (ticketConfirmationTemplateId) {
        fallbackTemplate = await prisma.mailTemplate.findUnique({
          where: { id: Number(ticketConfirmationTemplateId) },
        });
      }
      
      if (!fallbackTemplate) {
        logger.debug('Ingen mall för nya ärenden konfigurerad', { storeId });
        return null;
      }
      
      // Använd fallback-mallen om den finns
      return await sendTemplatedEmail(
        ticket.customer.email,
        fallbackTemplate,
        buildTicketVariables(ticket),
        ['new-ticket-confirmation', `ticket-${ticket.id}`]
      );
    }
    
    // Skicka mail med konfigurerad mall
    return await sendTemplatedEmail(
      ticket.customer.email,
      mailTemplateSetting.template,
      buildTicketVariables(ticket),
      ['new-ticket-confirmation', `ticket-${ticket.id}`]
    );
  } catch (error) {
    logger.error(`Fel vid skickande av bekräftelsemail för ärende #${ticket.id}`, {
      error: error.message,
      ticketId: ticket.id
    });
    throw error;
  }
};

/**
 * Byggfunktion för att skapa variabeldata från ett ärende
 * Centraliserad funktion för att skapa konsistenta variabler
 */
export const buildTicketVariables = (ticket: any): TemplateVariables => {
  const dynamicFields = typeof ticket.dynamicFields === 'object' && ticket.dynamicFields !== null
    ? ticket.dynamicFields
    : {};

  return {
    ärendeID: ticket.id,
    kundNamn: `${ticket.customer?.firstName || ''} ${ticket.customer?.lastName || ''}`.trim() || ticket.customer?.email || '',
    kundEmail: ticket.customer?.email || '',
    ärendeTyp: ticket.ticketType?.name || '',
    ärendeStatus: ticket.customStatus?.name || ticket.status || '',
    ärendeDatum: ticket.createdAt,
    företagsNamn: process.env.COMPANY_NAME || '',
    deadline: ticket.dueDate || '',      
    ...dynamicFields,
  };
};

/**
 * Generell funktion för att skicka mail baserat på en mall och variabler
 */
export const sendTemplatedEmail = async (
  toEmail: string,
  template: { id: number; name: string; subject: string; body: string },
  variables: TemplateVariables,
  categories: string[] = []
): Promise<any | null> => {
  try {
    // Bygg emailet baserat på mall och variabler
    const emailData = buildEmailFromTemplate(
      template,
      variables,
      toEmail,
      process.env.EMAIL_FROM || 'no-reply@servicedrive.se'
    );
    
    // Lägg till kategorier för spårning
    emailData.categories = categories;
    
    // Skicka emailet
    const [response] = await sendEmail(emailData);
    
    // Logga att vi skickat mailet (anonymiserad)
    logger.info(`Mail skickat med mall "${template.name}"`, {
      templateId: template.id,
      templateName: template.name,
      anonymous_recipient: toEmail.split('@')[0].substring(0, 2) + '***@' + toEmail.split('@')[1].split('.')[0],
      categories
    });
    
    return response;
  } catch (error) {
    logger.error(`Fel vid skickande av mail med mall "${template.name}"`, {
      error: error.message,
      templateId: template.id
    });
    throw error;
  }
};

/**
 * Skickar anpassat mail med valfri mall och variabler
 * @param templateId ID för mail-mallen som ska användas
 * @param toEmail Mottagarens e-postadress
 * @param variables Variabler att använda i mallen
 * @param categories Kategorier för spårning (optional)
 * @returns Promise med resultat av mailsändning
 */
export const sendCustomEmail = async (
  templateId: number,
  toEmail: string,
  variables: TemplateVariables,
  categories: string[] = ['custom-email']
): Promise<any> => {
  try {
    // Hämta mallen från databasen
    const mailTemplate = await prisma.mailTemplate.findUnique({
      where: { id: templateId },
    });
    
    if (!mailTemplate) {
      throw new Error(`Mailmall med ID ${templateId} hittades inte`);
    }
    
    // Bygg emailet baserat på mall och variabler
    const emailData = buildEmailFromTemplate(
      mailTemplate,
      variables,
      toEmail,
      process.env.EMAIL_FROM || 'no-reply@servicedrive.se'
    );
    
    // Lägg till kategorier för spårning
    emailData.categories = categories;
    
    // Skicka emailet
    const [response] = await sendEmail(emailData);
    
    // Logga att vi skickat mailet
    logger.info(`Anpassat mail skickat med mall "${mailTemplate.name}"`, {
      templateId: mailTemplate.id,
      templateName: mailTemplate.name,
      anonymous_recipient: toEmail.split('@')[0].charAt(0) + '***@' + toEmail.split('@')[1].split('.')[0]
    });
    
    return response;
  } catch (error) {
    logger.error(`Fel vid skickande av anpassat mail`, {
      error: error.message,
      templateId
    });
    throw error;
  }
};