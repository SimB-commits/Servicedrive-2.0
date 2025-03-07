// components/ImportExport/ImportComponents/DataPreview.tsx
import React from 'react';
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from '@heroui/react';

interface DataPreviewProps {
  data: any[] | null;
  maxRows?: number;
}

const DataPreview: React.FC<DataPreviewProps> = ({ data, maxRows = 5 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center p-4 text-default-500">
        Ingen data att visa
      </div>
    );
  }

  // Begränsa antalet rader som visas
  const displayData = data.slice(0, maxRows);
  
  // Extrahera kolumnrubriker från första raden
  const columns = Object.keys(displayData[0]);

  return (
    <div>
      <h4 className="font-medium mb-2">Dataförhandsvisning</h4>
      <div className="overflow-x-auto">
        <Table aria-label="Data preview" className="text-xs">
          <TableHeader>
            {columns.map((column) => (
              <TableColumn key={column}>{column}</TableColumn>
            ))}
          </TableHeader>
          <TableBody>
            {displayData.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map((column) => (
                  <TableCell key={column}>
                    {row[column] !== null && row[column] !== undefined 
                      ? String(row[column]) 
                      : '-'}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data.length > maxRows && (
        <p className="text-xs text-default-500 mt-2">
          Visar {maxRows} av {data.length} rader.
        </p>
      )}
    </div>
  );
};

export default DataPreview;