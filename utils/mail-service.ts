// utils/mail-service.ts
import { PrismaClient, Ticket, MailTemplate, UserTicketStatus } from '@prisma/client';
import { buildEmailFromTemplate, sendEmail, TemplateVariables } from './sendgrid';

const prisma = new PrismaClient();

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
      console.log(`Ingen mailmall kopplad till status för ärende #${ticket.id}`);
      return null;
    }
    
    // Kontrollera om vi har kundens e-postadress
    if (!ticket.customer?.email) {
      console.warn(`Kund saknar e-postadress för ärende #${ticket.id}, kan inte skicka mail`);
      return null;
    }
    
    // Bygg variabeldata från ärendet
    const dynamicFields = typeof ticket.dynamicFields === 'object' && ticket.dynamicFields !== null
    ? ticket.dynamicFields
    : {};

    const variables: TemplateVariables = {
      ärendeID: ticket.id,
      kundNamn: `${ticket.customer.firstName || ''} ${ticket.customer.lastName || ''}`.trim() || ticket.customer.email,
      kundEmail: ticket.customer.email,
      ärendeTyp: ticket.ticketType?.name || '',
      ärendeStatus: ticket.customStatus?.name || ticket.status || '',
      ärendeDatum: ticket.createdAt,
      företagsNamn: process.env.COMPANY_NAME || '',
      deadline: ticket.dueDate || '',
      gammalStatus: oldStatus || '',
      // Inkludera alla dynamiska fält (om det är ett objekt)
      ...dynamicFields,
    };
    
    // Bygg emailet baserat på mall och variabler
    const emailData = buildEmailFromTemplate(
      mailTemplate,
      variables,
      ticket.customer.email,
      process.env.EMAIL_FROM || 'no-reply@servicedrive.se'
    );
    
    // Skicka emailet
    const [response] = await sendEmail(emailData);
    
    // Logga att vi skickat mailet 
    console.log(`Status-uppdateringsmail skickat till ${ticket.customer.email} för ärende #${ticket.id}`);
    
    // Här skulle vi kunna logga mailet i en databas om önskat
    
    return response;
  } catch (error) {
    console.error(`Fel vid skickande av statusmail för ärende #${ticket.id}:`, error);
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
      console.warn(`Kund saknar e-postadress för ärende #${ticket.id}, kan inte skicka bekräftelsemail`);
      return null;
    }
    
    // Hämta standardmallen för nya ärenden från databasen
    // Detta antar att du har en mall med ett specifikt ID eller namn för nya ärenden
    const ticketConfirmationTemplateId = process.env.NEW_TICKET_TEMPLATE_ID;
    if (!ticketConfirmationTemplateId) {
      return null; // Ingen standardmall konfigurerad
    }
    
    const mailTemplate = await prisma.mailTemplate.findUnique({
      where: { id: Number(ticketConfirmationTemplateId) },
    });
    
    if (!mailTemplate) {
      console.log(`Ingen standardmall för nya ärenden hittades (ID: ${ticketConfirmationTemplateId})`);
      return null;
    }
    
    // Bygg variabeldata från ärendet
    const dynamicFields = typeof ticket.dynamicFields === 'object' && ticket.dynamicFields !== null
    ? ticket.dynamicFields
    : {};

    const variables: TemplateVariables = {
      ärendeID: ticket.id,
      kundNamn: `${ticket.customer.firstName || ''} ${ticket.customer.lastName || ''}`.trim() || ticket.customer.email,
      kundEmail: ticket.customer.email,
      ärendeTyp: ticket.ticketType?.name || '',
      ärendeStatus: ticket.status || '',
      ärendeDatum: ticket.createdAt,
      företagsNamn: process.env.COMPANY_NAME || '',
      deadline: ticket.dueDate || '',      
      // Inkludera alla dynamiska fält (om det är ett objekt)
      ...dynamicFields,
    };
    
    // Bygg emailet baserat på mall och variabler
    const emailData = buildEmailFromTemplate(
      mailTemplate,
      variables,
      ticket.customer.email,
      process.env.EMAIL_FROM || 'no-reply@servicedrive.se'
    );
    
    // Skicka emailet
    const [response] = await sendEmail(emailData);
    
    // Logga att vi skickat mailet
    console.log(`Bekräftelsemail skickat till ${ticket.customer.email} för nytt ärende #${ticket.id}`);
    
    return response;
  } catch (error) {
    console.error(`Fel vid skickande av bekräftelsemail för ärende #${ticket.id}:`, error);
    throw error;
  }
};
