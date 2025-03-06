import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import {
  Card,
  CardBody,
  CardHeader,
  Spinner,
  Divider,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Progress,
  Button
} from '@heroui/react';
import { title } from '@/components/primitives';

// Local storage key för att lagra dashboard-inställningar
const DASHBOARD_SETTINGS_KEY = 'servicedrive_dashboard_settings';

// Standardwidgets om inga inställningar hittas
const defaultWidgets = [
  {
    id: 'active_tickets',
    name: 'Aktiva ärenden',
    description: 'Visar antal aktiva ärenden per ärendetyp',
    enabled: true,
    position: 1
  },
  {
    id: 'unread_messages',
    name: 'Olästa meddelanden',
    description: 'Visar antal olästa meddelanden från kunder',
    enabled: true,
    position: 2
  },
  {
    id: 'due_this_week',
    name: 'Kommande deadline',
    description: 'Ärenden som ska vara färdiga denna vecka',
    enabled: true,
    position: 3
  },
  {
    id: 'ticket_statistics',
    name: 'Ärendestatistik',
    description: 'Visar statistik över ärenden och genomsnittlig handläggningstid',
    enabled: true,
    position: 4
  },
  {
    id: 'recent_customers',
    name: 'Senaste kunder',
    description: 'Visar de senaste registrerade kunderna',
    enabled: true,
    position: 5
  }
];

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [activeWidgets, setActiveWidgets] = useState([]);
  const router = useRouter();

  // Ladda widgets-inställningar från localStorage (med felhantering)
  useEffect(() => {
    try {
      const savedWidgetsJson = localStorage.getItem(DASHBOARD_SETTINGS_KEY);
      if (savedWidgetsJson) {
        const savedWidgets = JSON.parse(savedWidgetsJson);
        // Filtrera ut endast aktiva widgets
        const enabledWidgetIds = savedWidgets
          .filter(widget => widget.enabled)
          .sort((a, b) => a.position - b.position)
          .map(widget => widget.id);
        
        setActiveWidgets(enabledWidgetIds);
      } else {
        // Om inga sparade inställningar finns, använd standardalternativen
        const enabledDefaultWidgets = defaultWidgets
          .filter(widget => widget.enabled)
          .map(widget => widget.id);
        
        setActiveWidgets(enabledDefaultWidgets);
      }
    } catch (error) {
      console.error('Fel vid inläsning av dashboard-inställningar:', error);
      // Vid fel, använd standardwidgets
      setActiveWidgets(['active_tickets', 'unread_messages', 'due_this_week']);
    }
  }, []);

  // Hämta data med förbättrad felhantering
  useEffect(() => {
    const fetchData = async () => {
      if (status !== 'authenticated') return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Hämta ärendetyper
        try {
          const typesRes = await fetch('/api/tickets/types');
          if (!typesRes.ok) {
            console.warn('Kunde inte hämta ärendetyper:', typesRes.statusText);
            setTicketTypes([]);
          } else {
            const typesData = await typesRes.json();
            setTicketTypes(Array.isArray(typesData) ? typesData : []);
          }
        } catch (e) {
          console.error('Fel vid hämtning av ärendetyper:', e);
          setTicketTypes([]);
        }
        
        // Hämta ärenden
        try {
          const ticketsRes = await fetch('/api/tickets');
          if (!ticketsRes.ok) {
            console.warn('Kunde inte hämta ärenden:', ticketsRes.statusText);
            setTickets([]);
          } else {
            const ticketsData = await ticketsRes.json();
            setTickets(Array.isArray(ticketsData) ? ticketsData : []);
          }
        } catch (e) {
          console.error('Fel vid hämtning av ärenden:', e);
          setTickets([]);
        }
        
        // Hämta kunder
        try {
          const customersRes = await fetch('/api/customers');
          if (!customersRes.ok) {
            console.warn('Kunde inte hämta kunder:', customersRes.statusText);
            setCustomers([]);
          } else {
            const customersData = await customersRes.json();
            setCustomers(Array.isArray(customersData) ? customersData : []);
          }
        } catch (e) {
          console.error('Fel vid hämtning av kunder:', e);
          setCustomers([]);
        }
      } catch (error) {
        console.error('Fel vid hämtning av data:', error);
        setError('Ett fel inträffade när data skulle hämtas.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [status]);

  // Säker funktion för att räkna antal aktiva ärenden per ärendetyp
  const countActiveTicketsByType = () => {
    if (!Array.isArray(tickets) || !Array.isArray(ticketTypes)) {
      return [];
    }
    
    const counts = {};
    ticketTypes.forEach(type => {
      if (type && type.id !== undefined) {
        counts[type.id] = 0;
      }
    });
    
    tickets.forEach(ticket => {
      if (!ticket) return;
      
      if ((ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS') 
          && ticket.ticketTypeId !== undefined 
          && counts[ticket.ticketTypeId] !== undefined) {
        counts[ticket.ticketTypeId]++;
      }
    });
    
    return Object.entries(counts).map(([id, count]) => ({
      id: Number(id),
      name: ticketTypes.find(t => t && t.id === Number(id))?.name || 'Okänd',
      count
    }));
  };

  // Säker funktion för att filtrera ärenden med kommande deadline denna vecka
  const getDueThisWeek = () => {
    if (!Array.isArray(tickets)) {
      return [];
    }
    
    const today = new Date();
    const endOfWeek = new Date();
    endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
    
    return tickets.filter(ticket => {
      if (!ticket) return false;
      
      // Filtrera bort ärenden som redan är avslutade
      if (ticket.status === 'CLOSED') return false;
      
      // Filtrera bort ärenden där anpassad status kan betyda att ärendet är avslutat
      if (ticket.customStatus && typeof ticket.customStatus.name === 'string' && 
          (ticket.customStatus.name.toLowerCase().includes('färdig') || 
           ticket.customStatus.name.toLowerCase().includes('avslutad'))) {
        return false;
      }
      
      // Kontrollera deadline
      if (!ticket.dueDate) return false;
      
      try {
        const dueDate = new Date(ticket.dueDate);
        return dueDate >= today && dueDate <= endOfWeek;
      } catch (e) {
        console.error('Fel vid datum-parsing:', e);
        return false;
      }
    });
  };

  // Säker funktion för att hämta kundnamn
  const getCustomerName = (customer) => {
    if (!customer) return 'Okänd kund';
    
    if (typeof customer.firstName === 'string' || typeof customer.lastName === 'string') {
      return `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Okänd kund';
    }
    
    if (typeof customer.email === 'string') {
      return customer.email;
    }
    
    if (customer.id !== undefined) {
      return `Kund #${customer.id}`;
    }
    
    return 'Okänd kund';
  };

  // Widget: Aktiva ärenden
  const ActiveTicketsWidget = () => {
    const activeTickets = countActiveTicketsByType();
    
    return (
      <Card className="w-full h-full">
        <CardHeader>
          <h2 className="text-lg font-semibold">Aktiva ärenden</h2>
        </CardHeader>
        <CardBody>
          {activeTickets.length === 0 ? (
            <p className="text-center text-default-500">Inga aktiva ärenden</p>
          ) : (
            <div className="space-y-3">
              {activeTickets.map(item => (
                <div key={item.id}>
                  <div className="flex justify-between mb-1">
                    <span>{item.name}</span>
                    <span className="font-medium">{item.count}</span>
                  </div>
                  <Progress 
                    value={item.count} 
                    maxValue={Math.max(10, item.count)} 
                    color="primary" 
                    size="sm"
                  />
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    );
  };

  // Widget: Olästa meddelanden
  const UnreadMessagesWidget = () => {
    // I en verklig implementation skulle vi hämta faktiska olästa meddelanden
    // För demo-syften simulerar vi slumpmässiga olästa meddelanden
    const simulatedUnread = (Array.isArray(tickets) ? tickets : [])
      .slice(0, Math.min(5, tickets.length))
      .map(ticket => ({
        id: ticket.id,
        title: `Ärende #${ticket.id}`,
        customer: ticket.customer ? getCustomerName(ticket.customer) : 'Okänd kund',
        time: '2 timmar sedan'
      }));
    
    return (
      <Card className="w-full h-full">
        <CardHeader>
          <h2 className="text-lg font-semibold">Olästa meddelanden</h2>
        </CardHeader>
        <CardBody>
          {simulatedUnread.length === 0 ? (
            <p className="text-center text-default-500">Inga olästa meddelanden</p>
          ) : (
            <div className="space-y-4">
              {simulatedUnread.map((message, index) => (
                <div key={message.id}>
                  {index > 0 && <Divider className="my-2" />}
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium">{message.title}</p>
                      <p className="text-sm text-default-500">{message.customer}</p>
                    </div>
                    <span className="text-xs text-default-400">{message.time}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    );
  };

  // Widget: Kommande deadline
  const DueThisWeekWidget = () => {
    const dueTickets = getDueThisWeek();
    
    // Funktion för att navigera direkt till den dedikerade ärendesidan
    const navigateToTicket = (ticketId) => {
      router.push(`/arenden/${ticketId}`);
    };
    
    // Funktion för att hämta korrekt statusvisning
    const getStatusDisplay = (ticket) => {
      if (!ticket) return { name: 'Okänd', color: '#cccccc' };
      
      if (ticket.customStatus && typeof ticket.customStatus.name === 'string') {
        return {
          name: ticket.customStatus.name,
          color: ticket.customStatus.color || '#cccccc'
        };
      }
      
      // Standardfärger och namn för grundstatusar
      const statusMap = {
        'OPEN': { name: 'Öppen', color: '#ff9500' },
        'CLOSED': { name: 'Färdig', color: '#3BAB48' },
        'IN_PROGRESS': { name: 'Pågående', color: '#ffa500' },
        'RESOLVED': { name: 'Löst', color: '#4da6ff' }
      };
      
      return statusMap[ticket.status] || { name: ticket.status || 'Okänd', color: '#cccccc' };
    };
    
    return (
      <Card className="w-full h-full">
        <CardHeader>
          <h2 className="text-lg font-semibold">Kommande deadline</h2>
        </CardHeader>
        <CardBody>
          {dueTickets.length === 0 ? (
            <p className="text-center text-default-500">Inga ärenden med deadline denna vecka</p>
          ) : (
            <Table 
              removeWrapper 
              aria-label="Ärenden med deadline denna vecka" 
              className="cursor-pointer"
            >
              <TableHeader>
                <TableColumn>Ärende</TableColumn>
                <TableColumn>Kund</TableColumn>
                <TableColumn>Status</TableColumn>
                <TableColumn>Deadline</TableColumn>
              </TableHeader>
              <TableBody>
                {dueTickets.slice(0, 5).map(ticket => {
                  if (!ticket || !ticket.id) return null;
                  
                  const statusDisplay = getStatusDisplay(ticket);
                  return (
                    <TableRow 
                      key={ticket.id}
                      onClick={() => navigateToTicket(ticket.id)}
                    >
                      <TableCell>#{ticket.id}</TableCell>
                      <TableCell>{ticket.customer ? getCustomerName(ticket.customer) : 'Okänd'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: statusDisplay.color }} 
                          />
                          <span>{statusDisplay.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString('sv-SE') : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          
          <div className="mt-4 text-center">
            <Button 
              size="sm" 
              variant="flat" 
              color="primary"
              onPress={() => router.push('/arenden')}
            >
              Visa alla ärenden
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  };

  // Widget: Ärendestatistik
  const TicketStatisticsWidget = () => {
    // Säkra beräkningar för statistik
    const totalTickets = Array.isArray(tickets) ? tickets.length : 0;
    const openTickets = Array.isArray(tickets) ? tickets.filter(t => t && t.status === 'OPEN').length : 0;
    const inProgressTickets = Array.isArray(tickets) ? tickets.filter(t => t && t.status === 'IN_PROGRESS').length : 0;
    const closedTickets = Array.isArray(tickets) ? tickets.filter(t => t && t.status === 'CLOSED').length : 0;
    
    const openPercentage = totalTickets > 0 ? (openTickets / totalTickets) * 100 : 0;
    const inProgressPercentage = totalTickets > 0 ? (inProgressTickets / totalTickets) * 100 : 0;
    const closedPercentage = totalTickets > 0 ? (closedTickets / totalTickets) * 100 : 0;
    
    return (
      <Card className="w-full h-full">
        <CardHeader>
          <h2 className="text-lg font-semibold">Ärendestatistik</h2>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span>Öppna ärenden</span>
                <span className="font-medium">{openTickets}</span>
              </div>
              <Progress value={openPercentage} color="warning" size="sm" />
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span>Pågående ärenden</span>
                <span className="font-medium">{inProgressTickets}</span>
              </div>
              <Progress value={inProgressPercentage} color="primary" size="sm" />
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span>Färdiga ärenden</span>
                <span className="font-medium">{closedTickets}</span>
              </div>
              <Progress value={closedPercentage} color="success" size="sm" />
            </div>
            
            <Divider className="my-2" />
            
            <div className="flex justify-between">
              <span>Totalt antal ärenden:</span>
              <span className="font-bold">{totalTickets}</span>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  };

  // Widget: Senaste kunder
  const RecentCustomersWidget = () => {
    // Sortera kunder efter senaste skapade
    const sortedCustomers = [...(Array.isArray(customers) ? customers : [])]
      .filter(customer => customer && customer.createdAt)
      .sort((a, b) => {
        try {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        } catch (e) {
          return 0;
        }
      });
    
    return (
      <Card className="w-full h-full">
        <CardHeader>
          <h2 className="text-lg font-semibold">Senaste kunder</h2>
        </CardHeader>
        <CardBody>
          {sortedCustomers.length === 0 ? (
            <p className="text-center text-default-500">Inga kunder att visa</p>
          ) : (
            <Table removeWrapper aria-label="Senaste kunder">
              <TableHeader>
                <TableColumn>Namn</TableColumn>
                <TableColumn>E-post</TableColumn>
                <TableColumn>Tillagd</TableColumn>
              </TableHeader>
              <TableBody>
                {sortedCustomers.slice(0, 5).map(customer => {
                  if (!customer || !customer.id) return null;
                  
                  return (
                    <TableRow key={customer.id}>
                      <TableCell>{getCustomerName(customer)}</TableCell>
                      <TableCell>{customer.email || '-'}</TableCell>
                      <TableCell>
                        {customer.createdAt 
                          ? new Date(customer.createdAt).toLocaleDateString('sv-SE')
                          : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>
    );
  };

  // Visa laddningskärm
  if (status === 'loading' || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <Spinner size="lg" color="primary" />
          <p className="mt-4">Laddar dashboard...</p>
        </div>
      </div>
    );
  }

  // Visa felmeddelande
  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <p className="text-danger mb-4">{error}</p>
          <Button color="primary" onPress={() => window.location.reload()}>
            Försök igen
          </Button>
        </div>
      </div>
    );
  }

  // Visa meddelande om användaren inte är inloggad
  if (!session) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div>Ingen session – vänligen logga in.</div>
      </section>
    );
  }

  // Funktion för att avgöra om en widget ska vara full bredd
  const isFullWidthWidget = (widgetId) => {
    return widgetId === 'recent_customers';
  };

  // Funktionen för att visa en widget baserat på dess ID
  const renderWidget = (widgetId) => {
    try {
      switch (widgetId) {
        case 'active_tickets':
          return <ActiveTicketsWidget />;
        case 'unread_messages':
          return <UnreadMessagesWidget />;
        case 'due_this_week':
          return <DueThisWeekWidget />;
        case 'ticket_statistics':
          return <TicketStatisticsWidget />;
        case 'recent_customers':
          return <RecentCustomersWidget />;
        default:
          console.warn(`Okänd widget: ${widgetId}`);
          return null;
      }
    } catch (error) {
      console.error(`Fel vid rendering av widget ${widgetId}:`, error);
      return (
        <Card className="w-full h-full">
          <CardHeader>
            <h2 className="text-lg font-semibold">Widget Error</h2>
          </CardHeader>
          <CardBody>
            <p className="text-danger">Det uppstod ett fel vid visning av denna widget.</p>
          </CardBody>
        </Card>
      );
    }
  };

  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="inline-block max-w-lg text-center mb-6">
        <h1 className={title({ size: 'sm' })}>Dashboard</h1>
        <p className="text-default-500 mt-2">Översikt över dina ärenden och kunder</p>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Visa widgets baserat på aktiva widgets */}
        {Array.isArray(activeWidgets) && activeWidgets.map((widgetId) => (
          <div 
            key={widgetId} 
            className={`col-span-1 ${isFullWidthWidget(widgetId) ? 'md:col-span-2' : ''}`}
          >
            {renderWidget(widgetId)}
          </div>
        ))}
        
        {/* Meddelande om inga widgets är aktiva */}
        {(!Array.isArray(activeWidgets) || activeWidgets.length === 0) && (
          <div className="col-span-1 md:col-span-2 text-center p-8">
            <p className="text-default-500 text-lg mb-4">Inga widgets är aktiverade</p>
            <Button 
              color="primary" 
              variant="flat" 
              onPress={() => window.location.href = '/installningar'}
            >
              Gå till inställningar
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}