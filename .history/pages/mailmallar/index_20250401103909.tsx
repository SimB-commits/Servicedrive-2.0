// pages/mailmallar/index.tsx
import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Tabs, 
  Tab,
  Spinner
} from '@heroui/react';
import { title } from '@/components/primitives';
import useSubscription from '@/hooks/useSubscription';
import PlanFeatureNotice from '@/components/subscription/PlanFeatureNotice';

// Importera komponenter
import MailTemplateList from '@/components/email/MailTemplateList';
import TemplateSettings from '@/components/email/TemplateSettings';
import DefaultSenderAddressManager from '@/components/email/DefaultSenderAddressManager';
import MailTemplateGuide from '@/components/email/MailTemplateGuide';

export default function MailmallsPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState('templates');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const subscription = useSubscription();

  // Funktion som barn-komponenter kan anropa för att uppdatera data
  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Laddar-tillstånd
  if (status === 'loading') {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <Spinner size="lg" />
        <div>Laddar...</div>
      </section>
    );
  }

  // Autentiseringskontroll
  if (!session) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div>Ingen session – vänligen logga in.</div>
      </section>
    );
  }

  // Kontrollera om användaren kan använda e-postmallar enligt sin prenumerationsplan
  const canUseEmailTemplates = subscription.canUseFeature('emailTemplates');

  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="inline-block max-w-lg text-center">
        <h1 className={title({ size: 'sm' })}>Mailmallar</h1>
        <p className="mb-4">Skapa och hantera mailmallar för automatiserade utskick</p>
      </div>
      
      {/* Visa PlanFeatureNotice om funktionen inte är tillgänglig i användarens plan */}
      {!canUseEmailTemplates && (
        <PlanFeatureNotice 
          feature="emailTemplates"
          title="Mailmallar kräver en högre prenumerationsplan"
          description={`Din ${subscription.planName} plan har begränsad tillgång till mailmallar. Uppgradera för att skapa egna mallar och konfigurera automatiska utskick.`}
          className="w-full max-w-6xl mb-4"
        />
      )}
        
      <div className="w-full max-w-6xl">
        <Tabs 
          aria-label="Mailkonfiguration"
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as string)}
          variant="underlined"
          color="primary"
        >
          {/* Mall-fliken */}
          <Tab key="templates" title="Mailmallar">
            <div className="space-y-6 mt-4">
              {/* Komponent för mallnställningar */}
              <TemplateSettings 
                onSettingsUpdated={triggerRefresh} 
              />
              
              {/* Komponent för maillista */}
              <MailTemplateList 
                refreshTrigger={refreshTrigger} 
                onTemplateChanged={triggerRefresh}
                showPlanLimits={!canUseEmailTemplates} // Skicka med information till komponenten om att visa planbegränsningar
              />
            </div>
          </Tab>
          
          {/* Avsändarinställningar-fliken */}
          <Tab key="settings" title="Avsändarinställningar">
            <div className="space-y-6 mt-4">
              {/* Visa PlanFeatureNotice i kompakt läge om funktionen inte är tillgänglig */}
              {!canUseEmailTemplates && (
                <PlanFeatureNotice 
                  feature="emailTemplates"
                  compact={true}
                />
              )}
              
              <DefaultSenderAddressManager />
            </div>
          </Tab>
          
          {/* Guidefliken - nytt för att ge användarna hjälp */}
          <Tab key="guide" title="Guide">
            <div className="mt-4">
              <MailTemplateGuide />
            </div>
          </Tab>
        </Tabs>
      </div>
    </section>
  );
}