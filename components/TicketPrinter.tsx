import React, { useRef, useState } from 'react';
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Spinner } from '@heroui/react';
import { PrinterIcon } from '@/components/icons';

// Typdeklarationer
interface Customer {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  name?: string;
}

interface TicketType {
  name: string;
  fields: Array<{ name: string; fieldType: string }>;
}

export interface Ticket {
  id: number;
  status: string;
  createdAt: string;
  customer?: Customer;
  ticketType?: TicketType;
  dynamicFields: { [key: string]: any };
  dueDate?: string;
  customStatus?: {
    name: string;
    color: string;
  };
}

interface TicketPrinterProps {
  ticket: Ticket;
}

const TicketPrinter: React.FC<TicketPrinterProps> = ({ ticket }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);
  const [printers, setPrinters] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const printContentRef = useRef<HTMLDivElement>(null);

  // Funktion för att detektera tillgängliga kvittoskrivare
  const detectPrinters = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Här skulle vi normalt anropa ett API för att hämta skrivare
      // För demonstration simulerar vi med en timeout
      setTimeout(() => {
        // Simulerad lista med skrivare
        const mockPrinters = [
          'Kvittoskrivare (58mm)',
          'Kvittoskrivare (80mm)',
          'PDF-skrivare'
        ];
        setPrinters(mockPrinters);
        setSelectedPrinter(mockPrinters[0]);
        setLoading(false);
      }, 1000);
    } catch (err) {
      setError('Kunde inte hämta skrivare. Kontrollera att drivrutiner är installerade.');
      setLoading(false);
    }
  };

  // Öppna modal och detektera skrivare
  const handleOpenModal = () => {
    setIsModalOpen(true);
    detectPrinters();
  };

  // Formatera kundnamn
  const getCustomerName = () => {
    if (!ticket.customer) return 'Okänd kund';
    
    if (ticket.customer.firstName || ticket.customer.lastName) {
      const fullName = `${ticket.customer.firstName || ''} ${ticket.customer.lastName || ''}`.trim();
      if (fullName) return fullName;
    }
    
    if (ticket.customer.name) {
      return ticket.customer.name;
    }
    
    return ticket.customer.email || `Kund #${ticket.id}`;
  };

  // Formatera status
  const getStatusDisplay = () => {
    if (ticket.customStatus) {
      return ticket.customStatus.name;
    }
    
    const statusMap: Record<string, string> = {
      'OPEN': 'Öppen',
      'CLOSED': 'Stängd',
      'IN_PROGRESS': 'Pågående'
    };
    
    return statusMap[ticket.status] || ticket.status;
  };

  // Formatera datum
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('sv-SE');
    } catch (e) {
      return '-';
    }
  };

  // Hantera utskrift
  const handlePrint = async () => {
    if (!selectedPrinter) {
      setError('Ingen skrivare vald');
      return;
    }
    
    try {
      setLoading(true);
      
      // Först: Skicka till API för utskrift på kvittoskrivare
      if (selectedPrinter.includes('Kvittoskrivare')) {
        try {
          const response = await fetch('/api/tickets/print', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ticketId: ticket.id,
              printerName: selectedPrinter
            }),
          });
          
          const data = await response.json();
          
          if (response.ok) {
            setLoading(false);
            setIsModalOpen(false);
            return;
          } else {
            throw new Error(data.message || 'Kunde inte skriva ut till kvittoskrivare');
          }
        } catch (apiError) {
          console.error('API error:', apiError);
          // Fallback till browser utskrift om API fail
          setError('Fel vid skrivarkommunikation. Använder browser-utskrift istället.');
        }
      }
      
      // Fallback eller PDF-skrivare: använd browser utskrift
      if (printContentRef.current) {
        // Skapa en kopia av innehållet för utskrift
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <title>Utskrift - Ärende #${ticket.id}</title>
                <style>
                  body { 
                    font-family: monospace; 
                    width: 80mm;
                    margin: 0;
                    padding: 10px;
                    font-size: 12px;
                  }
                  .divider { 
                    border-top: 1px dashed #000;
                    margin: 10px 0;
                  }
                  .title {
                    text-align: center;
                    font-weight: bold;
                    font-size: 14px;
                    margin-bottom: 10px;
                  }
                  .field {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 5px;
                  }
                  .field-name {
                    font-weight: bold;
                  }
                  .section {
                    margin-bottom: 10px;
                  }
                  .center {
                    text-align: center;
                  }
                  @media print {
                    body {
                      width: 100%;
                    }
                  }
                </style>
              </head>
              <body>
                ${printContentRef.current.innerHTML}
              </body>
            </html>
          `);
          printWindow.document.close();
          
          // Vänta tills innehållet laddas, sedan skriv ut
          printWindow.onload = () => {
            printWindow.print();
            printWindow.close();
          };
        }
      }
      
      setLoading(false);
      setIsModalOpen(false);
    } catch (err) {
      setError('Ett fel uppstod vid utskrift. Försök igen.');
      setLoading(false);
    }
  };

  return (
    <>
      <Button 
        color="primary" 
        variant="flat" 
        startContent={<PrinterIcon />}
        onPress={handleOpenModal}
      >
        Skriv ut kvitto
      </Button>
      
      <Modal isOpen={isModalOpen} onOpenChange={setIsModalOpen}>
        <ModalContent>
          <ModalHeader>
            <h3 className="text-lg font-semibold">Skriv ut ärendekvitto</h3>
          </ModalHeader>
          
          <ModalBody>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Spinner />
                <p className="mt-4">Förbereder utskrift...</p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <p className="mb-2">Välj kvittoskrivare:</p>
                  <Dropdown>
                    <DropdownTrigger>
                      <Button 
                        variant="flat" 
                        className="w-full justify-between"
                      >
                        {selectedPrinter || 'Välj skrivare'}
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu 
                      aria-label="Välj skrivare" 
                      onAction={(key) => setSelectedPrinter(key as string)}
                      selectionMode="single"
                      selectedKeys={selectedPrinter ? [selectedPrinter] : []}
                    >
                      {printers.map((printer) => (
                        <DropdownItem key={printer}>{printer}</DropdownItem>
                      ))}
                    </DropdownMenu>
                  </Dropdown>
                </div>
                
                {error && (
                  <div className="bg-danger-50 border border-danger-100 text-danger-700 p-3 rounded-md mb-4">
                    {error}
                  </div>
                )}
                
                <div className="mt-4 p-4 border border-default-200 rounded-md bg-default-50">
                  <h4 className="font-medium mb-2">Förhandsgranskning:</h4>
                  
                  {/* Utskriftsinnehåll */}
                  <div 
                    ref={printContentRef} 
                    className="font-mono text-xs overflow-x-auto whitespace-pre-wrap"
                    style={{ maxWidth: '100%' }}
                  >
                    <div className="title">SERVICEDRIVE</div>
                    
                    <div className="divider"></div>
                    
                    <div className="title">ÄRENDE #{ticket.id}</div>
                    <div className="center">{ticket.ticketType?.name || 'Ingen ärendetyp'}</div>
                    <div className="divider"></div>
                    
                    <div className="section">
                      <div className="field">
                        <span className="field-name">Kund:</span>
                        <span>{getCustomerName()}</span>
                      </div>
                      
                      {ticket.customer?.phoneNumber && (
                        <div className="field">
                          <span className="field-name">Telefon:</span>
                          <span>{ticket.customer.phoneNumber}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="divider"></div>
                    
                    <div className="section">
                      
                      
                      {ticket.dueDate && (
                        <div className="field">
                          <span className="field-name">Deadline:</span>
                          <span>{formatDate(ticket.dueDate)}</span>
                        </div>
                      )}
                    </div>
                    
                    {ticket.ticketType?.fields && ticket.dynamicFields && (
                      <>
                        <div className="divider"></div>
                        <div className="section">
                          {ticket.ticketType.fields
                            .filter(field => field.fieldType !== "DUE_DATE" && 
                                            ticket.dynamicFields[field.name] !== undefined)
                            .map((field, index) => (
                              <div key={index} className="field">
                                <span className="field-name">{field.name}:</span>
                                <span>
                                  {field.fieldType === "DATE" 
                                    ? formatDate(ticket.dynamicFields[field.name]) 
                                    : String(ticket.dynamicFields[field.name])}
                                </span>
                              </div>
                            ))}
                        </div>
                      </>
                    )}
                    
                    <div className="divider"></div>
                    
                  </div>
                </div>
              </>
            )}
          </ModalBody>
          
          <ModalFooter>
            <Button 
              variant="flat" 
              onPress={() => setIsModalOpen(false)}
            >
              Avbryt
            </Button>
            <Button 
              color="primary"
              onPress={handlePrint}
              isDisabled={loading || !selectedPrinter}
            >
              Skriv ut
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default TicketPrinter;