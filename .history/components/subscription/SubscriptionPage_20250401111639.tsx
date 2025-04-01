// components/subscription/SubscriptionPage.tsx
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Tabs, Tab, Card, CardBody } from '@heroui/react';
import SubscriptionOverview from './SubscriptionOverview';
import PlanSelector from './PlanSelector';
import { useSubscription } from '@/context/SubscriptionContext';
import SubscriptionSkeleton from './SubcriptionSkeleteon';

const SubscriptionPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const subscription = useSubscription();
  const router = useRouter();
  
  // Uppdatera aktiv tab baserat på URL-parametern eller om vi ska visa uppgraderingsfliken
  useEffect(() => {
    if (router.query.upgrade === 'true') {
      setActiveTab('change');
    }
  }, [router.query]);
  
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
  
  // Hantera när prenumerationen har ändrats - detta är nu överflödigt med den globala prenumerationskontexten
  const handlePlanChanged = async () => {
    // Inget behöver göras här eftersom SubscriptionContext hanterar uppdatering automatiskt
    // Vi behåller metoden för bakåtkompatibilitet
  };

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