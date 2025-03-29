// pages/sok.tsx
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Card,
  CardBody,
  Button,
  Input,
  Spinner,
  Tabs,
  Tab,
  Divider,
} from '@heroui/react';
import { SearchIcon, EyeIcon } from '@/components/icons';
import { title } from '@/components/primitives';
import NextLink from 'next/link';

// Typningar för sökresultat
interface Customer {
  id: number;
  firstName?: string;
  lastName?: string;
  email: string;
  phoneNumber?: string;
}

interface Ticket {
  id: number;
  status?: string;
  customer?: Customer;
  ticketType?: {
    name: string;
  };
  customStatus?: {
    name: string;
    color: string;
  };
}

interface SettingResult {
  type: string;
  name: string;
  description: string;
  url: string;
}

interface SearchResults {
  customers: Customer[];
  tickets: Ticket[];
  settings: SettingResult[];
}

interface SearchResponse {
  query: string;
  results: SearchResults;
  totalCount: {
    customers: number;
    tickets: number;
    settings: number;
    total: number;
  };
}

export default function SearchPage() {
  const router = useRouter();
  const { q } = router.query;
  
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [totalCount, setTotalCount] = useState<Record<string, number>>({
    customers: 0,
    tickets: 0,
    settings: 0,
    total: 0
  });

  // Uppdatera sökfrågan när URL-parametern ändras
  useEffect(() => {
    if (q && typeof q === 'string') {
      setSearchQuery(q);
      performSearch(q);
    }
  }, [q]);

  // Sökfunktion
  const performSearch = async (query: string) => {
    if (!query.trim() || query.trim().length < 2) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Sökningen misslyckades');
      }
      
      const data: SearchResponse = await response.json();
      setResults(data.results);
      setTotalCount(data.totalCount || {
        customers: data.results.customers.length,
        tickets: data.results.tickets.length,
        settings: data.results.settings.length,
        total: data.results.customers.length + data.results.tickets.length + data.results.settings.length
      });
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Ett fel inträffade vid sökning');
    } finally {
      setLoading(false);
    }
  };

  // Hantera nytt sökformulär på söksidan
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (searchQuery.trim().length >= 2) {
      router.push(`/sok?q=${encodeURIComponent(searchQuery)}`, undefined, { shallow: true });
      performSearch(searchQuery);
    } else if (searchQuery.trim().length > 0) {
      setError('Söktermen måste vara minst 2 tecken');
    }
  };

  // Filtrering av resultat baserat på aktiv flik
  const getFilteredResults = () => {
    if (!results) return null;
    
    switch (activeTab) {
      case 'customers':
        return { ...results, tickets: [], settings: [] };
      case 'tickets':
        return { ...results, customers: [], settings: [] };
      case 'settings':
        return { ...results, customers: [], tickets: [] };
      default:
        return results;
    }
  };

  // Hjälpfunktion för att visa kundnamn
  const getCustomerName = (customer?: Customer): string => {
    if (!customer) return "-";
    
    if (customer.firstName || customer.lastName) {
      return `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
    }
    
    return customer.email || `Kund #${customer.id}`;
  };
  
  const filteredResults = getFilteredResults();

  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="inline-block max-w-xl text-center">
        <h1 className={title({ size: 'md' })}>Sökresultat</h1>
        {q && <p className="text-default-600 mt-2">Visar resultat för "{q}"</p>}
      </div>
      
      <Card className="w-full max-w-5xl mb-8">
        <CardBody>
          <form onSubmit={handleSearch}>
            <Input
              value={searchQuery}
              onValueChange={setSearchQuery}
              placeholder="Sök efter kunder, ärenden eller inställningar..."
              startContent={<SearchIcon className="text-default-400" />}
              endContent={
                loading ? <Spinner size="sm" /> : 
                <Button type="submit" variant="flat" size="sm">Sök</Button>
              }
              size="lg"
              className="mb-2"
              isInvalid={!!error && !loading && searchQuery.length < 2}
              errorMessage={!loading && searchQuery.length < 2 ? error : undefined}
            />
          </form>
        </CardBody>
      </Card>
      
      {error && searchQuery.length >= 2 && (
        <Card className="w-full max-w-5xl mb-4 bg-danger-50">
          <CardBody>
            <p className="text-danger">{error}</p>
          </CardBody>
        </Card>
      )}
      
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Spinner size="lg" />
          <p className="mt-4">Söker...</p>
        </div>
      ) : filteredResults ? (
        <div className="w-full max-w-5xl">
          <Tabs 
            selectedKey={activeTab} 
            onSelectionChange={(key) => setActiveTab(key as string)}
            variant="underlined"
            color="primary"
          >
            <Tab 
              key="all" 
              title={`Alla (${totalCount.total || 0})`}
            />
            <Tab 
              key="customers" 
              title={`Kunder (${totalCount.customers || 0})`}
              isDisabled={!results?.customers.length}
            />
            <Tab 
              key="tickets" 
              title={`Ärenden (${totalCount.tickets || 0})`}
              isDisabled={!results?.tickets.length}
            />
            <Tab 
              key="settings" 
              title={`Inställningar (${totalCount.settings || 0})`}
              isDisabled={!results?.settings.length}
            />
          </Tabs>
          
          <div className="mt-6">
            {/* Kundresultat */}
            {filteredResults.customers.length > 0 && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-3">Kunder</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredResults.customers.map((customer) => (
                    <Card key={`customer-${customer.id}`} className="hover:bg-default-50 transition-colors">
                      <CardBody>
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-medium">{getCustomerName(customer)}</h3>
                            <p className="text-default-500">{customer.email}</p>
                            {customer.phoneNumber && <p className="text-default-500">{customer.phoneNumber}</p>}
                          </div>
                          <Button
                            as={NextLink}
                            href={`/kunder/${customer.id}`}
                            isIconOnly
                            variant="flat"
                            size="sm"
                          >
                            <EyeIcon />
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            
            {/* Ärendeesultat */}
            {filteredResults.tickets.length > 0 && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-3">Ärenden</h2>
                <div className="space-y-3">
                  {filteredResults.tickets.map((ticket) => {
                    // Bestäm vilken status som ska visas
                    const statusName = ticket.customStatus 
                      ? ticket.customStatus.name 
                      : ticket.status || '-';
                    
                    const statusColor = ticket.customStatus 
                      ? ticket.customStatus.color 
                      : '#cccccc';
                    
                    return (
                      <Card key={`ticket-${ticket.id}`} className="hover:bg-default-50 transition-colors">
                        <CardBody>
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-medium">#{ticket.id}</h3>
                                <div className="flex items-center">
                                  <div 
                                    className="w-3 h-3 rounded-full mr-1" 
                                    style={{ backgroundColor: statusColor }}
                                  />
                                  <span className="text-sm">{statusName}</span>
                                </div>
                              </div>
                              <p className="text-default-700 font-medium">
                                {ticket.ticketType?.name || "-"}
                              </p>
                              <p className="text-default-500">Kund: {getCustomerName(ticket.customer)}</p>
                            </div>
                            <Button
                              as={NextLink}
                              href={`/arenden/${ticket.id}`}
                              isIconOnly
                              variant="flat"
                              size="sm"
                            >
                              <EyeIcon />
                            </Button>
                          </div>
                        </CardBody>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Inställningsresultat */}
            {filteredResults.settings.length > 0 && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-3">Inställningar</h2>
                <div className="space-y-2">
                  {filteredResults.settings.map((setting, index) => (
                    <Card key={`setting-${index}`} className="hover:bg-default-50 transition-colors">
                      <CardBody>
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-lg font-medium">{setting.name}</h3>
                            <p className="text-default-500">{setting.description}</p>
                          </div>
                          <Button
                            as={NextLink}
                            href={setting.url}
                            variant="flat"
                            size="sm"
                          >
                            Gå till inställning
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            
            {totalCount.total === 0 && (
              <div className="text-center py-12">
                <p className="text-default-500 text-lg">Inga resultat hittades.</p>
                <p className="text-default-400 mt-2">
                  Försök med andra söktermer eller sök i alla kategorier.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        q && (
          <div className="text-center py-12">
            <p className="text-default-500 text-lg">Inga resultat hittades.</p>
            <p className="text-default-400 mt-2">
              Försök med andra söktermer eller se till att du är inloggad med rätt konto.
            </p>
          </div>
        )
      )}
    </section>
  );
}