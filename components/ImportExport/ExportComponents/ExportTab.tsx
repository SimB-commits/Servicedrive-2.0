// components/ImportExport/ExportComponents/ExportTab.tsx
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Funktion för att exportera data
  const handleExport = async () => {
    setExportStatus('loading');
    setErrorMessage(null);
    
    try {
      // Använd det nya export-API:et
      const apiUrl = `/api/export?type=${exportTarget}&includeRelations=${includeRelations}&format=${exportType}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        // Hantera API-fel
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ett fel uppstod vid datahämtning');
      }
      
      // Hämta data från API:et
      const exportData = await response.json();
      
      // Kontrollera att vi faktiskt fick någon data
      if (!exportData || (Array.isArray(exportData) && exportData.length === 0) ||
          (exportTarget === 'all' && (!exportData.customers || !exportData.tickets))) {
        throw new Error('Ingen data hittades för export');
      }
      
      // Exportera data baserat på valt format
      if (exportType === 'csv') {
        // CSV-export
        if (exportTarget === 'all') {
          // Om vi exporterar 'all', skapa då två filer (en för kunder, en för ärenden)
          const customerCsv = Papa.unparse(exportData.customers || []);
          const ticketCsv = Papa.unparse(exportData.tickets || []);
          
          // Skapa länkar för båda filerna
          downloadBlob(customerCsv, 'text/csv;charset=utf-8;', `servicedrive_kunder_${getDateString()}.csv`);
          setTimeout(() => {
            downloadBlob(ticketCsv, 'text/csv;charset=utf-8;', `servicedrive_arenden_${getDateString()}.csv`);
          }, 100); // Kort fördröjning för att undvika att webbläsaren blockerar flera nedladdningar
        } else {
          // Annars, bara en fil för vald kategori
          const csv = Papa.unparse(exportData);
          const fileName = exportTarget === 'customers' 
            ? `servicedrive_kunder_${getDateString()}.csv` 
            : `servicedrive_arenden_${getDateString()}.csv`;
          
          downloadBlob(csv, 'text/csv;charset=utf-8;', fileName);
        }
      } 
      else if (exportType === 'excel') {
        // Excel-export
        const workbook = new ExcelJS.Workbook();
        
        if (exportTarget === 'all' || exportTarget === 'customers') {
          // Lägg till kunder i arbetsboken
          const customersData = exportTarget === 'all' ? exportData.customers : exportData;
          if (customersData && customersData.length > 0) {
            await addWorksheet(workbook, 'Kunder', customersData);
          }
        }
        
        if (exportTarget === 'all' || exportTarget === 'tickets') {
          // Lägg till ärenden i arbetsboken
          const ticketsData = exportTarget === 'all' ? exportData.tickets : exportData;
          if (ticketsData && ticketsData.length > 0) {
            await addWorksheet(workbook, 'Ärenden', ticketsData);
          }
        }
        
        // Skapa och ladda ner Excel-filen
        const buffer = await workbook.xlsx.writeBuffer();
        const fileName = exportTarget === 'all' 
          ? `servicedrive_all_data_${getDateString()}.xlsx` 
          : `servicedrive_${exportTarget === 'customers' ? 'kunder' : 'arenden'}_${getDateString()}.xlsx`;
        
        downloadBlob(buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileName);
      }
      else if (exportType === 'json') {
        // JSON-export
        const json = JSON.stringify(exportData, null, 2);
        const fileName = exportTarget === 'all' 
          ? `servicedrive_all_data_${getDateString()}.json` 
          : `servicedrive_${exportTarget === 'customers' ? 'kunder' : 'arenden'}_${getDateString()}.json`;
        
        downloadBlob(json, 'application/json', fileName);
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
      setErrorMessage(error instanceof Error ? error.message : 'Ett okänt fel uppstod');
      
      addToast({
        title: 'Export misslyckades',
        description: error instanceof Error ? error.message : 'Kunde inte exportera data. Försök igen.',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setTimeout(() => {
        setExportStatus('idle');
      }, 3000);
    }
  };

  // Hjälpfunktion för att ladda ner blob
  const downloadBlob = (content: string | ArrayBuffer, mimeType: string, fileName: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    
    // Rensa URL-objektet
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  };

  // Hjälpfunktion för att lägga till ett arbetsblad i Excel-arbetsboken
  const addWorksheet = async (workbook: ExcelJS.Workbook, name: string, data: any[]) => {
    if (!data || data.length === 0) return;
    
    const worksheet = workbook.addWorksheet(name);
    
    // Lägg till rubriker
    const headers = Object.keys(data[0]);
    worksheet.columns = headers.map(header => ({
      header,
      key: header,
      width: Math.min(30, Math.max(15, header.length * 1.5)) // Dynamisk bredd baserat på rubrikens längd
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
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    
    // Formatera datum och dylikt
    data.forEach((row, rowIndex) => {
      headers.forEach((header, colIndex) => {
        const cell = worksheet.getCell(rowIndex + 2, colIndex + 1);
        const value = row[header];
        
        if (typeof value === 'boolean') {
          // Formatera boolean som "Ja"/"Nej"
          cell.value = value ? 'Ja' : 'Nej';
        } 
        // Fler formateringsregler kan läggas till här
      });
    });
    
    // Frys översta raden
    worksheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }
    ];
  };

  // Hjälpfunktion för att få aktuellt datum på format YYYY-MM-DD
  const getDateString = () => {
    return new Date().toISOString().split('T')[0];
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
          <ExportStatusIndicator status={exportStatus} errorMessage={errorMessage} />
          
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