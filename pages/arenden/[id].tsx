import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { 
  Card, 
  CardHeader, 
  CardBody, 
  Button, 
  Spinner, 
  Tabs, 
  Tab, 
  Divider, 
  Dropdown, 
  DropdownTrigger, 
  DropdownMenu, 
  DropdownItem,
  addToast
} from '@heroui/react';
import { title } from '@/components/primitives';
import { PrinterIcon } from '@/components/icons';
import StatusConfirmationDialog from '@/components/StatusConfirmationDialog';

interface Ticket {
  customStatus: any;
  dueDate: any;
  id: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  customer?: any;
  ticketType?: any;
  dynamicFields: { [key: string]: any };
  messages?: any[];
}

export default function TicketPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [statusOptions, setStatusOptions] = useState<Array<{ name: string; uid: string; color?: string; mailTemplateId?: number | null }>>([]);
  const [activeTab, setActiveTab] = useState('details');
  
  // State för statusbekräftelsedialogrutan
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<{ uid: string; name: string; color: string; mailTemplateId?: number | null } | null>(null);

  // Hämta ärende
  useEffect(() => {
    if (!id || !session) return;

    const fetchTicket = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/tickets/${id}`);
        if (!res.ok) {
          throw new Error('Kunde inte hämta ärende');
        }
        const data = await res.json();
        setTicket(data);
      } catch (error) {
        console.error('Fel vid hämtning av ärende:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();    
  }, [id, session]);

  // Hämta statusar
  useEffect(() => {
    if (!session) return;

    const fetchStatuses = async () => {
      try {
        const res = await fetch('/api/tickets/statuses');
        if (res.ok) {
          const data = await res.json();
          
          // Viktigt: Skapa defaultstatusarna med EXPLICIT mailTemplateId
          const defaultStatuses = [
            // Dessa måste ha explicit mailTemplateId för att korrekt funktionalitet
            { name: "Öppen", uid: "OPEN", color: "#ff9500", mailTemplateId: null },
            { name: "Färdig", uid: "CLOSED", color: "#3BAB48", mailTemplateId: null },
            { name: "Pågående", uid: "IN_PROGRESS", color: "#ffa500", mailTemplateId: null },
          ];
          
          // Mappa de dynamiska statusarna och säkerställ att mailTemplateId hanteras korrekt
          const dynamicStatuses = data.map((s) => {
            // Se till att mailTemplateId hanteras konsekvent
            let templateId = null;
            
            // Hantera olika möjliga dataformat från API
            if (s.mailTemplateId !== undefined) {
              templateId = s.mailTemplateId;
            } else if (s.mailTemplate && s.mailTemplate.id) {
              templateId = s.mailTemplate.id;
            }
            
            return { 
              ...s, 
              uid: `CUSTOM_${s.id}`,
              // Se till att mailTemplateId alltid finns, även om det är null
              mailTemplateId: templateId
            };
          });
          
          const merged = [...defaultStatuses, ...dynamicStatuses];
          setStatusOptions(merged);
        }
      } catch (error) {
        console.error('Fel vid hämtning av statusar:', error);
      }
    };

    fetchStatuses();
  }, [session]);

  // Visa bekräftelsedialog istället för att uppdatera direkt
  const handleStatusChange = (statusOption: any) => {
    console.log('Status vald:', statusOption, 'har mailTemplateId:', statusOption.mailTemplateId);
    setSelectedStatus(statusOption);
    setConfirmDialogOpen(true);
  };

  // Faktisk uppdatering av status efter bekräftelse
  const updateStatus = async (newStatus: string, sendEmail: boolean) => {
    if (!ticket || !id) return;

    try {
      console.log('Uppdaterar status till:', newStatus, 'Skicka mail:', sendEmail);
      
      // Skapa ett fullständigt payload för att behålla alla befintliga värden
      // men uppdatera status och mailNotification-flaggan
      const payload = {
        // Behåll befintliga värden från ticket
        dynamicFields: ticket.dynamicFields,
        
        // För title/description: Använd befintliga värden om de finns
        title: ticket.title,
        
        // För dueDate: Se till att det är i rätt format eller null
        dueDate: ticket.dueDate,
        
        // Uppdatera status
        status: newStatus,
        
        // Skicka med flaggan för om mail ska skickas eller inte
        sendNotification: sendEmail
      };

      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Försök läsa eventuella felmeddelanden från servern
        const errorData = await res.json().catch(() => ({}));
        console.error('Serverfel vid statusuppdatering:', errorData);
        throw new Error('Kunde inte uppdatera status: ' + (errorData.message || res.statusText));
      }

      const updatedTicket = await res.json();
      setTicket(updatedTicket);
      
      const statusMessage = sendEmail 
        ? 'Ärendets status har uppdaterats och mail har skickats till kunden'
        : 'Ärendets status har uppdaterats utan mailnotifiering';
      
      addToast({
        title: 'Status uppdaterad',
        description: statusMessage,
        color: 'success',
        variant: 'flat'
      });

    } catch (error) {
      console.error('Fel vid uppdatering av status:', error);
      addToast({
        title: 'Fel',
        description: error instanceof Error ? error.message : 'Kunde inte uppdatera status',
        color: 'danger',
        variant: 'flat'
      });
    }
  };

  // Funktion för att hämta korrekt visat statusnamn och färg
  const getStatusDisplay = () => {
    if (ticket?.customStatus) {
      return {
        name: ticket.customStatus.name,
        color: ticket.customStatus.color || '#cccccc'
      };
    }

    // Standardfärger och namn för grundstatusar
    const statusMap: Record<string, { name: string; color: string }> = {
      'OPEN': { name: 'Öppen', color: '#ff9500' },
      'CLOSED': { name: 'Färdig', color: '#3BAB48' },
      'IN_PROGRESS': { name: 'Pågående', color: '#ffa500' },
      'RESOLVED': { name: 'Löst', color: '#4da6ff' }
    };

    return statusMap[ticket?.status || ''] || { name: ticket?.status || 'Okänd', color: '#cccccc' };
  };

  // Funktion för att generera HTML för utskriftsfönstret
  const generatePrintContent = (ticket: Ticket) => {
    return `
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
                <td>${getCustomerDisplayName(ticket.customer)}</td>
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
                <td>${getStatusDisplay().name}</td>
              </tr>
              ${ticket.dueDate ? `
              <tr>
                <th>Deadline</th>
                <td>${new Date(ticket.dueDate).toLocaleDateString('sv-SE')}</td>
              </tr>` : ''}
            </table>
            
            <h2>Ärendeinformation</h2>
            <table>
              ${renderDynamicFieldsForPrint(ticket)}
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
  };

  // Hjälpfunktion för att generera HTML för de dynamiska fälten
  const renderDynamicFieldsForPrint = (ticket: Ticket) => {
    if (!ticket.ticketType?.fields || !ticket.dynamicFields) return '';
    
    return ticket.ticketType.fields
      .filter((field) => field.fieldType !== "DUE_DATE")
      .map((field) => {
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
  
  // Hjälpfunktion för att visa kundnamn
  const getCustomerDisplayName = (customer: any) => {
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

  // Funktion för att formatera kundinformation
  const getCustomerInfo = () => {
    if (!ticket?.customer) return 'Okänd kund';

    let customerName = '';
    if (ticket.customer.firstName || ticket.customer.lastName) {
      customerName = `${ticket.customer.firstName || ''} ${ticket.customer.lastName || ''}`.trim();
    } else if (ticket.customer.name) {
      // Bakåtkompatibilitet med äldre kundmodell
      customerName = ticket.customer.name;
    } else {
      customerName = ticket.customer.email || `Kund #${ticket.customer.id}`;
    }

    return {
      name: customerName,
      email: ticket.customer.email,
      phone: ticket.customer.phoneNumber,
      address: ticket.customer.address,
      postalCode: ticket.customer.postalCode,
      city: ticket.customer.city
    };
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div>Ingen session – vänligen logga in.</div>
      </section>
    );
  }

  if (!ticket) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div>Ärende hittades inte.</div>
        <Button onPress={() => router.push('/arenden')}>Tillbaka till ärendelistan</Button>
      </section>
    );
  }

  const statusDisplay = getStatusDisplay();
  const customerInfo = getCustomerInfo();

  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="w-full max-w-6xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className={title({ size: 'sm' })}>Ärende #{ticket.id}</h1>
            <p className="text-default-500 mt-1">
              {ticket.ticketType?.name} • Skapad {new Date(ticket.createdAt).toLocaleDateString('sv-SE')}
            </p>
          </div>
          
          {/* Knappar för åtgärder */}
          <div className="flex gap-3">
            <Dropdown>
              <DropdownTrigger>
                <Button variant="flat" style={{ backgroundColor: statusDisplay.color + '20', color: statusDisplay.color }}>
                  Status: {statusDisplay.name}
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Ändra status">
                {statusOptions.map((option) => (
                  <DropdownItem 
                    key={option.uid} 
                    onPress={() => handleStatusChange(option)}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: option.color || '#cccccc' }} 
                      />
                      {option.name}
                    </div>
                  </DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>
            
            {/* Utskriftsknapp - startar utskrift direkt */}
            <Button
              variant="flat"
              color="primary"
              onPress={() => {
                if (ticket) {
                  const printWindow = window.open('', '_blank');
                  if (printWindow) {
                    // Skapa innehållet för utskriftsfönstret
                    const printContent = generatePrintContent(ticket);
                    printWindow.document.open();
                    printWindow.document.write(printContent);
                    printWindow.document.close();
                  }
                }
              }}
              startContent={<PrinterIcon />}
            >
              Skriv ut
            </Button>
            
            <Button color="primary" variant="flat" onPress={() => router.push('/arenden')}>
              Tillbaka till ärendelistan
            </Button>
          </div>
        </div>

        <Tabs 
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as string)}
          variant="underlined"
          color="primary"
          className="mb-4"
        >
          <Tab key="details" title="Ärendedetaljer" />
          <Tab key="messages" title="Meddelanden" />
          <Tab key="history" title="Historik" />
        </Tabs>

        {activeTab === 'details' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Kundinformation */}
            <Card className="col-span-1">
              <CardHeader className="px-6 py-4">
                <h2 className="text-lg font-medium">Kundinformation</h2>
              </CardHeader>
              <CardBody className="px-6 py-4">
                <div className="space-y-2">
                  <p className="font-medium text-lg">{customerInfo.name}</p>
                  
                  {customerInfo.email && (
                    <p>
                      <span className="text-default-500">E-post:</span> {customerInfo.email}
                    </p>
                  )}
                  
                  {customerInfo.phone && (
                    <p>
                      <span className="text-default-500">Telefon:</span> {customerInfo.phone}
                    </p>
                  )}
                  
                  {customerInfo.address && (
                    <div className="mt-4">
                      <span className="text-default-500">Adress:</span>
                      <p>{customerInfo.address}</p>
                      <p>{customerInfo.postalCode} {customerInfo.city}</p>
                    </div>
                  )}
                </div>
                
                <Divider className="my-4" />
                
                <Button 
                  size="sm"
                  variant="flat"
                  color="primary"
                  className="w-full"
                  onPress={() => router.push(`/kunder?id=${ticket.customer?.id}`)}
                >
                  Visa kundprofil
                </Button>
              </CardBody>
            </Card>
            
            {/* Ärendeinformation */}
            <Card className="col-span-1 md:col-span-2">
              <CardHeader className="px-6 py-4 flex justify-between items-center">
                <h2 className="text-lg font-medium">Ärendeinformation</h2>
              </CardHeader>
              
              <CardBody className="px-6 py-4">
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-default-500">Ärendetyp</p>
                      <p className="font-medium">{ticket.ticketType?.name || 'Ej angiven'}</p>
                    </div>
                    
                    <div>
                      <p className="text-default-500">Status</p>
                      <p 
                        className="font-medium" 
                        style={{ color: statusDisplay.color }}
                      >
                        {statusDisplay.name}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-default-500">Deadline</p>
                      <p className="font-medium">
                        {ticket.dueDate 
                          ? new Date(ticket.dueDate).toLocaleDateString('sv-SE') 
                          : 'Ingen deadline'}
                      </p>
                    </div>
                  </div>
                  
                  <Divider />
                  
                  {/* Dynamiska fält */}
                  {ticket.ticketType?.fields && ticket.ticketType.fields.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {ticket.ticketType.fields
                        .filter((field) => field.fieldType !== "DUE_DATE")
                        .map((field) => (
                          <div key={field.name} className={field.name === 'Kommentar' ? 'col-span-2' : ''}>
                            <p className="text-default-500">{field.name}</p>
                            <p className="font-medium">
                              {ticket.dynamicFields && ticket.dynamicFields[field.name] !== undefined
                                ? field.fieldType === "DATE"
                                  ? new Date(ticket.dynamicFields[field.name]).toLocaleDateString("sv-SE")
                                  : String(ticket.dynamicFields[field.name])
                                : "-"}
                            </p>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-center text-default-500">Inga ärendefält</p>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {activeTab === 'messages' && (
          <Card>
            <CardHeader className="px-6 py-4">
              <h2 className="text-lg font-medium">Meddelanden</h2>
            </CardHeader>
            <CardBody className="px-6 py-4">
              {ticket.messages && ticket.messages.length > 0 ? (
                <div className="space-y-4">
                  {ticket.messages.map((message) => (
                    <div key={message.id} className="p-4 border rounded-md">
                      <div className="flex justify-between mb-2">
                        <span className="font-medium">
                          {message.sender?.email || `Användare ${message.senderId}`}
                        </span>
                        <span className="text-default-500 text-sm">
                          {new Date(message.createdAt).toLocaleDateString('sv-SE', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p>{message.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-default-500">Inga meddelanden ännu</p>
                  <Button
                    color="primary"
                    variant="flat"
                    className="mt-4"
                  >
                    Skicka meddelande till kund
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {activeTab === 'history' && (
          <Card>
            <CardHeader className="px-6 py-4">
              <h2 className="text-lg font-medium">Ärendehistorik</h2>
            </CardHeader>
            <CardBody className="px-6 py-4">
              <div className="space-y-6">
                <div className="flex items-center">
                  <div className="bg-success rounded-full w-4 h-4 mr-3"></div>
                  <div className="flex-1">
                    <p className="text-sm text-default-500">
                      {new Date(ticket.createdAt).toLocaleDateString('sv-SE', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    <p>Ärendet skapades</p>
                  </div>
                </div>
                
                {ticket.updatedAt !== ticket.createdAt && (
                  <div className="flex items-center">
                    <div className="bg-primary rounded-full w-4 h-4 mr-3"></div>
                    <div className="flex-1">
                      <p className="text-sm text-default-500">
                        {new Date(ticket.updatedAt).toLocaleDateString('sv-SE', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      <p>Ärendet uppdaterades senast</p>
                    </div>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        )}

        {/* StatusConfirmationDialog för att bekräfta statusändring */}
        <StatusConfirmationDialog
          isOpen={confirmDialogOpen}
          onClose={() => setConfirmDialogOpen(false)}
          onConfirm={(sendEmail) => {
            if (selectedStatus) {
              updateStatus(selectedStatus.uid, sendEmail);
              setConfirmDialogOpen(false);
            }
          }}
          statusName={selectedStatus?.name || ''}
          statusColor={selectedStatus?.color || '#000000'}
          ticketId={ticket.id}
          hasMailTemplate={Boolean(selectedStatus?.mailTemplateId)}
        />
      </div>
    </section>
  );
}