// components/subscription/SubscriptionPage.tsx
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Tabs, Tab, Spinner } from '@heroui/react';
import SubscriptionOverview from './SubscriptionOverview';
import PlanSelector from './PlanSelector';
import { SubscriptionPlan } from '@prisma/client';

interface SubscriptionInfo {
  plan: SubscriptionPlan;
  billingPeriod: 'monthly' | 'yearly';
  autoRenew: boolean;
}

const SubscriptionPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
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
        const response = await fetch('/api/subscription/info');
        
        if (!response.ok) {
          throw new Error('Kunde inte hämta prenumerationsinformation');
        }
        
        const data = await response.json();
        
        setSubscription({
          plan: data.plan,
          billingPeriod: data.billingPeriod || 'monthly',
          autoRenew: data.autoRenew || false
        });
      } catch (err) {
        console.error('Fel vid hämtning av prenumerationsinformation:', err);
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
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner size="lg" />
      </div>
    );
  }
  
  if (!subscription) {
    return (
      <div className="p-4 bg-danger-100 text-danger-800 rounded-md">
        <p>Kunde inte ladda prenumerationsinformation. Vänligen försök igen senare.</p>
      </div>
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
        
        {activeTab === 'change' && (
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