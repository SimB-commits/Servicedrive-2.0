// utils/planRestrictions.ts
import { PrismaClient, SubscriptionPlan } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient();

/**
 * Plan limits för Servicedrive
 */
export const PLAN_LIMITS = {
  [SubscriptionPlan.STARTUP]: {
    monthlyTickets: 50,
    ticketTypes: 2,
    customStatuses: 0, // Bara standardstatusar
    adminUsers: 1,
    historyMonths: 3,
    description: "Basversion för nystartade verksamheter (50 ärenden/månad)"
  },
  [SubscriptionPlan.TEAM]: {
    monthlyTickets: Infinity,
    ticketTypes: 5,
    customStatuses: 3,
    adminUsers: 3,
    historyMonths: 12,
    description: "För småföretag med professionell ärendehantering"
  },
  [SubscriptionPlan.GROWING]: {
    monthlyTickets: Infinity,
    ticketTypes: 10,
    customStatuses: 5,
    adminUsers: 5,
    historyMonths: 24,
    description: "För verksamheter i tillväxtfas med avancerade funktioner"
  },
  [SubscriptionPlan.PROFESSIONAL]: {
    monthlyTickets: Infinity,
    ticketTypes: Infinity,
    customStatuses: 10,
    adminUsers: 10,
    historyMonths: 60, // 5 år
    description: "För etablerade företag med avancerad ärendehantering"
  }
};

/**
 * Returnerar information om en prenumerationsplan
 */
export function getPlanDetails(plan: SubscriptionPlan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS[SubscriptionPlan.STARTUP];
}

/**
 * Kontrollerar om en store kan skapa fler ärenden baserat på deras plan
 */
export async function canCreateTicket(storeId: number): Promise<{ allowed: boolean; message?: string }> {
  try {
    // Hämta butikens information
    const store = await prisma.store.findUnique({
      where: { id: storeId }
    });
    
    if (!store) {
      logger.error(`Store with ID ${storeId} not found when checking ticket limits`);
      return { 
        allowed: false, 
        message: 'Butik hittades inte' 
      };
    }
    
    // Hämta plangränser
    const planLimits = PLAN_LIMITS[store.subscriptionPlan];
    
    // För STARTUP-plan, kontrollera månatliga begränsningar
    if (store.subscriptionPlan === SubscriptionPlan.STARTUP) {
      // Kontrollera om begränsningen på 50 ärenden/månad har nåtts
      if (store.monthlyTicketCount >= planLimits.monthlyTickets) {
        return { 
          allowed: false, 
          message: `Din nuvarande plan (${store.subscriptionPlan}) tillåter endast ${planLimits.monthlyTickets} ärenden per månad. Uppgradera för obegränsade ärenden.` 
        };
      }
    }
    
    // För andra planer finns inga begränsningar på antalet ärenden
    return { allowed: true };
    
  } catch (error) {
    logger.error('Error checking ticket creation limits', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      storeId
    });
    
    return { 
      allowed: false, 
      message: 'Ett fel uppstod vid kontroll av planbegränsningar' 
    };
  }
}

/**
 * Ökar räknaren för månatliga ärenden för en butik
 */
export async function incrementTicketCount(storeId: number): Promise<boolean> {
  try {
    // Först kontrollera om vi behöver återställa räknaren
    await resetMonthlyTicketCountIfNeeded(storeId);
    
    // Uppdatera räknaren
    await prisma.store.update({
      where: { id: storeId },
      data: {
        monthlyTicketCount: {
          increment: 1
        }
      }
    });
    
    return true;
  } catch (error) {
    logger.error('Error incrementing ticket count', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      storeId
    });
    return false;
  }
}

/**
 * Kontrollerar om en butik kan skapa fler ärendetyper baserat på deras plan
 */
