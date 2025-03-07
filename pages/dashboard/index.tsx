import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import {
  Card,
  CardBody,
  Spinner,
  Button,
  Progress,
  Divider,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from '@heroui/react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { title } from "@/components/primitives";

// Färgschema för diagrammen
const COLORS = {
  primary: '#000000',
  success: '#3BAB48',
  warning: '#ff9500',
  danger: '#e57373',
  info: '#4da6ff',
  secondary: '#6c757d',
  background: '#f8f9fa',
  accent1: '#FFB457',
  accent2: '#6FEE8D',
  accent3: '#5EA2EF',
  accent4: '#E57373',
  accent5: '#d1c4e9'
};

// Funktion för att generera data för aktivitetsgrafen baserat på faktiska tickets
const generateActivityData = (tickets = [], days = 14) => {
  if (!Array.isArray(tickets) || tickets.length === 0) return [];
  
  const activityData = [];
  const now = new Date();
  
  // Skapa en map för att lagra datapunkter för varje dag
  const dataByDate = new Map();
  
  // Initialisera datastrukturen för alla dagar i perioden
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(now.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    dataByDate.set(dateStr, { date: dateStr, nya: 0, avslutade: 0 });
  }
  
  // Lägg till faktisk data från tickets
  tickets.forEach(ticket => {
    try {
      if (!ticket || !ticket.createdAt) return;
      
      const createdDate = new Date(ticket.createdAt).toISOString().split('T')[0];
      const updatedDate = ticket.status === 'CLOSED' && ticket.updatedAt ? 
        new Date(ticket.updatedAt).toISOString().split('T')[0] : null;
      
      // Kontrollera om datumet är inom vår period
      if (dataByDate.has(createdDate)) {
        const dayData = dataByDate.get(createdDate);
        dayData.nya += 1;
        dataByDate.set(createdDate, dayData);
      }
      
      if (updatedDate && dataByDate.has(updatedDate)) {
        const dayData = dataByDate.get(updatedDate);
        dayData.avslutade += 1;
        dataByDate.set(updatedDate, dayData);
      }
    } catch (error) {
      console.error('Fel vid bearbetning av ärende för aktivitetsgraf:', error);
    }
  });
  
  // Konvertera map till array för att användas i grafen
  return Array.from(dataByDate.values());
};

// Funktion för att generera prestandadata baserat på faktiska ärenden
const generatePerformanceData = (tickets = []) => {
  if (!Array.isArray(tickets) || tickets.length === 0) return [];
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
  const performanceData = [];
  
  // Dagens datum för att beräkna de senaste 6 månaderna
  const today = new Date();
  const currentMonth = today.getMonth();
  
  // Skapa data för de senaste 6 månaderna
  for (let i = 5; i >= 0; i--) {
    const monthIndex = (currentMonth - i + 12) % 12; // För att hantera årsskifte
    const year = today.getFullYear() - (currentMonth - i < 0 ? 1 : 0);
    
    // Filtrera ärenden för denna månad
    const monthTickets = tickets.filter(ticket => {
      if (!ticket || !ticket.createdAt) return false;
      const ticketDate = new Date(ticket.createdAt);
      return ticketDate.getMonth() === monthIndex && ticketDate.getFullYear() === year;
    });
    
    // Räkna färdiga ärenden
    const completedTickets = monthTickets.filter(ticket => ticket.status === 'CLOSED');
    
    // Beräkna genomsnittlig tid för att slutföra ett ärende (i dagar)
    let avgTime = 0;
    if (completedTickets.length > 0) {
      const totalDays = completedTickets.reduce((sum, ticket) => {
        const created = new Date(ticket.createdAt);
        const closed = new Date(ticket.updatedAt || ticket.createdAt);
        const diffTime = Math.abs(closed - created);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return sum + diffDays;
      }, 0);
      
      avgTime = parseFloat((totalDays / completedTickets.length).toFixed(1));
    }
    
    performanceData.push({
      name: monthNames[monthIndex],
      fardiga: completedTickets.length,
      tid: avgTime || 0,
    });
  }
  
  return performanceData;
};

export default function DashboardRedesign() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [activityData, setActivityData] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);
  
  // Hämta data när komponenten laddas
  useEffect(() => {
    const fetchData = async () => {
      if (status !== 'authenticated') return;
      
      try {
        setLoading(true);
        
        // Hämta ärendetyper
        try {
          const typesRes = await fetch('/api/tickets/types');
          if (!typesRes.ok) {
            console.warn('Kunde inte hämta ärendetyper:', typesRes.statusText);
          } else {
            const typesData = await typesRes.json();
            setTicketTypes(Array.isArray(typesData) ? typesData : []);
          }
        } catch (e) {
          console.error('Fel vid hämtning av ärendetyper:', e);
        }
        
        // Hämta ärenden
        try {
          const ticketsRes = await fetch('/api/tickets');
          if (!ticketsRes.ok) {
            console.warn('Kunde inte hämta ärenden:', ticketsRes.statusText);
          } else {
            const ticketsData = await ticketsRes.json();
            setTickets(Array.isArray(ticketsData) ? ticketsData : []);
          }
        } catch (e) {
          console.error('Fel vid hämtning av ärenden:', e);
        }
        
        // Hämta kunder
        try {
          const customersRes = await fetch('/api/customers');
          if (!customersRes.ok) {
            console.warn('Kunde inte hämta kunder:', customersRes.statusText);
          } else {
            const customersData = await customersRes.json();
            setCustomers(Array.isArray(customersData) ? customersData : []);
          }
        } catch (e) {
          console.error('Fel vid hämtning av kunder:', e);
        }
      } catch (error) {
        console.error('Fel vid hämtning av data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [status]);
  
  // Generera data för grafer när tickets ändras
  useEffect(() => {
    if (Array.isArray(tickets) && tickets.length > 0) {
      setActivityData(generateActivityData(tickets));
      setPerformanceData(generatePerformanceData(tickets));
    }
  }, [tickets]);
  
  // Räkna ärenden per status
  const countTicketsByStatus = () => {
    // För standardstatusar
    const standardCounts = {
      OPEN: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CLOSED: 0
    };
    
    // För anpassade statusar använder vi en Map för att kunna spåra varje unik status
    const customStatusCounts = new Map();
    
    if (!Array.isArray(tickets)) return [];
    
    tickets.forEach(ticket => {
      if (!ticket) return;
      
      if (ticket.customStatus) {
        // Hantera anpassade statusar
        const statusId = ticket.customStatus.id;
        const statusName = ticket.customStatus.name;
        const statusColor = ticket.customStatus.color || COLORS.accent1;
        
        if (customStatusCounts.has(statusId)) {
          const current = customStatusCounts.get(statusId);
          customStatusCounts.set(statusId, {
            ...current,
            value: current.value + 1
          });
        } else {
          customStatusCounts.set(statusId, {
            name: statusName,
            value: 1,
            color: statusColor
          });
        }
      } else if (ticket.status) {
        // Hantera standardstatusar
        if (standardCounts[ticket.status] !== undefined) {
          standardCounts[ticket.status]++;
        }
      }
    });
    
    // Kombinera standardstatusar och anpassade statusar
    const result = [
      { name: 'Öppna', value: standardCounts.OPEN, color: COLORS.warning },
      { name: 'Pågående', value: standardCounts.IN_PROGRESS, color: COLORS.info },
      { name: 'Lösta', value: standardCounts.RESOLVED, color: COLORS.secondary },
      { name: 'Avslutade', value: standardCounts.CLOSED, color: COLORS.success },
      // Lägg till alla anpassade statusar
      ...Array.from(customStatusCounts.values())
    ].filter(item => item.value > 0); // Filtrera bort statusar utan ärenden
    
    return result;
  };

  // Räkna ärenden per typ
  const countTicketsByType = () => {
    const counts = {};
    
    if (!Array.isArray(ticketTypes)) return [];
    
    ticketTypes.forEach(type => {
      if (type && type.id !== undefined) {
        counts[type.id] = 0;
      }
    });
    
    if (!Array.isArray(tickets)) return [];
    
    tickets.forEach(ticket => {
      if (!ticket || ticket.ticketTypeId === undefined) return;
      
      if (counts[ticket.ticketTypeId] !== undefined) {
        counts[ticket.ticketTypeId]++;
      }
    });
    
    return Object.entries(counts).map(([id, count]) => ({
      id: Number(id),
      name: ticketTypes.find(t => t && t.id === Number(id))?.name || 'Okänd',
      count,
      color: COLORS[`accent${Number(id) % 5 + 1}`]
    }));
  };
  
  // Få ärenden med kommande deadline den här veckan
  const getDueThisWeek = () => {
    if (!Array.isArray(tickets)) return [];
    
    const today = new Date();
    const endOfWeek = new Date();
    endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
    
    return tickets.filter(ticket => {
      if (!ticket || ticket.status === 'CLOSED') return false;
      if (!ticket.dueDate) return false;
      
      try {
        const dueDate = new Date(ticket.dueDate);
        return dueDate >= today && dueDate <= endOfWeek;
      } catch (e) {
        return false;
      }
    });
  };
  
  // Funktion för att hämta kundnamn
  const getCustomerName = (customer) => {
    if (!customer) return 'Okänd kund';
    
    if (typeof customer.firstName === 'string' || typeof customer.lastName === 'string') {
      return `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Okänd kund';
    }
    
    if (typeof customer.name === 'string' && customer.name.trim() !== '') {
      return customer.name;
    }
    
    if (typeof customer.email === 'string') {
      return customer.email;
    }
    
    if (customer.id !== undefined) {
      return `Kund #${customer.id}`;
    }
    
    return 'Okänd kund';
  };
  
  // Räkna ut framsteg
  const calculateProgress = () => {
    if (!Array.isArray(tickets)) return { totalTickets: 0, closedTickets: 0, percent: 0 };
    
    const totalTickets = tickets.length;
    const closedTickets = tickets.filter(t => t && t.status === 'CLOSED').length;
    
    return {
      totalTickets,
      closedTickets,
      percent: totalTickets > 0 ? Math.round((closedTickets / totalTickets) * 100) : 0
    };
  };
  
  // Beräkna data för statsen
  const statusData = countTicketsByStatus();
  const typeData = countTicketsByType();
  const dueTickets = getDueThisWeek();
  const progress = calculateProgress();
  const totalCustomers = Array.isArray(customers) ? customers.length : 0;
  
  // Senaste ärenden för aktivitet
  const recentTickets = Array.isArray(tickets) ? 
    [...tickets]
      .filter(ticket => ticket && ticket.createdAt)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5) 
    : [];
  
  // Visa laddningsskärm
  if (status === 'loading' || loading) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div className="text-center">
          <Spinner size="lg" color="primary" />
          <p className="mt-4">Laddar dashboard...</p>
        </div>
      </section>
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
  
  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="inline-block max-w-lg text-center mb-6">
        <h1 className={title({ size: 'sm' })}>Dashboard</h1>
      </div>
      
      <div className="w-full max-w-6xl mx-auto">
        {/* Hälsning och sammanfattning */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Hej {session.user.firstName}!</h1>
          <p className="text-xl text-default-600">
            Du har <span className="font-semibold">{dueTickets.length} ärenden</span> som behöver avslutas denna vecka 
            och <span className="font-semibold">{tickets.filter(t => t && t.status === 'OPEN').length} öppna ärenden</span> att hantera.
          </p>
        </div>
        
        {/* Överblick */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-none">
            <CardBody className="flex flex-col items-center justify-center py-6">
              <div className="text-4xl font-bold text-blue-600 mb-2">{tickets.length}</div>
              <div className="text-blue-800 font-medium">Totala ärenden</div>
            </CardBody>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-none">
            <CardBody className="flex flex-col items-center justify-center py-6">
              <div className="text-4xl font-bold text-green-600 mb-2">{tickets.filter(t => t && t.status === 'CLOSED').length}</div>
              <div className="text-green-800 font-medium">Avslutade ärenden</div>
            </CardBody>
          </Card>
          
          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-none">
            <CardBody className="flex flex-col items-center justify-center py-6">
              <div className="text-4xl font-bold text-yellow-600 mb-2">{tickets.filter(t => t && t.status === 'OPEN').length}</div>
              <div className="text-yellow-800 font-medium">Öppna ärenden</div>
            </CardBody>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-none">
            <CardBody className="flex flex-col items-center justify-center py-6">
              <div className="text-4xl font-bold text-purple-600 mb-2">{totalCustomers}</div>
              <div className="text-purple-800 font-medium">Totala kunder</div>
            </CardBody>
          </Card>
        </div>
        
        {/* Huvudinnehåll */}
        <div className="grid grid-cols-12 gap-6 mb-8">
          {/* Ärendeaktivitet - linjediagram */}
          <Card className="col-span-12 lg:col-span-8">
            <CardBody>
              <h2 className="text-xl font-semibold mb-4">Ärendeaktivitet - Senaste 14 dagarna</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={activityData}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="nya"
                      stroke={COLORS.warning}
                      activeDot={{ r: 8 }}
                      strokeWidth={2}
                      name="Nya ärenden"
                    />
                    <Line
                      type="monotone"
                      dataKey="avslutade"
                      stroke={COLORS.success}
                      strokeWidth={2}
                      name="Avslutade ärenden"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
          
          {/* Ärendestatus - cirkeldiagram */}
          <Card className="col-span-12 lg:col-span-4">
            <CardBody>
              <h2 className="text-xl font-semibold mb-4">Ärendestatus</h2>
              <div className="h-72 flex items-center justify-center">
                {statusData.length === 0 ? (
                  <p className="text-center text-default-500">Inga ärenden att visa</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, value, percent }) => 
                          `${Math.round(percent * 100)}%`
                        }
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [`${value} ärenden`, name]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardBody>
          </Card>
          
          {/* Ärenden per typ - tabellkort */}
          <Card className="col-span-12 lg:col-span-4">
            <CardBody>
              <h2 className="text-xl font-semibold mb-4">Ärenden per typ</h2>
              <div className="space-y-4">
                {typeData.length === 0 ? (
                  <p className="text-center text-default-500">Inga ärendetyper definierade</p>
                ) : (
                  typeData.map(item => (
                    <div key={item.id}>
                      <div className="flex justify-between mb-1">
                        <span className="font-medium">{item.name}</span>
                        <span>{item.count}</span>
                      </div>
                      <Progress 
                        value={item.count} 
                        maxValue={Math.max(10, item.count * 1.5)} 
                        size="sm"
                        classNames={{
                          indicator: `bg-gradient-to-r from-blue-500 to-blue-600`
                        }}
                      />
                    </div>
                  ))
                )}
              </div>
            </CardBody>
          </Card>
          
          {/* Prestanda - diagram */}
          <Card className="col-span-12 lg:col-span-8">
            <CardBody>
              <h2 className="text-xl font-semibold mb-4">Prestandaöversikt</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={performanceData}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" orientation="left" stroke={COLORS.success} />
                    <YAxis yAxisId="right" orientation="right" stroke={COLORS.primary} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="fardiga" name="Färdiga ärenden" fill={COLORS.success} />
                    <Line yAxisId="right" type="monotone" dataKey="tid" name="Genomsn. tid (dagar)" stroke={COLORS.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
          
          {/* Kommande deadlines */}
          <Card className="col-span-12 lg:col-span-6">
            <CardBody>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Kommande deadlines</h2>
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  onPress={() => router.push('/arenden')}
                >
                  Visa alla
                </Button>
              </div>
              {dueTickets.length === 0 ? (
                <div className="text-center py-6 text-default-500">
                  <p>Inga ärenden med deadline denna vecka</p>
                  <p className="text-sm mt-2">Bra jobbat!</p>
                </div>
              ) : (
                <Table 
                  removeWrapper 
                  aria-label="Ärenden med deadline denna vecka"
                  className="cursor-pointer"
                >
                  <TableHeader>
                    <TableColumn>ID</TableColumn>
                    <TableColumn>Kund</TableColumn>
                    <TableColumn>Deadline</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {dueTickets.slice(0, 5).map(ticket => (
                      <TableRow 
                        key={ticket.id}
                        onClick={() => router.push(`/arenden/${ticket.id}`)}
                      >
                        <TableCell>#{ticket.id}</TableCell>
                        <TableCell>{getCustomerName(ticket.customer)}</TableCell>
                        <TableCell>
                          <div className="text-danger font-medium">
                            {ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString('sv-SE') : '-'}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardBody>
          </Card>
          
          {/* Senaste aktivitet */}
          <Card className="col-span-12 lg:col-span-6">
            <CardBody>
              <h2 className="text-xl font-semibold mb-4">Senaste aktivitet</h2>
              {recentTickets.length === 0 ? (
                <p className="text-center text-default-500 py-6">Ingen aktivitet att visa</p>
              ) : (
                <div className="space-y-4">
                  {recentTickets.map((ticket, index) => (
                    <div key={ticket.id} className="cursor-pointer hover:bg-default-100 p-2 rounded-md transition-colors"
                      onClick={() => router.push(`/arenden/${ticket.id}`)}>
                      {index > 0 && <Divider className="my-3" />}
                      <div className="flex items-start">
                        <div className="bg-primary/10 text-primary p-2 rounded-full mr-3">
                          #{ticket.id}
                        </div>
                        <div>
                          <p className="font-medium">{ticket.ticketType?.name || 'Ärende'}</p>
                          <p className="text-sm text-default-500">
                            {ticket.customer ? getCustomerName(ticket.customer) : 'Okänd kund'} • {' '}
                            {new Date(ticket.createdAt).toLocaleDateString('sv-SE')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
        
        {/* Framsteg */}
        <Card className="mb-8">
          <CardBody>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold">Totalt framsteg</h2>
                <p className="text-default-500">
                  {progress.closedTickets} av {progress.totalTickets} ärenden avslutade
                </p>
              </div>
              <div className="text-3xl font-bold text-success">{progress.percent}%</div>
            </div>
            <Progress 
              value={progress.percent} 
              size="lg"
              classNames={{
                indicator: `bg-gradient-to-r from-blue-500 to-green-500`
              }}
            />
          </CardBody>
        </Card>
        
        {/* Snabbåtgärder */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Button 
            color="primary" 
            size="lg" 
            className="h-16 text-lg"
            onPress={() => router.push('/nytt-arende')}
          >
            Skapa nytt ärende
          </Button>
          <Button 
            color="secondary" 
            variant="flat" 
            size="lg" 
            className="h-16 text-lg"
            onPress={() => router.push('/kunder')}
          >
            Hantera kunder
          </Button>
          <Button 
            color="warning" 
            variant="flat" 
            size="lg" 
            className="h-16 text-lg"
            onPress={() => router.push('/installningar')}
          >
            Inställningar
          </Button>
        </div>
      </div>
    </section>
  );
}