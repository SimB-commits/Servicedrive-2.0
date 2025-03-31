// components/subscription/SubscriptionOverview.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody, CardFooter, Button, Spinner, Chip } from '@heroui/react';
import { SubscriptionPlan } from '@prisma/client';
import UsageIndicator from './UsageIndicator';
import { SubscriptionService } from '@/utils/subscriptionFeatures';

interface SubscriptionData {
  plan: SubscriptionPlan;
  planName: string;
  startDate: string;
  endDate?: string;
  daysRemaining?: number;
  autoRenew: boolean;
  billingPeriod: 'monthly' | 'yearly';
  usage: {
    adminUsers: { current: number; limit: number | string; percentage: number; status: string };
    ticketTypes: { current: number; limit: number | string; percentage: number; status: string };
    customStatuses: { current: number; limit: number | string; percentage: number; status: string };
    monthlyTickets: { current: number; limit: number | string; percentage: number; status: string; resetDate: string };
    historyMonths: { limit: number };
  };
  features: Record<string, boolean>;
}

const SubscriptionOverview: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/subscription/info');
        
        if (!response.ok) {
          throw new Error('Kunde inte hämta prenumerationsinformation');
        }
        
        const data = await response.json();
        setSubscription(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ett fel inträffade');
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardBody>
          <div className="text-danger">
            <p>Det gick inte att ladda prenumerationsinformation: {error}</p>
            <Button color="primary" className="mt-4" onClick={() => window.location.reload()}>
              Försök igen
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (!subscription) {
    return null;
  }

  const { plan, planName, startDate, endDate, daysRemaining, autoRenew, billingPeriod, usage, features } = subscription;

  // Formatera datum
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('sv-SE');
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">{planName}</h2>
          <p className="text-default-500 text-sm">
            Startdatum: {formatDate(startDate)}
            {billingPeriod === 'yearly' && (
              <> | Slutdatum: {formatDate(endDate)}</>
            )}
          </p>
        </div>
        <div className="flex flex-col sm:items-end mt-2 sm:mt-0">
          <Chip 
            color="primary" 
            variant="flat" 
            className="mb-1"
          >
            {billingPeriod === 'yearly' ? 'Årsbetalning' : 'Månadsbetalning'}
          </Chip>
          {daysRemaining !== undefined && daysRemaining <= 30 && (
            <Chip 
              color={daysRemaining <= 7 ? 'danger' : 'warning'} 
              variant="flat"
            >
              {daysRemaining <= 0 
                ? 'Prenumeration utgången' 
                : `${daysRemaining} dagar kvar`}
            </Chip>
          )}
        </div>
      </CardHeader>
      
      <CardBody>
        <div className="space-y-6">
          <section>
            <h3 className="text-lg font-semibold mb-3">Användning</h3>
            <div className="space-y-4">
              <UsageIndicator 
                label="Administratörer" 
                current={usage.adminUsers.current} 
                limit={Number(usage.adminUsers.limit === 'Obegränsat' ? SubscriptionService.UNLIMITED : usage.adminUsers.limit)} 
              />
              
              <UsageIndicator 
                label="Ärendetyper" 
                current={usage.ticketTypes.current} 
                limit={Number(usage.ticketTypes.limit === 'Obegränsat' ? SubscriptionService.UNLIMITED : usage.ticketTypes.limit)} 
              />
              
              {plan !== 'STARTUP' && (
                <UsageIndicator 
                  label="Anpassade statusar" 
                  current={usage.customStatuses.current} 
                  limit={Number(usage.customStatuses.limit === 'Obegränsat' ? SubscriptionService.UNLIMITED : usage.customStatuses.limit)} 
                />
              )}
              
              <UsageIndicator 
                label="Ärenden denna månad" 
                current={usage.monthlyTickets.current} 
                limit={Number(usage.monthlyTickets.limit === 'Obegränsat' ? SubscriptionService.UNLIMITED : usage.monthlyTickets.limit)} 
              />
              
              {usage.monthlyTickets.resetDate && plan === 'STARTUP' && (
                <p className="text-xs text-default-500 mt-1">
                  Räknaren återställs {formatDate(usage.monthlyTickets.resetDate)}
                </p>
              )}
            </div>
          </section>
          
          <section>
            <h3 className="text-lg font-semibold mb-3">Funktioner</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { key: 'unlimitedTickets', label: 'Obegränsade ärenden' },
                { key: 'customStatuses', label: 'Anpassade statusar' },
                { key: 'customFields', label: 'Anpassade fält' },
                { key: 'emailTemplates', label: 'E-postmallar' },
                { key: 'appointmentBooking', label: 'Tidsbokning' },
                { key: 'advancedStatistics', label: 'Avancerad statistik' },
                { key: 'multiStore', label: 'Flerbutiksstöd' },
                { key: 'customDomains', label: 'Anpassade domäner' },
                { key: 'apiAccess', label: 'API-åtkomst' },
                { key: 'smsNotifications', label: 'SMS-notifieringar' },
                { key: 'roleBased', label: 'Rollbaserade användare' },
                { key: 'prioritySupport', label: 'Prioriterad support' }
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center">
                  <div className={`w-4 h-4 rounded-full ${features[key] ? 'bg-success-500' : 'bg-default-200'} mr-2`} />
                  <span className={features[key] ? 'text-default-700' : 'text-default-400'}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </CardBody>
      
      <CardFooter className="flex flex-col sm:flex-row gap-2 justify-between">
        <div>
          <p className="text-sm text-default-500">
            Historik: {usage.historyMonths.limit} månader
            {billingPeriod === 'yearly' && autoRenew && (
              <> | Automatisk förnyelse aktiverad</>
            )}
          </p>
        </div>
        
        <div className="flex gap-2">
          {plan !== 'PROFESSIONAL' && (
            <Button 
              as="a" 
              href="/installningar?tab=subscription&upgrade=true" 
              color="primary"
            >
              Uppgradera
            </Button>
          )}
          <Button 
            as="a" 
            href="/installningar?tab=subscription" 
            variant="flat"
          >
            Hantera prenumeration
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default SubscriptionOverview;