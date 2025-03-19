// Uppdaterad version av kundimportalternativ i components/ImportExport/ImportTab.tsx

import React, { useState } from 'react';
import { 
  Chip,
  Tooltip,
  Card,
  CardBody,
  Button
} from '@heroui/react';
import ImportHelpModal from './ImportHelpModal';

interface ImportOptionsProps {
  importOptions: {
    skipExisting: boolean;
    updateExisting: boolean;
    includeAll: boolean;
    batchSize: number;
  };
  setImportOptions: React.Dispatch<React.SetStateAction<{
    skipExisting: boolean;
    updateExisting: boolean;
    includeAll: boolean;
    batchSize: number;
  }>>;
  importTarget: 'customers' | 'tickets';
}

const ImportOptions: React.FC<ImportOptionsProps> = ({ 
  importOptions, 
  setImportOptions,
  importTarget
}) => {
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  // Hjälpfunktion för att växla boolean-alternativ
  const toggleOption = (option: 'skipExisting' | 'updateExisting' | 'includeAll') => {
    setImportOptions(prev => {
      // Om vi aktiverar updateExisting, stäng av skipExisting eftersom de utesluter varandra
      if (option === 'updateExisting' && !prev.updateExisting) {
        return {
          ...prev,
          updateExisting: true,
          skipExisting: false, // Stäng av skipExisting
          [option]: !prev[option]
        };
      }
      
      // Om vi aktiverar skipExisting, stäng av updateExisting
      if (option === 'skipExisting' && !prev.skipExisting) {
        return {
          ...prev,
          skipExisting: true,
          updateExisting: false, // Stäng av updateExisting
          [option]: !prev[option]
        };
      }
      
      // Annars, bara växla det valda alternativet
      return {
        ...prev,
        [option]: !prev[option]
      };
    });
  };

  return (
    <div>
      <h4 className="font-medium mb-2">Importalternativ</h4>
      <Card>
        <CardBody className="p-3">
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              <Tooltip 
                content={
                  <div className="max-w-xs p-2">
                    <p>När aktiverat: Befintliga poster hoppar över import och räknas som framgångsrika.</p>
                    <p className="text-xs mt-1">Existerande kunder identifieras genom e-postadress eller externt ID.</p>
                  </div>
                }
              >
                <Chip
                  variant={importOptions.skipExisting ? "solid" : "flat"}
                  color={importOptions.skipExisting ? "primary" : "default"}
                  onPress={() => toggleOption('skipExisting')}
                  className="cursor-pointer"
                >
                  Hoppa över befintliga
                </Chip>
              </Tooltip>
              
              <Tooltip 
                content={
                  <div className="max-w-xs p-2">
                    <p>När aktiverat: Befintliga poster uppdateras med ny information från importfilen.</p>
                    <p className="text-xs mt-1">Uppdaterar endast fält som finns i importfilen, befintliga värden behålls om de inte anges.</p>
                  </div>
                }
              >
                <Chip
                  variant={importOptions.updateExisting ? "solid" : "flat"}
                  color={importOptions.updateExisting ? "primary" : "default"}
                  onPress={() => toggleOption('updateExisting')}
                  className="cursor-pointer"
                >
                  Uppdatera befintliga
                </Chip>
              </Tooltip>
              
              <Tooltip 
                content={
                  <div className="max-w-xs p-2">
                    <p>När aktiverat: Importerar alla kolumner, även de som inte mappats specifikt.</p>
                    <p className="text-xs mt-1">Användbara för anpassade fält och metadata.</p>
                  </div>
                }
              >
                <Chip
                  variant={importOptions.includeAll ? "solid" : "flat"}
                  color={importOptions.includeAll ? "primary" : "default"}
                  onPress={() => toggleOption('includeAll')}
                  className="cursor-pointer"
                >
                  Inkludera alla fält
                </Chip>
              </Tooltip>
            </div>
            
            {importTarget === 'customers' && (
              <div className="text-xs text-default-500 bg-default-50 p-2 rounded-md">
                <p className="font-medium mb-1">Anteckning för kundimport:</p>
                <ul className="list-disc list-inside space-y-1 ml-1">
                  <li>Befintliga kunder identifieras via e-postadress eller externt ID</li>
                  <li>Om "Uppdatera befintliga" är aktiverat, uppdateras bara fält som finns i importfilen</li>
                  <li>Tomma fält i importfilen överskriver inte befintlig data</li>
                </ul>
              </div>
            )}
            
            {importTarget === 'tickets' && (
              <div className="text-xs text-default-500 bg-default-50 p-2 rounded-md">
                <p className="font-medium mb-1">Anteckning för ärendeimport:</p>
                <ul className="list-disc list-inside space-y-1 ml-1">
                  <li>Befintliga ärenden identifieras via ID eller extern ärendesreferens</li>
                  <li>Ärendestatus uppdateras endast om specificerad i importfilen</li>
                  <li>Dynamiska fält i befintliga ärenden uppdateras vid vald ärendetyp</li>
                </ul>
              </div>
            )}
            
            <div className="flex justify-end mt-2">
              <Button 
                size="sm" 
                variant="light" 
                onPress={() => setShowHelpModal(true)}
              >
                Mer information om import
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
      
      {/* Hjälp-modal */}
      <ImportHelpModal 
        isOpen={showHelpModal} 
        onClose={() => setShowHelpModal(false)} 
        importTarget={importTarget}
      />
    </div>
  );
};

export default ImportOptions;