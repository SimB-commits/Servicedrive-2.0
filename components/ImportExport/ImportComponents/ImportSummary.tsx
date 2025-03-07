import React from 'react';

interface ImportSummaryProps {
  summary: {
    total: number;
    success: number;
    failed: number;
    errors: string[];
  };
}

const ImportSummary: React.FC<ImportSummaryProps> = ({ summary }) => {
  return (
    <div className="mt-4 p-4 border rounded-md bg-default-50">
      <h4 className="font-medium mb-2">Importsammanfattning</h4>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <p className="text-sm text-default-500">Totalt</p>
          <p className="text-xl font-semibold">{summary.total}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-success">Importerade</p>
          <p className="text-xl font-semibold text-success">{summary.success}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-danger">Misslyckade</p>
          <p className="text-xl font-semibold text-danger">{summary.failed}</p>
        </div>
      </div>
      
      {summary.errors.length > 0 && (
        <div className="mt-2">
          <p className="font-medium text-sm mb-1">Fel</p>
          <div className="max-h-32 overflow-y-auto text-xs bg-danger-50 p-2 rounded-md text-danger-700">
            {summary.errors.map((error, index) => (
              <p key={index}>{error}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportSummary;