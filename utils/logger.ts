// utils/logger.ts
/**
 * Enkel logger för strukturerad loggning utan känslig data
 * 
 * I en produktionsmiljö skulle detta ersättas med en mer robust
 * loggningslösning som Winston, Pino, eller en molnbaserad lösning.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogData {
  [key: string]: any;
}

// Enkelt filter för personuppgifter - utöka efter behov
const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, // Email
  /\b\d{10,12}\b/g, // Personnummer / telefonnummer
  /\b[0-9]{3}[\s-]?[0-9]{2}[\s-]?[0-9]{2}[\s-]?[0-9]{3}\b/g, // Personnummer med bindestreck
];

/**
 * Saniterar bort potentiellt känslig information från loggdata
 */
const sanitizeData = (data: any): any => {
  if (typeof data === 'object' && data !== null) {
    // Rekursivt sanitera objekt/arrayer
    const sanitized = Array.isArray(data) ? [] : {};
    
    Object.entries(data).forEach(([key, value]) => {
      // Skippa känsliga fält baserat på nyckelnamn
      const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'auth'];
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeData(value);
      } else if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else {
        sanitized[key] = value;
      }
    });
    
    return sanitized;
  } else if (typeof data === 'string') {
    return sanitizeString(data);
  }
  
  return data;
};

/**
 * Saniterar bort PII från strängar
 */
const sanitizeString = (str: string): string => {
  let sanitized = str;
  
  // Ersätt mönster som matchar PII
  PII_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[PII REDACTED]');
  });
  
  return sanitized;
};

/**
 * Loggningsfunktion med nivåer och strukturerad data
 */
const log = (level: LogLevel, message: string, data?: LogData) => {
  // I utvecklingsläge, logga alltid
  // I produktion, skippa debug-meddelanden
  if (level === 'debug' && process.env.NODE_ENV === 'production') {
    return;
  }
  
  const timestamp = new Date().toISOString();
  const sanitizedData = data ? sanitizeData(data) : undefined;
  
  // Skapa strukturerad loggning som en JSON-sträng
  const logEntry = JSON.stringify({
    timestamp,
    level,
    message,
    ...sanitizedData
  });
  
  // Använd olika console-metoder baserat på nivå
  switch (level) {
    case 'debug':
      console.debug(logEntry);
      break;
    case 'info':
      console.info(logEntry);
      break;
    case 'warn':
      console.warn(logEntry);
      break;
    case 'error':
      console.error(logEntry);
      break;
  }
};

// Exportera loggnivåfunktioner
export const logger = {
  debug: (message: string, data?: LogData) => log('debug', message, data),
  info: (message: string, data?: LogData) => log('info', message, data),
  warn: (message: string, data?: LogData) => log('warn', message, data),
  error: (message: string, data?: LogData) => log('error', message, data)
};