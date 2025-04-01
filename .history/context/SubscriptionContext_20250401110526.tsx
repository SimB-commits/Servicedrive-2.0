// context/SubscriptionContext.tsx
import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { SubscriptionPlan } from '@prisma/client';
import { SubscriptionService, PlanFeatures, PlanLimits } from '@/utils/subscriptionFeatures';
import { logger } from '@/utils/logger';

// Definiera tillståndet för prenumerationskontexten
export interface SubscriptionState {
  isLoading: boolean;
  error: string | null;
  plan?: SubscriptionPlan;
  features: PlanFeatures;
  limits: PlanLimits;
  usage: {
    adminUsers: { current: number; limit: number; percentage: number; status: string };
    ticketTypes: { current: number; limit: number; percentage: number; status: string };
    customStatuses: { current: number; limit: number; percentage: number; status: string };
    monthlyTickets: { current: number; limit: number; percentage: number; status: string };
  };
  planName: string;
  daysRemaining?: number;
  billingPeriod?: 'monthly' | 'yearly';
  autoRenew?: boolean;
  isExpiring: boolean;
  hasReachedLimit: {
    tickets: boolean;
    ticketTypes: boolean;
    customStatuses: boolean;
    adminUsers: boolean;
  };
}

// Utöka SubscriptionState med funktioner för att kontrollera tillgänglighet och uppdatera prenumerationen
interface SubscriptionContextType extends SubscriptionState {
  canUseFeature: (feature: keyof PlanFeatures) => boolean;
  canCreate: (resourceType: 'ticket' | 'ticketType' | 'customStatus' | 'admin') => boolean;
  getLimitMessage: (resourceType: 'ticket' | 'ticketType' | 'customStatus' | 'admin') => string;
  getUsageInfo: (resourceType: 'ticket' | 'ticketType' | 'customStatus' | 'admin') => any;
  refreshSubscription: () => Promise<void>;
}

// Standardvärden för kontexten
const defaultContext: SubscriptionContextType = {
  isLoading: true,
  error: null,
  features: SubscriptionService.getFeatures('STARTUP'),
  limits: SubscriptionService.getLimits('STARTUP'),
  usage: {
    adminUsers: { current: 0, limit: 0, percentage: 0, status: 'ok' },
    ticketTypes: { current: 0, limit: 0, percentage: 0, status: 'ok' },
    customStatuses: { current: 0, limit: 0, percentage: 0, status: 'ok' },
    monthlyTickets: { current: 0, limit: 0, percentage: 0, status: 'ok' }
  },
  planName: 'Startup (Gratis)',
  isExpiring: false,
  hasReachedLimit: {
    tickets: false,
    ticketTypes: false,
    customStatuses: false,
    adminUsers: false
  },
  canUseFeature: () => false,
  canCreate: () => false,
  getLimitMessage: () => '',
  getUsageInfo: () => null,
  refreshSubscription: async () => {}
};

// Skapa kontexten
const SubscriptionContext = createContext<SubscriptionContextType>(defaultContext);

