// pages/installningar/index.tsx
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { 
  Tabs, 
  Tab,
  Card, 
  CardBody,
  Button,
  Input,
  Form,
  addToast,
  Spinner
} from '@heroui/react';
import { title } from '@/components/primitives';

// Importera innehåll för olika tabbar
import ArendetyperContent from '../arendetyper/index';
import KundkortContent from '../kundkort/index';
import MailmallsContent from '../mailmallar/index';
import ArendestatusarContent from '../arendestatusar/index'; // Ny import för ärendestatusar
import AccountSettings from '@/components/AccountSettings';
import ImportExportManager from '@/components/ImportExport';
import StoreManager from '@/components/StoreManager';
import DomainVerificationPage from './domainVerification';

// Typer för att hantera aktiv tab
type TabKey = 'konto' | 'arendetyper' | 'kundkortsmallar' | 'mailmallar' | 'dataimport' | 'butiker' | 'arendestatusar' | 'domainVerification';

export default function InstallningarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<TabKey>('konto');
  const [loading, setLoading] = useState(true);

  // Kontrollera om det finns en tab-query-parameter för att stödja direktnavigering
  useEffect(() => {
    const { tab } = router.query;
    if (tab && typeof tab === 'string') {
      // Validera att tab är en giltig flik
      const isValidTab = (tab: string): tab is TabKey => 
        ['konto', 'arendetyper', 'kundkortsmallar', 'mailmallar', 'dataimport', 'butiker', 'arendestatusar', 'domainVerification'].includes(tab);
      
      if (isValidTab(tab)) {
        setSelectedTab(tab);
      }
    }
  }, [router.query]);

  useEffect(() => {
    if (status !== 'loading') {
      setLoading(false);
    }
  }, [status]);

  // Funktion för att rendera innehåll baserat på vald tab
  const renderTabContent = () => {
    switch (selectedTab) {
      case 'konto':
        return <AccountSettings />;
      case 'arendetyper':
        return <ArendetyperContent />;
      case 'kundkortsmallar':
        return <KundkortContent />;
      case 'mailmallar':
        return <MailmallsContent />;
      case 'dataimport':
        return <ImportExportManager />;
      case 'butiker':
        return <StoreManager />;
      case 'arendestatusar': // Nytt case för ärendestatusar
        return <ArendestatusarContent />;
      case 'domainVerification':
        return <DomainVerificationPage />;  
      default:
        return <div>Välj en inställningskategori</div>;
    }
  };

  if (loading) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <Spinner size="lg" />
        <div>Laddar...</div>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div>Ingen session – vänligen logga in.</div>
      </section>
    );
  }

  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="inline-block max-w-xl text-center mb-6">
        <h1 className={title({ size: 'sm' })}>Inställningar</h1>
        <p className="text-default-500 mt-2">Anpassa dina inställningar för Servicedrive</p>
      </div>
      
      <div className="w-full max-w-6xl">
        {/* Uppdaterad med overflow-x-auto för mobilanpassning */}
        <div className="overflow-x-auto">
          <Tabs 
            aria-label="Inställningar"
            selectedKey={selectedTab}
            onSelectionChange={(key) => {
              setSelectedTab(key as TabKey);
              // Uppdatera URL med query-parametern för att stödja delning av länkar till specifika flikar
              router.push(`/installningar?tab=${key}`, undefined, { shallow: true });
            }}
            color="primary"
            variant="underlined"
            classNames={{
              base: "w-full",
              tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider flex-nowrap overflow-x-auto",
              cursor: "w-full bg-primary",
              tab: "max-w-fit px-2 h-12 whitespace-nowrap",
              tabContent: "group-data-[selected=true]:text-primary"
            }}
          >
            <Tab key="konto" title="Konto" />
            <Tab key="arendetyper" title="Ärendetyper" />
            <Tab key="arendestatusar" title="Ärendestatusar" /> {/* Ny flik för ärendestatusar */}
            <Tab key="kundkortsmallar" title="Kundkortsmallar" />
            <Tab key="mailmallar" title="Mailmallar" />
            <Tab key="dataimport" title="Import/Export" />
            <Tab key="butiker" title="Butiker" />
            <Tab key="domainVerification" title="Domänverifiering" />
          </Tabs>
        </div>
        
        <div className="mt-4">
          {renderTabContent()}
        </div>
      </div>
    </section>
  );
}