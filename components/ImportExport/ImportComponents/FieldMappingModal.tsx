// components/ImportExport/ImportComponents/FieldMappingModal.tsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  Tab,
  Badge,
  ScrollShadow,
  Select,
  SelectItem
} from '@heroui/react';

// Importera FieldMatcher
import { FieldMatcher, getStringSimilarity } from '@/utils/field-matcher';
import { parseDate } from '@/utils/date-formatter';

interface FieldMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableFields: string[];
  targetFields: string[];
  fieldMapping: Record<string, string>;
  updateFieldMapping: (sourceField: string, targetField: string) => void;
  previewData: any[] | null;
  importTarget?: 'customers' | 'tickets';
}

const FieldMappingModal: React.FC<FieldMappingModalProps> = ({
  isOpen,
  onClose,
  availableFields,
  targetFields,
  fieldMapping,
  updateFieldMapping,
  previewData,
  importTarget = 'customers'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  
  // Skapa en instans av FieldMatcher
  const fieldMatcher = useMemo(() => new FieldMatcher(), []);
  
  // Alternativa målförslag för varje fält
  const [alternativeSuggestions, setAlternativeSuggestions] = useState<Record<string, Array<{field: string, score: number}>>>({});
  
  // Generera alternativa förslag för fält
  useEffect(() => {
    if (!isOpen) return; // Beräkna bara när modalen är öppen
    
    const suggestions: Record<string, Array<{field: string, score: number}>> = {};
    
    availableFields.forEach(sourceField => {
      const fieldSuggestions: Array<{field: string, score: number}> = [];
      
      // Använd endast målfält som inte redan används av andra källfält
      const usedTargets = new Set(Object.values(fieldMapping).filter(Boolean));
      const availableTargets = targetFields.filter(field => 
        field !== fieldMapping[sourceField] && !usedTargets.has(field)
      );
      
      // Hitta de 3 bästa förslagen för detta fält
      availableTargets.forEach(targetField => {
        const similarity = getStringSimilarity(sourceField, targetField);
        if (similarity > 0.5) { // Endast förslag med rimlig likhet
          fieldSuggestions.push({ field: targetField, score: similarity });
        }
      });
      
      // Sortera och begränsa till top 3
      const sortedSuggestions = fieldSuggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      
      if (sortedSuggestions.length > 0) {
        suggestions[sourceField] = sortedSuggestions;
      }
    });
    
    setAlternativeSuggestions(suggestions);
  }, [isOpen, availableFields, targetFields, fieldMapping, fieldMatcher, importTarget]);

  // Beräkna statistik över mappning
  const mappingStats = useMemo(() => {
    const total = availableFields.length;
    const mapped = Object.values(fieldMapping).filter(Boolean).length;
    const percent = total > 0 ? Math.round((mapped / total) * 100) : 0;
    
    // Identifiera viktiga fält som saknas mappning
    // Nu inkluderar vi även "externalId" för kunder, så att historik kan migreras korrekt
    const importantFieldsByType = {
      'customers': ['externalId', 'email', 'firstName', 'lastName'],
      'tickets': ['customerEmail', 'title', 'field_Kommentar']
    };
    
    const importantFields = importantFieldsByType[importTarget] || ['email', 'customerEmail'];
    
    const missingImportantFields = targetFields
      .filter(field => !Object.values(fieldMapping).includes(field))
      .filter(field => importantFields.includes(field));
    
    return {
      total,
      mapped,
      percent,
      missingImportantFields
    };
  }, [fieldMapping, availableFields, targetFields, importTarget]);


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

  // Funktion för att mappa alla icke-mappade fält automatiskt med FieldMatcher
  const autoMapRemainingFields = () => {
    // Hämta alla omappade källfält
    const unmappedSourceFields = availableFields.filter(sourceField => !fieldMapping[sourceField]);
    
    // Hämta alla omappade målfält
    const mappedTargetFields = Object.values(fieldMapping).filter(Boolean);
    const unmappedTargetFields = targetFields.filter(field => !mappedTargetFields.includes(field));
    
    // Använd FieldMatcher för att skapa mapping endast för de omappade fälten
    const partialMapping = fieldMatcher.createMapping(
      unmappedSourceFields, 
      unmappedTargetFields, 
      importTarget
    );
    
    // Uppdatera fieldMapping med de nya mappningarna
    Object.entries(partialMapping).forEach(([source, target]) => {
      if (target) {
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

  // Hjälpfunktion för att visa matchningsgrad
  const renderMatchIndicator = (score: number) => {
    if (score >= 0.9) {
      return <Badge color="success" content="Hög" variant="flat" size="sm" />;
    } else if (score >= 0.7) {
      return <Badge color="warning" content="Medium" variant="flat" size="sm" />;
    } else {
      return <Badge color="default" content="Låg" variant="flat" size="sm" />;
    }
  };

  const renderDatePreview = (dateValue: any) => {
    if (!dateValue) return '-';
    
    const parsedDate = parseDate(dateValue);
    if (!parsedDate) return String(dateValue);
    
    // Visa datum i läsbart format
    try {
      return new Date(parsedDate).toLocaleDateString('sv-SE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return String(dateValue);
    }
  };

  // Anpassad dropdown-innehåll för rullningsfunktionalitet
  const renderDropdownContent = (field: string) => {
    // Dela upp målfalten i mindre grupper om det finns många
    // Detta kan hjälpa med prestanda och scrollning
    
    // Först lägger vi till alternativet att ignorera
    const items = [
      <DropdownItem key="clear" onPress={() => updateFieldMapping(field, '')}>
        -- Ignorera detta fält --
      </DropdownItem>
    ];
    
    // Sedan lägger vi till alla målfält
    // För att förbättra prestanda i dropdown med många alternativ
    targetFields.forEach((targetField) => {
      items.push(
        <DropdownItem 
          key={targetField} 
          onPress={() => updateFieldMapping(field, targetField)}
          // Lägg till textWrap: nowrap för att undvika problem med långa fältnamn
          textValue={targetField} // För tillgänglighet och sökning
          className="text-sm whitespace-normal" // Gör att texten kan wrappa
        >
          {targetField}
        </DropdownItem>
      );
    });
    
    return items;
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
            
            {/* Importtyp-indikator */}
            <div>
              <Chip
                color={importTarget === 'customers' ? "primary" : "secondary"}
                variant="flat"
              >
                Importerar: {importTarget === 'customers' ? 'Kunder' : 'Ärenden'}
              </Chip>
              <p className="text-xs text-default-500 mt-1">
                Datatypen detekterades automatiskt baserat på filens innehåll
              </p>
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

            {importTarget === 'tickets' && (
              <div className="p-4 border rounded mt-4 bg-success-50">
                <h5 className="font-medium mb-2">Datumhantering för importerade ärenden</h5>
                <p className="text-sm text-default-600 mb-2">
                  Om din importfil innehåller kolumner för när ärenden skapades eller uppdaterades, 
                  mappa dessa till <strong>createdAt</strong> och <strong>updatedAt</strong> för att 
                  bevara originaldatum vid import.
                </p>
                
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-success"></div>
                    <span className="text-sm font-medium">createdAt</span>
                    <span className="text-xs text-default-500">
                      {Object.values(fieldMapping).includes('createdAt') 
                        ? 'Originaldatum kommer att bevaras' 
                        : 'Inget originaldatum hittat - använder dagens datum'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                    <span className="text-sm font-medium">updatedAt</span>
                    <span className="text-xs text-default-500">
                      {Object.values(fieldMapping).includes('updatedAt') 
                        ? 'Originaldatum kommer att bevaras' 
                        : 'Inget originaldatum hittat - använder dagens datum'}
                    </span>
                  </div>
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
                  <TableColumn>Alternativ</TableColumn>
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
                            {/* Byt från Dropdown till Select-komponenten som har bättre scroll-stöd */}
                            <Select
                              items={[
                                { key: '', label: '-- Ignorera detta fält --' },
                                ...targetFields.map(f => ({ key: f, label: f }))
                              ]}
                              selectedKeys={fieldMapping[field] ? [fieldMapping[field]] : []}
                              onSelectionChange={(keys) => {
                                // Convert Set to array and get first item
                                const selected = Array.from(keys)[0] as string;
                                updateFieldMapping(field, selected);
                              }}
                              classNames={{
                                trigger: "w-full",
                                listbox: "max-h-[200px] overflow-y-auto",
                                // Säkerställ att långa fältnamn visas korrekt i listan
                                base: "max-w-full",
                                innerWrapper: "max-w-full",
                                // Låt texten i items wrappa om behov finns
                                popover: "max-w-full",
                                value: "truncate max-w-full", // Visa ... för långa värden i triggern
                              }}
                              popoverProps={{
                                // Definiera en tooltip för att visa fullständig text när användaren hovrar  
                                classNames: {
                                  content: "min-w-full"
                                },
                              }}
                              variant="flat"
                              color={fieldMapping[field] ? "success" : "default"}
                              aria-label="Välj fält"
                              placeholder="Välj fält eller ignorera"
                              size="md"
                              renderValue={(items) => {
                                return items.length > 0 ? (
                                  <div className="flex items-center gap-2">
                                    <div className="truncate" title={items[0].textValue}>
                                      {items[0].textValue}
                                    </div>
                                  </div>
                                ) : null;
                              }}
                            >
                              {(item) => (
                                <SelectItem 
                                  key={item.key} 
                                  textValue={item.label}
                                  className="whitespace-normal text-wrap py-2"
                                  title={item.label} // Lägger till HTML title attribut för hover tooltip
                                >
                                  {item.label}
                                </SelectItem>
                              )}
                            </Select>
                          </TableCell>
                          <TableCell>
                            {alternativeSuggestions[field] && alternativeSuggestions[field].length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {alternativeSuggestions[field].map((suggestion, i) => (
                                  <Button 
                                    key={i} 
                                    size="sm" 
                                    variant="light" 
                                    color="default"
                                    onPress={() => updateFieldMapping(field, suggestion.field)}
                                    className="px-2 py-0 text-xs"
                                  >
                                    {suggestion.field}
                                    {renderMatchIndicator(suggestion.score)}
                                  </Button>
                                ))}
                              </div>
                            ) : (
                              <span className="text-default-400 text-xs">Inga förslag</span>
                            )}
                          </TableCell>
                          <TableCell className="text-default-500">
                            {exampleValue}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4">
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