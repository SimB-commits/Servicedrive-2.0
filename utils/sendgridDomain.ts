// utils/sendgridDomain.ts
import { logger } from './logger';

// Basinställningar för SendGrid API
const API_KEY = process.env.SENDGRID_API_KEY;
const BASE_URL = 'https://api.sendgrid.com/v3';

/**
 * Interface för domänautentiseringsdata från SendGrid
 */
interface DomainAuthenticationData {
  id: string; // Ändrat till string för att garantera typkonsekvens
  domain: string;
  subdomain: string;
  username: string;
  ips: string[];
  custom_spf: boolean;
  default: boolean;
  legacy: boolean;
  automatic_security: boolean;
  valid: boolean;
  dns: {
    mail_cname?: { host: string; type: string; data: string; valid: boolean };
    dkim1?: { host: string; type: string; data: string; valid: boolean };
    dkim2?: { host: string; type: string; data: string; valid: boolean };
    spf?: { host: string; type: string; data: string; valid: boolean };
    cname?: { host: string; type: string; data: string; valid: boolean };
    mail?: { host: string; type: string; data: string; valid: boolean };
  };
  subdomains?: string[];
  created_at: string;
  updated_at: string;
  dkim?: { valid: boolean };
  spf?: { valid: boolean };
}

/**
 * Generisk funktion för att göra API-anrop till SendGrid
 */
const sendGridApiRequest = async <T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: any
): Promise<T | null> => {
  try {
    if (!API_KEY) {
      throw new Error('SENDGRID_API_KEY saknas i miljövariablerna');
    }

    const headers = {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    
    // Hantera olika HTTP-statuskoder
    if (response.status === 204) {
      // No content, vanligtvis för DELETE-anrop
      return null;
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`SendGrid API Error: ${response.status} ${response.statusText}`, {
        endpoint,
        method,
        errorText: errorText
      });

      // Försök parsa felmeddelandet om det är JSON
      let errorDetail = 'Se loggarna för mer information';
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.errors && errorJson.errors.length > 0) {
          errorDetail = errorJson.errors.map(e => e.message).join(', ');
        }
      } catch (e) {
        // Ignorera fel vid parsning
      }

      throw new Error(`API-anrop misslyckades: ${response.status} ${response.statusText}. ${errorDetail}`);
    }

    // Parsa JSON om vi förväntar oss ett svar
    if (response.headers.get('content-type')?.includes('application/json')) {
      const data = await response.json();
      
      // Konvertera id till sträng om det behövs
      if (data && typeof data.id !== 'string' && data.id !== undefined) {
        data.id = String(data.id);
      } else if (Array.isArray(data)) {
        // Om det är en array av objekt, konvertera id till sträng för varje objekt
        data.forEach(item => {
          if (item && typeof item.id !== 'string' && item.id !== undefined) {
            item.id = String(item.id);
          }
        });
      }
      
      return data as T;
    }
    
    return null;
  } catch (error) {
    logger.error(`SendGrid API Request Error: ${error.message}`, {
      endpoint,
      method,
      error: error.stack?.substring(0, 500)
    });
    throw error;
  }
};

/**
 * Hämta alla domänautentiseringar
 */
export const getDomainAuthentication = async (): Promise<DomainAuthenticationData[]> => {
  try {
    const result = await sendGridApiRequest<DomainAuthenticationData[]>('/whitelabel/domains');
    return result || [];
  } catch (error) {
    // Om vi får "404 Not Found" eller liknande från API:et betyder det troligen
    // att användaren inte har några domäner eller användaren har en plan utan denna funktion
    logger.warn(`Kunde inte hämta domänautentiseringar: ${error.message}`);
    return [];
  }
};

/**
 * Hämta en specifik domänautentisering med ID
 */
export const getDomainAuthenticationById = async (id: string): Promise<DomainAuthenticationData | null> => {
  try {
    return await sendGridApiRequest<DomainAuthenticationData>(`/whitelabel/domains/${id}`);
  } catch (error) {
    logger.warn(`Kunde inte hämta domän med ID ${id}: ${error.message}`);
    return null;
  }
};

/**
 * Skapa en ny domänautentisering
 * Anpassad för gratisplanen utan Subuser Management
 */
export const createDomainAuthentication = async (domain: string, subdomain?: string): Promise<DomainAuthenticationData | null> => {
  // Skapa ett förenklat payload för gratisplanen
  const payload = {
    domain,
    subdomain: subdomain || 'mail',
    // Ta bort username-parametern som kräver Subuser Management
    // username: domain.replace(/\./g, '_'),
    ips: [],
    custom_spf: true,
    default: true,
    automatic_security: true,
  };

  try {
    // För SendGrid gratisplan, använd standarddomänautentisering
    return await sendGridApiRequest<DomainAuthenticationData>('/whitelabel/domains', 'POST', payload);
  } catch (error) {
    // Fånga specifika felmeddelanden relaterade till planbegränsningar
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes('subuser') || errorMessage.includes('could not find')) {
      throw new Error('Din SendGrid-plan stödjer inte Subuser Management. Använd standarddomänautentisering istället.');
    } else if (errorMessage.includes('limit') || errorMessage.includes('quota') || errorMessage.includes('plan')) {
      throw new Error('Du har nått maximalt antal verifierade domäner för din SendGrid-plan.');
    }
    throw error;
  }
};

/**
 * Alternativ metod för att skapa domänautentisering med Sender Authentication API
 * Detta fungerar ofta med gratisplanen när den vanliga metoden misslyckas
 */
export const createSenderAuthentication = async (domain: string): Promise<any> => {
  try {
    // Använd Sender Authentication-API istället för Whitelabel Domains
    // Detta är ofta tillgängligt även i gratisplanen
    const payload = {
      domain,
      default: true
    };
    
    return await sendGridApiRequest('/sender_authentication/domain', 'POST', payload);
  } catch (error) {
    logger.error(`Kunde inte skapa senderautentisering: ${error.message}`);
    throw error;
  }
};

/**
 * Verifiera en domänautentisering
 */
export const verifyDomainAuthentication = async (id: string): Promise<DomainAuthenticationData | null> => {
  try {
    return await sendGridApiRequest<DomainAuthenticationData>(`/whitelabel/domains/${id}/validate`, 'POST');
  } catch (error) {
    // Fånga specifika felmeddelanden
    if (error.message.includes('could not find') || error.message.includes('not found')) {
      logger.warn(`Domän med ID ${id} finns inte i SendGrid`);
      return null;
    }
    throw error;
  }
};

/**
 * Ta bort en domänautentisering
 */
export const deleteDomainAuthentication = async (id: string): Promise<void> => {
  try {
    await sendGridApiRequest<null>(`/whitelabel/domains/${id}`, 'DELETE');
  } catch (error) {
    // Ignorera 404-fel (domänen finns redan inte)
    if (error.message.includes('404')) {
      logger.warn(`Domän med ID ${id} finns redan inte i SendGrid`);
      return;
    }
    throw error;
  }
};

/**
 * Uppdatera en domänautentisering
 */
export const updateDomainAuthentication = async (id: string, data: Partial<{ default: boolean; custom_spf: boolean }>): Promise<DomainAuthenticationData | null> => {
  return await sendGridApiRequest<DomainAuthenticationData>(`/whitelabel/domains/${id}`, 'PATCH', data);
};

export default {
  getDomainAuthentication,
  getDomainAuthenticationById,
  createDomainAuthentication,
  createSenderAuthentication,
  verifyDomainAuthentication,
  deleteDomainAuthentication,
  updateDomainAuthentication
};