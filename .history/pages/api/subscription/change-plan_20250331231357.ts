// pages/api/subscription/change-plan.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, SubscriptionPlan } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { logger } from '@/utils/logger';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validationsschema för planändringar
const changePlanSchema = z.object({
  plan: z.enum(['STARTUP', 'TEAM', 'GROWING', 'PROFESSIONAL']),
  billingPeriod: z.enum(['monthly', 'yearly']).optional(),
  autoRenew: z.boolean().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Endast POST-metoden är tillåten
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
    
    // Autentisering - endast ADMIN kan ändra prenumerationsplaner
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return res.status(401).json({ error: 'Endast administratörer kan ändra prenumerationsplaner' });
    }

    const storeId = session.user.storeId;
    if (!storeId) {
      return res.status(400).json({ error: 'Ingen butik vald' });
    }

    // Validera inkommande data
    const parseResult = changePlanSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return res.status(400).json({ message: 'Valideringsfel', errors });
    }

    const { plan, billingPeriod, autoRenew } = parseResult.data;
    
    // Hämta aktuell butiksdata
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

    // Aktuella användarmått
    const currentMetrics = store.StoreUsageMetrics[0] || { 
      adminCount: 1, 
      customTicketTypeCount: 0, 
      customStatusCount: 0 
    };

    // Hämta begränsningar för den nya planen
    const newPlanLimits = getPlanLimits(plan);
    
    // Kontrollera om nedgradering orsakar överanvändning
    const isDowngrade = isPlanDowngrade(store.subscriptionPlan, plan);
    if (isDowngrade) {
      const validationIssues = validateDowngrade(currentMetrics, newPlanLimits);
      if (validationIssues.length > 0) {
        return res.status(400).json({ 
          error: 'Nedgradering ej möjlig', 
          message: 'Nedgradering ej möjlig på grund av resursanvändning över den nya planens gränser.',
          details: validationIssues
        });
      }
    }
    
    // Beräkna nytt slutdatum för prenumerationen baserat på faktureringsperiod
    const now = new Date();
    let subscriptionEndDate: Date | null = null;
    
    if (billingPeriod === 'yearly') {
      // Sätt prenumerationsslutet till 1 år från nu
      subscriptionEndDate = new Date(now);
      subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);
    } else {
      // För månadsbaserade planer, sätt till null (löpande)
      subscriptionEndDate = null;
    }
    
    // Uppdatera prenumerationen
    const updatedStore = await prisma.store.update({
      where: { id: storeId },
      data: {
        subscriptionPlan: plan,
        subscriptionStartDate: now,
        subscriptionEndDate: subscriptionEndDate,
        subscriptionAutoRenew: autoRenew !== undefined ? autoRenew : store.subscriptionAutoRenew,
      }
    });
    
    // Logga planändringen
    logger.info(`Prenumerationsplan ändrad för butik ${storeId}`, {
      oldPlan: store.subscriptionPlan,
      newPlan: plan,
      billingPeriod: billingPeriod || 'monthly',
      autoRenew: autoRenew !== undefined ? autoRenew : store.subscriptionAutoRenew,
      storeId
    });

    return res.status(200).json({
      success: true,
      message: `Prenumerationsplan ändrad till ${getPlanDisplayName(plan)}`,
      subscription: {
        plan: updatedStore.subscriptionPlan,
        startDate: updatedStore.subscriptionStartDate,
        endDate: updatedStore.subscriptionEndDate,
        autoRenew: updatedStore.subscriptionAutoRenew,
      }
    });
  } catch (error: any) {
    logger.error('Fel vid ändring av prenumerationsplan', { 
      error: error instanceof Error ? error.message : 'Okänt fel'
    });
    
    if (error.constructor?.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }
    
    return res.status(500).json({ message: 'Ett internt serverfel uppstod.' });
  } finally {
    await prisma.$disconnect();
  }
}

// Hjälpfunktion för att kontrollera om en planändring är en nedgradering
function isPlanDowngrade(currentPlan: SubscriptionPlan, newPlan: SubscriptionPlan): boolean {
  const planValues = {
    'STARTUP': 0,
    'TEAM': 1,
    'GROWING': 2,
    'PROFESSIONAL': 3
  };
  
  return planValues[newPlan] < planValues[currentPlan];
}

// Hjälpfunktion för att hämta planbegränsningar
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

// Hjälpfunktion för att kontrollera om nedgradering är möjlig
function validateDowngrade(
  metrics: { adminCount: number; customTicketTypeCount: number; customStatusCount: number; },
  planLimits: { ticketsPerMonth: number; ticketTypes: number; customStatuses: number; adminUsers: number; }
): string[] {
  const issues = [];
  
  if (metrics.adminCount > planLimits.adminUsers) {
    issues.push(`Du har ${metrics.adminCount} administratörer men den nya planen tillåter endast ${planLimits.adminUsers}.`);
  }
  
  if (metrics.customTicketTypeCount > planLimits.ticketTypes) {
    issues.push(`Du har ${metrics.customTicketTypeCount} ärendetyper men den nya planen tillåter endast ${planLimits.ticketTypes}.`);
  }
  
  if (metrics.customStatusCount > planLimits.customStatuses) {
    issues.push(`Du har ${metrics.customStatusCount} anpassade statusar men den nya planen tillåter endast ${planLimits.customStatuses}.`);
  }
  
  return issues;
}

// Hjälpfunktion för att konvertera plannamn till visningsnamn
function getPlanDisplayName(plan: SubscriptionPlan): string {
  switch(plan) {
    case 'STARTUP': return 'Startup (Gratis)';
    case 'TEAM': return 'Team';
    case 'GROWING': return 'Växande';
    case 'PROFESSIONAL': return 'Professionell';
    default: return plan;
  }
}