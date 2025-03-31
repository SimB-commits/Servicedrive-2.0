// components/subscription/SubscriptionPage.tsx
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Tabs, Tab, Spinner, Card, CardBody } from '@heroui/react';
import SubscriptionOverview from './SubscriptionOverview';
import PlanSelector from './PlanSelector';
import { SubscriptionPlan } from '@prisma/client';
import { logger } from '@/utils/logger';

interface SubscriptionInfo {
  plan: SubscriptionPlan;
  billingPeriod: 'monthly' | 'yearly';
  autoRenew: boolean;
}

const SubscriptionPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  // Uppdatera aktiv tab baserat på URL-parametern eller om vi ska visa uppgraderingsfliken
  useEffect(() => {
    if (router.query.upgrade === 'true') {
      setActiveTab('change');
    }
  }, [router.query]);
  
  // Hämta prenumerationsinformation vid sidladdning
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/subscription/info');
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Kunde inte hämta prenumerationsinformation');
        }
        
        const data = await response.json();
        
        setSubscription({
          plan: data.plan,
          billingPeriod: data.billingPeriod || 'monthly',
          autoRenew: data.autoRenew || false
        });
      } catch (err) {
        console.error('Fel vid hämtning av prenumerationsinformation:', err);
        setError(err instanceof Error ? err.message : 'Ett okänt fel uppstod');
        logger.error('Fel vid hämtning av prenumerationsinformation', { 
          error: err instanceof Error ? err.message : 'Okänt fel'
        });
        
        // Sätt standardvärden så att sidan ändå kan fungera
        setSubscription({
          plan: 'STARTUP',
          billingPeriod: 'monthly',
          autoRenew: false
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, []);
  
  // Hantera tab-ändring
  const handleTabChange = (key: React.Key) => {
    setActiveTab(key as string);
    
    // Uppdatera URL för att reflektera vald tab
    router.push({
      pathname: router.pathname,
      query: { 
        ...router.query,
        tab: 'subscription',
        upgrade: key === 'change' ? 'true' : undefined
      }
    }, undefined, { shallow: true });
  };
  
  // Hantera när prenumerationen har ändrats
  const handlePlanChanged = async () => {
    // Ladda om prenumerationsdata
    try {
      setLoading(true);
      const response = await fetch('/api/subscription/info');
      if (response.ok) {
        const data = await response.json();
        setSubscription({
          plan: data.plan,
          billingPeriod: data.billingPeriod || 'monthly',
          autoRenew: data.autoRenew || false
        });
      }
    } catch (error) {
      console.error('Kunde inte uppdatera prenumerationsinformation:', error);
      logger.error('Kunde inte uppdatera prenumerationsinformation efter planändring', { 
        error: error instanceof Error ? error.message : 'Okänt fel'
      });
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner size="lg" />
      </div>
    );
  }
  
  // Visa ett användarvänligt felmeddelande som ger användaren alternativ
  if (error) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardBody>
          <div className="p-4 bg-danger-100 text-danger-800 rounded-md">
            <h2 className="text-lg font-medium mb-2">Det gick inte att ladda prenumerationsinformation</h2>
            <p className="mb-4">{error}</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600"
              >
                Ladda sidan igen
              </button>
              <button 
                onClick={() => router.push('/installningar')}
                className="px-4 py-2 bg-default-200 text-default-800 rounded-md hover:bg-default-300"
              >
                Gå tillbaka till inställningar
              </button>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Tabs 
        selectedKey={activeTab} 
        onSelectionChange={handleTabChange}
        variant="underlined"
        className="mb-4"
      >
        <Tab key="overview" title="Översikt" />
        <Tab key="change" title="Ändra prenumeration" />
        <Tab key="history" title="Faktureringshistorik" />
      </Tabs>
      
      <div className="mt-4">
        {activeTab === 'overview' && <SubscriptionOverview />}
        
        {activeTab === 'change' && subscription && (
          <PlanSelector 
            currentPlan={subscription.plan}
            currentBillingPeriod={subscription.billingPeriod}
            autoRenew={subscription.autoRenew}
            onPlanChanged={handlePlanChanged}
          />
        )}
        
        {activeTab === 'history' && (
          <div className="p-6 bg-default-50 rounded-lg text-center">
            <p>Faktureringshistorik kommer i nästa version.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionPage;