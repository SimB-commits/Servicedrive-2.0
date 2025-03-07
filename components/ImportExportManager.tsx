import React, { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  addToast,
  Form,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Table,
  TableHeader,
  TableRow,
  TableBody,
  TableCell,
  TableColumn,
  Input,
  Checkbox,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tabs,
  Tab,
  Card,
  CardHeader,
  CardBody,
  Progress,
  Divider,
  Spinner
} from '@heroui/react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// Importera mappningsfunktioner
import { 
  mapCustomerFields, 
  mapTicketFields, 
  detectFileType,
  validateImport
} from '@/utils/import-export';

// Komponent för att hantera import/export av data
const ImportExportManager = () => {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState('import');
  const [loading, setLoading] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<any[] | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const [importTarget, setImportTarget] = useState<'customers' | 'tickets'>('customers');
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [targetFields, setTargetFields] = useState<string[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export-related states
  const [exportType, setExportType] = useState<'csv' | 'excel' | 'json'>('csv');
  const [exportTarget, setExportTarget] = useState<'customers' | 'tickets' | 'all'>('all');
  const [includeRelations, setIncludeRelations] = useState(true);
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [exportData, setExportData] = useState<any>(null);

  // Hämta tillgängliga fält baserat på importmål
  useEffect(() => {
    if (importTarget === 'customers') {
      setTargetFields([
        'firstName', 'lastName', 'email', 'phoneNumber', 'address', 
        'postalCode', 'city', 'country', 'newsletter', 'loyal'
      ]);
    } else {
      setTargetFields([
        'title', 'description', 'status', 'dueDate', 'customerEmail'
      ]);
    }
  }, [importTarget]);

  // När en fil väljs, analysera den och försök identifiera fält
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setImportFile(file);
    setFileData(null);
    setFieldMapping({});
    setPreviewData(null);
    setImportSummary(null);

    try {
      // Identifiera filtyp
      const type = detectFileType(file.name);
      setFileType(type);

      // Läs filens innehåll
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          let data: any[] = [];
          if (type === 'csv') {
            // Parsa CSV med PapaParse
            const result = Papa.parse(event.target?.result as string, {
              header: true,
              skipEmptyLines: true,
              dynamicTyping: true,
            });
            data = result.data;
            setAvailableFields(result.meta.fields || []);
          } else if (type === 'excel') {
            // Parsa Excel med SheetJS
            const workbook = XLSX.read(event.target?.result, {
              type: 'binary',
              cellDates: true
            });
            
            // Använd första arbetsbladet
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Konvertera till JSON
            data = XLSX.utils.sheet_to_json(worksheet);
            
            // Extrahera tillgängliga fält från första raden
            if (data.length > 0) {
              setAvailableFields(Object.keys(data[0]));
            }
          } else if (type === 'json') {
            // Parsa JSON
            data = JSON.parse(event.target?.result as string);
            
            // Om data är ett objekt med en array-property, använd den
            if (!Array.isArray(data) && data !== null && typeof data === 'object') {
              const keys = Object.keys(data);
              // Sök efter en array-property
              for (const key of keys) {
                if (Array.isArray(data[key])) {
                  data = data[key];
                  break;
                }
              }
            }
            
            if (data.length > 0) {
              setAvailableFields(Object.keys(data[0]));
            }
          }

          setFileData(data);
          setPreviewData(data.slice(0, 5)); // Visa de första 5 raderna som förhandsvisning
          
          // Försök att automatiskt mappa fält baserat på namn
          const autoMapping: Record<string, string> = {};
          
          availableFields.forEach(sourceField => {
            // Normalisera fältnamnet för enklare matchning
            const normalizedField = sourceField.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            // Hitta bästa matchning i targetFields
            let bestMatch = '';
            let bestMatchScore = 0;
            
            targetFields.forEach(targetField => {
              const normalizedTarget = targetField.toLowerCase();
              
              // Exakta matchningar
              if (
                normalizedField === normalizedTarget ||
                normalizedField === normalizedTarget.replace(/[^a-z0-9]/g, '')
              ) {
                bestMatch = targetField;
                bestMatchScore = 100;
              } 
              // Partiella matchningar
              else if (
                normalizedField.includes(normalizedTarget) || 
                normalizedTarget.includes(normalizedField)
              ) {
                // Om vi redan har en exakt matchning, hoppa över
                if (bestMatchScore < 100) {
                  const score = Math.min(normalizedField.length, normalizedTarget.length) / 
                                Math.max(normalizedField.length, normalizedTarget.length) * 90;
                  
                  if (score > bestMatchScore) {
                    bestMatch = targetField;
                    bestMatchScore = score;
                  }
                }
              }
            });
            
            // Om vi hittade en matchning med poäng över 70, använd den
            if (bestMatchScore > 70) {
              autoMapping[sourceField] = bestMatch;
            }
          });
          
          setFieldMapping(autoMapping);
          setShowMappingModal(true);
        } catch (error) {
          console.error('Fel vid parsning av fil:', error);
          addToast({
            title: 'Fel',
            description: 'Kunde inte tolka filens innehåll. Kontrollera filformatet.',
            color: 'danger',
            variant: 'flat'
          });
        } finally {
          setLoading(false);
        }
      };

      reader.onerror = () => {
        setLoading(false);
        addToast({
          title: 'Fel',
          description: 'Kunde inte läsa filen. Försök igen.',
          color: 'danger',
          variant: 'flat'
        });
      };

      if (type === 'excel') {
        reader.readAsBinaryString(file);
      } else {
        reader.readAsText(file);
      }

    } catch (error) {
      console.error('Fel vid filhantering:', error);
      setLoading(false);
      addToast({
        title: 'Fel',
        description: 'Ett fel uppstod vid hantering av filen.',
        color: 'danger',
        variant: 'flat'
      });
    }
  };

  // Uppdatera fältmappningen när användaren väljer ett fält
  const updateFieldMapping = (sourceField: string, targetField: string) => {
    setFieldMapping(prev => ({
      ...prev,
      [sourceField]: targetField
    }));
  };

  // Starta importprocessen
  const handleImport = async () => {
    if (!fileData || !fieldMapping) {
      addToast({
        title: 'Fel',
        description: 'Ingen data att importera eller ofullständig fältmappning.',
        color: 'danger',
        variant: 'flat'
      });
      return;
    }

    setLoading(true);
    setImportProgress(0);
    setImportSummary(null);

    try {
      // Validera importen
      const validationResult = validateImport(fileData, fieldMapping, importTarget);
      
      if (!validationResult.valid) {
        addToast({
          title: 'Valideringsfel',
          description: validationResult.message || 'Data kunde inte valideras.',
          color: 'danger',
          variant: 'flat'
        });
        setImportSummary({
          total: fileData.length,
          success: 0,
          failed: fileData.length,
          errors: [validationResult.message || 'Okänt valideringsfel']
        });
        setLoading(false);
        return;
      }

      // Förberedd data för import
      const dataToImport = fileData.map(row => {
        // Mappa fält baserat på fältmappningen
        const mappedRow: Record<string, any> = {};
        
        for (const [sourceField, targetField] of Object.entries(fieldMapping)) {
          if (targetField && row[sourceField] !== undefined) {
            mappedRow[targetField] = row[sourceField];
          }
        }
        
        return mappedRow;
      });

      // Starta importen
      const results = {
        total: dataToImport.length,
        success: 0,
        failed: 0,
        errors: [] as string[]
      };

      // Importera stegvis
      const batchSize = 20;
      const totalBatches = Math.ceil(dataToImport.length / batchSize);
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * batchSize;
        const end = Math.min(start + batchSize, dataToImport.length);
        const batch = dataToImport.slice(start, end);
        
        try {
          // Anropa API:et baserat på importmål
          const response = await fetch(`/api/import/${importTarget}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              data: batch,
              // Inkludera eventuella ytterligare inställningar
              settings: {
                skipExisting: true
              } 
            }),
          });

          if (response.ok) {
            const result = await response.json();
            results.success += result.success || 0;
            results.failed += result.failed || 0;
            
            if (result.errors && result.errors.length > 0) {
              results.errors.push(...result.errors);
            }
          } else {
            const error = await response.json();
            console.error('API-fel:', error);
            results.failed += batch.length;
            results.errors.push(`Batch ${batchIndex + 1}: ${error.message || 'Okänt fel'}`);
          }
        } catch (error) {
          console.error('Fel vid import av batch:', error);
          results.failed += batch.length;
          results.errors.push(`Batch ${batchIndex + 1}: ${error instanceof Error ? error.message : 'Okänt fel'}`);
        }

        // Uppdatera framsteg
        setImportProgress(Math.round(((batchIndex + 1) / totalBatches) * 100));
      }

      // När importen är klar, visa sammanfattning
      setImportSummary(results);
      
      if (results.failed === 0) {
        addToast({
          title: 'Import slutförd',
          description: `${results.success} ${importTarget === 'customers' ? 'kunder' : 'ärenden'} importerades framgångsrikt.`,
          color: 'success',
          variant: 'flat'
        });
      } else {
        addToast({
          title: 'Import slutförd med varningar',
          description: `${results.success} av ${results.total} ${importTarget === 'customers' ? 'kunder' : 'ärenden'} importerades. ${results.failed} misslyckades.`,
          color: 'warning',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid import:', error);
      addToast({
        title: 'Import misslyckades',
        description: 'Ett fel uppstod under importprocessen.',
        color: 'danger',
        variant: 'flat'
      });
      
      setImportSummary({
        total: fileData.length,
        success: 0,
        failed: fileData.length,
        errors: [error instanceof Error ? error.message : 'Okänt fel']
      });
    } finally {
      setLoading(false);
    }
  };

  // Reset import formuläret
  const resetImport = () => {
    setImportFile(null);
    setFileData(null);
    setFileType(null);
    setFieldMapping({});
    setAvailableFields([]);
    setPreviewData(null);
    setImportSummary(null);
    setImportProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Funktion för att exportera data
  const handleExport = async () => {
    setExportStatus('loading');
    
    try {
      // Använd API:et för att hämta data för export
      const endpoint = exportTarget === 'all' 
        ? '/api/export/all'
        : `/api/export/${exportTarget}`;
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Kunde inte hämta data för export');
      }
      
      const data = await response.json();
      
      // Förbered data för export
      if (exportType === 'csv') {
        // Konvertera till CSV med PapaParse
        const csv = Papa.unparse(data);
        
        // Skapa en nedladdningslänk
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `servicedrive_export_${exportTarget}_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        
        // Rensa URL-objektet
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 100);
      } else if (exportType === 'excel') {
        // Konvertera till Excel med SheetJS
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Data');
        
        // Konvertera till blob och skapa en nedladdningslänk
        XLSX.writeFile(wb, `servicedrive_export_${exportTarget}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      } else if (exportType === 'json') {
        // Skapa en nedladdningslänk för JSON-data
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `servicedrive_export_${exportTarget}_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        
        // Rensa URL-objektet
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 100);
      }
      
      setExportStatus('success');
      addToast({
        title: 'Export slutförd',
        description: 'Data exporterades framgångsrikt',
        color: 'success',
        variant: 'flat'
      });
    } catch (error) {
      console.error('Fel vid export:', error);
      setExportStatus('error');
      addToast({
        title: 'Export misslyckades',
        description: 'Kunde inte exportera data. Försök igen.',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setTimeout(() => {
        setExportStatus('idle');
      }, 3000);
    }
  };

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
          <Card>
            <CardHeader>
              <h3 className="text-lg font-medium">Importera data</h3>
              <p className="text-default-500 text-sm">
                Importera kunder och ärenden från externa system. Stödjer CSV, Excel och JSON.
              </p>
            </CardHeader>
            <CardBody>
              <div className="space-y-6">
                {/* Steg 1: Välj importmål */}
                <div>
                  <h4 className="font-medium mb-2">1. Välj vad du vill importera</h4>
                  <div className="flex gap-4">
                    <Button
                      variant={importTarget === 'customers' ? 'solid' : 'flat'}
                      color={importTarget === 'customers' ? 'primary' : 'default'}
                      onPress={() => setImportTarget('customers')}
                    >
                      Kunder
                    </Button>
                    <Button
                      variant={importTarget === 'tickets' ? 'solid' : 'flat'}
                      color={importTarget === 'tickets' ? 'primary' : 'default'}
                      onPress={() => setImportTarget('tickets')}
                    >
                      Ärenden
                    </Button>
                  </div>
                </div>
                
                {/* Steg 2: Ladda upp fil */}
                <div>
                  <h4 className="font-medium mb-2">2. Välj importfil</h4>
                  <div className="flex flex-col gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".csv,.xlsx,.xls,.json"
                      className="block w-full text-sm text-default-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary-600"
                    />
                    <p className="text-xs text-default-500">
                      Stödjer .csv, .xlsx, .xls, och .json
                    </p>
                    
                    {importFile && (
                      <div className="mt-2 p-2 bg-default-100 rounded-md">
                        <p className="text-sm font-medium">{importFile.name}</p>
                        <p className="text-xs text-default-500">
                          {fileType?.toUpperCase()} | {(importFile.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Visar framsteg vid import */}
                {loading && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Importerar data...</p>
                    <Progress value={importProgress} className="mb-2" />
                    <p className="text-xs text-center text-default-500">
                      {importProgress}% slutfört
                    </p>
                  </div>
                )}
                
                {/* Importsammanfattning */}
                {importSummary && (
                  <div className="mt-4 p-4 border rounded-md bg-default-50">
                    <h4 className="font-medium mb-2">Importsammanfattning</h4>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-sm text-default-500">Totalt</p>
                        <p className="text-xl font-semibold">{importSummary.total}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-success">Importerade</p>
                        <p className="text-xl font-semibold text-success">{importSummary.success}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-danger">Misslyckade</p>
                        <p className="text-xl font-semibold text-danger">{importSummary.failed}</p>
                      </div>
                    </div>
                    
                    {importSummary.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium text-sm mb-1">Fel</p>
                        <div className="max-h-32 overflow-y-auto text-xs bg-danger-50 p-2 rounded-md text-danger-700">
                          {importSummary.errors.map((error, index) => (
                            <p key={index}>{error}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Knappar */}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="flat"
                    onPress={resetImport}
                  >
                    Återställ
                  </Button>
                  <Button
                    variant="flat"
                    color="primary"
                    isDisabled={!importFile || !fieldMapping || Object.keys(fieldMapping).length === 0}
                    onPress={() => setShowMappingModal(true)}
                  >
                    Redigera mappning
                  </Button>
                  <Button
                    color="primary"
                    isDisabled={!importFile || !fieldMapping || Object.keys(fieldMapping).length === 0 || loading}
                    isLoading={loading}
                    onPress={handleImport}
                  >
                    Starta import
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
          
          {/* Tips och dokumentation */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-medium">Importguide</h3>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">Format för kundfiler</h4>
                  <p className="text-sm text-default-500 mb-2">
                    Filen bör innehålla följande fält:
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1 text-default-500">
                    <li><strong>firstName</strong> - Kundens förnamn</li>
                    <li><strong>lastName</strong> - Kundens efternamn</li>
                    <li><strong>email</strong> - Kundens e-postadress (obligatoriskt)</li>
                    <li><strong>phoneNumber</strong> - Telefonnummer</li>
                    <li><strong>address</strong> - Postadress</li>
                    <li><strong>postalCode</strong> - Postnummer</li>
                    <li><strong>city</strong> - Ort</li>
                    <li><strong>country</strong> - Land</li>
                    <li><strong>newsletter</strong> - Nyhetsbrev (true/false)</li>
                    <li><strong>loyal</strong> - Stamkund (true/false)</li>
                  </ul>
                </div>
                
                <Divider />
                
                <div>
                  <h4 className="font-medium">Format för ärendefiler</h4>
                  <p className="text-sm text-default-500 mb-2">
                    Filen bör innehålla följande fält:
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1 text-default-500">
                    <li><strong>title</strong> - Ärendets titel</li>
                    <li><strong>description</strong> - Ärendebeskrivning</li>
                    <li><strong>status</strong> - Ärendestatus (OPEN, IN_PROGRESS, etc.)</li>
                    <li><strong>dueDate</strong> - Deadline (YYYY-MM-DD)</li>
                    <li><strong>customerEmail</strong> - Kopplar ärendet till en befintlig kund via e-post (obligatoriskt)</li>
                  </ul>
                </div>
                
                <Divider />
                
                <div>
                  <h4 className="font-medium">Tips för lyckad import</h4>
                  <ul className="list-disc list-inside text-sm space-y-1 text-default-500">
                    <li>Vid import av ärenden måste kunderna redan finnas i systemet</li>
                    <li>Kontrollera fältmappningen noggrant innan du startar importen</li>
                    <li>För stora datamängder, dela upp data i mindre filer</li>
                    <li>Datum bör vara i formatet YYYY-MM-DD eller MM/DD/YYYY</li>
                    <li>Boolean-värden (true/false) kan också anges som 1/0, yes/no, eller ja/nej</li>
                  </ul>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
      
      {/* === EXPORT === */}
      {activeTab === 'export' && (
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-medium">Exportera data</h3>
              <p className="text-default-500 text-sm">
                Exportera data från systemet i olika format för säkerhetskopiering eller migrering.
              </p>
            </CardHeader>
            <CardBody>
              <div className="space-y-6">
                {/* Steg 1: Välj data att exportera */}
                <div>
                  <h4 className="font-medium mb-2">1. Välj vad du vill exportera</h4>
                  <div className="flex gap-4">
                    <Button
                      variant={exportTarget === 'all' ? 'solid' : 'flat'}
                      color={exportTarget === 'all' ? 'primary' : 'default'}
                      onPress={() => setExportTarget('all')}
                    >
                      All data
                    </Button>
                    <Button
                      variant={exportTarget === 'customers' ? 'solid' : 'flat'}
                      color={exportTarget === 'customers' ? 'primary' : 'default'}
                      onPress={() => setExportTarget('customers')}
                    >
                      Kunder
                    </Button>
                    <Button
                      variant={exportTarget === 'tickets' ? 'solid' : 'flat'}
                      color={exportTarget === 'tickets' ? 'primary' : 'default'}
                      onPress={() => setExportTarget('tickets')}
                    >
                      Ärenden
                    </Button>
                  </div>
                </div>
                
                {/* Steg 2: Välj exportformat */}
                <div>
                  <h4 className="font-medium mb-2">2. Välj exportformat</h4>
                  <div className="flex gap-4">
                    <Button
                      variant={exportType === 'csv' ? 'solid' : 'flat'}
                      color={exportType === 'csv' ? 'primary' : 'default'}
                      onPress={() => setExportType('csv')}
                    >
                      CSV
                    </Button>
                    <Button
                      variant={exportType === 'excel' ? 'solid' : 'flat'}
                      color={exportType === 'excel' ? 'primary' : 'default'}
                      onPress={() => setExportType('excel')}
                    >
                      Excel
                    </Button>
                    <Button
                      variant={exportType === 'json' ? 'solid' : 'flat'}
                      color={exportType === 'json' ? 'primary' : 'default'}
                      onPress={() => setExportType('json')}
                    >
                      JSON
                    </Button>
                  </div>
                </div>
                
                {/* Steg 3: Inställningar */}
                <div>
                  <h4 className="font-medium mb-2">3. Inställningar</h4>
                  <div className="flex flex-col gap-2">
                    <Checkbox
                      isSelected={includeRelations}
                      onValueChange={setIncludeRelations}
                    >
                      Inkludera relationer (kunder med tillhörande ärenden)
                    </Checkbox>
                  </div>
                </div>
                
                {/* Exportstatus */}
                {exportStatus === 'loading' && (
                  <div className="flex justify-center">
                    <Spinner size="sm" color="primary" />
                    <span className="ml-2">Förbereder export...</span>
                  </div>
                )}
                
                {exportStatus === 'success' && (
                  <div className="text-center text-success">
                    Exporten slutfördes! Filen har laddats ner.
                  </div>
                )}
                
                {exportStatus === 'error' && (
                  <div className="text-center text-danger">
                    Ett fel inträffade. Försök igen.
                  </div>
                )}
                
                {/* Exportknapp */}
                <div className="flex justify-end">
                  <Button 
                    color="primary"
                    isLoading={exportStatus === 'loading'}
                    isDisabled={exportStatus === 'loading'}
                    onPress={handleExport}
                  >
                    Exportera data
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
          
          {/* Exportinformation */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-medium">Exportinformation</h3>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">Exportformat</h4>
                  <div className="space-y-2 mt-2">
                    <div className="p-2 bg-default-100 rounded-md">
                      <h5 className="font-medium">CSV</h5>
                      <p className="text-sm text-default-500">
                        Kommaseparerade värden som kan öppnas i Excel eller Google Sheets.
                        Bra för dataanalys eller import till andra system.
                      </p>
                    </div>
                    
                    <div className="p-2 bg-default-100 rounded-md">
                      <h5 className="font-medium">Excel</h5>
                      <p className="text-sm text-default-500">
                        Microsoft Excel-format (.xlsx) som bevarar formateringar och datatyper.
                        Bäst för användare som vill arbeta med data i Excel.
                      </p>
                    </div>
                    
                    <div className="p-2 bg-default-100 rounded-md">
                      <h5 className="font-medium">JSON</h5>
                      <p className="text-sm text-default-500">
                        Strukturerat dataformat som används för dataöverföring mellan system.
                        Bäst för utvecklare eller för import till andra system.
                      </p>
                    </div>
                  </div>
                </div>
                
                <Divider />
                
                <div>
                  <h4 className="font-medium">Inkluderad data</h4>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="font-medium min-w-24">Kunder:</div>
                      <div className="text-sm text-default-500">
                        All kundinformation inklusive namn, kontaktuppgifter och anpassade fält
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <div className="font-medium min-w-24">Ärenden:</div>
                      <div className="text-sm text-default-500">
                        Ärendeinformation inklusive status, deadline, och kundkopplingar
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <div className="font-medium min-w-24">All data:</div>
                      <div className="text-sm text-default-500">
                        Både kunder och ärenden med relationer mellan dem
                      </div>
                    </div>
                  </div>
                </div>
                
                <Divider />
                
                <div>
                  <h4 className="font-medium">Tips för export</h4>
                  <ul className="list-disc list-inside text-sm space-y-1 text-default-500 mt-2">
                    <li>Exportera regelbundet för att skapa säkerhetskopior av din data</li>
                    <li>Exportera i alla tre format om du är osäker på vilket som behövs</li>
                    <li>För stora databaser kan exporten ta längre tid att slutföra</li>
                    <li>Exporterade filer kan innehålla känslig kundinformation - hantera dem säkert</li>
                  </ul>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
      
      {/* === FIELD MAPPING MODAL === */}
      <Modal
        isOpen={showMappingModal}
        onOpenChange={setShowMappingModal}
        scrollBehavior="inside"
        size="3xl"
      >
        <ModalContent>
          <ModalHeader>
            <h2 className="text-xl font-bold">Fältmappning</h2>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <p className="text-default-500">
                Mappa källfält från din fil till motsvarande fält i systemet. 
                Vi har försökt göra automatiska mappningar men du bör kontrollera dem noga.
              </p>
              
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
                        {previewData.map((row, rowIndex) => (
                          <TableRow key={rowIndex}>
                            {Object.keys(previewData[0]).map((key) => (
                              <TableCell key={key}>
                                {row[key] !== null && row[key] !== undefined ? String(row[key]) : '-'}
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
                <h3 className="font-medium mb-2">Fältmappning</h3>
                <Table aria-label="Field mapping">
                  <TableHeader>
                    <TableColumn>Källfält</TableColumn>
                    <TableColumn>Målfält</TableColumn>
                    <TableColumn>Exempel</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {availableFields.map((field) => {
                      // Hämta exempelvärde från första raden i data
                      const exampleValue = previewData && previewData.length > 0 
                        ? previewData[0][field] !== null && previewData[0][field] !== undefined 
                          ? String(previewData[0][field]) 
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
                                  className="w-full justify-start"
                                >
                                  {fieldMapping[field] || 'Välj målfält'}
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
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button 
              variant="flat" 
              onPress={() => setShowMappingModal(false)}
            >
              Avbryt
            </Button>
            <Button 
              color="primary" 
              onPress={() => setShowMappingModal(false)}
            >
              Spara mappning
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default ImportExportManager;