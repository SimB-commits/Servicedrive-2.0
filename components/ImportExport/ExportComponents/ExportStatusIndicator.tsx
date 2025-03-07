import React from 'react';
import { Spinner } from '@heroui/react';

interface ExportStatusIndicatorProps {
  status: 'idle' | 'loading' | 'success' | 'error';
}

const ExportStatusIndicator: React.FC<ExportStatusIndicatorProps> = ({ status }) => {
  if (status === 'idle') {
    return null;
  }

  return (
    <div className="my-4">
      {status === 'loading' && (
        <div className="flex justify-center">
          <Spinner size="sm" color="primary" />
          <span className="ml-2">Förbereder export...</span>
        </div>
      )}
      
      {status === 'success' && (
        <div className="text-center text-success">
          Exporten slutfördes! Filen har laddats ner.
        </div>
      )}
      
      {status === 'error' && (
        <div className="text-center text-danger">
          Ett fel inträffade. Försök igen.
        </div>
      )}
    </div>
  );
};

export default ExportStatusIndicator;