import React, { useState, useMemo } from 'react';
import { Accordion, AccordionItem, Chip, Progress, Button, Card, CardBody, Divider } from '@heroui/react';

interface ImportSummaryProps {
  summary: {
    total: number;
    success: number;
    failed: number;
    errors: string[];
  };
}

const ImportSummary: React.FC<ImportSummaryProps> = ({ summary }) => {
  const [showAllErrors, setShowAllErrors] = useState(false);
  
  // Beräkna procent av lyckade/misslyckade
  const successPercent = Math.round((summary.success / summary.total) * 100);
  const failedPercent = Math.round((summary.failed / summary.total) * 100);
  
  // Få en lämplig färg baserat på resultatet
  const getStatusColor = () => {
    if (summary.failed === 0) return "success";
    if (summary.success === 0) return "danger";
    return "warning";
  };
  
  // Få en sammanfattningstext
  const getSummaryText = () => {
    if (summary.failed === 0) {
      return "Alla poster importerades framgångsrikt.";
    } else if (summary.success === 0) {
      return "Importen misslyckades helt. Kontrollera felmeddelanden nedan.";
    } else {
      return `${summary.success} av ${summary.total} poster importerades. ${summary.failed} misslyckades.`;
    }
  };
  
  // Gruppera och kategorisera fel
  const categorizedErrors = useMemo(() => {
    const errorCategories: Record<string, string[]> = {
      'validation': [],   // Valideringsfel
      'database': [],     // Databasfel
      'mapping': [],      // Mappningsfel
      'duplicate': [],    // Dubbletter
      'missing': [],      // Saknade fält/relationer
      'other': []         // Övrigt
    };
    
    summary.errors.forEach(error => {
      // Identifiera felkategori baserat på innehåll
      if (error.toLowerCase().includes('valider') || error.includes('schema')) {
        errorCategories.validation.push(error);
      } 
      else if (error.toLowerCase().includes('database') || error.includes('prisma')) {
        errorCategories.database.push(error);
      }
      else if (error.toLowerCase().includes('mapp') || error.includes('field')) {
        errorCategories.mapping.push(error);
      }
      else if (error.toLowerCase().includes('finns redan') || error.toLowerCase().includes('duplicate') || error.includes('P2002')) {
        errorCategories.duplicate.push(error);
      }
      else if (error.toLowerCase().includes('hitta') || error.toLowerCase().includes('saknas') || error.includes('not found')) {
        errorCategories.missing.push(error);
      }
      else {
        errorCategories.other.push(error);
      }
    });
    
    // Ta bort tomma kategorier
    const result: Record<string, string[]> = {};
    Object.entries(errorCategories).forEach(([category, errors]) => {
      if (errors.length > 0) {
        result[category] = errors;
      }
    });
    
    return result;
  }, [summary.errors]);
  
  // Förenkla felmeddelanden för presentation
  const simplifyErrorMessage = (error: string): string => {
    // Ta bort onödiga detaljer som stacktraces och tekniska detaljer
    let simplified = error;
    
    // Ta bort radnummer och batch-info
    simplified = simplified.replace(/^Batch \d+ \(rad \d+-\d+\): /, '');
    simplified = simplified.replace(/^Rad \d+: /, '');
    
    // Ta bort långa felkoder från Prisma
    if (simplified.includes('Invalid `prisma')) {
      simplified = simplified.split('\n')[0];
    }
    
    // Ta bort tekniska detaljer som stacktraces
    const stackIndex = simplified.indexOf('\n    at ');
    if (stackIndex !== -1) {
      simplified = simplified.substring(0, stackIndex);
    }
    
    return simplified;
  };
  
  // Visa bara de första 3 felen som standard i varje kategori
  const getDisplayErrors = (errors: string[], limit = 3) => {
    return showAllErrors 
      ? errors 
      : errors.slice(0, limit);
  };
  
  // Antalet kategorier med fel
  const categoryCount = Object.keys(categorizedErrors).length;

  return (
    <div className="mt-4 border rounded-md overflow-hidden">
      <div className="bg-default-50 p-4 border-b">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Importsammanfattning</h4>
          <Chip 
            color={getStatusColor()}
            variant="flat"
          >
            {getSummaryText()}
          </Chip>
        </div>
        
        <div className="mt-4">
          <Progress 
            value={successPercent}
            color={getStatusColor()}
            showValueLabel={true}
            label="Importerade"
            valueLabel={`${summary.success} av ${summary.total}`}
            className="mb-2"
          />
        </div>
      </div>
      
      <div className="p-4">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-2 bg-default-50 rounded-md">
            <p className="text-sm text-default-500">Totalt</p>
            <p className="text-xl font-semibold">{summary.total}</p>
          </div>
          <div className="text-center p-2 bg-success-50 rounded-md">
            <p className="text-sm text-success">Importerade</p>
            <p className="text-xl font-semibold text-success">{summary.success}</p>
          </div>
          <div className="text-center p-2 bg-danger-50 rounded-md">
            <p className="text-sm text-danger">Misslyckade</p>
            <p className="text-xl font-semibold text-danger">{summary.failed}</p>
          </div>
        </div>
        
        {summary.errors.length > 0 && (
          <>
            <h5 className="font-medium text-sm mb-2">Felkategorier</h5>
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(categorizedErrors).map(([category, errors]) => {
                let color: "danger" | "warning" | "primary" | "default";
                let label: string;
                
                switch (category) {
                  case 'validation':
                    color = "danger";
                    label = "Valideringsfel";
                    break;
                  case 'database':
                    color = "danger";
                    label = "Databasfel";
                    break;
                  case 'mapping':
                    color = "warning";
                    label = "Mappningsfel";
                    break;
                  case 'duplicate':
                    color = "primary";
                    label = "Dubblettkonflikter";
                    break;
                  case 'missing':
                    color = "warning";
                    label = "Saknade resurser";
                    break;
                  default:
                    color = "default";
                    label = "Övriga fel";
                }
                
                return (
                  <Chip 
                    key={category}
                    color={color}
                    variant="flat"
                  >
                    {label} ({errors.length})
                  </Chip>
                );
              })}
            </div>
            
            <Accordion variant="splitted" className="mb-2">
              {Object.entries(categorizedErrors).map(([category, errors]) => {
                let title: string;
                let description: string;
                let iconColor: string;
                
                switch (category) {
                  case 'validation':
                    title = "Valideringsfel";
                    description = "Data uppfyller inte kraven för import";
                    iconColor = "text-danger";
                    break;
                  case 'database':
                    title = "Databasfel";
                    description = "Problem uppstod vid sparande i databasen";
                    iconColor = "text-danger";
                    break;
                  case 'mapping':
                    title = "Mappningsfel";
                    description = "Problem med att mappa fält korrekt";
                    iconColor = "text-warning";
                    break;
                  case 'duplicate':
                    title = "Dubblettkonflikter";
                    description = "Data finns redan i systemet";
                    iconColor = "text-primary";
                    break;
                  case 'missing':
                    title = "Saknade resurser";
                    description = "Relaterade resurser kunde inte hittas";
                    iconColor = "text-warning";
                    break;
                  default:
                    title = "Övriga fel";
                    description = "Diverse problem med importen";
                    iconColor = "text-default-500";
                }
                
                return (
                  <AccordionItem 
                    key={category}
                    title={
                      <div className="flex items-center gap-2">
                        <span className={`text-lg ${iconColor}`}>
                          {category === 'validation' && '⚠'}
                          {category === 'database' && '⛔'}
                          {category === 'mapping' && '⚙️'}
                          {category === 'duplicate' && '🔄'}
                          {category === 'missing' && '🔍'}
                          {category === 'other' && 'ℹ️'}
                        </span>
                        <div>
                          <span className="font-medium">{title}</span>
                          <p className="text-xs text-default-500">{description}</p>
                        </div>
                        <Chip size="sm" variant="flat" className="ml-auto">
                          {errors.length} st
                        </Chip>
                      </div>
                    }
                  >
                    <Card className="mb-2">
                      <CardBody className="py-2 px-3">
                        <div className="max-h-60 overflow-y-auto text-xs">
                          {getDisplayErrors(errors).map((error, index) => (
                            <div key={index} className="mb-2 pb-2 border-b border-default-200 last:border-0">
                              <p className="text-danger-600">{simplifyErrorMessage(error)}</p>
                              {error.includes('dynamicFields') && (
                                <p className="text-xs text-default-500 mt-1">
                                  Tips: Kontrollera att dynamiska fält är korrekt formaterade
                                </p>
                              )}
                              {error.toLowerCase().includes('kunde inte hitta kund') && (
                                <p className="text-xs text-default-500 mt-1">
                                  Tips: Importera kunder innan du importerar ärenden
                                </p>
                              )}
                            </div>
                          ))}
                          
                          {errors.length > 3 && !showAllErrors && (
                            <Button 
                              size="sm" 
                              variant="flat" 
                              className="mt-2 w-full" 
                              onPress={() => setShowAllErrors(true)}
                            >
                              Visa alla {errors.length} fel
                            </Button>
                          )}
                        </div>
                      </CardBody>
                    </Card>
                  </AccordionItem>
                );
              })}
            </Accordion>
            
            <Divider className="my-3" />
            
            {/* Tips för att lösa vanliga fel */}
            <div className="text-xs text-default-500">
              <h5 className="font-medium text-sm mb-1">Vanliga lösningar:</h5>
              <ul className="list-disc list-inside space-y-1">
                <li>Valideringsfel - Kontrollera att data har rätt format och att obligatoriska fält finns med</li>
                <li>Dubblettkonflikter - E-postadresser måste vara unika per butik</li>
                <li>Saknade resurser - Kontrollera att alla ärenden är kopplade till befintliga kunder</li>
                <li>Dynamiska fält - Kontrollera att anpassade fält har rätt datatyp och format</li>
              </ul>
            </div>
            
            <div className="flex justify-end mt-4">
              <Button 
                size="sm" 
                variant="bordered" 
                color="primary"
                onPress={() => {
                  // Kopiera felmeddelanden till urklipp
                  const errorText = summary.errors.join('\n\n');
                  navigator.clipboard.writeText(errorText)
                    .then(() => alert('Felmeddelanden kopierade till urklipp'));
                }}
              >
                Kopiera alla felmeddelanden
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ImportSummary;