// components/subscription/SubscriptionOverview.tsx
import React from 'react';
import { Card, CardHeader, CardBody, CardFooter, Button, Chip } from '@heroui/react';
import UsageIndicator from './UsageIndicator';
import { useSubscription } from '@/context/SubscriptionContext';
import SubscriptionSkeleton from './SubscriptionSkeleton';

const SubscriptionOverview: React.FC = () => {
  const subscription = useSubscription();
  const { isLoading, error, plan, planName, daysRemaining, usage, features, limits } = subscription;

  // Visa skelett under inladdning istället för spinner
  if (isLoading) {
    return <SubscriptionSkeleton />;
  }

  // Visa ett användarvänligt felmeddelande
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

  // Om det inte finns någon prenumerationsplan (vilket inte borde hända med vår nya globala kontext)
  if (!plan) {
    return null;
  }

  // Formatera datum
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('sv-SE');
  };

  // Bestäm faktureringsperioden baserat på om det finns ett slutdatum
  const billingPeriod = subscription.billingPeriod || 'monthly';
  const autoRenew = subscription.autoRenew || false;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">{planName}</h2>
          <p className="text-default-500 text-sm">
            {billingPeriod === 'yearly' && (
              <>Slutdatum: {daysRemaining && daysRemaining <= 30 ? <strong>{formatDate(new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000).toISOString())}</strong> : formatDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString())}</>
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
                limit={Number(usage.adminUsers.limit)} 
              />
              
              <UsageIndicator 
                label="Ärendetyper" 
                current={usage.ticketTypes.current} 
                limit={Number(usage.ticketTypes.limit)} 
              />
              
              {plan !== 'STARTUP' && (
                <UsageIndicator 
                  label="Anpassade statusar" 
                  current={usage.customStatuses.current} 
                  limit={Number(usage.customStatuses.limit)} 
                />
              )}
              
              <UsageIndicator 
                label="Ärenden denna månad" 
                current={usage.monthlyTickets.current} 
                limit={Number(usage.monthlyTickets.limit)} 
              />
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
                  <div 
                    className={`w-4 h-4 rounded-full ${features[key] ? 'bg-success-500' : 'bg-default-200'} mr-2`} 
                  />
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
            Historik: {limits.historyMonths} månader
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