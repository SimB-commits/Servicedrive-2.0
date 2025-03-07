import React, { useState, useMemo } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Chip,
  Input,
  Tabs,
  Tab
} from '@heroui/react';

interface FieldMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableFields: string[];
  targetFields: string[];
  fieldMapping: Record<string, string>;
  updateFieldMapping: (sourceField: string, targetField: string) => void;
  previewData: any[] | null;
}

const FieldMappingModal: React.FC<FieldMappingModalProps> = ({
  isOpen,
  onClose,
  availableFields,
  targetFields,
  fieldMapping,
  updateFieldMapping,
  previewData
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');

  // Beräkna statistik över mappning
  const mappingStats = useMemo(() => {
    const total = availableFields.length;
    const mapped = Object.values(fieldMapping).filter(Boolean).length;
    const percent = total > 0 ? Math.round((mapped / total) * 100) : 0;
    
    // Identifiera viktiga fält som saknas mappning
    const missingImportantFields = targetFields
      .filter(field => !Object.values(fieldMapping).includes(field))
      .filter(field => ['email', 'customerEmail', 'firstName', 'lastName'].includes(field));
    
    return {
      total,
      mapped,
      percent,
      missingImportantFields
    };
  }, [fieldMapping, availableFields, targetFields]);

  // Filtrera fält baserat på sökning
  const filteredFields = useMemo(() => {
    if (!searchTerm.trim()) {
      return availableFields;
    }
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    return availableFields.filter(field => 
      field.toLowerCase().includes(lowerSearchTerm) || 
      (fieldMapping[field] && fieldMapping[field].toLowerCase().includes(lowerSearchTerm))
    );
  }, [availableFields, fieldMapping, searchTerm]);

  // Filtrera fält baserat på mappningsstatus
  const filteredByMappingStatus = useMemo(() => {
    if (activeTab === 'all') {
      return filteredFields;
    } else if (activeTab === 'mapped') {
      return filteredFields.filter(field => fieldMapping[field]);
    } else {
      return filteredFields.filter(field => !fieldMapping[field]);
    }
  }, [filteredFields, fieldMapping, activeTab]);

  // Funktion för att mappa alla icke-mappade fält automatiskt (baserat på namn)
  const autoMapRemainingFields = () => {
    // Hämta alla omappade källfält
    const unmappedSourceFields = availableFields.filter(sourceField => !fieldMapping[sourceField]);
    
    // Hämta alla omappade målfält
    const mappedTargetFields = Object.values(fieldMapping).filter(Boolean);
    const unmappedTargetFields = targetFields.filter(field => !mappedTargetFields.includes(field));
    
    // Gå igenom omappade källfält och försök hitta en passande matchning
    const newMappings: Record<string, string> = { ...fieldMapping };
    
    unmappedSourceFields.forEach(sourceField => {
      // Normalisera namnet för enklare matchning (ta bort specialtecken, gör lowercase)
      const normalizedSource = sourceField.toLowerCase().replace(/[^a-zåäö0-9]/g, '');
      
      // Hitta bästa matchning i omappade målfält
      let bestMatch = '';
      let bestMatchScore = 0;
      
      unmappedTargetFields.forEach(targetField => {
        const normalizedTarget = targetField.toLowerCase().replace(/[^a-zåäö0-9]/g, '');
        
        // Exakt matchning
        if (normalizedSource === normalizedTarget) {
          bestMatch = targetField;
          bestMatchScore = 100;
        } 
        // Partiell matchning
        else if (normalizedSource.includes(normalizedTarget) || normalizedTarget.includes(normalizedSource)) {
          const score = Math.min(normalizedSource.length, normalizedTarget.length) / 
                        Math.max(normalizedSource.length, normalizedTarget.length) * 90;
          
          if (score > bestMatchScore) {
            bestMatch = targetField;
            bestMatchScore = score;
          }
        }
      });
      
      // Om vi hittade en tillräckligt bra matchning, använd den
      if (bestMatchScore > 65) {
        newMappings[sourceField] = bestMatch;
        // Ta bort från listan över omappade målfält
        const index = unmappedTargetFields.indexOf(bestMatch);
        if (index > -1) {
          unmappedTargetFields.splice(index, 1);
        }
      }
    });
    
    // Uppdatera alla mappningar på en gång
    Object.entries(newMappings).forEach(([source, target]) => {
      if (target && !fieldMapping[source]) {
        updateFieldMapping(source, target);
      }
    });
  };

  // Funktion för att rensa alla mappningar
  const clearAllMappings = () => {
    availableFields.forEach(field => {
      if (fieldMapping[field]) {
        updateFieldMapping(field, '');
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onClose}
      scrollBehavior="inside"
      size="3xl"
    >
      <ModalContent>
        <ModalHeader>
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold">Koppla kolumner</h2>
            <p className="text-sm text-default-500">
              Ange vilka kolumner från din fil som motsvarar olika fält i systemet
            </p>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            {/* Mappningsstatistik */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Chip 
                color={mappingStats.percent === 100 ? "success" : mappingStats.percent > 50 ? "warning" : "danger"}
                variant="flat"
              >
                {mappingStats.mapped} av {mappingStats.total} kolumner kopplade ({mappingStats.percent}%)
              </Chip>
              
              {mappingStats.missingImportantFields.length > 0 && (
                <Chip color="danger" variant="flat">
                  Viktiga fält saknas: {mappingStats.missingImportantFields.join(', ')}
                </Chip>
              )}
            </div>
            
            {/* Sökfunktion och knappar */}
            <div className="flex flex-wrap justify-between gap-2">
              <Input
                placeholder="Sök efter kolumnnamn..."
                value={searchTerm}
                onValueChange={setSearchTerm}
                size="sm"
                className="max-w-xs"
                startContent={
                  <span className="text-default-400 text-small">
                    <svg
                      aria-hidden="true"
                      fill="none"
                      focusable="false"
                      height="1em"
                      role="presentation"
                      viewBox="0 0 24 24"
                      width="1em"
                    >
                      <path
                        d="M11.5 21C16.7467 21 21 16.7467 21 11.5C21 6.25329 16.7467 2 11.5 2C6.25329 2 2 6.25329 2 11.5C2 16.7467 6.25329 21 11.5 21Z"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                      <path
                        d="M22 22L20 20"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                  </span>
                }
              />
              
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="flat" 
                  color="primary"
                  onPress={autoMapRemainingFields}
                >
                  Koppla automatiskt
                </Button>
                <Button 
                  size="sm" 
                  variant="flat" 
                  color="danger"
                  onPress={clearAllMappings}
                >
                  Rensa alla
                </Button>
              </div>
            </div>
            
            {/* Filter-flikar */}
            <Tabs 
              selectedKey={activeTab}
              onSelectionChange={(key) => setActiveTab(key as string)}
              variant="light"
              size="sm"
              aria-label="Filtrera kolumner"
            >
              <Tab key="all" title="Alla" />
              <Tab key="mapped" title="Kopplade" />
              <Tab key="unmapped" title="Okopplade" />
            </Tabs>
            
            {/* Förhandsvisning av data */}
            {previewData && previewData.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Dataförhandsvisning</h3>
                <div className="overflow-x-auto">
                  <Table aria-label="Data preview" className="text-xs">
                    <TableHeader>
                      {Object.keys(previewData[0]).map((key) => (
                        <TableColumn key={key}>{key}</TableColumn>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {previewData.slice(0, 3).map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {Object.keys(previewData[0]).map((key) => (
                            <TableCell key={key}>
                              {row[key] !== null && row[key] !== undefined ? String(row[key]).substring(0, 30) : '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            
            {/* Fältmappningstabell */}
            <div>
              <h3 className="font-medium mb-2">Kolumnmappning</h3>
              <Table aria-label="Field mapping">
                <TableHeader>
                  <TableColumn>Kolumn i filen</TableColumn>
                  <TableColumn>Fält i systemet</TableColumn>
                  <TableColumn>Exempel</TableColumn>
                </TableHeader>
                <TableBody>
                  {filteredByMappingStatus.length > 0 ? (
                    filteredByMappingStatus.map((field) => {
                      // Hämta exempelvärde från första raden i data
                      const exampleValue = previewData && previewData.length > 0 
                        ? previewData[0][field] !== null && previewData[0][field] !== undefined 
                          ? String(previewData[0][field]).substring(0, 50)
                          : '-'
                        : '-';
                        
                      return (
                        <TableRow key={field}>
                          <TableCell>{field}</TableCell>
                          <TableCell>
                            <Dropdown>
                              <DropdownTrigger>
                                <Button 
                                  variant="flat" 
                                  color={fieldMapping[field] ? "success" : "default"}
                                  className="w-full justify-start"
                                >
                                  {fieldMapping[field] || 'Välj fält eller ignorera'}
                                </Button>
                              </DropdownTrigger>
                              <DropdownMenu>
                                <DropdownItem key="clear" onPress={() => updateFieldMapping(field, '')}>
                                  -- Ignorera detta fält --
                                </DropdownItem>
                                {targetFields.map((targetField) => (
                                  <DropdownItem 
                                    key={targetField} 
                                    onPress={() => updateFieldMapping(field, targetField)}
                                  >
                                    {targetField}
                                  </DropdownItem>
                                ))}
                              </DropdownMenu>
                            </Dropdown>
                          </TableCell>
                          <TableCell className="text-default-500">
                            {exampleValue}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4">
                        Inga kolumner matchar filtret
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button 
            variant="flat" 
            onPress={onClose}
          >
            Avbryt
          </Button>
          <Button 
            color="primary" 
            onPress={onClose}
          >
            Spara mappning
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default FieldMappingModal;