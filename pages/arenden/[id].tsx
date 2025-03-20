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
import TicketPrinter from '@/components/TicketPrinter';
import { PrinterIcon } from '@/components/icons';

interface Ticket {
  customStatus: any;
  dueDate: any;
  id: number;
  status: string;
  createdAt: string;
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
  const [statusOptions, setStatusOptions] = useState<Array<{ name: string; uid: string; color?: string }>>([]);
  const [activeTab, setActiveTab] = useState('details');

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
          const defaultStatuses = [
            { name: "Öppen", uid: "OPEN", color: "#ff9500" },
            { name: "Färdig", uid: "CLOSED", color: "#3BAB48" },
            { name: "Pågående", uid: "IN_PROGRESS", color: "#ffa500" },
          ];
          
          // Mappa de dynamiska statusarna
          const dynamicStatuses = data.map((s: any) => ({ 
            ...s, 
            uid: `CUSTOM_${s.id}`,
            name: s.name,
            color: s.color
          }));
          
          const merged = [...defaultStatuses, ...dynamicStatuses];
          setStatusOptions(merged);
        }
      } catch (error) {
        console.error('Fel vid hämtning av statusar:', error);
      }
    };

    fetchStatuses();
  }, [session]);

  // Funktion för att uppdatera status
  const updateStatus = async (newStatus: string) => {
    if (!ticket || !id) return;

    try {
      console.log('Försöker uppdatera status till:', newStatus);
      
      // Skapa ett fullständigt payload för att behålla alla befintliga värden
      // men uppdatera status
      const payload = {
        // Behåll befintliga värden från ticket
        dynamicFields: ticket.dynamicFields,
        
        // För title/description: Använd befintliga värden om de finns
        title: ticket.title,
        
        // För dueDate: Se till att det är i rätt format eller null
        dueDate: ticket.dueDate,
        
        // Uppdatera status
        status: newStatus
      };
      
      // Debugging: Logga det fullständiga payload
      console.log('Skickar payload:', JSON.stringify(payload));

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
      console.log('Uppdaterat ärende:', updatedTicket);
      setTicket(updatedTicket);
      
      addToast({
        title: 'Status uppdaterad',
        description: 'Ärendets status har uppdaterats',
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
          
          {/* Här har vi nu knapparna, inklusive utskriftsfunktionen */}
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
                    onPress={() => updateStatus(option.uid)}
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
            
            {/* Utskriftskomponenten integrerad här */}
            <TicketPrinter ticket={ticket} />
            
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
      </div>
    </section>
  );
}