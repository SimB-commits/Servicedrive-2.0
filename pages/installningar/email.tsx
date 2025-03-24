// pages/installningar/email.tsx
import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { 
  Tabs, 
  Tab,
  Spinner,
  Button
} from '@heroui/react';
import { title } from '@/components/primitives';

// Importera komponenter för e-postinställningar
import EmailReplySettings from '@/components/email/EmailReplySettings';
import DefaultSenderAddressManager from '@/components/email/DefaultSenderAddressManager';

export default function EmailSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('general');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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

  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="inline-block max-w-lg text-center mb-4">
        <h1 className={title({ size: 'sm' })}>E-postinställningar</h1>
        <p className="mb-4">Hantera e-postinställningar för din butik</p>
        <Button 
          variant="flat" 
          size="sm"
          onPress={() => router.push('/installningar')}
        >
          Tillbaka till inställningar
        </Button>
      </div>
        
      <div className="w-full max-w-6xl">
        <Tabs 
          aria-label="E-postinställningar"
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as string)}
          variant="underlined"
          color="primary"
        >
          {/* Generella e-postinställningar */}
          <Tab key="general" title="Generella inställningar">
            <div className="space-y-6 mt-4">
              <DefaultSenderAddressManager 
                onAddressUpdated={triggerRefresh} 
              />
              
              <EmailReplySettings 
                className="mt-6"
              />
            </div>
          </Tab>
          
          {/* Domäninställningar */}
          <Tab key="domains" title="Domänhantering">
            <div className="space-y-6 mt-4 text-center">
              <p className="mb-4">
                För att hantera domäner och verifiera nya domäner, gå till Domänverifiering.
              </p>
              <Button 
                color="primary"
                variant="flat"
                onPress={() => router.push('/installningar/domaner')}
              >
                Gå till Domänverifiering
              </Button>
            </div>
          </Tab>
        </Tabs>
      </div>
    </section>
  );
}