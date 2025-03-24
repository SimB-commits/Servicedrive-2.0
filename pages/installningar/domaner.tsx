// pages/installningar/domaner.tsx
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  Tabs, 
  Tab,
  Spinner,
  Button,
  addToast
} from '@heroui/react';
import { title } from '@/components/primitives';

// Importera komponenter
import DomainVerificationManager from '@/components/email/DomainVerificationManager';
import DomainVerificationInfo from '@/components/email/DomainVerificationInfo';
import DomainVerificationStatus from '@/components/email/DomainVerificationStatus';
import EmailReplySettings from '@/components/email/EmailReplySettings';

export default function DomanerPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState('domains');
  const [domains, setDomains] = useState<any[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(true);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Hämta domäner när komponenten laddas
  useEffect(() => {
    if (session) {
      fetchDomains();
    }
  }, [session, refreshTrigger]);

  // Hämta alla domäner
  const fetchDomains = async () => {
    try {
      setLoadingDomains(true);
      const res = await fetch('/api/mail/domains');
      if (res.ok) {
        const data = await res.json();
        setDomains(data);
      } else {
        console.error('Kunde inte hämta domäner');
        addToast({
          title: 'Fel',
          description: 'Kunde inte hämta domäner',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid hämtning av domäner:', error);
    } finally {
      setLoadingDomains(false);
    }
  };

  // Ta bort en domän
  const handleDeleteDomain = async (domainId: string) => {
    try {
      const res = await fetch(`/api/mail/domains/${domainId}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        // Uppdatera domänlistan
        setRefreshTrigger(prev => prev + 1);
        
        addToast({
          title: 'Framgång',
          description: 'Domänen har tagits bort',
          color: 'success',
          variant: 'flat'
        });
      } else {
        throw new Error('Kunde inte ta bort domänen');
      }
    } catch (error) {
      console.error('Fel vid borttagning av domän:', error);
      addToast({
        title: 'Fel',
        description: 'Kunde inte ta bort domänen',
        color: 'danger',
        variant: 'flat'
      });
    }
  };

  // När en domän har verifierats
  const handleDomainVerified = () => {
    // Uppdatera domänlistan
    setRefreshTrigger(prev => prev + 1);
    // Återgå till domänlistan
    setShowAddDomain(false);
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
      <div className="inline-block max-w-lg text-center">
        <h1 className={title({ size: 'sm' })}>E-postinställningar</h1>
        <p className="mb-4">Hantera domäner, avsändaradresser och e-postsvar</p>
      </div>
        
      <div className="w-full max-w-6xl">
        <Tabs 
          aria-label="E-postkonfiguration"
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as string)}
          variant="underlined"
          color="primary"
        >
          {/* Domänfliken */}
          <Tab key="domains" title="Domänverifiering">
            <div className="space-y-6 mt-4">
              {showAddDomain ? (
                // Visa domänverifieringshanteraren när man lägger till ny domän
                <DomainVerificationManager
                  onDomainVerified={handleDomainVerified}
                />
              ) : (
                // Visa domänöversikt
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Verifierade domäner</h2>
                    <Button 
                      color="primary"
                      onPress={() => setShowAddDomain(true)}
                    >
                      Verifiera ny domän
                    </Button>
                  </div>
                  
                  {loadingDomains ? (
                    <div className="flex justify-center items-center py-8">
                      <Spinner size="md" />
                      <p className="ml-3">Laddar domäner...</p>
                    </div>
                  ) : domains.length === 0 ? (
                    <DomainVerificationInfo
                      onAddNewClick={() => setShowAddDomain(true)}
                    />
                  ) : (
                    <div className="space-y-4">
                      {domains.map((domain) => (
                        <DomainVerificationStatus
                          key={domain.id}
                          domain={domain}
                          onDelete={() => handleDeleteDomain(domain.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Tab>
          
          {/* E-postsvarsinställningar */}
          <Tab key="reply" title="E-postsvarsinställningar">
            <div className="space-y-6 mt-4">
              <EmailReplySettings
                onSettingsUpdated={() => {
                  // Uppdatera domänlistan vid behov
                  setRefreshTrigger(prev => prev + 1);
                }}
              />
            </div>
          </Tab>
        </Tabs>
      </div>
    </section>
  );
}