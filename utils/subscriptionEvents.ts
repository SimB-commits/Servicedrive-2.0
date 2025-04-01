// utils/subscriptionEvents.ts
/**
 * Modul för hantering av prenumerationsrelaterade händelser.
 * 
 * Detta möjliggör uppdatering av prenumerationsstatusen när användare gör
 * ändringar eller när systemet behöver uppdatera prenumerationsinformation.
 */

import { logger } from './logger';

// En enkel hanterare för händelser
type SubscriptionEventHandler = () => void;

// Lista över registrerade händelsehanterare
let handlers: SubscriptionEventHandler[] = [];

/**
 * Registrera en hanterare som anropas när prenumerationen behöver uppdateras
 * @param handler Funktion som ska anropas vid uppdateringar
 * @returns Funktion för att avregistrera händelsehanteraren
 */
export const subscribeToSubscriptionUpdates = (handler: SubscriptionEventHandler): (() => void) => {
  handlers.push(handler);
  
  // Returnera en funktion för att avregistrera händelsehanteraren
  return () => {
    handlers = handlers.filter(h => h !== handler);
  };
};

/**
 * Utlös en uppdatering av prenumerationsinformationen
 * Detta anropar alla registrerade händelsehanterare
 */
export const triggerSubscriptionUpdate = (): void => {
  logger.info('Utlöser global prenumerationsuppdatering');
  
  // Anropa alla registrerade hanterare
  handlers.forEach(handler => {
    try {
      handler();
    } catch (error) {
      logger.error('Fel vid prenumerationsuppdatering', {
        error: error instanceof Error ? error.message : 'Okänt fel'
      });
    }
  });
};

export default {
  subscribeToSubscriptionUpdates,
  triggerSubscriptionUpdate
};