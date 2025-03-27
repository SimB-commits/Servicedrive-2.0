// utils/ticketStatusService.ts
/**
 * Centraliserad tjänst för hantering av ärendestatusar genom hela applikationen.
 * Hanterar alla aspekter av ärendestatusar inklusive hämtning, visning och mailkoppling.
 */
import { PrismaClient, MailTemplate, MailTemplateUsage } from '@prisma/client';
import { logger } from './logger';
import { addToast } from '@heroui/react';

const prisma = new PrismaClient();

/**
 * Interface för en grundläggande status
 */
export interface BaseStatus {
  uid: string;          // Unik identifierare
  name: string;         // Visningsnamn
  color: string;        // HEX-färgkod 
  mailTemplateId?: number | null; // Koppling till mailmall (om det finns)
}

/**
 * Interface för systemstatusar (default statusar)
 */
export interface SystemStatus extends BaseStatus {
  systemName: string;   // Samma som uid, för intern mappning
  isSystemStatus: true; // Flagga för att identifiera systemstatusar
}

/**
 * Interface för anpassade (custom) statusar
 */
export interface CustomStatus extends BaseStatus {
  id: number;           // Numeriskt ID från databasen
  isSystemStatus?: false; // Systemstatusar är alltid false (eller saknas)
}

/**
 * Union-typ för alla statusar
 */
export type TicketStatus = SystemStatus | CustomStatus;

/**
 * Standard systemstatusar med konsistenta värden
 */
export const SYSTEM_STATUSES: SystemStatus[] = [
  { uid: "OPEN", name: "Öppen", color: "#ff9500", systemName: "OPEN", mailTemplateId: null, isSystemStatus: true },
  { uid: "IN_PROGRESS", name: "Pågående", color: "#ffa500", systemName: "IN_PROGRESS", mailTemplateId: null, isSystemStatus: true },
  { uid: "RESOLVED", name: "Löst", color: "#4da6ff", systemName: "RESOLVED", mailTemplateId: null, isSystemStatus: true },
  { uid: "CLOSED", name: "Färdig", color: "#3BAB48", systemName: "CLOSED", mailTemplateId: null, isSystemStatus: true }
];

// Cache för statusar per butik för effektivitet
let statusCache: Record<number, TicketStatus[]> = {};
let lastCacheFetch: Date | null = null;
const CACHE_LIFETIME_MS = 5 * 60 * 1000; // 5 minuter

/**
 * Konvertera ett API-statusobjekt till standardiserat format
 */
export function normalizeApiStatus(apiStatus: any): CustomStatus {
  // Säkerställ korrekt format för mailTemplateId
  let templateId = null;
  if (apiStatus.mailTemplateId !== undefined) {
    templateId = apiStatus.mailTemplateId;
  } else if (apiStatus.mailTemplate && apiStatus.mailTemplate.id) {
    templateId = apiStatus.mailTemplate.id;
  }
  
  return {
    id: apiStatus.id,
    uid: `CUSTOM_${apiStatus.id}`,
    name: apiStatus.name,
    color: apiStatus.color || "#cccccc",
    mailTemplateId: templateId
  };
}

/**
 * Slå samman systemstatusar med anpassade statusar
 */
export function combineStatusOptions(customStatuses: any[] = []): TicketStatus[] {
  const normalizedCustomStatuses = customStatuses.map(normalizeApiStatus);
  const combinedStatuses: TicketStatus[] = [...SYSTEM_STATUSES];
  
  // Gå igenom alla anpassade statusar
  normalizedCustomStatuses.forEach(customStatus => {
    // Kontrollera om denna anpassade status motsvarar en systemstatus
    // genom att jämföra namn (strängen, inte UID)
    const matchingSystemStatusIndex = combinedStatuses.findIndex(
      status => status.name.toLowerCase() === customStatus.name.toLowerCase()
    );
    
    if (matchingSystemStatusIndex >= 0) {
      // Om en matchande systemstatus hittades, uppdatera den med egenskaper från den anpassade statusen
      // (speciellt mailTemplateId) istället för att lägga till en ny status
      combinedStatuses[matchingSystemStatusIndex] = {
        ...combinedStatuses[matchingSystemStatusIndex],
        mailTemplateId: customStatus.mailTemplateId,
        // Behåll isSystemStatus = true
        isSystemStatus: combinedStatuses[matchingSystemStatusIndex].isSystemStatus
      };
    } else {
      // Om det inte finns någon matchande systemstatus, lägg till den anpassade statusen
      combinedStatuses.push(customStatus);
    }
  });
  
  return combinedStatuses;
}

