// components/ImportExport/ExportComponents/ExportOptions.tsx
import React from 'react';
import { 
  RadioGroup, 
  Radio, 
  Checkbox, 
  Card, 
  CardBody
} from '@heroui/react';

interface ExportOptionsProps {
  exportTarget: 'customers' | 'tickets' | 'all';
  setExportTarget: (target: 'customers' | 'tickets' | 'all') => void;
  exportType: 'csv' | 'excel' | 'json';
  setExportType: (type: 'csv' | 'excel' | 'json') => void;
  includeRelations: boolean;
  setIncludeRelations: (include: boolean) => void;
}

const ExportOptions: React.FC<ExportOptionsProps> = ({
  exportTarget,
  setExportTarget,
  exportType,
  setExportType,
  includeRelations,
  setIncludeRelations
}) => {
  return (
    <div className="space-y-6">
      {/* Välj exportmål */}
      <div>
        <h4 className="font-medium mb-2">1. Välj vad du vill exportera</h4>
        <RadioGroup
          value={exportTarget}
          onValueChange={(value) => setExportTarget(value as 'customers' | 'tickets' | 'all')}
        >
          <div className="flex flex-wrap gap-4">
            <Radio value="all">Alla data</Radio>
            <Radio value="customers">Endast kunder</Radio>
            <Radio value="tickets">Endast ärenden</Radio>
          </div>
        </RadioGroup>
      </div>
      
      {/* Välj exportformat */}
      <div>
        <h4 className="font-medium mb-2">2. Välj exportformat</h4>
        <RadioGroup
          value={exportType}
          onValueChange={(value) => setExportType(value as 'csv' | 'excel' | 'json')}
        >
          <div className="flex flex-wrap gap-4">
            <Radio value="csv">CSV</Radio>
            <Radio value="excel">Excel</Radio>
            <Radio value="json">JSON</Radio>
          </div>
        </RadioGroup>
      </div>
      
      {/* Avancerade inställningar */}
      <div>
        <h4 className="font-medium mb-2">3. Inställningar</h4>
        <Card>
          <CardBody>
            <Checkbox
              isSelected={includeRelations}
              onValueChange={setIncludeRelations}
            >
              Inkludera relationer
              <p className="text-xs text-default-500 ml-6">
                T.ex. antal ärenden per kund, kundinformation för ärenden
              </p>
            </Checkbox>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default ExportOptions;