// utils/subscriptionFeatures.ts
import { SubscriptionPlan } from '@prisma/client';

export function isPlanDowngrade(currentPlan: SubscriptionPlan, newPlan: SubscriptionPlan): boolean {
  const planValues = {
    'STARTUP': 0,
    'TEAM': 1,
    'GROWING': 2,
    'PROFESSIONAL': 3
  };
  
  return planValues[newPlan] < planValues[currentPlan];
}

/**
 * Interface för att definiera funktioner som är tillgängliga per plan
 */
export interface PlanFeatures {
  multiStore: boolean;              // Flerbutiksstöd
  customDomains: boolean;           // Anpassade domäner
  apiAccess: boolean;               // API-åtkomst
  emailTemplates: boolean;          // E-postmallar
  appointmentBooking: boolean;      // Tidsbokning
  advancedStatistics: boolean;      // Avancerad statistik
  roleBased: boolean;               // Rollbaserade användare
  prioritySupport: boolean;         // Prioriterad support
  customFields: boolean;            // Anpassade fält
  customStatuses: boolean;          // Anpassade statusar
  unlimitedTickets: boolean;        // Obegränsade ärenden
  smsNotifications: boolean;        // SMS-notifieringar
}

/**
 * Interface för prenumerationsgränser per plan
 */
export interface PlanLimits {
  ticketsPerMonth: number;          // Antal ärenden per månad
  ticketTypes: number;              // Antal ärendetyper
  customStatuses: number;           // Antal anpassade statusar
  adminUsers: number;               // Antal administratörer
  historyMonths: number;            // Antal månaders historik
}

// Konstanter för att hantera oändliga värden i UI
export const UNLIMITED = Number.POSITIVE_INFINITY;
export const UNLIMITED_DISPLAY = 'Obegränsat';

/**
 * Returnerar funktioner som är tillgängliga för en given plan
 */
export function getPlanFeatures(plan: SubscriptionPlan): PlanFeatures {
  const baseFeatures = {
    multiStore: false,
    customDomains: false,
    apiAccess: false,
    emailTemplates: false,
    appointmentBooking: false,
    advancedStatistics: false,
    roleBased: false,
    prioritySupport: false,
    customFields: false,
    customStatuses: false,
    unlimitedTickets: false,
    smsNotifications: false
  };
  
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

/**
 * Returnerar gränser för resurser för en given plan
 */
export function getPlanLimits(plan: SubscriptionPlan): PlanLimits {
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
        ticketsPerMonth: UNLIMITED,
        ticketTypes: 5,
        customStatuses: 3,
        adminUsers: 3,
        historyMonths: 12
      };
    case 'GROWING':
      return {
        ticketsPerMonth: UNLIMITED,
        ticketTypes: 10,
        customStatuses: 5,
        adminUsers: 5,
        historyMonths: 24
      };
    case 'PROFESSIONAL':
      return {
        ticketsPerMonth: UNLIMITED,
        ticketTypes: UNLIMITED,
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
 * Formaterar gränsvärden för visning i UI
 */
export function formatLimitValue(value: number): string {
  return value === UNLIMITED ? UNLIMITED_DISPLAY : value.toString();
}

/**
 * Returnerar användningsstatistik för visning i UI
 * @param current Nuvarande användning
 * @param limit Gräns enligt plan
 */
export function getUsageStats(current: number, limit: number): {
  percentage: number;
  status: 'ok' | 'warning' | 'critical';
  display: string;
} {
  // Beräkna procentuell användning
  const percentage = limit === UNLIMITED ? 0 : Math.round((current / limit) * 100);
  
  // Bestäm status baserat på procentuell användning
  let status: 'ok' | 'warning' | 'critical' = 'ok';
  if (percentage >= 90) {
    status = 'critical';
  } else if (percentage >= 75) {
    status = 'warning';
  }
  
  // Formatera för visning
  const display = limit === UNLIMITED 
    ? `${current} / ${UNLIMITED_DISPLAY}` 
    : `${current} / ${limit} (${percentage}%)`;
  
  return { percentage, status, display };
}

/**
 * Hook för att kontrollera om en funktion är tillgänglig för en given plan
 * @param feature Funktionen att kontrollera
 * @param plan Prenumerationsplan
 */
export function isFeatureAvailable(feature: keyof PlanFeatures, plan: SubscriptionPlan): boolean {
  const features = getPlanFeatures(plan);
  return features[feature];
}

/**
 * Huvudfunktion för att kontrollera tillgänglighet av funktioner och gränser
 */
export const SubscriptionService = {
  getFeatures: getPlanFeatures,
  getLimits: getPlanLimits,
  isFeatureAvailable,
  getUsageStats,
  formatLimitValue,
  isPlanDowngrade,
  
  /**
   * Kontrollerar om användaren har nått sin gräns för en resurs
   */
  hasReachedLimit(current: number, limit: number): boolean {
    if (limit === UNLIMITED) return false;
    return current >= limit;
  },
  
  /**
   * Returnerar displaynamn för en plan
   */
  getPlanDisplayName(plan: SubscriptionPlan): string {
    switch(plan) {
      case 'STARTUP': return 'Startup (Gratis)';
      case 'TEAM': return 'Team';
      case 'GROWING': return 'Växande';
      case 'PROFESSIONAL': return 'Professionell';
      default: return plan;
    }
  },
  
  /**
   * Returnerar månatlig kostnad för en plan (i SEK)
   */
  getMonthlyPrice(plan: SubscriptionPlan): number {
    switch(plan) {
      case 'STARTUP': return 0;
      case 'TEAM': return 199;
      case 'GROWING': return 349;
      case 'PROFESSIONAL': return 499;
      default: return 0;
    }
  },
  
  /**
   * Returnerar årlig kostnad för en plan (i SEK)
   */
  getYearlyPrice(plan: SubscriptionPlan): number {
    switch(plan) {
      case 'STARTUP': return 0;
      case 'TEAM': return 1990;
      case 'GROWING': return 3490;
      case 'PROFESSIONAL': return 4990;
      default: return 0;
    }
  }
};

export default SubscriptionService;