/**
 * Hitta en status baserat på uid i en lista av statusar
 */
export function findStatusByUid(uid: string, options: TicketStatus[]): TicketStatus | undefined {
  return options.find(option => option.uid === uid);
}

/**
 * Hitta en systemstatus baserat på uid
 */
export function getSystemStatus(uid: string): SystemStatus | undefined {
  return SYSTEM_STATUSES.find(status => status.uid === uid);
}

/**
 * Förbättrad funktion för att avgöra om en status har en mailmall
 * @param status Status som ska verifieras
 * @returns Boolean som indikerar om status har en mailmall
 */
export function hasMailTemplate(status: TicketStatus | null | undefined): boolean {
  // Null/undefined check
  if (!status) return false;

  // 1. Direkt kontroll för systemstatusar
  if ('isSystemStatus' in status && status.isSystemStatus) {
    // För systemstatusar, kontrollera mailTemplateId
    return status.mailTemplateId !== null && 
           status.mailTemplateId !== undefined;
  }

  // 2. För anpassade statusar
  // Kontrollera både direkt mailTemplateId och indirekt via mailTemplate
  return (status as CustomStatus).mailTemplateId !== null && 
         (status as CustomStatus).mailTemplateId !== undefined;
}

/**
 * Hämta den faktiska mailmallen för en status
 * @param status Status vars mall ska hämtas
 * @returns Mailmall eller null om ingen finns
 */
export async function getStatusMailTemplate(
  status: TicketStatus, 
  storeId: number
): Promise<MailTemplate | null> {
  try {
    // Om status har ett direktkopplat mailTemplateId, returnera den
    if (hasMailTemplate(status)) {
      const templateId = 'mailTemplateId' in status ? status.mailTemplateId : null;
      
      if (templateId) {
        const template = await prisma.mailTemplate.findUnique({
          where: { 
            id: templateId,
            storeId: storeId 
          }
        });
        
        return template;
      }
    }

    // Fallback: Sök efter en mall via inställningar för status
    // Detta ger flexibilitet för systemstatusar
    const statusMapping: Record<string, MailTemplateUsage> = {
      'OPEN': 'NEW_TICKET',
      'IN_PROGRESS': 'STATUS_UPDATE', 
      'RESOLVED': 'STATUS_UPDATE',
      'CLOSED': 'STATUS_UPDATE'
    };

    // Bestäm lämplig usage baserat på status
    const usage = status.systemName ? 
      statusMapping[status.systemName] || 'STATUS_UPDATE' : 
      'STATUS_UPDATE';

    const templateSetting = await prisma.mailTemplateSettings.findUnique({
      where: {
        storeId_usage: {
          storeId: storeId,
          usage: usage
        }
      },
      include: {
        template: true
      }
    });

    return templateSetting?.template || null;
  } catch (error) {
    // Logga felet och returnera null
    logger.error('Fel vid hämtning av mailmall för status', { 
      error: error instanceof Error ? error.message : 'Okänt fel',
      statusId: 'id' in status ? status.id : 'system-status',
      systemName: status.systemName
    });
    return null;
  }
}

/**
 * Hämta alla statusar (kombinerade system- och anpassade statusar)
 * Använder cache om tillgänglig och inte för gammal
 */
