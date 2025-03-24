// pages/installningar/email.tsx
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { 
  Tabs, 
  Tab,
  Spinner,
  Button,
  addToast
} from '@heroui/react';
import { title } from '@/components/primitives';

// Importera komponenter för e-postinställningar
import DefaultSenderAddressManager from '@/components/email/DefaultSenderAddressManager';
import EmailReplySettings from '@/components/email/EmailReplySettings';
import DomainVerificationManager from '@/components/email/DomainVerificationManager';
import DomainVerificationStatus from '@/components/email/DomainVerificationStatus';
import DomainVerificationInfo from '@/components/email/DomainVerificationInfo';

export default function EmailSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('general');
  const [domains, setDomains] = useState<any[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(true);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Håll koll på activeTab från URL-parametrar
  useEffect(() => {
    const { tab } = router.query;
    if (tab && typeof tab === 'string') {
      // Validera att tab är giltig
      if (['general', 'domains', 'reply'].includes(tab)) {
        setActiveTab(tab);
      }
    }
  }, [router.query]);

  // Hämta domäner när komponenten laddas
  useEffect(() => {
    if (session) {
      fetchDomains();
    }
  }, [session, refreshTrigger]);

  // Funktion för att hämta domäner
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

  // Funktion för att ta bort en domän
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

  // Hantera när en domän har verifierats
  const handleDomainVerified = () => {
    // Uppdatera domänlistan
    setRefreshTrigger(prev => prev + 1);
    // Återgå till domänlistan
    setShowAddDomain(false);
    
    // Visa ett meddelande och guida användaren till e-postsvarsinställningar
    setTimeout(() => {
      setActiveTab('reply');
      
      // Visa ett tydligt meddelande om att en svarsdomän skapats automatiskt
      addToast({
        title: 'Svarsdomän skapad automatiskt',
        description: 'Din domän har verifierats och en svarsdomän har skapats automatiskt. Du kan konfigurera den här.',
        color: 'success',
        variant: 'flat',
      });
    }, 500);
  };

  // När användarens val av flik ändras, uppdatera URL
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    router.push(`/installningar/email?tab=${tab}`, undefined, { shallow: true });
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
      <div className="inline-block max-w-xl text-center mb-4">
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
          onSelectionChange={(key) => handleTabChange(key as string)}
          variant="underlined"
          color="primary"
        >
          {/* Generella e-postinställningar */}
          <Tab key="general" title="Avsändarinställningar">
            <div className="space-y-6 mt-4">
              <DefaultSenderAddressManager 
                onAddressUpdated={() => setRefreshTrigger(prev => prev + 1)} 
              />
            </div>
          </Tab>
          
          {/* Domänhantering */}
          <Tab key="domains" title="Domänverifiering">
            <div className="space-y-6 mt-4">
              {showAddDomain ? (
                // Visa domänverifieringshanteraren när man lägger till ny domän
                <DomainVerificationManager
                  onDomainVerified={handleDomainVerified}
                />
              ) : (
                // Visa lista över verifierade domäner
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
                      
                      {/* Informationsruta om automatisk reply-domän */}
                      <div className="bg-info-50 border border-info-200 p-4 rounded mt-6">
                        <h3 className="text-md font-medium text-info-700 mb-2">Automatisk svarsdomän</h3>
                        <p className="text-sm text-info-700">
                          När du verifierar en domän skapar systemet automatiskt en svarsdomän (reply.dindomän.se)
                          som används för att ta emot svar på e-postmeddelanden och koppla dem till rätt ärende.
                        </p>
                        <Button 
                          color="primary" 
                          variant="flat"
                          size="sm"
                          className="mt-3"
                          onPress={() => handleTabChange('reply')}
                        >
                          Gå till e-postsvarsinställningar
                        </Button>
                      </div>
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
                onSettingsUpdated={() => setRefreshTrigger(prev => prev + 1)}
              />
            </div>
          </Tab>
        </Tabs>
      </div>
    </section>
  );
}