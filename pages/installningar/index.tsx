import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Tabs, 
  Tab,
  Card, 
  CardBody,
  Button,
  Input,
  Form,
  addToast
} from '@heroui/react';
import { title } from '@/components/primitives';

// Importera innehåll för olika tabbar
import ArendetyperContent from '../arendetyper/index';
import KundkortContent from '../kundkort/index';
import MailmallsContent from '../mailmallar/index';
import AccountSettings from '@/components/AccountSettings';
import ImportExportManager from '@/components/ImportExport';

// Typer för att hantera aktiv tab
type TabKey = 'konto' | 'arendetyper' | 'kundkortsmallar' | 'mailmallar' | 'dataimport';

export default function InstallningarPage() {
  const { data: session, status } = useSession();
  const [selectedTab, setSelectedTab] = useState<TabKey>('konto');
  const [loading, setLoading] = useState(true);

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
      default:
        return <div>Välj en inställningskategori</div>;
    }
  };

  if (loading) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
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
        <Tabs 
          aria-label="Inställningar"
          selectedKey={selectedTab}
          onSelectionChange={(key) => setSelectedTab(key as TabKey)}
          color="primary"
          variant="underlined"
          classNames={{
            tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider",
            cursor: "w-full bg-primary",
            tab: "max-w-fit px-2 h-12",
            tabContent: "group-data-[selected=true]:text-primary"
          }}
        >
          <Tab key="konto" title="Konto" />
          <Tab key="arendetyper" title="Ärendetyper" />
          <Tab key="kundkortsmallar" title="Kundkortsmallar" />
          <Tab key="mailmallar" title="Mailmallar" />
          <Tab key="dataimport" title="Import/Export" />
        </Tabs>
        
        <div className="mt-4">
          {renderTabContent()}
        </div>
      </div>
    </section>
  );
}