export async function getAllStatuses(forceRefresh = false): Promise<TicketStatus[]> {
  try {
    // Kontrollera om vi behöver tvinga uppdatering eller om cachen är för gammal
    const needsRefresh = forceRefresh || 
      !lastCacheFetch || 
      (Date.now() - lastCacheFetch.getTime()) > CACHE_LIFETIME_MS;
    
    if (needsRefresh) {
      const res = await fetch('/api/tickets/statuses');
      if (!res.ok) {
        throw new Error('Kunde inte hämta statusar från API:et');
      }
      
      const data = await res.json();
      // Uppdatera cache
      statusCache = combineStatusOptions(data);
      lastCacheFetch = new Date();
    }
    
    return statusCache;
  } catch (error) {
    logger.error('Fel vid hämtning av statusar', { error });
    // Returnera minst systemstatusarna om något går fel
    return [...SYSTEM_STATUSES];
  }
}

/**
 * Uppdatera eller skapa en status via API
 */
export async function saveStatus(statusData: any, statusId?: number): Promise<CustomStatus | null> {
  try {
    const url = statusId ? `/api/tickets/statuses/${statusId}` : '/api/tickets/statuses';
    const method = statusId ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(statusData)
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || 'Kunde inte spara status');
    }
    
    const savedStatus = await res.json();
    // Uppdatera cache vid framgång
    lastCacheFetch = null; // Tvinga uppdatering vid nästa hämtning
    
    // Visa en framgångstoast
    addToast({
      title: statusId ? 'Status uppdaterad' : 'Status skapad',
      description: statusId 
        ? 'Statusen uppdaterades framgångsrikt!'
        : 'Den nya statusen skapades framgångsrikt!',
      color: 'success',
      variant: 'flat'
    });
    
    return normalizeApiStatus(savedStatus);
  } catch (error) {
    logger.error('Fel vid sparande av status', { error, statusData });
    
    // Visa en feltoast
    addToast({
      title: 'Fel',
      description: error instanceof Error ? error.message : 'Ett fel inträffade vid hantering av statusen',
      color: 'danger',
      variant: 'flat'
    });
    
    return null;
  }
}

/**
 * Ta bort en status
 */
