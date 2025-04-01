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
//import PlanLimitNotice from '@/components/subscription/PlanLimitNotice';

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
      
      {/* Visa varning om planens begränsningar för e-postmallar */}
      {/* {!canUseEmailTemplates && (
        <PlanLimitNotice 
          resourceType="customStatus" // Använder customStatus eftersom det saknas specifik resourceType för e-postmallar
          className="w-full max-w-6xl mb-4"
        />
      )} */}
        
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
              {/* Visa varning för gratisanvändare */}
              {!canUseEmailTemplates && (
                <div className="p-4 bg-warning-50 border border-warning-200 rounded-lg">
                  <h3 className="font-medium text-warning-700">Begränsad funktionalitet</h3>
                  <p className="text-sm text-warning-600 mt-2">
                    Din nuvarande plan ({subscription.planName}) har begränsade funktioner för e-postmallar. 
                    Uppgradera din plan för att få tillgång till alla funktioner.
                  </p>
                </div>
              )}
              
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
              {/* Visa varning för gratisanvändare */}
              {/* {!canUseEmailTemplates && (
                <PlanLimitNotice 
                  resourceType="customStatus" 
                  compact={true}
                  className="mb-4"
                />
              )} */}
              
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