// components/email/EmailSettings.tsx
import React, { useState, useEffect } from 'react';
import { 
  Tabs, 
  Tab,
  Spinner,
  addToast
} from '@heroui/react';

// Importera komponenter för e-postinställningar - OBSERVERA: Borttagna komponenter relaterade till reply-domäner
import DefaultSenderAddressManager from '@/components/email/DefaultSenderAddressManager';
import DomainVerificationManager from '@/components/email/DomainVerificationManager';
import DomainVerificationStatus from '@/components/email/DomainVerificationStatus';
import DomainVerificationInfo from '@/components/email/DomainVerificationInfo';

// Typ-definition för domäner
interface Domain {
  id: string;
  domain: string;
  status: string;
  verified: boolean;
  [key: string]: any;
}

/**
 * E-postinställningskomponent
 * 
 * OBS: Funktionalitet för kundspecifika svarsdomäner har tagits bort som en del
 * av standardiseringen av systemets e-postarkitektur. Alla svar dirigeras nu 
 * automatiskt till standarddomänen reply.servicedrive.se.
 */
const EmailSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(true);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Hämta domäner när komponenten laddas
  useEffect(() => {
    fetchDomains();
  }, [refreshTrigger]);

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
        const errorData = await res.json().catch(() => ({ error: 'Kunde inte parsa felmeddelande' }));
        throw new Error(errorData.error || 'Kunde inte ta bort domänen');
      }
    } catch (error) {
      console.error('Fel vid borttagning av domän:', error);
      addToast({
        title: 'Fel',
        description: error.message || 'Kunde inte ta bort domänen',
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
    
    addToast({
      title: 'Domän verifierad!',
      description: 'Din domän har nu verifierats och kan användas för mailutskick.',
      color: 'success',
      variant: 'flat'
    });
  };

  return (
    <div className="w-full">
      <Tabs 
        aria-label="E-postinställningar"
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as string)}
        variant="underlined"
        color="primary"
      >
        {/* Generella e-postinställningar */}
        <Tab key="general" title="Avsändarinställningar">
          <div className="space-y-6 mt-4">
            <DefaultSenderAddressManager 
              onAddressUpdated={() => setRefreshTrigger(prev => prev + 1)} 
            />
            
            {/* Informationsmeddelande om standardiserad svarshantering */}
            <div className="bg-info-50 border border-info-200 p-4 rounded">
              <h3 className="text-md font-medium text-info-700 mb-2">Information om svarshantering</h3>
              <p className="text-sm text-info-700">
                Systemet använder nu en standardiserad svarshantering via domänen
                <strong> reply.servicedrive.se</strong>. När kunder svarar på mail från systemet,
                dirigeras svaren automatiskt till rätt ärende utan behov av ytterligare konfiguration.
              </p>
            </div>
          </div>
        </Tab>
        
        {/* Domänhantering */}
        <Tab key="domains" title="Domänverifiering">
          <div className="space-y-6 mt-4">
            {showAddDomain ? (
              // Visa domänverifieringshanteraren när man lägger till ny domän
              <DomainVerificationManager
                onDomainVerified={handleDomainVerified}
                onAddNewDomain={() => setShowAddDomain(true)}
              />
            ) : (
              // Visa lista över verifierade domäner
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Verifierade domäner</h2>
                  <button 
                    className="heroui-button heroui-button-primary heroui-button-md"
                    onClick={() => setShowAddDomain(true)}
                  >
                    Verifiera ny domän
                  </button>
                </div>
                
                <div className="bg-info-50 border border-info-200 rounded p-4 mb-4">
                  <h3 className="text-md font-medium text-info-700 mb-2">Domänverifiering</h3>
                  <p className="text-info-700 mb-2">
                    Verifiera din domän för att kunna skicka mail från dina egna e-postadresser. 
                    Verifierade domäner kan användas som avsändaradresser i systemet.
                  </p>
                  <p className="text-info-700">
                    <strong>OBS:</strong> För svarshantering används alltid systemets standarddomän 
                    <strong> reply.servicedrive.se</strong> oavsett vilken avsändaradress du använder.
                  </p>
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
      </Tabs>
    </div>
  );
};

export default EmailSettings;