// Provider-komponent som kommer att omsluta applikationen
export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SubscriptionState>({
    isLoading: true,
    error: null,
    features: SubscriptionService.getFeatures('STARTUP'),
    limits: SubscriptionService.getLimits('STARTUP'),
    usage: {
      adminUsers: { current: 0, limit: 0, percentage: 0, status: 'ok' },
      ticketTypes: { current: 0, limit: 0, percentage: 0, status: 'ok' },
      customStatuses: { current: 0, limit: 0, percentage: 0, status: 'ok' },
      monthlyTickets: { current: 0, limit: 0, percentage: 0, status: 'ok' }
    },
    planName: 'Startup (Gratis)',
    isExpiring: false,
    hasReachedLimit: {
      tickets: false,
      ticketTypes: false,
      customStatuses: false,
      adminUsers: false
    }
  });

  // Funktion för att hämta prenumerationsdata
  const fetchSubscription = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const response = await fetch('/api/subscription/info');
      
      if (!response.ok) {
        throw new Error('Kunde inte hämta prenumerationsinformation');
      }
      
      const data = await response.json();
      
      // Extrahera plan och plannamn
      const plan = data.plan as SubscriptionPlan;
      const planName = data.planName || SubscriptionService.getPlanDisplayName(plan);
      
      // Uppdatera features och limits baserat på plan
      const features = SubscriptionService.getFeatures(plan);
      const limits = SubscriptionService.getLimits(plan);
      
      // Beräkna om prenumerationen håller på att gå ut
      const isExpiring = !!data.daysRemaining && data.daysRemaining <= 7;
      
      // Extrahera användningsinformation
      const usage = {
        adminUsers: {
          current: data.usage.adminUsers.current,
          limit: typeof data.usage.adminUsers.limit === 'string' 
            ? SubscriptionService.UNLIMITED 
            : data.usage.adminUsers.limit,
          percentage: data.usage.adminUsers.percentage,
          status: data.usage.adminUsers.status
        },
        ticketTypes: {
          current: data.usage.ticketTypes.current,
          limit: typeof data.usage.ticketTypes.limit === 'string' 
            ? SubscriptionService.UNLIMITED 
            : data.usage.ticketTypes.limit,
          percentage: data.usage.ticketTypes.percentage,
          status: data.usage.ticketTypes.status
        },
        customStatuses: {
          current: data.usage.customStatuses.current,
          limit: typeof data.usage.customStatuses.limit === 'string' 
            ? SubscriptionService.UNLIMITED 
            : data.usage.customStatuses.limit,
          percentage: data.usage.customStatuses.percentage,
          status: data.usage.customStatuses.status
        },
        monthlyTickets: {
          current: data.usage.monthlyTickets.current,
          limit: typeof data.usage.monthlyTickets.limit === 'string' 
            ? SubscriptionService.UNLIMITED 
            : data.usage.monthlyTickets.limit,
          percentage: data.usage.monthlyTickets.percentage,
          status: data.usage.monthlyTickets.status
        }
      };
      
      // Kontrollera om några gränser har nåtts
      const hasReachedLimit = {
        tickets: SubscriptionService.hasReachedLimit(
          usage.monthlyTickets.current, 
          usage.monthlyTickets.limit
        ),
        ticketTypes: SubscriptionService.hasReachedLimit(
          usage.ticketTypes.current, 
          usage.ticketTypes.limit
        ),
        customStatuses: SubscriptionService.hasReachedLimit(
          usage.customStatuses.current, 
          usage.customStatuses.limit
        ),
        adminUsers: SubscriptionService.hasReachedLimit(
          usage.adminUsers.current, 
          usage.adminUsers.limit
        )
      };
      
      // Uppdatera alla tillstånd
      setState({
        isLoading: false,
        error: null,
        plan,
        features,
        limits,
        usage,
        planName,
        daysRemaining: data.daysRemaining,
        billingPeriod: data.billingPeriod || 'monthly',
        autoRenew: data.autoRenew || false,
        isExpiring,
        hasReachedLimit
      });
      
      logger.info('Prenumerationsdata laddad globalt', { plan });
    } catch (err) {
      // Logg av fel
      logger.error('Fel vid laddning av prenumerationsdata', { 
        error: err instanceof Error ? err.message : 'Okänt fel' 
      });
      
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: err instanceof Error ? err.message : 'Ett fel inträffade' 
      }));
    }
  }, []);

  // Hämta prenumerationsinformation vid första renderingen
  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Memoized hjälpfunktioner för kontextvärdet
  const contextValue = useMemo(() => {
    // Funktion för att kontrollera om en feature är tillgänglig
    const canUseFeature = (feature: keyof PlanFeatures) => {
      return state.features[feature];
    };
    
    // Funktion för att kontrollera om användaren kan skapa en resurs
    const canCreate = (resourceType: 'ticket' | 'ticketType' | 'customStatus' | 'admin') => {
      if (state.isLoading) return false;
      
      switch (resourceType) {
        case 'ticket':
          return !state.hasReachedLimit.tickets;
        case 'ticketType':
          return !state.hasReachedLimit.ticketTypes;
        case 'customStatus':
          return state.features.customStatuses && !state.hasReachedLimit.customStatuses;
        case 'admin':
          return !state.hasReachedLimit.adminUsers;
        default:
          return false;
      }
    };
    
    // Funktion för att få ett användarvänligt meddelande för begränsningar
    const getLimitMessage = (resourceType: 'ticket' | 'ticketType' | 'customStatus' | 'admin') => {
      if (state.isLoading) return '';
      
      switch (resourceType) {
        case 'ticket':
          return `Din ${state.planName} plan tillåter endast ${state.limits.ticketsPerMonth} ärenden per månad.`;
        case 'ticketType':
          return `Din ${state.planName} plan tillåter endast ${state.limits.ticketTypes} ärendetyper.`;
        case 'customStatus':
          if (!state.features.customStatuses) {
            return `Din ${state.planName} plan har inte stöd för anpassade statusar.`;
          }
          return `Din ${state.planName} plan tillåter endast ${state.limits.customStatuses} anpassade statusar.`;
        case 'admin':
          return `Din ${state.planName} plan tillåter endast ${state.limits.adminUsers} administratörer.`;
        default:
          return 'Denna funktion är begränsad i din nuvarande plan.';
      }
    };
    
    // Funktion för att få användningsinformation för en resurstyp
    const getUsageInfo = (resourceType: 'ticket' | 'ticketType' | 'customStatus' | 'admin') => {
      switch (resourceType) {
        case 'ticket':
          return state.usage.monthlyTickets;
        case 'ticketType':
          return state.usage.ticketTypes;
        case 'customStatus':
          return state.usage.customStatuses;
        case 'admin':
          return state.usage.adminUsers;
        default:
          return null;
      }
    };
    
    // Funktion för att manuellt uppdatera prenumerationsdatan
    const refreshSubscription = async () => {
      await fetchSubscription();
    };

    return {
      ...state,
      canUseFeature,
      canCreate,
      getLimitMessage,
      getUsageInfo,
      refreshSubscription
    };
  }, [state, fetchSubscription]);

  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
    </SubscriptionContext.Provider>
  );
};

// Ny hook som använder vår kontext
export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  
  if (context === undefined) {
    throw new Error('useSubscription måste användas inom en SubscriptionProvider');
  }
  
  return context;
};

// Exportera även kontexten för direkt användning om det behövs
export default SubscriptionContext;