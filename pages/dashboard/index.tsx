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

// Widget-typer definierade baserat på DashboardSettings
const widgetTypes = {
  active_tickets: "Aktiva ärenden",
  unread_messages: "Olästa meddelanden",
  due_this_week: "Kommande deadline",
  ticket_statistics: "Ärendestatistik",
  recent_customers: "Senaste kunder"
};

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [activeWidgets, setActiveWidgets] = useState([
    'active_tickets',
    'unread_messages',
    'due_this_week'
  ]);

  // Skapa mock-data för widgets
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Hämta ärendetyper
        const typesRes = await fetch('/api/tickets/types');
        const typesData = await typesRes.json();
        setTicketTypes(typesData);
        
        // Hämta ärenden
        const ticketsRes = await fetch('/api/tickets');
        const ticketsData = await ticketsRes.json();
        setTickets(ticketsData);
        
        // Hämta kunder
        const customersRes = await fetch('/api/customers');
        const customersData = await customersRes.json();
        setCustomers(customersData);
        
        setLoading(false);
      } catch (error) {
        console.error('Fel vid hämtning av data:', error);
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Funktion för att räkna antal aktiva ärenden per ärendetyp
  const countActiveTicketsByType = () => {
    const counts = {};
    ticketTypes.forEach(type => {
      counts[type.id] = 0;
    });
    
    tickets.forEach(ticket => {
      if (ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS') {
        if (counts[ticket.ticketTypeId] !== undefined) {
          counts[ticket.ticketTypeId]++;
        }
      }
    });
    
    return Object.entries(counts).map(([id, count]) => ({
      id: Number(id),
      name: ticketTypes.find(t => t.id === Number(id))?.name || 'Okänd',
      count
    }));
  };

  // Funktion för att filtrera ärenden med kommande deadline denna vecka
  const getDueThisWeek = () => {
    const today = new Date();
    const endOfWeek = new Date();
    endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
    
    return tickets.filter(ticket => {
      // Filtrera bort ärenden som redan är avslutade
      if (ticket.status === 'CLOSED') return false;
      
      // Filtrera bort ärenden där anpassad status kan betyda att ärendet är avslutat
      if (ticket.customStatus && ticket.customStatus.name.toLowerCase().includes('färdig')) return false;
      if (ticket.customStatus && ticket.customStatus.name.toLowerCase().includes('avslutad')) return false;
      
      // Kontrollera deadline
      if (!ticket.dueDate) return false;
      const dueDate = new Date(ticket.dueDate);
      return dueDate >= today && dueDate <= endOfWeek;
    });
  };

  // Funktion för att hämta kundnamn
  const getCustomerName = (customer) => {
    if (!customer) return 'Okänd kund';
    
    if (customer.firstName || customer.lastName) {
      return `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
    }
    
    return customer.email || `Kund #${customer.id}`;
  };

  // Widget: Aktiva ärenden
  const ActiveTicketsWidget = () => {
    const activeTickets = countActiveTicketsByType();
    
    return (
      <Card className="w-full">
        <CardHeader className="flex flex-col">
          <h2 className="text-lg font-semibold">{widgetTypes.active_tickets}</h2>
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
    const simulatedUnread = tickets
      .slice(0, Math.min(5, tickets.length))
      .map(ticket => ({
        id: ticket.id,
        title: `Ärende #${ticket.id}`,
        customer: ticket.customer ? getCustomerName(ticket.customer) : 'Okänd kund',
        time: '2 timmar sedan'
      }));
    
    return (
      <Card className="w-full">
        <CardHeader className="flex flex-col">
          <h2 className="text-lg font-semibold">{widgetTypes.unread_messages}</h2>
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
    const router = useRouter();
    
    // Funktion för att navigera direkt till den dedikerade ärendesidan
    const navigateToTicket = (ticketId) => {
      // Navigera direkt till den dedikerade ärendesidan
      router.push(`/arenden/${ticketId}`);
    };
    
    // Funktion för att hämta korrekt statusvisning
    const getStatusDisplay = (ticket) => {
      if (ticket.customStatus) {
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
      <Card className="w-full">
        <CardHeader className="flex flex-col">
          <h2 className="text-lg font-semibold">{widgetTypes.due_this_week}</h2>
          <p className="text-default-500 text-sm mt-1">Klicka på ett ärende för att se detaljer</p>
        </CardHeader>
        <CardBody>
          {dueTickets.length === 0 ? (
            <p className="text-center text-default-500">Inga ärenden med deadline denna vecka</p>
          ) : (
            <Table removeWrapper aria-label="Ärenden med deadline denna vecka" className="cursor-pointer">
              <TableHeader>
                <TableColumn>Ärende</TableColumn>
                <TableColumn>Kund</TableColumn>
                <TableColumn>Ärendetyp</TableColumn>
                <TableColumn>Status</TableColumn>
                <TableColumn>Deadline</TableColumn>
              </TableHeader>
              <TableBody>
                {dueTickets.slice(0, 5).map(ticket => {
                  const statusDisplay = getStatusDisplay(ticket);
                  return (
                    <TableRow 
                      key={ticket.id}
                      onClick={() => navigateToTicket(ticket.id)}
                      className="hover:bg-default-100 transition-colors"
                    >
                      <TableCell>#{ticket.id}</TableCell>
                      <TableCell>{ticket.customer ? getCustomerName(ticket.customer) : 'Okänd'}</TableCell>
                      <TableCell>{ticket.ticketType ? ticket.ticketType.name : 'Okänd'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: statusDisplay.color }} 
                          />
                          <span>{statusDisplay.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{new Date(ticket.dueDate).toLocaleDateString('sv-SE')}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          
          <div className="mt-4 text-sm text-default-600">
            <p className="flex justify-center">
              <Button 
                size="sm" 
                variant="flat" 
                color="primary"
                onPress={() => router.push('/arenden')}
              >
                Visa alla ärenden
              </Button>
            </p>
          </div>
        </CardBody>
      </Card>
    );
  };

  // Widget: Ärendestatistik
  const TicketStatisticsWidget = () => {
    // Beräkna statistik
    const totalTickets = tickets.length;
    const openTickets = tickets.filter(t => t.status === 'OPEN').length;
    const inProgressTickets = tickets.filter(t => t.status === 'IN_PROGRESS').length;
    const closedTickets = tickets.filter(t => t.status === 'CLOSED').length;
    
    const openPercentage = totalTickets > 0 ? (openTickets / totalTickets) * 100 : 0;
    const inProgressPercentage = totalTickets > 0 ? (inProgressTickets / totalTickets) * 100 : 0;
    const closedPercentage = totalTickets > 0 ? (closedTickets / totalTickets) * 100 : 0;
    
    return (
      <Card className="w-full">
        <CardHeader className="flex flex-col">
          <h2 className="text-lg font-semibold">{widgetTypes.ticket_statistics}</h2>
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
    const sortedCustomers = [...customers].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    return (
      <Card className="w-full">
        <CardHeader className="flex flex-col">
          <h2 className="text-lg font-semibold">{widgetTypes.recent_customers}</h2>
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
                {sortedCustomers.slice(0, 5).map(customer => (
                  <TableRow key={customer.id}>
                    <TableCell>{getCustomerName(customer)}</TableCell>
                    <TableCell>{customer.email}</TableCell>
                    <TableCell>{new Date(customer.createdAt).toLocaleDateString('sv-SE')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>
    );
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

  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="inline-block max-w-lg text-center mb-8">
        <h1 className={title({ size: 'sm' })}>Dashboard</h1>
        <p className="text-default-500 mt-2">Översikt över dina ärenden och kunder</p>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Visa widgets baserat på aktiva widgets */}
        {activeWidgets.includes('active_tickets') && (
          <div className="col-span-1">
            <ActiveTicketsWidget />
          </div>
        )}
        
        {activeWidgets.includes('unread_messages') && (
          <div className="col-span-1">
            <UnreadMessagesWidget />
          </div>
        )}
        
        {activeWidgets.includes('due_this_week') && (
          <div className="col-span-1">
            <DueThisWeekWidget />
          </div>
        )}
        
        {activeWidgets.includes('ticket_statistics') && (
          <div className="col-span-1">
            <TicketStatisticsWidget />
          </div>
        )}
        
        {activeWidgets.includes('recent_customers') && (
          <div className="col-span-1 md:col-span-2">
            <RecentCustomersWidget />
          </div>
        )}
      </div>
    </section>
  );
}