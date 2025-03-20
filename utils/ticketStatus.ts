// utils/ticketStatus.ts
/**
 * Centraliserad hantering av ärendestatusar för att undvika duplicering
 * och säkerställa konsistens genom applikationen.
 */

/**
 * Interface för systemstatusar (default statusar)
 */
export interface SystemStatus {
    uid: string;         // Unik identifierare t.ex. "OPEN"
    name: string;        // Namn för visning, t.ex. "Öppen"
    color: string;       // HEX-färgkod
    systemName: string;  // Samma som uid, används för bakåtkompatibilitet
    mailTemplateId: null;// Alltid null för systemstatusar tills de konfigureras
  }
  
  /**
   * Interface för anpassade (custom) statusar
   */
  export interface CustomStatus {
    id?: number;          // Numeriskt ID från databasen
    uid: string;          // "CUSTOM_" + id
    name: string;         // Namn för visning
    color: string;        // HEX-färgkod
    mailTemplateId: number | null; // Optional koppling till mailmall
  }
  
  /**
   * Union-typ för alla statustyper
   */
  export type TicketStatus = SystemStatus | CustomStatus;
  
  /**
   * Standard systemstatusar med konsistenta värden
   */
  export const SYSTEM_STATUSES: SystemStatus[] = [
    { uid: "OPEN", name: "Öppen", color: "#22c55e", systemName: "OPEN", mailTemplateId: null },
    { uid: "IN_PROGRESS", name: "Pågående", color: "#3b82f6", systemName: "IN_PROGRESS", mailTemplateId: null },
    { uid: "RESOLVED", name: "Löst", color: "#6366f1", systemName: "RESOLVED", mailTemplateId: null },
    { uid: "CLOSED", name: "Färdig", color: "#64748b", systemName: "CLOSED", mailTemplateId: null }
  ];
  
  /**
   * Hitta en systemstatus baserat på uid
   */
  export function getSystemStatus(uid: string): SystemStatus | undefined {
    return SYSTEM_STATUSES.find(status => status.uid === uid);
  }
  
  /**
   * Konvertera en anpassad status från API till standardformat
   */
  export function convertApiStatus(apiStatus: any): CustomStatus {
    // Standardisera mailTemplateId till alltid vara null eller ett nummer
    let templateId = null;
    if (apiStatus.mailTemplateId !== undefined) {
      templateId = apiStatus.mailTemplateId !== null ? Number(apiStatus.mailTemplateId) : null;
    } else if (apiStatus.mailTemplate && apiStatus.mailTemplate.id) {
      templateId = Number(apiStatus.mailTemplate.id);
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
   * Konvertera ett ärende till dess effektiva status
   * Hanterar de olika formaten som kan förekomma i API-svar
   */
  export function getEffectiveStatus(ticket: any): string {
    // Om ärendet har en customStatus, använd det
    if (ticket.customStatus) {
      return `CUSTOM_${ticket.customStatus.id}`;
    }
    
    // Om status är ett objekt med uid, använd det
    if (typeof ticket.status === "object" && ticket.status.uid) {
      return ticket.status.uid;
    }
    
    // Annars, använd status som string
    return typeof ticket.status === "string" ? ticket.status : "UNKNOWN";
  }
  
  /**
   * Hämta visningsinformation (namn och färg) för en status
   */
  export function getStatusDisplay(ticket: any): { name: string; color: string } {
    // Om ärendet har en customStatus, använd den information
    if (ticket.customStatus && typeof ticket.customStatus === "object") {
      return {
        name: ticket.customStatus.name,
        color: ticket.customStatus.color || "#cccccc"
      };
    }
    
    // Hantera ärendesystem där status är ett objekt
    if (ticket.status && typeof ticket.status === "object") {
      return {
        name: ticket.status.name || "Okänd",
        color: ticket.status.color || "#cccccc"
      };
    }
  
    // För system-statusar, använd mappning
    if (typeof ticket.status === "string") {
      const systemStatus = getSystemStatus(ticket.status);
      if (systemStatus) {
        return {
          name: systemStatus.name,
          color: systemStatus.color
        };
      }
    }
    
    // Fallback om ingen av ovanstående matchar
    return { name: "Okänd", color: "#cccccc" };
  }
  
  /**
   * Kombinerar systemstatusar och dynamiska statusar från API
   */
  export function combineStatusOptions(apiStatuses: any[] = []): TicketStatus[] {
    // Konvertera API-statusar till standardformat
    const customStatuses = apiStatuses.map(convertApiStatus);
    
    // Kombinera med systemstatusarna
    return [...SYSTEM_STATUSES, ...customStatuses];
  }
  
  /**
   * Kontrollera om en status har en kopplad mailmall
   */
  export function hasMailTemplate(status: TicketStatus | null | undefined): boolean {
    if (!status) return false;
    return status.mailTemplateId !== null && status.mailTemplateId !== undefined;
  }
  
  /**
   * Hitta en status bland valmöjligheter baserat på dess uid
   */
  export function findStatusByUid(uid: string, options: TicketStatus[]): TicketStatus | undefined {
    return options.find(option => option.uid === uid);
  }