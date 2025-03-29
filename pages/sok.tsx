// pages/sok.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import {
  Card,
  CardBody,
  Input,
  Button,
  Tabs,
  Tab,
  Spinner,
  Chip,
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Link,
  Pagination
} from '@heroui/react';
import { title } from '@/components/primitives';
import { SearchIcon } from '@/components/icons';

// Typ för ett sökresultat
type SearchResult = {
  type: 'ticket' | 'customer' | 'setting';
  id: number | string;
  title: string;
  subtitle?: string;
  metaInfo?: string;
  url: string;
  relevance: number;
  data: any; // Den ursprungliga dataobjektet
};

const SearchPage = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { q: queryParam } = router.query;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(10);

  // Uppdatera söktermen när URL-parametern ändras
  useEffect(() => {
    if (typeof queryParam === 'string') {
      setSearchQuery(queryParam);
      performSearch(queryParam);
    }
  }, [queryParam]);

  // Utför sökningen
  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    try {
      // Sökning i ärenden
      const ticketsResponse = await fetch(`/api/tickets?search=${encodeURIComponent(query)}`);
      const tickets = await ticketsResponse.json();

      // Sökning i kunder
      const customersResponse = await fetch(`/api/customers?search=${encodeURIComponent(query)}`);
      const customers = await customersResponse.json();

      // Sammanställ resultat
      const combinedResults: SearchResult[] = [
        // Mappa ärenden till SearchResult format
        ...tickets.map(ticket => ({
          type: 'ticket' as const,
          id: ticket.id,
          title: `Ärende #${ticket.id}`,
          subtitle: ticket.ticketType?.name || 'Okänd ärendetyp',
          metaInfo: new Date(ticket.createdAt).toLocaleDateString('sv-SE'),
          url: `/arenden/${ticket.id}`,
          relevance: calculateRelevance(query, ticket),
          data: ticket
        })),
        
        // Mappa kunder till SearchResult format
        ...customers.map(customer => ({
          type: 'customer' as const,
          id: customer.id,
          title: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email,
          subtitle: customer.email,
          metaInfo: customer.phoneNumber || '',
          url: `/kunder/${customer.id}`,
          relevance: calculateRelevance(query, customer),
          data: customer
        }))
      ];

      // Sortera resultat efter relevans
      setResults(combinedResults.sort((a, b) => b.relevance - a.relevance));
    } catch (error) {
      console.error('Fel vid sökning:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Beräkna relevans baserat på matchningar mot olika fält
  const calculateRelevance = (query: string, item: any): number => {
    const lowerQuery = query.toLowerCase();
    let score = 0;

    // Om det är ett ärende
    if (item.ticketType) {
      // Poäng om ID:t matchar
      if (item.id.toString().includes(lowerQuery)) score += 10;
      
      // Poäng om ärendetypen matchar
      if (item.ticketType?.name?.toLowerCase().includes(lowerQuery)) score += 5;
      
      // Poäng om något dynamiskt fält matchar
      if (item.dynamicFields) {
        Object.values(item.dynamicFields).forEach((value: any) => {
          if (String(value).toLowerCase().includes(lowerQuery)) score += 3;
        });
      }
      
      // Poäng om kundens namn matchar
      if (item.customer) {
        const customerName = `${item.customer.firstName || ''} ${item.customer.lastName || ''}`.toLowerCase();
        if (customerName.includes(lowerQuery)) score += 4;
        if (item.customer.email?.toLowerCase().includes(lowerQuery)) score += 3;
      }
    }
    
    // Om det är en kund
    else if (item.email) {
      // Poäng om namn matchar
      const fullName = `${item.firstName || ''} ${item.lastName || ''}`.toLowerCase();
      if (fullName.includes(lowerQuery)) score += 10;
      
      // Poäng om email matchar
      if (item.email.toLowerCase().includes(lowerQuery)) score += 8;
      
      // Poäng om telefon matchar
      if (item.phoneNumber?.toLowerCase().includes(lowerQuery)) score += 7;
      
      // Poäng om adress matchar
      if (item.address?.toLowerCase().includes(lowerQuery)) score += 5;
      if (item.city?.toLowerCase().includes(lowerQuery)) score += 5;
    }

    return score;
  };

  // Hantera ny sökning
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Uppdatera URL:en för att uppdatera sökningen
    if (searchQuery.trim()) {
      router.push({
        pathname: '/sok',
        query: { q: searchQuery }
      }, undefined, { shallow: true });
      
      // Utför sökningen direkt
      performSearch(searchQuery);
    }
  };

  // Filtrera resultat baserat på aktuell flik
  const filteredResults = useMemo(() => {
    if (activeTab === 'all') return results;
    return results.filter(result => result.type === activeTab);
  }, [results, activeTab]);

  // Beräkna antal sidor och nuvarande sidresultat
  const totalPages = Math.ceil(filteredResults.length / resultsPerPage);
  const currentPageResults = useMemo(() => {
    const startIndex = (page - 1) * resultsPerPage;
    return filteredResults.slice(startIndex, startIndex + resultsPerPage);
  }, [filteredResults, page, resultsPerPage]);

  // Gruppera antal per typ
  const resultCountsByType = useMemo(() => {
    const counts = {
      all: results.length,
      ticket: results.filter(r => r.type === 'ticket').length,
      customer: results.filter(r => r.type === 'customer').length,
      setting: results.filter(r => r.type === 'setting').length
    };
    return counts;
  }, [results]);

  // Om användaren inte är inloggad
  if (status === 'unauthenticated') {
    router.push('/auth/login');
    return null;
  }

  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="inline-block max-w-lg text-center mb-6">
        <h1 className={title({ size: 'sm' })}>Sökning</h1>
        <p className="text-default-500 mt-2">Sök efter ärenden, kunder eller inställningar</p>
      </div>
      
      <div className="w-full max-w-5xl">
        {/* Sökformulär */}
        <Card className="mb-6">
          <CardBody>
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                fullWidth
                placeholder="Sök efter ärenden, kunder eller inställningar..."
                value={searchQuery}
                onValueChange={setSearchQuery}
                startContent={<SearchIcon className="text-default-400" />}
                size="lg"
                autoFocus
              />
              <Button
                color="primary"
                type="submit"
                isLoading={isSearching}
                isDisabled={!searchQuery.trim()}
              >
                Sök
              </Button>
            </form>
          </CardBody>
        </Card>
        
        {/* Resultatsektion */}
        {queryParam ? (
          <div className="space-y-4">
            {isSearching ? (
              <div className="flex justify-center items-center py-12">
                <Spinner size="lg" color="primary" />
                <span className="ml-4">Söker...</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">
                    {results.length > 0 
                      ? `${results.length} resultat för "${queryParam}"` 
                      : `Inga resultat för "${queryParam}"`}
                  </h2>
                </div>
                
                {results.length > 0 && (
                  <>
                    <Tabs 
                      selectedKey={activeTab}
                      onSelectionChange={(key) => {
                        setActiveTab(key as string);
                        setPage(1); // Återställ till första sidan vid filikändring
                      }}
                      variant="light"
                      color="primary"
                      classNames={{
                        tabList: "gap-4",
                        tab: "py-2"
                      }}
                    >
                      <Tab 
                        key="all" 
                        title={
                          <div className="flex items-center gap-2">
                            <span>Alla</span>
                            <Chip size="sm" variant="flat">{resultCountsByType.all}</Chip>
                          </div>
                        } 
                      />
                      <Tab 
                        key="ticket" 
                        title={
                          <div className="flex items-center gap-2">
                            <span>Ärenden</span>
                            <Chip size="sm" variant="flat">{resultCountsByType.ticket}</Chip>
                          </div>
                        } 
                        isDisabled={resultCountsByType.ticket === 0}
                      />
                      <Tab 
                        key="customer" 
                        title={
                          <div className="flex items-center gap-2">
                            <span>Kunder</span>
                            <Chip size="sm" variant="flat">{resultCountsByType.customer}</Chip>
                          </div>
                        } 
                        isDisabled={resultCountsByType.customer === 0}
                      />
                    </Tabs>
                    
                    <Table
                      aria-label="Sökresultat"
                      bottomContent={
                        totalPages > 1 ? (
                          <div className="flex w-full justify-center">
                            <Pagination
                              isCompact
                              showControls
                              showShadow
                              color="primary"
                              page={page}
                              total={totalPages}
                              onChange={setPage}
                            />
                          </div>
                        ) : null
                      }
                      bottomContentPlacement="outside"
                    >
                      <TableHeader>
                        <TableColumn>Titel</TableColumn>
                        <TableColumn>Beskrivning</TableColumn>
                        <TableColumn>Typ</TableColumn>
                        <TableColumn>Info</TableColumn>
                      </TableHeader>
                      <TableBody emptyContent="Inga resultat hittades.">
                        {currentPageResults.map((result) => (
                          <TableRow 
                            key={`${result.type}-${result.id}`}
                            onClick={() => router.push(result.url)}
                            className="cursor-pointer hover:bg-default-100"
                          >
                            <TableCell>
                              <Link href={result.url} className="font-medium">{result.title}</Link>
                            </TableCell>
                            <TableCell>{result.subtitle || '-'}</TableCell>
                            <TableCell>
                              <Chip 
                                color={result.type === 'ticket' ? 'primary' : result.type === 'customer' ? 'success' : 'secondary'}
                                variant="flat"
                                size="sm"
                              >
                                {result.type === 'ticket' ? 'Ärende' : 
                                 result.type === 'customer' ? 'Kund' : 'Inställning'}
                              </Chip>
                            </TableCell>
                            <TableCell>{result.metaInfo || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-default-500">
            <p>Ange en sökterm för att söka</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default SearchPage;