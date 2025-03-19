// utils/mail-service.ts
import { PrismaClient, Ticket, MailTemplate, UserTicketStatus, MailTemplateUsage } from '@prisma/client';
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
 * @param oldCustomStatusId Tidigare custom status ID (om tillgängligt)
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
  oldStatus?: string,
  oldCustomStatusId?: number | null
): Promise<any | null> => {
  try {
    // Om ärendet har en anpassad status med mailmall, använd den
    let mailTemplate = ticket.customStatus?.mailTemplate;
    let mailSource = 'custom-status';
    
    // Om ingen mailmall är direkt kopplad till status, försök hitta en mall baserad på statustyp
    if (!mailTemplate) {
      // Försök att hitta en mall för generella statusuppdateringar
      const templateSetting = await prisma.mailTemplateSettings.findUnique({
        where: {
          storeId_usage: {
            storeId: ticket.storeId,
            usage: 'STATUS_UPDATE'
          }
        },
        include: {
          template: true
        }
      });
      
      if (templateSetting?.template) {
        mailTemplate = templateSetting.template;
        mailSource = 'template-settings';
        logger.debug(`Använder generell STATUS_UPDATE-mall för ärende #${ticket.id}`);
      } else {
        logger.debug(`Ingen mailmall kopplad till status för ärende #${ticket.id}`);
        return null;
      }
    }
    
    // Kontrollera om vi har kundens e-postadress
    if (!ticket.customer?.email) {
      logger.warn(`Kund saknar e-postadress för ärende #${ticket.id}, kan inte skicka mail`);
      return null;
    }
    
    // Hämta den anpassade avsändaradressen för denna butik om den finns
    const senderAddress = await prisma.senderAddress.findFirst({
      where: {
        storeId: ticket.storeId,
        isDefault: true
      }
    });

    // Logga vilken avsändaradress som används för spårning
    logger.debug(`Använder avsändaradress för mail till ärende #${ticket.id}`, { 
      useDefaultSender: !!senderAddress,
      senderEmail: senderAddress?.email ? `${senderAddress.email.substring(0, 2)}***@${senderAddress.email.split('@')[1]}` : 'default'
    });
    
    // Bygg variabeldata från ärendet
    const variables = buildTicketVariables(ticket);
    
    // Lägg till information om statusändringen
    if (oldStatus) {
      variables.gammalStatus = oldStatus;
    }
    
    if (oldCustomStatusId && oldCustomStatusId !== ticket.customStatusId) {
      try {
        // Hämta namn på den gamla anpassade statusen
        const oldCustomStatus = await prisma.userTicketStatus.findUnique({
          where: { id: oldCustomStatusId }
        });
        
        if (oldCustomStatus) {
          variables.gammalStatusNamn = oldCustomStatus.name;
        }
      } catch (error) {
        // Ignorera fel vid hämtning av gammal status
        logger.warn(`Kunde inte hämta gammal anpassad status för ärende #${ticket.id}`, { 
          error: error.message,
          oldCustomStatusId
        });
      }
    }
    
    // Lägg till användbara länkar i variablerna
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    if (baseUrl) {
      variables.ärendeLänk = `${baseUrl}/arenden/${ticket.id}`;
    }
    
    // Lägg till status-specifik text baserad på aktuell status
    variables.statusText = getStatusSpecificText(ticket.status, ticket.customStatus?.name);
    
    // Skicka mail med statusmallen
    const response = await sendTemplatedEmail(
      ticket.customer.email,
      mailTemplate,
      variables,
      ['status-update', `ticket-${ticket.id}`, `status-${ticket.status || 'custom'}`],
      senderAddress?.email,
      senderAddress?.name
    );
    
    // Logga framgångsrikt mail
    logger.info(`Mail skickat för statusändring på ärende #${ticket.id}`, {
      ticketId: ticket.id, 
      status: ticket.status,
      customStatusId: ticket.customStatusId,
      mailSource,
      anonymizedRecipient: getAnonymizedCustomerName(ticket.customer)
    });
    
    return response;
  } catch (error) {
    logger.error(`Fel vid skickande av statusmail för ärende #${ticket.id}`, {
      error: error.message,
      ticketId: ticket.id,
      status: ticket.status,
      customStatusId: ticket.customStatusId
    });
    throw error;
  }
};

/**
 * Returnerar specifik text baserad på status för användning i mail
 */