export async function canCreateTicketType(storeId: number): Promise<{ allowed: boolean; message?: string }> {
  try {
    // Hämta butikens information och användningsstatistik
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { 
        StoreUsageMetrics: {
          orderBy: { updatedAt: 'desc' },
          take: 1
        } 
      }
    });
    
    if (!store) {
      logger.error(`Store with ID ${storeId} not found when checking ticket type limits`);
      return { 
        allowed: false, 
        message: 'Butik hittades inte' 
      };
    }
    
    // Hämta plangränser
    const planLimits = PLAN_LIMITS[store.subscriptionPlan];
    
    // Hämta aktuellt antal ärendetyper från databasen
    const currentCount = await prisma.ticketType.count({
      where: { storeId }
    });
    
    // Kontrollera begränsning baserat på plan
    if (currentCount >= planLimits.ticketTypes) {
      return { 
        allowed: false, 
        message: `Din nuvarande plan (${store.subscriptionPlan}) tillåter max ${planLimits.ticketTypes} anpassade ärendetyper. Uppgradera för att skapa fler.` 
      };
    }
    
    return { allowed: true };
    
  } catch (error) {
    logger.error('Error checking ticket type creation limits', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      storeId
    });
    
    return { 
      allowed: false, 
      message: 'Ett fel uppstod vid kontroll av planbegränsningar' 
    };
  }
}

/**
 * Kontrollerar om en butik kan skapa fler anpassade statusar baserat på deras plan
 */
export async function canCreateCustomStatus(storeId: number): Promise<{ allowed: boolean; message?: string }> {
  try {
    // Hämta butikens information
    const store = await prisma.store.findUnique({
      where: { id: storeId }
    });
    
    if (!store) {
      logger.error(`Store with ID ${storeId} not found when checking custom status limits`);
      return { 
        allowed: false, 
        message: 'Butik hittades inte' 
      };
    }
    
    // Hämta plangränser
    const planLimits = PLAN_LIMITS[store.subscriptionPlan];
    
    // Hämta aktuellt antal anpassade statusar från databasen
    const currentCount = await prisma.userTicketStatus.count({
      where: { storeId }
    });
    
    // Kontrollera begränsning baserat på plan
    if (currentCount >= planLimits.customStatuses) {
      return { 
        allowed: false, 
        message: `Din nuvarande plan (${store.subscriptionPlan}) tillåter max ${planLimits.customStatuses} anpassade statusar. Uppgradera för att skapa fler.` 
      };
    }
    
    return { allowed: true };
    
  } catch (error) {
    logger.error('Error checking custom status creation limits', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      storeId
    });
    
    return { 
      allowed: false, 
      message: 'Ett fel uppstod vid kontroll av planbegränsningar' 
    };
  }
}

/**
 * Kontrollerar om en butik kan lägga till fler administratörer baserat på deras plan
 */
export async function canAddAdmin(storeId: number): Promise<{ allowed: boolean; message?: string }> {
  try {
    // Hämta butikens information
    const store = await prisma.store.findUnique({
      where: { id: storeId }
    });
    
    if (!store) {
      logger.error(`Store with ID ${storeId} not found when checking admin limits`);
      return { 
        allowed: false, 
        message: 'Butik hittades inte' 
      };
    }
    
    // Hämta plangränser
    const planLimits = PLAN_LIMITS[store.subscriptionPlan];
    
    // Hämta aktuellt antal admin-användare för butiken
    const adminCount = await prisma.userStore.count({
      where: {
        storeId,
        user: {
          role: 'ADMIN'
        }
      }
    });
    
    // Kontrollera begränsning baserat på plan
    if (adminCount >= planLimits.adminUsers) {
      return { 
        allowed: false, 
        message: `Din nuvarande plan (${store.subscriptionPlan}) tillåter max ${planLimits.adminUsers} administratörer. Uppgradera för att lägga till fler.` 
      };
    }
    
    return { allowed: true };
    
  } catch (error) {
    logger.error('Error checking admin user limits', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      storeId
    });
    
    return { 
      allowed: false, 
      message: 'Ett fel uppstod vid kontroll av planbegränsningar' 
    };
  }
}

/**
 * Returnerar antalet månader som ärenden ska behållas enligt plan
 */
export function getHistoryRetentionMonths(plan: SubscriptionPlan): number {
  return PLAN_LIMITS[plan]?.historyMonths || PLAN_LIMITS[SubscriptionPlan.STARTUP].historyMonths;
}

/**
 * Återställer månatlig ärenderäknare vid månadsskifte
 */
