import React, { useState } from 'react';
import { Accordion, AccordionItem, Chip, Progress, Button } from '@heroui/react';

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
  
  // Gruppera liknande fel för tydlighet
  const groupSimilarErrors = () => {
    const errorGroups: Record<string, number> = {};
    
    summary.errors.forEach(error => {
      // Extrahera det grundläggande felet (utan radnummer, etc.)
      const basicError = error.replace(/^Batch \d+ \(rad \d+-\d+\): /, '')
                             .replace(/^Rad \d+: /, '');
      
      errorGroups[basicError] = (errorGroups[basicError] || 0) + 1;
    });
    
    return Object.entries(errorGroups).map(([error, count]) => ({
      error,
      count
    }));
  };
  
  // Gruppera liknande fel
  const errorGroups = groupSimilarErrors();
  
  // Visa bara de första 3 felen som standard
  const visibleErrors = showAllErrors 
    ? summary.errors 
    : summary.errors.slice(0, 3);

  return (
    <div className="mt-4 border rounded-md overflow-hidden">
      <div className="bg-default-50 p-4 border-b">
        <h4 className="font-medium">Importsammanfattning</h4>
        <p className="text-sm text-default-500">{getSummaryText()}</p>
        
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
            <h5 className="font-medium text-sm mb-2">Vanligaste felen</h5>
            <div className="flex flex-wrap gap-2 mb-4">
              {errorGroups.slice(0, 3).map((group, index) => (
                <Chip 
                  key={index}
                  color="danger"
                  variant="flat"
                >
                  {group.error} ({group.count})
                </Chip>
              ))}
            </div>
            
            <Accordion variant="light">
              <AccordionItem key="errors" title="Visa alla felmeddelanden">
                <div className="max-h-60 overflow-y-auto text-xs bg-danger-50 p-2 rounded-md text-danger-700">
                  {visibleErrors.map((error, index) => (
                    <p key={index} className="mb-1 pb-1 border-b border-danger-200 last:border-0">
                      {error}
                    </p>
                  ))}
                  
                  {summary.errors.length > 3 && !showAllErrors && (
                    <Button 
                      size="sm" 
                      variant="flat" 
                      className="mt-2" 
                      onPress={() => setShowAllErrors(true)}
                    >
                      Visa alla {summary.errors.length} fel
                    </Button>
                  )}
                </div>
              </AccordionItem>
            </Accordion>
          </>
        )}
      </div>
    </div>
  );
};

export default ImportSummary;