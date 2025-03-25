// components/email/EmailSettings.tsx
import React, { useState, useEffect } from 'react';
import { 
  Tabs, 
  Tab,
  Spinner,
  addToast,
  Alert
} from '@heroui/react';

// Importera komponenter för e-postinställningar
import DefaultSenderAddressManager from '@/components/email/DefaultSenderAddressManager';
import EmailReplySettings from '@/components/email/EmailReplySettings';
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

const EmailSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(true);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [pendingReplyDomains, setPendingReplyDomains] = useState<Domain[]>([]);

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
        
        // Hitta reply-domäner som inte är verifierade
        const pendingReplies = data.filter((d: Domain) => 
          d.domain.startsWith('reply.') && 
          (d.status === 'pending' || !d.verified)
        );
        
        setPendingReplyDomains(pendingReplies);
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
        description: 'Din domän har verifierats och en svarsdomän har skapats automatiskt, men den behöver också verifieras. Se fliken "E-postsvarsinställningar".',
        color: 'warning',
        variant: 'flat'
        // Ta bort 'duration' property som orsakar TypeScript-fel
      });
    }, 500);
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
          </div>
        </Tab>
        
        {/* Domänhantering */}
        <Tab key="domains" title="Domänverifiering">
          <div className="space-y-6 mt-4">
            {pendingReplyDomains.length > 0 && (
              <Alert variant="solid" color="warning">
                <div className="font-bold">Verifiering krävs för reply-domäner!</div>
                <div>
                  Du har {pendingReplyDomains.length} reply-domän(er) som behöver verifieras med separata DNS-poster. 
                  Reply-domäner är nödvändiga för att systemet ska kunna ta emot e-postsvar från dina kunder.
                  Gå till fliken "E-postsvarsinställningar" för att slutföra verifieringen.
                </div>
              </Alert>
            )}
          
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
                  <h3 className="text-md font-medium text-info-700 mb-2">Verifieringsprocess</h3>
                  <ol className="list-decimal list-inside space-y-1">
                    <li className="text-info-700">Verifiera din huvuddomän (t.ex. dindomän.se) genom att lägga till DNS-poster</li>
                    <li className="text-info-700">Efter verifiering skapas en reply-domän (reply.dindomän.se) automatiskt</li>
                    <li className="text-info-700">Gå till fliken "E-postsvarsinställningar" för att verifiera reply-domänen (kräver ytterligare DNS-poster)</li>
                    <li className="text-info-700">När både huvuddomänen och reply-domänen är verifierade kan du använda dem för e-postkommunikation</li>
                  </ol>
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
        <Tab key="reply" title={
          <div className="flex items-center">
            E-postsvarsinställningar
            {pendingReplyDomains.length > 0 && (
              <span className="ml-2 bg-warning-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                {pendingReplyDomains.length}
              </span>
            )}
          </div>
        }>
          <div className="space-y-6 mt-4">
            {pendingReplyDomains.length > 0 && (
              <Alert variant="solid" color="warning">
                <div className="font-bold">Åtgärd krävs för att aktivera e-postsvar!</div>
                <div>
                  För att kunna ta emot e-postsvar från kunder behöver du slutföra verifieringen av din reply-domän. 
                  Detta kräver att du lägger till ytterligare DNS-poster specifikt för reply-domänen.
                </div>
              </Alert>
            )}
            
            <EmailReplySettings
              onSettingsUpdated={() => setRefreshTrigger(prev => prev + 1)}
            />
          </div>
        </Tab>
      </Tabs>
    </div>
  );
};

export default EmailSettings;