export async function resetMonthlyTicketCountIfNeeded(storeId: number): Promise<void> {
  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { ticketCountResetDate: true }
    });
    
    if (!store) return;
    
    const now = new Date();
    const resetDate = new Date(store.ticketCountResetDate);
    
    // Kontrollera om det är dags att återställa räknaren
    if (now >= resetDate) {
      // Beräkna nästa återställningsdatum (första dagen i nästa månad)
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);
      
      // Återställ räknaren
      await prisma.store.update({
        where: { id: storeId },
        data: {
          monthlyTicketCount: 0,
          ticketCountResetDate: nextMonth
        }
      });
      
      logger.info(`Reset monthly ticket count for store ${storeId}`);
    }
  } catch (error) {
    logger.error('Error resetting monthly ticket count', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      storeId
    });
  }
}

/**
 * Arkiverar gamla ärenden baserat på planens historikbegränsning
 * Kan köras schemalagt eller vid behov
 */
export async function purgeOldTickets(storeId?: number): Promise<void> {
  try {
    // Om storeId anges, arkivera endast för den butiken
    if (storeId) {
      await purgeOldTicketsForStore(storeId);
      return;
    }
    
    // Annars, hämta alla butiker och rensa för var och en
    const stores = await prisma.store.findMany({
      select: { id: true, subscriptionPlan: true }
    });
    
    for (const store of stores) {
      await purgeOldTicketsForStore(store.id, store.subscriptionPlan);
    }
    
  } catch (error) {
    logger.error('Error purging old tickets', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      storeId
    });
  }
}

/**
 * Arkiverar gamla ärenden för en specifik butik
 */
async function purgeOldTicketsForStore(storeId: number, plan?: SubscriptionPlan): Promise<void> {
  try {
    // Hämta butikens plan om den inte redan är angiven
    if (!plan) {
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { subscriptionPlan: true }
      });
      
      if (!store) return;
      plan = store.subscriptionPlan;
    }
    
    // Hämta hur många månader tillbaka ärenden ska behållas
    const monthsToKeep = getHistoryRetentionMonths(plan);
    
    // Beräkna brytdatum
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsToKeep);
    
    // Räkna ärenden som kommer att arkiveras
    const ticketsToArchive = await prisma.ticket.count({
      where: {
        storeId,
        updatedAt: {
          lt: cutoffDate
        },
        archived: false
      }
    });
    
    if (ticketsToArchive === 0) {
      logger.debug(`No tickets to archive for store ${storeId}`);
      return;
    }
    
    // Arkivera ärenden som är äldre än brytdatumet
    const result = await prisma.ticket.updateMany({
      where: {
        storeId,
        updatedAt: {
          lt: cutoffDate
        },
        archived: false
      },
      data: {
        archived: true
      }
    });
    
    logger.info(`Archived ${result.count} old tickets for store ${storeId} (plan: ${plan})`);
    
  } catch (error) {
    logger.error('Error purging old tickets for store', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      storeId
    });
  }
}

/**
 * Uppdaterar användningsstatistik för en butik
 * Bör köras regelbundet eller efter ändringar
 */
export async function updateStoreUsageMetrics(storeId: number): Promise<void> {
  try {
    // Hämta aktuell användning från databasen
    const [
      ticketTypeCount,
      customStatusCount,
      adminCount,
      verifiedDomainCount
    ] = await Promise.all([
      prisma.ticketType.count({ where: { storeId } }),
      prisma.userTicketStatus.count({ where: { storeId } }),
      prisma.userStore.count({ 
        where: { 
          storeId, 
          user: { role: 'ADMIN' } 
        } 
      }),
      prisma.verifiedDomain.count({ 
        where: { 
          storeId, 
          status: 'verified' 
        } 
      })
    ]);
    
    // Uppdatera eller skapa användningsstatistik
    await prisma.storeUsageMetrics.upsert({
      where: {
        id: `latest-${storeId}` // Använd en förutsägbar ID för att alltid uppdatera senaste posten
      },
      update: {
        customTicketTypeCount: ticketTypeCount,
        customStatusCount: customStatusCount,
        adminCount: adminCount,
        verifiedDomainCount: verifiedDomainCount,
        updatedAt: new Date()
      },
      create: {
        id: `latest-${storeId}`,
        storeId,
        customTicketTypeCount: ticketTypeCount,
        customStatusCount: customStatusCount,
        adminCount: adminCount,
        verifiedDomainCount: verifiedDomainCount
      }
    });
    
    logger.debug(`Updated usage metrics for store ${storeId}`);
    
  } catch (error) {
    logger.error('Error updating store usage metrics', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      storeId
    });
  }
}