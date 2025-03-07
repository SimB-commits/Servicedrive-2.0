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

  // Funktion för att förbereda data för export
  const prepareDataForExport = (data, type) => {
    // För kunder, förenkla och normalisera data för export
    if (type === 'customers') {
      return data.map(customer => ({
        id: customer.id,
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        email: customer.email || '',
        phoneNumber: customer.phoneNumber || '',
        address: customer.address || '',
        postalCode: customer.postalCode || '',
        city: customer.city || '',
        country: customer.country || '',
        dateOfBirth: customer.dateOfBirth ? new Date(customer.dateOfBirth).toISOString().split('T')[0] : '',
        newsletter: customer.newsletter ? 'Ja' : 'Nej',
        loyal: customer.loyal ? 'Ja' : 'Nej',
        createdAt: new Date(customer.createdAt).toLocaleDateString('sv-SE'),
        ...(customer.dynamicFields && typeof customer.dynamicFields === 'object' 
          ? Object.entries(customer.dynamicFields).reduce((acc, [key, value]) => {
              acc[`extra_${key}`] = value;
              return acc;
            }, {})
          : {})
      }));
    }
    // För ärenden, förenkla och normalisera data för export
    else if (type === 'tickets') {
      return data.map(ticket => ({
        id: ticket.id,
        title: ticket.title || '',
        description: ticket.description || '',
        status: ticket.status || (ticket.customStatus ? ticket.customStatus.name : ''),
        customerId: ticket.customerId,
        customerName: ticket.customer ? `${ticket.customer.firstName || ''} ${ticket.customer.lastName || ''}`.trim() : '',
        customerEmail: ticket.customer?.email || '',
        createdAt: new Date(ticket.createdAt).toLocaleDateString('sv-SE'),
        updatedAt: new Date(ticket.updatedAt).toLocaleDateString('sv-SE'),
        dueDate: ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString('sv-SE') : '',
        ticketType: ticket.ticketType?.name || '',
        ...(ticket.dynamicFields && typeof ticket.dynamicFields === 'object' 
          ? Object.entries(ticket.dynamicFields).reduce((acc, [key, value]) => {
              acc[`fält_${key}`] = value;
              return acc;
            }, {})
          : {})
      }));
    }
    
    return data;
  };

  // Funktion för att exportera data
  const handleExport = async () => {
    setExportStatus('loading');
    
    try {
      let customerData = [];
      let ticketData = [];
      
      // Hämta kunddata om vi exporterar kunder eller all data
      if (exportTarget === 'customers' || exportTarget === 'all') {
        const customersResponse = await fetch('/api/customers', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!customersResponse.ok) {
          throw new Error('Kunde inte hämta kunddata');
        }
        
        customerData = await customersResponse.json();
        customerData = prepareDataForExport(customerData, 'customers');
      }
      
      // Hämta ärendedata om vi exporterar ärenden eller all data
      if (exportTarget === 'tickets' || exportTarget === 'all') {
        // Användaren måste vara admin för att se alla ärenden
        const ticketsResponse = await fetch('/api/tickets', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!ticketsResponse.ok) {
          throw new Error('Kunde inte hämta ärendedata');
        }
        
        ticketData = await ticketsResponse.json();
        ticketData = prepareDataForExport(ticketData, 'tickets');
      }
      
      // Välj vilken data som ska exporteras baserat på valet
      let dataToExport;
      let fileName;
      
      if (exportTarget === 'customers') {
        dataToExport = customerData;
        fileName = `servicedrive_kunder_${new Date().toISOString().slice(0, 10)}`;
      } else if (exportTarget === 'tickets') {
        dataToExport = ticketData;
        fileName = `servicedrive_arenden_${new Date().toISOString().slice(0, 10)}`;
      } else {
        // För 'all' skapar vi två separata filer eller en fil med flikar/sheets (för Excel)
        if (exportType === 'excel') {
          // För Excel kan vi använda flera arbetsblade/sheets
          const workbook = new ExcelJS.Workbook();
          
          // Lägg till kunddata på ett blad
          if (customerData.length > 0) {
            const customerSheet = workbook.addWorksheet('Kunder');
            const customerHeaders = Object.keys(customerData[0]);
            
            customerSheet.columns = customerHeaders.map(header => ({
              header,
              key: header,
              width: 20
            }));
            
            customerSheet.addRows(customerData);
            customerSheet.getRow(1).font = { bold: true };
            customerSheet.getRow(1).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE0E0E0' }
            };
          }
          
          // Lägg till ärendedata på ett annat blad
          if (ticketData.length > 0) {
            const ticketSheet = workbook.addWorksheet('Ärenden');
            const ticketHeaders = Object.keys(ticketData[0]);
            
            ticketSheet.columns = ticketHeaders.map(header => ({
              header,
              key: header,
              width: 20
            }));
            
            ticketSheet.addRows(ticketData);
            ticketSheet.getRow(1).font = { bold: true };
            ticketSheet.getRow(1).fill = {
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
          link.download = `servicedrive_all_data_${new Date().toISOString().slice(0, 10)}.xlsx`;
          link.click();
          
          // Rensa URL-objektet
          setTimeout(() => {
            URL.revokeObjectURL(url);
          }, 100);
          
          setExportStatus('success');
          addToast({
            title: 'Export slutförd',
            description: 'Data exporterades framgångsrikt',
            color: 'success',
            variant: 'flat'
          });
          
          return; // Avsluta funktionen här för Excel med all data
        } else {
          // För CSV och JSON med all data, skapa två separata filer
          // Eller en kombinerad JSON-fil
          if (exportType === 'json') {
            dataToExport = {
              customers: customerData,
              tickets: ticketData
            };
            fileName = `servicedrive_all_data_${new Date().toISOString().slice(0, 10)}`;
          } else {
            // För CSV måste vi skapa två separata filer
            // Exportera kundfilen först
            if (customerData.length > 0) {
              const customerCsv = Papa.unparse(customerData);
              const customerBlob = new Blob([customerCsv], { type: 'text/csv;charset=utf-8;' });
              const customerUrl = URL.createObjectURL(customerBlob);
              const customerLink = document.createElement('a');
              customerLink.href = customerUrl;
              customerLink.download = `servicedrive_kunder_${new Date().toISOString().slice(0, 10)}.csv`;
              customerLink.click();
              
              // Rensa URL-objektet
              setTimeout(() => {
                URL.revokeObjectURL(customerUrl);
              }, 100);
            }
            
            // Exportera ärendefilen sedan
            if (ticketData.length > 0) {
              const ticketCsv = Papa.unparse(ticketData);
              const ticketBlob = new Blob([ticketCsv], { type: 'text/csv;charset=utf-8;' });
              const ticketUrl = URL.createObjectURL(ticketBlob);
              const ticketLink = document.createElement('a');
              ticketLink.href = ticketUrl;
              ticketLink.download = `servicedrive_arenden_${new Date().toISOString().slice(0, 10)}.csv`;
              ticketLink.click();
              
              // Rensa URL-objektet
              setTimeout(() => {
                URL.revokeObjectURL(ticketUrl);
              }, 100);
            }
            
            setExportStatus('success');
            addToast({
              title: 'Export slutförd',
              description: 'Data exporterades framgångsrikt',
              color: 'success',
              variant: 'flat'
            });
            
            return; // Avsluta funktionen här för CSV med all data
          }
        }
      }
      
      // Fortsätt med export av enskilda filer (customers eller tickets)
      if (exportType === 'csv') {
        // Konvertera till CSV med PapaParse
        const csv = Papa.unparse(dataToExport);
        
        // Skapa en nedladdningslänk
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.csv`;
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
        if (dataToExport.length > 0) {
          const headers = Object.keys(dataToExport[0]);
          worksheet.columns = headers.map(header => ({
            header,
            key: header,
            width: 20 // Standardbredd
          }));
          
          // Lägg till data
          worksheet.addRows(dataToExport);
          
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
        link.download = `${fileName}.xlsx`;
        link.click();
        
        // Rensa URL-objektet
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 100);
      } else if (exportType === 'json') {
        // Skapa en nedladdningslänk för JSON-data
        const json = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.json`;
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
        description: error.message || 'Kunde inte exportera data. Försök igen.',
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