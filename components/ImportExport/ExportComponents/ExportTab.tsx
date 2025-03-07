import React, { useState } from 'react';
import { 
  Card, 
  CardHeader, 
  CardBody, 
  Button, 
  Spinner,
  addToast
} from '@heroui/react';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';

// Importera delkomponenter
import ExportOptions from './ExportOptions';
import ExportStatusIndicator from './ExportStatusIndicator';
import ExportInfo from './ExportInfo';

const ExportTab = () => {
  const [exportType, setExportType] = useState<'csv' | 'excel' | 'json'>('csv');
  const [exportTarget, setExportTarget] = useState<'customers' | 'tickets' | 'all'>('all');
  const [includeRelations, setIncludeRelations] = useState(true);
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

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
        // Konvertera till Excel med ExcelJS
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Data');
        
        // Lägg till rubriker om det finns data
        if (data.length > 0) {
          const headers = Object.keys(data[0]);
          worksheet.columns = headers.map(header => ({
            header,
            key: header,
            width: 20 // Standardbredd
          }));
          
          // Lägg till data
          worksheet.addRows(data);
          
          // Stil för rubriker
          worksheet.getRow(1).font = { bold: true };
          worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
          };
        }
        
        // Skapa en blob och ladda ner
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `servicedrive_export_${exportTarget}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        link.click();
        
        // Rensa URL-objektet
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 100);
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

  return (
    <>
      <Card>
        <CardHeader>
          <h3 className="text-lg font-medium">Exportera data</h3>
          <p className="text-default-500 text-sm">
            Exportera data från systemet i olika format för säkerhetskopiering eller migrering.
          </p>
        </CardHeader>
        <CardBody>
          <ExportOptions 
            exportTarget={exportTarget}
            setExportTarget={setExportTarget}
            exportType={exportType}
            setExportType={setExportType}
            includeRelations={includeRelations}
            setIncludeRelations={setIncludeRelations}
          />
          
          {/* Exportstatus */}
          <ExportStatusIndicator status={exportStatus} />
          
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
        </CardBody>
      </Card>

      {/* Information om export */}
      <ExportInfo />
    </>
  );
};

export default ExportTab;