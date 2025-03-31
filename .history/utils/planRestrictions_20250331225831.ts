// utils/planRestrictions.ts
import { PrismaClient, SubscriptionPlan } from '@prisma/client';
import { logger } from './logger';

// Använd en singel PrismaClient-instans
const prisma = new PrismaClient();

/**
 * Kontrollerar om en butik kan skapa ett nytt ärende baserat på deras prenumerationsplan
 * STARTUP-planen har en begränsning på 50 ärenden per månad
 */
export async function canCreateTicket(storeId: number): Promise<{ allowed: boolean; message?: string }> {
  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId }
    });
    
    if (!store) {
      return { allowed: false, message: 'Butiken hittades inte' };
    }
    
    // För STARTUP-plan, kontrollera månatliga begränsningar
    if (store.subscriptionPlan === 'STARTUP') {
      // Kontrollera om begränsningen på 50 ärenden/månad har nåtts
      if (store.monthlyTicketCount >= 50) {
        return { 
          allowed: false, 
          message: 'Din gratisplan tillåter endast 50 ärenden per månad. Uppgradera för att få obegränsade ärenden.' 
        };
      }
    }
    
    // För andra planer finns ingen begränsning
    return { allowed: true };
  } catch (error) {
    logger.error('Fel vid kontroll av ärendebegränsning', { error: error instanceof Error ? error.message : 'Okänt fel', storeId });
    return { allowed: true }; // Tillåt vid fel för att undvika att blockera användare
  }
}

/**
 * Kontrollerar om en butik kan skapa en ny ärendetyp baserat på deras prenumerationsplan
 */
export async function canCreateTicketType(storeId: number): Promise<{ allowed: boolean; message?: string }> {
  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { 
        StoreUsageMetrics: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
    
    if (!store) {
      return { allowed: false, message: 'Butiken hittades inte' };
    }
    
    // Hämta senaste mätvärden eller skapa en ny post om ingen finns
    const metrics = store.StoreUsageMetrics?.[0];
    const customTicketTypeCount = metrics?.customTicketTypeCount || 0;
    
    // Kontrollera begränsning baserat på plan
    switch(store.subscriptionPlan) {
      case 'STARTUP': 
        if (customTicketTypeCount >= 2) {
          return { 
            allowed: false, 
            message: 'Din gratisplan tillåter endast 2 ärendetyper. Uppgradera för att skapa fler.' 
          };
        }
        break;
      case 'TEAM': 
        if (customTicketTypeCount >= 5) {
          return { 
            allowed: false, 
            message: 'Din Team-plan tillåter endast 5 ärendetyper. Uppgradera för att skapa fler.' 
          };
        }
        break;
      case 'GROWING': 
        if (customTicketTypeCount >= 10) {
          return { 
            allowed: false, 
            message: 'Din Growing-plan tillåter endast 10 ärendetyper. Uppgradera för att skapa fler.' 
          };
        }
        break;
      case 'PROFESSIONAL': 
        // Obegränsat
        break;
    }
    
    return { allowed: true };
  } catch (error) {
    logger.error('Fel vid kontroll av ärendetypsbegränsning', { error: error instanceof Error ? error.message : 'Okänt fel', storeId });
    return { allowed: true }; // Tillåt vid fel för att undvika att blockera användare
  }
}

/**
 * Kontrollerar om en butik kan skapa en anpassad status baserat på deras plan
 */
export async function canCreateCustomStatus(storeId: number): Promise<{ allowed: boolean; message?: string }> {
  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { 
        StoreUsageMetrics: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
    
    if (!store) {
      return { allowed: false, message: 'Butiken hittades inte' };
    }
    
    // Hämta senaste mätvärden
    const metrics = store.StoreUsageMetrics?.[0];
    const customStatusCount = metrics?.customStatusCount || 0;
    
    // STARTUP har bara grundläggande statusar (öppen/färdig)
    if (store.subscriptionPlan === 'STARTUP') {
      return { 
        allowed: false, 
        message: 'Din gratisplan tillåter endast grundläggande statusar. Uppgradera för att skapa anpassade statusar.' 
      };
    }
    
    // Kontrollera begränsning baserat på plan
    switch(store.subscriptionPlan) {
      case 'TEAM': 
        if (customStatusCount >= 3) {
          return { 
            allowed: false, 
            message: 'Din Team-plan tillåter endast 3 anpassade statusar. Uppgradera för att skapa fler.' 
          };
        }
        break;
      case 'GROWING': 
        if (customStatusCount >= 5) {
          return { 
            allowed: false, 
            message: 'Din Growing-plan tillåter endast 5 anpassade statusar. Uppgradera för att skapa fler.' 
          };
        }
        break;
      case 'PROFESSIONAL': 
        if (customStatusCount >= 10) {
          return { 
            allowed: false, 
            message: 'Din Professional-plan tillåter endast 10 anpassade statusar. Uppgradera till Organization för obegränsat antal.' 
          };
        }
        break;
    }
    
    return { allowed: true };
  } catch (error) {
    logger.error('Fel vid kontroll av statusbegränsning', { error: error instanceof Error ? error.message : 'Okänt fel', storeId });
    return { allowed: true }; // Tillåt vid fel för att undvika att blockera användare
  }
}

/**
 * Kontrollerar om en butik kan lägga till fler administratörer baserat på deras plan
 */
