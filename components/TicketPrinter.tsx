// components/TicketPrinter.tsx
import React, { useRef } from 'react';
import { Button } from '@heroui/react';

interface TicketPrinterProps {
  ticket: any;
  onClose?: () => void;
}

const TicketPrinter: React.FC<TicketPrinterProps> = ({ ticket, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);

  // Funktion för att hantera utskrift
  const handlePrint = () => {
    // Öppna en ny utskriftsvänlig popup-fönster
    const printWindow = window.open('', '_blank');
    
    if (!printWindow || !printRef.current) return;
    
    // Skapa innehållet för utskriften
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ärende #${ticket.id} - Utskrift</title>
          <meta charset="utf-8">
          <style>
            /* Grundläggande stilar */
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              color: #000;
              background-color: #fff;
            }
            
            .print-container {
              width: 100%;
              max-width: 100%;
              margin: 0 auto;
              padding: 20px;
              box-sizing: border-box;
            }
            
            /* Tabellstilar som säkerställer att text inte kapas */
            table {
              width: 100%;
              margin-bottom: 20px;
              table-layout: fixed; /* Viktigt! Fixerar kolumnbredd */
              border-collapse: collapse;
            }
            
            td, th {
              padding: 8px;
              text-align: left;
              vertical-align: top;
              border-bottom: 1px solid #ddd;
              /* Se till att text som är för lång bryts om till nästa rad */
              word-wrap: break-word;
              overflow-wrap: break-word;
            }
            
            th {
              width: 30%;
              font-weight: bold;
              background-color: #f8f8f8;
            }
            
            /* Rubrikstil */
            .print-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
            }
            
            .print-header h1 {
              margin: 0;
              font-size: 24px;
            }
            
            /* Skrivarspecifika justeringar */
            @media print {
              body {
                width: 100%;
                margin: 0;
                padding: 0;
              }
              
              /* Förhindra att innehåll kapas vid sidbrytningar */
              .page-break {
                page-break-after: always;
              }
              
              /* Viktig för att hantera marginaler vid utskrift */
              @page {
                size: A4;
                margin: 1cm;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div class="print-header">
              <h1>Ärende #${ticket.id}</h1>
              <div>${new Date().toLocaleDateString('sv-SE')}</div>
            </div>
            
            <h2>Kundinformation</h2>
            <table>
              <tr>
                <th>Kund</th>
                <td>${getCustomerName(ticket.customer)}</td>
              </tr>
              ${ticket.customer?.email ? `
              <tr>
                <th>E-post</th>
                <td>${ticket.customer.email}</td>
              </tr>` : ''}
              ${ticket.customer?.phoneNumber ? `
              <tr>
                <th>Telefon</th>
                <td>${ticket.customer.phoneNumber}</td>
              </tr>` : ''}
              ${ticket.customer?.address ? `
              <tr>
                <th>Adress</th>
                <td>${ticket.customer.address}${ticket.customer.postalCode ? ', ' + ticket.customer.postalCode : ''}${ticket.customer.city ? ', ' + ticket.customer.city : ''}</td>
              </tr>` : ''}
            </table>
            
            <h2>Ärendedetaljer</h2>
            <table>
              <tr>
                <th>Ärendetyp</th>
                <td>${ticket.ticketType?.name || '-'}</td>
              </tr>
              <tr>
                <th>Status</th>
                <td>${getStatusDisplay(ticket)}</td>
              </tr>
              
              ${ticket.dueDate ? `
              <tr>
                <th>Deadline</th>
                <td>${new Date(ticket.dueDate).toLocaleDateString('sv-SE')}</td>
              </tr>` : ''}
            </table>
            
            <h2>Ärendeinformation</h2>
            <table>
              ${renderDynamicFields(ticket)}
            </table>
            
            <div class="signature-area" style="margin-top: 40px;">
              <p style="border-top: 1px solid #000; padding-top: 10px; width: 200px; margin-top: 70px;">
                Signatur
              </p>
            </div>
          </div>
          
          <script>
            // Automatisk utskrift när sidan har laddats
            window.onload = function() {
              window.print();
              // Stänger fönstret efter utskrift om det stöds av webbläsaren
              // Fungerar ej i vissa webbläsare av säkerhetsskäl
              setTimeout(function() {
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;
    
    // Skriv innehållet till popup-fönstret
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
  };
  
  // Hjälpfunktion för att visa kundnamn
  const getCustomerName = (customer: any) => {
    if (!customer) return "-";
    
    if (customer.name) {
      return customer.name;
    }

    if (customer.firstName || customer.lastName) {
      const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
      if (fullName) return fullName;
    }

    if (customer.id) {
      return `Kund #${customer.id}`;
    }

    return "Okänd kund";
  };
  
  // Hjälpfunktion för att visa status
  const getStatusDisplay = (ticket: any) => {
    if (ticket.customStatus) {
      return ticket.customStatus.name;
    }
    
    const statusNames: Record<string, string> = {
      OPEN: 'Öppen',
      CLOSED: 'Färdig',
      IN_PROGRESS: 'Pågående',
      RESOLVED: 'Löst'
    };
    
    return statusNames[ticket.status] || ticket.status;
  };
  
  // Hjälpfunktion för att generera HTML för dynamiska fält
  const renderDynamicFields = (ticket: any) => {
    if (!ticket.ticketType?.fields || !ticket.dynamicFields) return '';
    
    return ticket.ticketType.fields
      .filter((field: any) => field.fieldType !== "DUE_DATE")
      .map((field: any) => {
        const value = ticket.dynamicFields[field.name];
        let displayValue = '-';
        
        if (value !== undefined && value !== null) {
          if (field.fieldType === "DATE" && value) {
            try {
              displayValue = new Date(value).toLocaleDateString("sv-SE");
            } catch (e) {
              displayValue = value;
            }
          } else {
            displayValue = String(value);
          }
        }
        
        return `
          <tr>
            <th>${field.name}</th>
            <td>${displayValue}</td>
          </tr>
        `;
      })
      .join('');
  };

  return (
    <div>
      {/* Förhandsgranskningsyta som vanligtvis är dold */}
      <div ref={printRef} style={{ display: 'none' }}>
        {/* Innehåll för förhandsgranskning - vi genererar HTML direkt i handlePrint istället */}
      </div>
      
      {/* Utskriftsknapp */}
      <div className="flex justify-center mt-4 space-x-4">
        <Button
          color="primary"
          onPress={handlePrint}
        >
          Skriv ut ärende
        </Button>
        
        {onClose && (
          <Button
            variant="flat"
            onPress={onClose}
          >
            Stäng
          </Button>
        )}
      </div>
    </div>
  );
};

export default TicketPrinter;