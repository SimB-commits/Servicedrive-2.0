// pages/api/subscription/info.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, SubscriptionPlan } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Endast GET-metoden är tillåten
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
    
    // Autentisering - endast inloggade användare kan se prenumerationsinformation
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Du måste vara inloggad för att se denna information' });
    }

    const storeId = session.user.storeId;
    if (!storeId) {
      return res.status(400).json({ error: 'Ingen butik vald' });
    }

    // Hämta butiksinformation med senaste mätvärden
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
      return res.status(404).json({ error: 'Butiken hittades inte' });
    }

    // Hämta plangränser
    const planLimits = getPlanLimits(store.subscriptionPlan);
    
    // Beräkna dagar kvar på prenumerationen
    let daysRemaining = null;
    if (store.subscriptionEndDate) {
      const endDate = new Date(store.subscriptionEndDate);
      const today = new Date();
      const diffTime = endDate.getTime() - today.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    
    // Beräkna om användaren närmar sig sina gränser
    const metrics = store.StoreUsageMetrics[0] || { 
      adminCount: 1, 
      customTicketTypeCount: 0, 
      customStatusCount: 0,
      verifiedDomainCount: 0 
    };
    
    // Beräkna procentuell användning
    const usagePercentages = {
      adminUsers: calculatePercentage(metrics.adminCount, planLimits.adminUsers),
      ticketTypes: calculatePercentage(metrics.customTicketTypeCount, planLimits.ticketTypes),
      customStatuses: calculatePercentage(metrics.customStatusCount, planLimits.customStatuses),
      monthlyTickets: calculatePercentage(store.monthlyTicketCount, planLimits.ticketsPerMonth)
    };
    
    // Bestäm status för varje resurstyp
    const usageStatus = {
      adminUsers: getStatusFromPercentage(usagePercentages.adminUsers),
      ticketTypes: getStatusFromPercentage(usagePercentages.ticketTypes),
      customStatuses: getStatusFromPercentage(usagePercentages.customStatuses),
      monthlyTickets: getStatusFromPercentage(usagePercentages.monthlyTickets)
    };
    
    // Sammanställ prenumerationsinformation
    const subscriptionInfo = {
      plan: store.subscriptionPlan,
      planName: getPlanDisplayName(store.subscriptionPlan),
      startDate: store.subscriptionStartDate,
      endDate: store.subscriptionEndDate,
      daysRemaining,
      autoRenew: store.subscriptionAutoRenew,
      billingPeriod: store.subscriptionEndDate ? 'yearly' : 'monthly',
      
      // Användning och gränser
      usage: {
        adminUsers: {
          current: metrics.adminCount,
          limit: planLimits.adminUsers === Number.POSITIVE_INFINITY ? 'Obegränsat' : planLimits.adminUsers,
          percentage: usagePercentages.adminUsers,
          status: usageStatus.adminUsers
        },
        ticketTypes: {
          current: metrics.customTicketTypeCount,
          limit: planLimits.ticketTypes === Number.POSITIVE_INFINITY ? 'Obegränsat' : planLimits.ticketTypes,
          percentage: usagePercentages.ticketTypes,
          status: usageStatus.ticketTypes
        },
        customStatuses: {
          current: metrics.customStatusCount,
          limit: planLimits.customStatuses === Number.POSITIVE_INFINITY ? 'Obegränsat' : planLimits.customStatuses,
          percentage: usagePercentages.customStatuses,
          status: usageStatus.customStatuses
        },
        monthlyTickets: {
          current: store.monthlyTicketCount,
          limit: planLimits.ticketsPerMonth === Number.POSITIVE_INFINITY ? 'Obegränsat' : planLimits.ticketsPerMonth,
          percentage: usagePercentages.monthlyTickets,
          status: usageStatus.monthlyTickets,
          resetDate: store.ticketCountResetDate
        },
        historyMonths: {
          limit: planLimits.historyMonths
        },
        verifiedDomains: {
          current: metrics.verifiedDomainCount
        }
      },
      
      // Funktioner som är tillgängliga per plan
      features: getPlanFeatures(store.subscriptionPlan)
    };
    
    return res.status(200).json(subscriptionInfo);
  } catch (error: any) {
    logger.error('Fel vid hämtning av prenumerationsinformation', { 
      error: error instanceof Error ? error.message : 'Okänt fel',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    if (error?.constructor?.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }
    
    // Returnera ett mer beskrivande felmeddelande
    return res.status(500).json({ 
      message: 'Ett internt serverfel uppstod vid hämtning av prenumerationsinformation.', 
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Hjälpfunktion för att hämta planbegränsningar
 */
function getPlanLimits(plan: SubscriptionPlan): { 
  ticketsPerMonth: number; 
  ticketTypes: number; 
  customStatuses: number; 
  adminUsers: number;
  historyMonths: number;
} {
  switch(plan) {
    case 'STARTUP':
      return {
        ticketsPerMonth: 50,
        ticketTypes: 2,
        customStatuses: 0,
        adminUsers: 1,
        historyMonths: 3
      };
    case 'TEAM':
      return {
        ticketsPerMonth: Number.POSITIVE_INFINITY, // Obegränsat
        ticketTypes: 5,
        customStatuses: 3,
        adminUsers: 3,
        historyMonths: 12
      };
    case 'GROWING':
      return {
        ticketsPerMonth: Number.POSITIVE_INFINITY,
        ticketTypes: 10,
        customStatuses: 5,
        adminUsers: 5,
        historyMonths: 24
      };
    case 'PROFESSIONAL':
      return {
        ticketsPerMonth: Number.POSITIVE_INFINITY,
        ticketTypes: Number.POSITIVE_INFINITY,
        customStatuses: 10,
        adminUsers: 10,
        historyMonths: 60
      };
    default:
      return {
        ticketsPerMonth: 50,
        ticketTypes: 2,
        customStatuses: 0,
        adminUsers: 1,
        historyMonths: 3
      };
  }
}

/**
 * Hjälpfunktion för att konvertera plannamn till visningsnamn
 */
function getPlanDisplayName(plan: SubscriptionPlan): string {
  switch(plan) {
    case 'STARTUP': return 'Startup (Gratis)';
    case 'TEAM': return 'Team';
    case 'GROWING': return 'Växande';
    case 'PROFESSIONAL': return 'Professionell';
    default: return plan;
  }
}

/**
 * Beräkna procentuell användning
 */
function calculatePercentage(current: number, limit: number): number {
  if (limit === Number.POSITIVE_INFINITY) {
    return 0; // Ingen gräns
  }
  return Math.round((current / limit) * 100);
}

/**
 * Bestäm status baserat på procentuell användning
 */
function getStatusFromPercentage(percentage: number): 'ok' | 'warning' | 'critical' {
  if (percentage >= 90) {
    return 'critical';
  } else if (percentage >= 75) {
    return 'warning';
  } else {
    return 'ok';
  }
}

/**
 * Hämta funktioner som är tillgängliga per plan
 */
function getPlanFeatures(plan: SubscriptionPlan): Record<string, boolean> {
  const baseFeatures = {
    multiStore: false,               // Flerbutiksstöd
    customDomains: false,            // Anpassade domäner
    apiAccess: false,                // API-åtkomst
    emailTemplates: false,           // E-postmallar
    appointmentBooking: false,       // Tidsbokning
    advancedStatistics: false,       // Avancerad statistik
    roleBased: false,                // Rollbaserade användare
    prioritySupport: false,          // Prioriterad support
    customFields: false,             // Anpassade fält
    customStatuses: false,           // Anpassade statusar
    unlimitedTickets: false,         // Obegränsade ärenden
    smsNotifications: false          // SMS-notifieringar
  };
  
  // Aktivera funktioner baserat på plan
  switch(plan) {
    case 'PROFESSIONAL':
      return {
        ...baseFeatures,
        multiStore: true,
        customDomains: true,
        apiAccess: true,
        emailTemplates: true,
        appointmentBooking: true,
        advancedStatistics: true,
        roleBased: true,
        prioritySupport: true,
        customFields: true,
        customStatuses: true,
        unlimitedTickets: true,
        smsNotifications: true
      };
    case 'GROWING':
      return {
        ...baseFeatures,
        customDomains: true,
        emailTemplates: true,
        appointmentBooking: true,
        advancedStatistics: true,
        customFields: true,
        customStatuses: true,
        unlimitedTickets: true
      };
    case 'TEAM':
      return {
        ...baseFeatures,
        emailTemplates: true,
        customFields: true,
        customStatuses: true,
        unlimitedTickets: true
      };
    case 'STARTUP':
    default:
      return {
        ...baseFeatures,
        customFields: true
      };
  }
}