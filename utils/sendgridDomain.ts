// utils/sendgridDomain.ts
import fetch from 'node-fetch';
import { logger } from './logger';

// Basinställningar för SendGrid API
const API_KEY = process.env.SENDGRID_API_KEY;
const BASE_URL = 'https://api.sendgrid.com/v3';

/**
 * Interface för domänautentiseringsdata från SendGrid
 */
interface DomainAuthenticationData {
  id: string;
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

    const options: any = {
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
        errorText: errorText.substring(0, 500) // Begränsa storlek på loggad data
      });
      throw new Error(`API-anrop misslyckades: ${response.status} ${response.statusText}`);
    }

    // Parsa JSON om vi förväntar oss ett svar
    if (response.headers.get('content-type')?.includes('application/json')) {
      return await response.json();
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
  const result = await sendGridApiRequest<DomainAuthenticationData[]>('/whitelabel/domains');
  return result || [];
};

/**
 * Hämta en specifik domänautentisering med ID
 */
export const getDomainAuthenticationById = async (id: string): Promise<DomainAuthenticationData | null> => {
  return await sendGridApiRequest<DomainAuthenticationData>(`/whitelabel/domains/${id}`);
};

/**
 * Skapa en ny domänautentisering
 */
export const createDomainAuthentication = async (domain: string, subdomain?: string): Promise<DomainAuthenticationData | null> => {
  const payload = {
    domain,
    subdomain: subdomain || 'mail',
    username: domain.replace(/\./g, '_'), // Skapa ett säkert användarnamn baserat på domänen
    ips: [],
    custom_spf: true,
    default: false,
    automatic_security: true,
  };

  return await sendGridApiRequest<DomainAuthenticationData>('/whitelabel/domains', 'POST', payload);
};

/**
 * Verifiera en domänautentisering
 */
export const verifyDomainAuthentication = async (id: string): Promise<DomainAuthenticationData | null> => {
  return await sendGridApiRequest<DomainAuthenticationData>(`/whitelabel/domains/${id}/validate`, 'POST');
};

/**
 * Ta bort en domänautentisering
 */
export const deleteDomainAuthentication = async (id: string): Promise<void> => {
  await sendGridApiRequest<null>(`/whitelabel/domains/${id}`, 'DELETE');
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
  verifyDomainAuthentication,
  deleteDomainAuthentication,
  updateDomainAuthentication
};