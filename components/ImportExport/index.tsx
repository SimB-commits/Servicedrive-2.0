import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardBody, CardHeader, Tabs, Tab } from '@heroui/react';

// Importera delkomponenter
import ImportTab from './ImportTab';
import ExportTab from './ExportComponents/ExportTab';
import ImportGuide from './ImportGuide';

// Huvud-wrapper-komponent för import/export-funktionalitet
const ImportExportManager = () => {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState('import');

  // Om användaren inte är admin, visa inget
  if (session?.user?.role !== 'ADMIN') {
    return (
      <div className="p-6 text-center">
        <p className="text-default-500">Du måste vara admin för att komma åt detta.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-6">Dataöverföring</h2>
      
      <Tabs 
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as string)}
        variant="underlined" 
        color="primary"
        className="mb-6"
      >
        <Tab key="import" title="Importera" />
        <Tab key="export" title="Exportera" />
      </Tabs>
      
      {/* === IMPORT === */}
      {activeTab === 'import' && (
        <div className="space-y-8">
          <ImportTab />
          <ImportGuide />
        </div>
      )}
      
      {/* === EXPORT === */}
      {activeTab === 'export' && (
        <div className="space-y-8">
          <ExportTab />
        </div>
      )}
    </div>
  );
};

export default ImportExportManager;