export async function deleteStatus(id: number): Promise<boolean> {
  try {
    if (!confirm('Är du säker på att du vill ta bort denna status?')) {
      return false;
    }
    
    const res = await fetch(`/api/tickets/statuses/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || 'Kunde inte ta bort statusen');
    }
    
    // Uppdatera cache vid framgång
    lastCacheFetch = null; // Tvinga uppdatering vid nästa hämtning
    
    addToast({
      title: 'Status borttagen',
      description: 'Statusen togs bort framgångsrikt',
      color: 'success',
      variant: 'flat'
    });
    
    return true;
  } catch (error) {
    logger.error('Fel vid borttagning av status', { error, statusId: id });
    
    addToast({
      title: 'Fel',
      description: error instanceof Error ? error.message : 'Ett fel inträffade vid borttagning av statusen',
      color: 'danger',
      variant: 'flat'
    });
    
    return false;
  }
}

/**
 * Hämta korrekt uid för en status (hanterar olika dataformat)
 */
export function getStatusUid(ticket: any): string {
  // Om ärendet har en anpassad status, använd dess uid
  if (ticket.customStatus && ticket.customStatus.id) {
    return `CUSTOM_${ticket.customStatus.id}`;
  }
  
  // Om status är ett objekt med uid-egenskap, använd det
  if (ticket.status && typeof ticket.status === 'object' && ticket.status.uid) {
    return ticket.status.uid;
  }
  
  // Annars, använd status-strängen direkt
  if (typeof ticket.status === 'string') {
    return ticket.status;
  }
  
  // Fallback om inget av ovanstående fungerar
  return 'UNKNOWN';
}

/**
 * Hämta visningsinformation för en given status
 */
export function getStatusDisplay(ticket: any): { name: string; color: string } {
  try {
    // Om ärendet har en customStatus, prioritera den
    if (ticket.customStatus && typeof ticket.customStatus === 'object') {
      return {
        name: ticket.customStatus.name || 'Anpassad',
        color: ticket.customStatus.color || '#cccccc'
      };
    }
    
    // För objektstatusar
    if (ticket.status && typeof ticket.status === 'object' && ticket.status.name) {
      return {
        name: ticket.status.name || 'Status',
        color: ticket.status.color || '#cccccc'
      };
    }
    
    // För strängstatusar, leta efter matchande systemstatus
    if (typeof ticket.status === 'string') {
      const systemStatus = getSystemStatus(ticket.status);
      if (systemStatus) {
        return {
          name: systemStatus.name,
          color: systemStatus.color
        };
      }
    }
    
    // Fallback
    return { name: 'Okänd', color: '#cccccc' };
  } catch (error) {
    logger.warn('Fel vid hämtning av statusvisning', { error, ticket });
    return { name: 'Okänd', color: '#cccccc' };
  }
}

/**
 * Uppdatera ett ärendes status med kontroll för mailutskick
 */
export async function updateTicketStatus(
  ticketId: number, 
  statusUid: string, 
  sendEmail: boolean = true
): Promise<any> {
  try {
    // Förberedelse av payload för API-anropet
    // Vi måste hantera custom vs system statusar korrekt
    let payload: Record<string, any> = {
      sendNotification: sendEmail
    };
    
    // Hantera statusar baserat på UID-format
    // Custom statusar börjar med CUSTOM_ följt av ID
    const isCustomStatus = statusUid.startsWith('CUSTOM_');
    
    if (isCustomStatus) {
      // För custom statusar, skicka bara status UID, API:et hanterar uppdelningen
      payload.status = statusUid;
    } else {
      // För systemstatusar, skicka status direkt
      payload.status = statusUid;
    }
    
    // Förbättrad loggning för felsökning
    logger.debug('Skickar statusuppdatering till API', { 
      ticketId,
      statusUid,
      isCustomStatus,
      sendEmail,
      payload: JSON.stringify(payload)
    });
    
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || res.statusText || 'Kunde inte uppdatera status');
    }

    const updatedTicket = await res.json();
    
    // Detaljerade framgångstoasts beroende på situation
    // Vi påverkar inte den faktiska logiken för att avgöra om mail skickas - det sköts av API:et
    // Här beräknar vi bara vad som visas i toast-meddelandet
    const isMailSent = sendEmail;
    
    const statusName = isCustomStatus
      ? updatedTicket.customStatus?.name || 'Anpassad status'
      : findStatusByUid(statusUid, SYSTEM_STATUSES)?.name || statusUid;
    
    const statusMessage = isMailSent 
      ? `Ärendets status har ändrats till "${statusName}" och mail har skickats till kunden`
      : `Ärendets status har ändrats till "${statusName}" utan mailnotifiering`;
    
    addToast({
      title: 'Status uppdaterad',
      description: statusMessage,
      color: 'success',
      variant: 'flat'
    });
    
    return updatedTicket;
  } catch (error) {
    logger.error('Fel vid uppdatering av ärendestatus', { 
      error: error instanceof Error ? error.message : 'Okänt fel',
      ticketId,
      statusUid
    });
    
    addToast({
      title: 'Fel',
      description: error instanceof Error ? error.message : 'Kunde inte uppdatera status',
      color: 'danger',
      variant: 'flat'
    });
    
    throw error;
  }
}

// Exportera alla funktioner och konstanter för användning i resten av applikationen
export default {
  SYSTEM_STATUSES,
  normalizeApiStatus,
  combineStatusOptions,
  findStatusByUid,
  getSystemStatus,
  hasMailTemplate,
  getAllStatuses,
  saveStatus,
  deleteStatus,
  getStatusUid,
  getStatusDisplay,
  updateTicketStatus,
  getStatusMailTemplate
};