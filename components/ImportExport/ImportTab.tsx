import React, { useState, useRef, useEffect } from 'react';
import { 
  Card, 
  CardHeader, 
  CardBody, 
  Button, 
  Progress,
  addToast,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Select,
  SelectItem,
  Chip
} from '@heroui/react';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';

// Importera nya FieldMatcher
import { FieldMatcher } from '@/utils/field-matcher';

// Importera undermappar
import FileUploader from './ImportComponents/FileUploader';
import FieldMappingModal from './ImportComponents/FieldMappingModal';
import ImportSummary from './ImportComponents/ImportSummary';
import ImportOptions from './ImportComponents/ImportOptions';

// Importera hjälpfunktioner
import { 
  mapCustomerFields, 
  mapTicketFields, 
  detectFileType
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
  const [ticketTypes, setTicketTypes] = useState<any[]>([]);
  const [selectedTicketType, setSelectedTicketType] = useState<number | null>(null);
  const [importOptions, setImportOptions] = useState({
    skipExisting: true,
    updateExisting: false,
    includeAll: true,
    batchSize: 10
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Skapa en instans av FieldMatcher för att återanvända
  const fieldMatcher = useRef(new FieldMatcher());

  // Hämta de tillgängliga ärendetyperna när komponenten laddas
  useEffect(() => {
    // Hämta alla ärendetyper och deras fält
    const fetchAllTicketTypeFields = async () => {
      try {
        const response = await fetch('/api/tickets/types');
        if (response.ok) {
          const data = await response.json();
          setTicketTypes(data);
          if (data.length > 0 && !selectedTicketType) {
            setSelectedTicketType(data[0].id);
          }
          
          // Loggning
          console.log('Samtliga ärendetyper:', data);
        }
      } catch (error) {
        console.error('Fel vid hämtning av ärendetyper:', error);
      }
    };
  
    fetchAllTicketTypeFields();
  }, []);

  // Hämta tillgängliga fält baserat på importmål
  useEffect(() => {
    if (importTarget === 'customers') {
      setTargetFields([
        'externalId',
        'firstName', 'lastName', 'email', 'phoneNumber', 'address', 
        'postalCode', 'city', 'country', 'dateOfBirth', 'newsletter', 'loyal',
        'dynamicFields' // För anpassade kundfält
      ]);
    } else {
      const baseFields = [
        'title', 'description', 'status', 'dueDate', 
        'customerEmail', 'customer_external_id',
        'ticketTypeId', 'ticketTypeName', 'priority', 'dynamicFields',
        'createdAt', 'updatedAt'
      ];
  
      // Samla in ALLA dynamiska fält från ALLA ärendetyper
      const allDynamicFields = new Set<string>();
      
      ticketTypes.forEach(ticketType => {
        if (ticketType.fields && Array.isArray(ticketType.fields)) {
          ticketType.fields.forEach(field => {
            if (field.name) {
              // Normalisera namnet för att hantera specialtecken och ha en konsekvent namngivning
              const normalizedName = field.name
                .replace(/[^\w\sÅÄÖåäö]/g, '')  // Ta bort specialtecken men behåll svenska bokstäver
                .trim()
                .replace(/\s+/g, '_');          // Ersätt mellanslag med understreck
                
              allDynamicFields.add(normalizedName);
              
              // Lägg även till originalnamnets variant
              allDynamicFields.add(field.name);
            }
          });
        }
      });
      
      // Logga alla dynamiska fält för felsökning
      console.log('Alla dynamiska fält från ärendetyper:', Array.from(allDynamicFields));
      
      // Lägg till alla dynamiska fält med field_-prefix
      allDynamicFields.forEach(fieldName => {
        if (!fieldName.startsWith('field_')) {
          baseFields.push(`field_${fieldName}`);
        } else {
          baseFields.push(fieldName);
        }
      });
      
      // Logga alla targetFields för felsökning
      console.log('Tillgängliga målfält:', baseFields);
      
      setTargetFields(baseFields);
    }
  }, [importTarget, ticketTypes]);

  const logMappingStatus = () => {
    console.log("Aktuell fältmappning:", fieldMapping);
    
    // Kontrollera om några viktiga fält saknas i mappningen
    const mappedFields = Object.values(fieldMapping).filter(Boolean);
    
    const missingImportantFields = [];
    if (importTarget === 'tickets') {
      if (!mappedFields.includes('customerEmail')) {
        missingImportantFields.push('customerEmail');
      }
    } else {
      if (!mappedFields.includes('email')) {
        missingImportantFields.push('email');
      }
    }
    
    if (missingImportantFields.length > 0) {
      console.warn("Viktiga fält saknas i mappningen:", missingImportantFields);
    }
    
    // Kontrollera om dynamiska fält saknas
    const dynamicTargetFields = targetFields.filter(field => field.startsWith('field_'));
    const mappedDynamicFields = dynamicTargetFields.filter(field => mappedFields.includes(field));
    
    console.log("Dynamiska fält i targetFields:", dynamicTargetFields);
    console.log("Mappade dynamiska fält:", mappedDynamicFields);
    
    if (dynamicTargetFields.length > mappedDynamicFields.length) {
      console.warn("Inte alla dynamiska fält är mappade.");
    }
  };
  
  // Funktion för autodetektering av datatyp baserat på kolumninnehåll
  const detectDataTypeFromColumns = (data: any[]): 'customers' | 'tickets' => {
    if (!data || data.length === 0) return importTarget;

    // Hämta kolumnnamnen från första raden
    const columns = Object.keys(data[0]);
    
    // Poängsättning för att avgöra datatyp
    let customerScore = 0;
    let ticketScore = 0;
    
    // Kontrollera vanliga kolumnnamn för kunder
    const customerColumns = ['email', 'firstname', 'lastname', 'phone', 'address', 'city', 'postal'];
    const ticketColumns = ['title', 'description', 'status', 'customeremail', 'duedate', 'tickettype'];
    
    // Räkna poäng baserat på kolumnnamn
    columns.forEach(col => {
      const normalizedCol = col.toLowerCase();
      
      // Kontrollera kundfält
      for (const customerCol of customerColumns) {
        if (normalizedCol.includes(customerCol)) {
          customerScore += 1;
          break;
        }
      }
      
      // Kontrollera ärendefält
      for (const ticketCol of ticketColumns) {
        if (normalizedCol.includes(ticketCol)) {
          ticketScore += 1;
          break;
        }
      }
      
      // Ge extra poäng för field_ prefix för ärenden
      if (normalizedCol.startsWith('field_')) {
        ticketScore += 0.5;
      }
    });
    
    console.log(`Datatyp-detektion: kundscore ${customerScore}, ärendescore ${ticketScore}`);
    
    // Returnera den datatyp som fick högst poäng
    return customerScore > ticketScore ? 'customers' : 'tickets';
  };

  

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
          let headers: string[] = [];
          
          if (type === 'csv') {
            // Parsa CSV med PapaParse med förbättrade inställningar
            const result = Papa.parse(event.target?.result as string, {
              header: true,
              skipEmptyLines: true,
              dynamicTyping: true,
              // Förbättrad hantering av CSV-format
              transformHeader: (header) => {
                // Behåll originalrubriken inklusive versaler/gemener och specialtecken
                return header.trim();
              },
              // Gissa olika avskiljare för att hantera både komma, semikolon och tab
              delimitersToGuess: [',', ';', '\t', '|'],
            });
            
            data = result.data;
            headers = result.meta.fields || [];
            
            // Loggning för felsökning
            console.log('CSV headers:', headers);
            console.log('First row of data:', data[0]);
            
            setAvailableFields(headers);
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
            headers = [];
            
            // Extrahera rubriker (första raden)
            worksheet.getRow(1).eachCell((cell, colNumber) => {
              // Behåll originalrubriken inklusive versaler/gemener och specialtecken
              const headerText = cell.value?.toString().trim() || `Column${colNumber}`;
              headers[colNumber - 1] = headerText;
            });
            
            console.log('Excel headers:', headers);
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
            
            console.log('First row of Excel data:', data[0]);
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
              headers = Object.keys(data[0]);
              setAvailableFields(headers);
            }
            
            console.log('JSON headers:', headers);
            console.log('First row of JSON data:', data[0]);
          }

          // Om data lästes framgångsrikt
          if (data.length > 0) {
            setFileData(data);
            setPreviewData(data.slice(0, 5)); // Visa de första 5 raderna som förhandsvisning
            
            // Automatiskt upptäcka om detta är kund- eller ärendedata
            const detectedDataType = detectDataTypeFromColumns(data);
            if (detectedDataType !== importTarget) {
              console.log(`Automatisk detektion av datatyp: ${detectedDataType}`);
              setImportTarget(detectedDataType);
            }
            
            // Använd FieldMatcher för att skapa en automatisk mapping
            const autoMapping = fieldMatcher.current.createMapping(
              headers, 
              targetFields, 
              importTarget
            );
            
            console.log('Automatisk fältmapping:', autoMapping);
            setFieldMapping(autoMapping);
            
            // Öppna mappningsmodalen automatiskt
            setShowMappingModal(true);
          } else {
            addToast({
              title: 'Varning',
              description: 'Ingen data hittades i filen. Kontrollera att filen innehåller giltiga data.',
              color: 'warning',
              variant: 'flat'
            });
          }
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

  useEffect(() => {
    // När filer läses in och mappning skapas
    if (previewData && previewData.length > 0 && importTarget === 'tickets') {
      // Kontrollera ifall vi har hittat createdAt/updatedAt i datan
      const hasCreatedAtMapping = Object.values(fieldMapping).includes('createdAt');
      const hasUpdatedAtMapping = Object.values(fieldMapping).includes('updatedAt');
      
      if (hasCreatedAtMapping || hasUpdatedAtMapping) {
        // Visa notifiering om att originaldata för datum kommer att bevaras
        addToast({
          title: 'Originaldatum hittade',
          description: `Importerade ärenden kommer att behålla originaldata för ${
            hasCreatedAtMapping && hasUpdatedAtMapping 
              ? 'skapandedatum och uppdateringsdatum' 
              : hasCreatedAtMapping 
                ? 'skapandedatum' 
                : 'uppdateringsdatum'
          }.`,
          color: 'success',
          variant: 'flat'
        });
      }
    }
  }, [importTarget, fileData, previewData, fieldMapping]);

  // Uppdatera fältmappningen när användaren väljer ett fält
  const updateFieldMapping = (sourceField: string, targetField: string) => {
    setFieldMapping(prev => ({
      ...prev,
      [sourceField]: targetField
    }));
  };
  
  // Automatisk mappning med den nya FieldMatcher
  const autoMapRemainingFields = () => {
    // Hämta alla omappade källfält
    const unmappedSourceFields = availableFields.filter(sourceField => !fieldMapping[sourceField]);
    
    // Hämta alla omappade målfält
    const mappedTargetFields = Object.values(fieldMapping).filter(Boolean);
    const unmappedTargetFields = targetFields.filter(field => !mappedTargetFields.includes(field));
    
    // Använd FieldMatcher för att skapa mapping endast för de omappade fälten
    const partialMapping = fieldMatcher.current.createMapping(
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

  // Starta importprocessen
  const handleImport = async () => {
    logMappingStatus();
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
      // Förbered data för import baserat på importmål
      let mappedData;
      if (importTarget === 'customers') {
        mappedData = mapCustomerFields(fileData, fieldMapping);
      } else {
        // För ärenden, lägg till vald ärendetyp om den inte mappats
        mappedData = mapTicketFields(fileData, fieldMapping);
        
        if (selectedTicketType) {
          mappedData = mappedData.map(item => {
            if (!item.ticketTypeId) {
              return {
                ...item,
                ticketTypeId: selectedTicketType
              };
            }
            return item;
          });
        }
      }
  
      // Starta importen
      const results = {
        total: mappedData.length,
        success: 0,
        failed: 0,
        errors: [] as string[]
      };
  
      // Importera stegvis
      const batchSize = importOptions.batchSize;
      const totalBatches = Math.ceil(mappedData.length / batchSize);
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * batchSize;
        const end = Math.min(start + batchSize, mappedData.length);
        const batch = mappedData.slice(start, end);
        
        // Uppdatera framsteg
        setImportProgress(Math.round(((batchIndex) / totalBatches) * 100));
        
        try {
          // Välj API-endpoint baserat på importmål
          const endpoint = importTarget === 'customers' 
            ? '/api/import/customers' 
            : '/api/import/tickets';
          
          // Skicka BÅDA importalternativen explicit
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              data: batch,
              options: {
                skipExisting: importOptions.skipExisting,
                updateExisting: importOptions.updateExisting,
                includeAll: importOptions.includeAll
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
            results.errors.push(`Batch ${batchIndex + 1} (rad ${start+1}-${end}): ${error.message || 'Okänt fel'}`);
          }
        } catch (error) {
          console.error('Fel vid import av batch:', error);
          results.failed += batch.length;
          results.errors.push(`Batch ${batchIndex + 1} (rad ${start+1}-${end}): ${error instanceof Error ? error.message : 'Okänt fel'}`);
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
            
            {/* Visa ärendetypsväljare om import av ärenden är vald */}
            {importTarget === 'tickets' && (
              <div className="mt-4">
                <h5 className="text-sm font-medium mb-2">Välj ärendetyp för nya ärenden:</h5>
                <Select
                  className="max-w-xs"
                  selectedKeys={selectedTicketType ? [selectedTicketType.toString()] : []}
                  onChange={e => setSelectedTicketType(Number(e.target.value))}
                  size="sm"
                >
                  {ticketTypes.map((type) => (
                    <SelectItem key={type.id.toString()} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
                </Select>
                <p className="text-xs text-default-500 mt-1">
                  Denna ärendetyp används för ärenden som importeras utan specifik ärendetyp
                </p>
              </div>
            )}
          </div>
          
          {/* Importalternativ */}
          <div>
  <h4 className="font-medium mb-2">2. Alternativ</h4>
  
  {/* Ersätt befintliga alternativ med ImportOptions-komponenten */}
  <ImportOptions 
    importOptions={importOptions} 
    setImportOptions={setImportOptions}
    importTarget={importTarget}
  />
</div>
          
          {/* Steg 3: Ladda upp fil med FileUploader-komponenten */}
          <div>
            <h4 className="font-medium mb-2">3. Välj importfil</h4>
            <FileUploader
              fileInputRef={fileInputRef}
              importFile={importFile}
              fileType={fileType}
              onFileChange={handleFileChange}
            />
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
        importTarget={importTarget}
      />
    </Card>
  );
};

export default ImportTab;