export async function canAddAdmin(storeId: number): Promise<{ allowed: boolean; message?: string }> {
  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { 
        StoreUsageMetrics: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
    
    if (!store) {
      return { allowed: false, message: 'Butiken hittades inte' };
    }
    
    // Hämta senaste mätvärden
    const metrics = store.StoreUsageMetrics?.[0];
    const adminCount = metrics?.adminCount || 1;
    
    // Kontrollera begränsning baserat på plan
    switch(store.subscriptionPlan) {
      case 'STARTUP': 
        if (adminCount >= 1) {
          return { 
            allowed: false, 
            message: 'Din gratisplan tillåter endast 1 administratör. Uppgradera för att lägga till fler.' 
          };
        }
        break;
      case 'TEAM': 
        if (adminCount >= 3) {
          return { 
            allowed: false, 
            message: 'Din Team-plan tillåter endast 3 administratörer. Uppgradera för att lägga till fler.' 
          };
        }
        break;
      case 'GROWING': 
        if (adminCount >= 5) {
          return { 
            allowed: false, 
            message: 'Din Growing-plan tillåter endast 5 administratörer. Uppgradera för att lägga till fler.' 
          };
        }
        break;
      case 'PROFESSIONAL': 
        if (adminCount >= 10) {
          return { 
            allowed: false, 
            message: 'Din Professional-plan tillåter endast 10 administratörer. Uppgradera till Organization för obegränsat antal.' 
          };
        }
        break;
    }
    
    return { allowed: true };
  } catch (error) {
    logger.error('Fel vid kontroll av administratörsbegränsning', { error: error instanceof Error ? error.message : 'Okänt fel', storeId });
    return { allowed: true }; // Tillåt vid fel för att undvika att blockera användare
  }
}

/**
 * Uppdaterar ärendeantal och användningsstatistik när ett nytt ärende skapas
 */
export async function incrementTicketCount(storeId: number): Promise<void> {
  try {
    await prisma.store.update({
      where: { id: storeId },
      data: {
        monthlyTicketCount: { increment: 1 }
      }
    });
  } catch (error) {
    logger.error('Fel vid uppdatering av ärendeantal', { error: error instanceof Error ? error.message : 'Okänt fel', storeId });
  }
}

/**
 * Uppdaterar användningsstatistik när en ny ärendetyp skapas
 */
export async function incrementTicketTypeCount(storeId: number): Promise<void> {
  try {
    const metrics = await prisma.storeUsageMetrics.findFirst({
      where: { storeId },
      orderBy: { createdAt: 'desc' }
    });
    
    if (metrics) {
      await prisma.storeUsageMetrics.update({
        where: { id: metrics.id },
        data: {
          customTicketTypeCount: { increment: 1 }
        }
      });
    } else {
      // Skapa en ny metricspost om ingen finns
      await prisma.storeUsageMetrics.create({
        data: {
          storeId,
          customTicketTypeCount: 1
        }
      });
    }
  } catch (error) {
    logger.error('Fel vid uppdatering av ärendetypsstatistik', { error: error instanceof Error ? error.message : 'Okänt fel', storeId });
  }
}

/**
 * Uppdaterar användningsstatistik när en ny anpassad status skapas
 */
export async function incrementCustomStatusCount(storeId: number): Promise<void> {
  try {
    const metrics = await prisma.storeUsageMetrics.findFirst({
      where: { storeId },
      orderBy: { createdAt: 'desc' }
    });
    
    if (metrics) {
      await prisma.storeUsageMetrics.update({
        where: { id: metrics.id },
        data: {
          customStatusCount: { increment: 1 }
        }
      });
    } else {
      // Skapa en ny metricspost om ingen finns
      await prisma.storeUsageMetrics.create({
        data: {
          storeId,
          customStatusCount: 1
        }
      });
    }
  } catch (error) {
    logger.error('Fel vid uppdatering av statusstatistik', { error: error instanceof Error ? error.message : 'Okänt fel', storeId });
  }
}

/**
 * Uppdaterar användningsstatistik när en ny administratör läggs till
 */
export async function incrementAdminCount(storeId: number): Promise<void> {
  try {
    const metrics = await prisma.storeUsageMetrics.findFirst({
      where: { storeId },
      orderBy: { createdAt: 'desc' }
    });
    
    if (metrics) {
      await prisma.storeUsageMetrics.update({
        where: { id: metrics.id },
        data: {
          adminCount: { increment: 1 }
        }
      });
    } else {
      // Skapa en ny metricspost om ingen finns
      await prisma.storeUsageMetrics.create({
        data: {
          storeId,
          adminCount: 1
        }
      });
    }
  } catch (error) {
    logger.error('Fel vid uppdatering av administratörsstatistik', { error: error instanceof Error ? error.message : 'Okänt fel', storeId });
  }
}

/**
 * Returnerar historikbegränsning i månader baserat på prenumerationsplan
 */
export function getHistoryLimitInMonths(plan: SubscriptionPlan): number {
  switch(plan) {
    case 'STARTUP': return 3;  // 3 månader
    case 'TEAM': return 12;    // 1 år
    case 'GROWING': return 24; // 2 år
    case 'PROFESSIONAL': return 60; // 5 år
    default: return 3;
  }
}

export default {
  canCreateTicket,
  canCreateTicketType,
  canCreateCustomStatus,
  canAddAdmin,
  incrementTicketCount,
  incrementTicketTypeCount,
  incrementCustomStatusCount,
  incrementAdminCount,
  getHistoryLimitInMonths
};