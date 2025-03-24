// utils/mail-service.ts
import { PrismaClient, Ticket, MailTemplate, UserTicketStatus, MailTemplateUsage } from '@prisma/client';
import { buildEmailFromTemplate, sendEmail, TemplateVariables } from './sendgrid';
import { logger } from './logger';

const prisma = new PrismaClient();

/**
 * Genererar en Reply-To adress baserad på ärende-ID och domän
 */
export function generateReplyToAddress(ticketId: number, domain?: string): string {
  // Använd verifierad domän eller fallback till standarddomän
  const replyDomain = domain || process.env.REPLY_DOMAIN || 'reply.servicedrive.se';
  return `ticket-${ticketId}@${replyDomain}`;
}

/**
 * Skickar en notifikation till handläggaren när ett nytt kundmeddelande mottagits
 */
export async function sendNewMessageNotification(
  ticket: any,
  message: any,
  recipientEmail: string,
): Promise<any> {
  try {
    // Skapa en förenklad version av det inkommande meddelandet
    const truncatedContent = message.content.length > 300 
      ? message.content.substring(0, 300) + '...' 
      : message.content;

    // Bygg HTML för notifikationen
    const htmlContent = `
      <h2>Nytt kundmeddelande på ärende #${ticket.id}</h2>
      <p>Kunden ${ticket.customer.firstName || ''} ${ticket.customer.lastName || ''} har svarat på ärende #${ticket.id}.</p>
      
      <div style="margin: 20px 0; padding: 10px; border-left: 4px solid #f0f0f0; background-color: #f9f9f9;">
        <p><strong>Meddelande:</strong></p>
        <p>${truncatedContent}</p>
      </div>
      
      <p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/arenden/${ticket.id}" 
           style="display:inline-block; background-color:#4CAF50; color:white; padding:10px 15px; text-decoration:none; border-radius:4px;">
          Visa ärendet
        </a>
      </p>
      
      <p style="color:#666; font-size:12px;">
        Detta är en automatisk notifikation från Servicedrive. 
        För att svara på kundens meddelande, logga in i systemet och gå till ärendet.
      </p>
    `;

    // Skapa variabler för mailmallen
    const variables = {
      ärendeID: ticket.id,
      kundNamn: `${ticket.customer.firstName || ''} ${ticket.customer.lastName || ''}`.trim() || ticket.customer.email,
      kundEmail: ticket.customer.email,
      ärendeTyp: ticket.ticketType?.name || '',
      ärendeStatus: ticket.customStatus?.name || ticket.status || '',
      meddelande: truncatedContent,
      länk: `${process.env.NEXT_PUBLIC_APP_URL}/arenden/${ticket.id}`,
      företagsNamn: process.env.COMPANY_NAME || 'Servicedrive',
    };

    // Försök hitta en mall för meddelande-notifikationer
    const notificationTemplate = await prisma.mailTemplate.findFirst({
      where: {
        storeId: ticket.storeId,
        name: { contains: 'notif' } // Försök hitta en mall som innehåller "notif"
      }
    });

    if (notificationTemplate) {
      // Använd den befintliga mallen om en hittades
      return await sendTemplatedEmail(
        recipientEmail,
        notificationTemplate,
        variables,
        ['message-notification', `ticket-${ticket.id}`]
      );
    } else {
      // Annars, skicka ett enkelt email utan mall
      const emailData = {
        to: recipientEmail,
        from: process.env.EMAIL_FROM || 'no-reply@servicedrive.se',
        subject: `Nytt kundmeddelande på ärende #${ticket.id}`,
        html: htmlContent,
        text: `Nytt kundmeddelande på ärende #${ticket.id}\n\nKunden har svarat på ärendet. Logga in för att se och svara på meddelandet: ${process.env.NEXT_PUBLIC_APP_URL}/arenden/${ticket.id}`,
        categories: ['message-notification', `ticket-${ticket.id}`]
      };
      
      return await sendEmail(emailData);
    }
  } catch (error) {
    logger.error(`Fel vid skickande av meddelande-notifikation för ärende #${ticket.id}`, {
      error: error.message,
      ticketId: ticket.id,
      messageId: message.id
    });
    throw error;
  }
}

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
    store?: any; // Lägg till valfri store-parameter
  },
  oldStatus?: string,
  oldCustomStatusId?: number | null
): Promise<any | null> => {
  try {
    // Om butiksinformation saknas, hämta den
    let store = ticket.store;
    if (!store && ticket.storeId) {
      try {
        store = await prisma.store.findUnique({
          where: { id: ticket.storeId }
        });
      } catch (error) {
        logger.warn(`Kunde inte hämta butiksinformation för ärende #${ticket.id}, använder standardnamn`, {
          error: error.message,
          ticketId: ticket.id,
          storeId: ticket.storeId
        });
      }
    }

    // Om ärendet har en anpassad status med mailmall, använd den
    let mailTemplate = ticket.customStatus?.mailTemplate;
    
    // Returnera null om ingen mailmall är kopplad till denna status
    // Vi använder INTE längre någon standardmall som fallback
    if (!mailTemplate) {
      logger.debug(`Ingen mailmall kopplad till status för ärende #${ticket.id}, skickar inget mail`);
      return null;
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
    
    // Lägg till butiksnamn i variablerna om det finns
    if (store) {
      variables.företagsNamn = store.name || store.company || variables.företagsNamn;
    }
    
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
      mailSource: 'custom-status',
      anonymizedRecipient: getAnonymizedCustomerName(ticket.customer),
      storeName: store?.name || 'Okänd butik'
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

// Resten av filen är oförändrad...

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
        buildTicketVariables(ticket, storeId),
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
export const buildTicketVariables = (ticket: any, store?: any): TemplateVariables => {
  const dynamicFields = typeof ticket.dynamicFields === 'object' && ticket.dynamicFields !== null
    ? ticket.dynamicFields
    : {};

  // Använd butiksnamn från store-objektet om tillgängligt, annars fallback
  const useCompanyName = store?.company || 
    ticket.store?.company || 
    process.env.COMPANY_NAME || 
    'Servicedrive';

  return {
    ärendeID: ticket.id,
    kundNamn: `${ticket.customer?.firstName || ''} ${ticket.customer?.lastName || ''}`.trim() || ticket.customer?.email || '',
    kundEmail: ticket.customer?.email || '',
    ärendeTyp: ticket.ticketType?.name || '',
    ärendeStatus: ticket.customStatus?.name || ticket.status || '',
    ärendeDatum: ticket.createdAt,
    företagsNamn: useCompanyName,
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
export async function sendTemplatedEmail(
  toEmail: string,
  template: { id: number; name: string; subject: string; body: string },
  variables: TemplateVariables,
  categories: string[] = [],
  fromEmail?: string,
  fromName?: string
): Promise<any | null> {
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
    
    // Om detta är relaterat till ett ärende, lägg till Reply-To
    if (variables.ärendeID) {
      // Extrahera domänen från avsändaradressen för att använda för reply
      const domain = senderEmail.split('@')[1];
      const domainParts = domain.split('.');
      // Vi bör bara använda den verifierade domänen om det är ett riktigt domännamn
      const verifiedDomain = domainParts.length >= 2 ? 
        `reply.${domainParts.slice(-2).join('.')}` : 
        process.env.REPLY_DOMAIN || 'reply.servicedrive.se';
      
      // Sätt Reply-To adressen
      emailData.replyTo = generateReplyToAddress(variables.ärendeID, verifiedDomain);
      
      // Lägg till X-Headers som kan användas för spårning och säkerhet
      emailData.headers = {
        ...(emailData.headers || {}),
        'X-Ticket-ID': `${variables.ärendeID}`,
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
      };
    }
    
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
      sender: senderEmail.split('@')[0].substring(0, 2) + '***@' + senderEmail.split('@')[1],
      hasReplyTo: !!emailData.replyTo
    });

    // Skapa ett nytt utgående meddelande i databasen om detta är ett ärende-mail
    if (variables.ärendeID && typeof variables.ärendeID === 'number') {
      try {
        const ticketId = variables.ärendeID;
        await prisma.message.create({
          data: {
            ticketId: ticketId,
            content: emailData.html || emailData.text || '',
            senderId: 'system', // Eller värdena från 'userId' om den finns
            isFromCustomer: false,
            emailFrom: emailData.from,
            emailTo: emailData.to,
            emailSubject: emailData.subject,
            emailMessageId: response.headers['x-message-id'],
            emailReplyTo: emailData.replyTo,
            createdAt: new Date(),
          }
        });
      } catch (dbError) {
        logger.error('Kunde inte spara utgående meddelande i databasen', { 
          error: dbError.message, 
          ticketId: variables.ärendeID 
        });
        // Fortsätt trots databasfel - mailet har skickats
      }
    }
    
    return response;
  } catch (error) {
    logger.error(`Fel vid skickande av mail med mall "${template.name}"`, {
      error: error.message,
      templateId: template.id
    });
    throw error;
  }
}

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

