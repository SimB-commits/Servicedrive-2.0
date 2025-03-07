import React, { useState, useRef, useEffect } from 'react';
import { 
  Card, 
  CardHeader, 
  CardBody, 
  Button, 
  Progress,
  addToast
} from '@heroui/react';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';

// Importera undermappar
import FileUploader from './ImportComponents/FileUploader';
import FieldMappingModal from './ImportComponents/FieldMappingModal';
import ImportSummary from './ImportComponents/ImportSummary';

// Importera hjälpfunktioner
import { 
  mapCustomerFields, 
  mapTicketFields, 
  detectFileType,
  validateImport,
  normalizeFieldName
} from '@/utils/import-export';

interface FieldMapping {
  [key: string]: string;
}

const ImportTab = () => {
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

  // Hämta tillgängliga fält baserat på importmål
  useEffect(() => {
    if (importTarget === 'customers') {
      setTargetFields([
        'firstName', 'lastName', 'email', 'phoneNumber', 'address', 
        'postalCode', 'city', 'country', 'dateOfBirth', 'newsletter', 'loyal'
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
            // Parsa Excel med ExcelJS
            const buffer = event.target?.result as ArrayBuffer;
            const workbook = new ExcelJS.Workbook();
            
            // ExcelJS arbetar med Promises
            const workbookData = await workbook.xlsx.load(buffer);
            
            // Använd första arbetsbladet
            const worksheet = workbook.worksheets[0];
            
            // Konvertera till JSON
            data = [];
            const headers: string[] = [];
            
            // Extrahera rubriker (första raden)
            worksheet.getRow(1).eachCell((cell, colNumber) => {
              headers[colNumber - 1] = cell.value?.toString() || `Column${colNumber}`;
            });
            
            setAvailableFields(headers);
            
            // Läs alla rader (börja från rad 2)
            worksheet.eachRow((row, rowNumber) => {
              if (rowNumber > 1) { // Skippa rubrikraden
                const rowData: Record<string, any> = {};
                row.eachCell((cell, colNumber) => {
                  // Hantera olika celltyper
                  let value = cell.value;
                  if (cell.type === ExcelJS.ValueType.Date) {
                    value = cell.value; // ExcelJS hanterar datum korrekt
                  }
                  rowData[headers[colNumber - 1]] = value;
                });
                data.push(rowData);
              }
            });
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
          
          if (availableFields.length > 0 && data.length > 0) {
            availableFields.forEach(sourceField => {
              // Normalisera fältnamnet för enklare matchning
              const normalizedField = normalizeFieldName(sourceField);
              
              // Hitta bästa matchning i targetFields
              let bestMatch = '';
              let bestMatchScore = 0;
              
              targetFields.forEach(targetField => {
                const normalizedTarget = normalizeFieldName(targetField);
                
                // Exakta matchningar
                if (
                  normalizedField === normalizedTarget ||
                  normalizedField === normalizedTarget.replace(/[^a-z0-9åäö]/g, '')
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
          }
          
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
        reader.readAsArrayBuffer(file); // ExcelJS använder ArrayBuffer istället för binary string
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
      // Förenklade valideringsregler - kräv bara e-post för kunder
      let validationPassed = true;
      let validationMessage = '';
      
      if (importTarget === 'customers') {
        // Kontrollera bara att e-post mappas för kunder
        const hasEmailMapping = Object.values(fieldMapping).includes('email');
        if (!hasEmailMapping) {
          validationPassed = false;
          validationMessage = 'E-postfält måste mappas för kundimport';
        }
      } else if (importTarget === 'tickets') {
        // För ärenden behöver vi mappning till kund-email
        const hasCustomerEmailMapping = Object.values(fieldMapping).includes('customerEmail');
        if (!hasCustomerEmailMapping) {
          validationPassed = false;
          validationMessage = 'Kundens e-post måste mappas för ärendeimport';
        }
      }
      
      if (!validationPassed) {
        addToast({
          title: 'Valideringsfel',
          description: validationMessage || 'Data kunde inte valideras.',
          color: 'danger',
          variant: 'flat'
        });
        setImportSummary({
          total: fileData.length,
          success: 0,
          failed: fileData.length,
          errors: [validationMessage || 'Okänt valideringsfel']
        });
        setLoading(false);
        return;
      }

      // Förberedd data för import
      const dataToImport = fileData.map(row => {
        // Mappa fält baserat på fältmappningen
        const mappedRow: Record<string, any> = {};
        
        // För kunder eller ärenden, lägg till dynamicFields-objekt
        if (importTarget === 'customers' || importTarget === 'tickets') {
          // Skapa tomt dynamicFields-objekt om det saknas
          mappedRow.dynamicFields = {};
        }
        
        // För kunder, sätt standardvärden för boolean-fält
        if (importTarget === 'customers') {
          // Sätt standardvärden för boolean-fält
          mappedRow.newsletter = false;
          mappedRow.loyal = false;
        }
        
        // Mappa alla fält som finns i mappningen
        for (const [sourceField, targetField] of Object.entries(fieldMapping)) {
          if (targetField && sourceField) {
            const value = row[sourceField];
            
            // Lägg till värdet i mappedRow om det finns
            if (value !== undefined && value !== null && value !== '') {
              mappedRow[targetField] = value;
            }
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
      const batchSize = 10; // Mindre batchstorlek för att undvika överbelastning
      const totalBatches = Math.ceil(dataToImport.length / batchSize);
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * batchSize;
        const end = Math.min(start + batchSize, dataToImport.length);
        const batch = dataToImport.slice(start, end);
        
        // Uppdatera framsteg
        setImportProgress(Math.round(((batchIndex) / totalBatches) * 100));
        
        try {
          // För varje post i batchen, skapa en egen POST-förfrågan
          // till våra specialanpassade import-API:er
          try {
            // Välj API-endpoint baserat på importmål
            const endpoint = importTarget === 'customers' 
              ? '/api/import/customers' 
              : '/api/import/tickets';
            
            // Skicka hela batchen för importering
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                data: batch,
                options: {
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
        } catch (error) {
          console.error('Fel vid import av batch:', error);
          results.failed += batch.length;
          results.errors.push(`Batch ${batchIndex + 1}: ${error instanceof Error ? error.message : 'Okänt fel'}`);
        }

        // Uppdatera framsteg efter varje batch
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
        description: error instanceof Error ? error.message : 'Ett fel uppstod under importprocessen.',
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

  return (
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
          
          {/* Steg 2: Ladda upp fil med FileUploader-komponenten */}
          <FileUploader
            fileInputRef={fileInputRef}
            importFile={importFile}
            fileType={fileType}
            onFileChange={handleFileChange}
          />
          
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
            <ImportSummary summary={importSummary} />
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

      {/* Modal för fältmappning */}
      <FieldMappingModal 
        isOpen={showMappingModal}
        onClose={() => setShowMappingModal(false)}
        availableFields={availableFields}
        targetFields={targetFields}
        fieldMapping={fieldMapping}
        updateFieldMapping={updateFieldMapping}
        previewData={previewData}
      />
    </Card>
  );
};

export default ImportTab;