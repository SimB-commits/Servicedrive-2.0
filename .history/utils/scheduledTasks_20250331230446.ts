// utils/scheduledTasks.ts

import { PrismaClient } from '@prisma/client';
import { logger } from './logger';
import planRestrictions from './planRestrictions';

const prisma = new PrismaClient();

/**
 * Återställer månadsantal för ärenden om återställningsdatum har passerat
 * Denna funktion kan köras dagligen som en schemalagd uppgift
 */
export async function resetMonthlyTicketCountIfNeeded(): Promise<void> {
  try {
    logger.info('Kontrollerar återställning av månadsantal för ärenden');
    
    // Hämta butiker där återställningsdatumet har passerat
    const stores = await prisma.store.findMany({
      where: {
        ticketCountResetDate: {
          lt: new Date()
        }
      }
    });
    
    logger.info(`Återställer räknare för ${stores.length} butiker`);
    
    // Återställ räknare och uppdatera nästa återställningsdatum
    for (const store of stores) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1); // Första dagen i nästa månad
      nextMonth.setHours(0, 0, 0, 0); // Sätt till midnatt
      
      await prisma.store.update({
        where: { id: store.id },
        data: {
          monthlyTicketCount: 0,
          ticketCountResetDate: nextMonth
        }
      });
      
      logger.info(`Återställde räknare för butik ${store.id}, nästa återställning: ${nextMonth.toISOString()}`);
    }
  } catch (error) {
    logger.error('Fel vid återställning av månatligt ärendeantal', { 
      error: error instanceof Error ? error.message : 'Okänt fel'
    });
  }
}

/**
 * Arkiverar gamla ärenden baserat på historikbegräsningar per prenumerationsplan
 * Denna funktion kan köras veckovis eller månatligen som en schemalagd uppgift
 */
export async function archiveOldTickets(): Promise<void> {
  try {
    logger.info('Startar arkivering av gamla ärenden');
    
    // Hämta alla butiker med deras prenumerationsplaner
    const stores = await prisma.store.findMany();
    
    for (const store of stores) {
      // Hämta historikbegränsning baserat på prenumerationsplan
      const monthsToKeep = planRestrictions.getHistoryLimitInMonths(store.subscriptionPlan);
      
      // Beräkna brytdatum baserat på historikbegränsning
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - monthsToKeep);
      
      // Vi behöver lägga till archived-kolumnen i prisma-modellen om den inte finns
      // För nu kan vi kanske simulera genom att uppdatera ett statusfält eller liknande
      // Alternativt kan vi använda JSON-metadata
      
      // Uppdatera äldre ärenden med en attribute i dynamicFields för att markera dem som arkiverade
      const result = await prisma.ticket.updateMany({
        where: {
          storeId: store.id,
          updatedAt: {
            lt: cutoffDate
          },
          // Kontrollera om de inte redan är markerade som arkiverade
          OR: [
            { 
              status: {
                notIn: ['CLOSED']
              } 
            },
            {
              customStatusId: {
                not: null
              }
            }
          ]
        },
        data: {
          // Sätt ärendet till stängt
          status: 'CLOSED',
          customStatusId: null,
          // Vi kan även lägga till metadata i dynamicFields för att indikera arkivering
          // Men detta skulle kräva att vi först läser och sedan skriver tillbaka JSON-data
        }
      });
      
      logger.info(`Arkiverade ${result.count} ärenden för butik ${store.id} (${store.name}) med plan ${store.subscriptionPlan}`);
    }
  } catch (error) {
    logger.error('Fel vid arkivering av gamla ärenden', { 
      error: error instanceof Error ? error.message : 'Okänt fel'
    });
  }
}

export default {
  resetMonthlyTicketCountIfNeeded,
  archiveOldTickets
};