const getStatusSpecificText = (status?: string, customStatusName?: string): string => {
  if (customStatusName) {
    return `Ditt ärende har fått statusen "${customStatusName}".`;
  }
  
  switch(status) {
    case 'OPEN':
      return 'Ditt ärende är nu öppet och vi jobbar på att hantera det så snart som möjligt.';
    case 'IN_PROGRESS':
      return 'Vi har nu börjat arbeta med ditt ärende.';
    case 'RESOLVED':
      return 'Ditt ärende har markerats som löst. Om du fortfarande upplever problem, vänligen kontakta oss.';
    case 'CLOSED':
      return 'Ditt ärende är nu avslutat. Tack för att du valde oss!';
    default:
      return 'Status på ditt ärende har uppdaterats.';
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
    
    // Hämta mailmallens inställningar för bekräftelsemail vid nya ärenden
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
    
    // Hämta den anpassade avsändaradressen för denna butik om den finns
    const senderAddress = await prisma.senderAddress.findFirst({
      where: {
        storeId: ticket.storeId,
        isDefault: true
      }
    });
    
    // Om ingen inställning finns eller ingen mall är vald, försök med fallback
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
        ['new-ticket-confirmation', `ticket-${ticket.id}`],
        senderAddress?.email,
        senderAddress?.name
      );
    }
    
    // Bygg utökade variabler med länkar
    const variables = buildTicketVariables(ticket);
    
    // Lägg till användbara länkar i variablerna
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    if (baseUrl) {
      variables.ärendeLänk = `${baseUrl}/arenden/${ticket.id}`;
    }
    
    // Skicka mail med konfigurerad mall
    return await sendTemplatedEmail(
      ticket.customer.email,
      mailTemplateSetting.template,
      variables,
      ['new-ticket-confirmation', `ticket-${ticket.id}`],
      senderAddress?.email,
      senderAddress?.name
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
    // Data om användare som hanterar ärendet, om tillgängligt
    handläggare: ticket.assignedUser ? 
      `${ticket.assignedUser.firstName || ''} ${ticket.assignedUser.lastName || ''}`.trim() : 
      (ticket.user ? `${ticket.user.firstName || ''} ${ticket.user.lastName || ''}`.trim() : ''),
    handläggareEmail: ticket.assignedUser?.email || ticket.user?.email || '',
    // Lägg till aktuellt datum
    aktuellDatum: new Date(),
    ...dynamicFields,
  };
};

/**
 * Generell funktion för att skicka mail baserat på en mall och variabler
 * @param toEmail Mottagarens e-postadress
 * @param template Mailmallen som ska användas
 * @param variables Variabler att använda i mallen
 * @param categories Kategorier för spårning (valfri)
 * @param fromEmail Avsändarens e-postadress (valfri)
 * @param fromName Avsändarens visningsnamn (valfri)
 * @returns Promise med resultat av mailsändning
 */
export const sendTemplatedEmail = async (
  toEmail: string,
  template: { id: number; name: string; subject: string; body: string },
  variables: TemplateVariables,
  categories: string[] = [],
  fromEmail?: string,
  fromName?: string
): Promise<any | null> => {
  try {
    // Använd angiven avsändare eller fall tillbaka på standardvärdet
    const senderEmail = fromEmail || process.env.EMAIL_FROM || 'no-reply@servicedrive.se';
    
    // Bygg emailet baserat på mall och variabler
    const emailData = buildEmailFromTemplate(
      template,
      variables,
      toEmail,
      senderEmail,
      fromName
    );
    
    // Lägg till kategorier för spårning
    emailData.categories = categories;
    
    // Lägg till ett GDPR-footer om det inte redan finns i mallen
    if (!emailData.html.includes('GDPR') && !emailData.html.includes('dataskydd')) {
      emailData.html += `
        <br><hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          Detta mail har skickats automatiskt från vårt ärendehanteringssystem. 
          Vi hanterar dina personuppgifter enligt GDPR. För mer information om 
          hur vi hanterar dina uppgifter, vänligen kontakta oss.
        </p>
      `;
    }
    
    // Skicka emailet
    const [response] = await sendEmail(emailData);
    
    // Logga att vi skickat mailet (anonymiserad)
    logger.info(`Mail skickat med mall "${template.name}"`, {
      templateId: template.id,
      templateName: template.name,
      anonymous_recipient: toEmail.split('@')[0].substring(0, 2) + '***@' + toEmail.split('@')[1].split('.')[0],
      categories,
      sender: senderEmail.split('@')[0].substring(0, 2) + '***@' + senderEmail.split('@')[1]
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
 * @param fromEmail Avsändarens e-postadress (valfri)
 * @param fromName Avsändarens visningsnamn (valfri)
 * @returns Promise med resultat av mailsändning
 */
export const sendCustomEmail = async (
  templateId: number,
  toEmail: string,
  variables: TemplateVariables,
  categories: string[] = ['custom-email'],
  fromEmail?: string,
  fromName?: string
): Promise<any> => {
  try {
    // Hämta mallen från databasen
    const mailTemplate = await prisma.mailTemplate.findUnique({
      where: { id: templateId },
    });
    
    if (!mailTemplate) {
      throw new Error(`Mailmall med ID ${templateId} hittades inte`);
    }
    
    // Använd angiven avsändare eller fall tillbaka på standardvärdet
    const senderEmail = fromEmail || process.env.EMAIL_FROM || 'no-reply@servicedrive.se';
    
    // Bygg emailet baserat på mall och variabler
    const emailData = buildEmailFromTemplate(
      mailTemplate,
      variables,
      toEmail,
      senderEmail,
      fromName
    );
    
    // Lägg till kategorier för spårning
    emailData.categories = categories;
    
    // Skicka emailet
    const [response] = await sendEmail(emailData);
    
    // Logga att vi skickat mailet
    logger.info(`Anpassat mail skickat med mall "${mailTemplate.name}"`, {
      templateId: mailTemplate.id,
      templateName: mailTemplate.name,
      anonymous_recipient: toEmail.split('@')[0].charAt(0) + '***@' + toEmail.split('@')[1].split('.')[0],
      sender: senderEmail.split('@')[0].charAt(0) + '***@' + senderEmail.split('@')[1]
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