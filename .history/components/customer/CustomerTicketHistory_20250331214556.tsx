// components/customer/CustomerTicketHistory.tsx
import React, { useState, useEffect } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Button,
  Pagination,
  Spinner,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Card,
  CardHeader,
  CardBody,
  Badge,
  Input,
  addToast
} from "@heroui/react";
import { useRouter } from "next/router";
import { MenuIcon, EditIcon, TicketIcon } from "@/components/icons";

type Ticket = {
  id: number;
  status: string;
  createdAt: string;
  customStatus?: {
    name: string;
    color: string;
  };
  ticketType?: {
    name: string;
  };
  dueDate?: string;
  dynamicFields: Record<string, any>;
};

interface CustomerTicketHistoryProps {
  customerId: number;
}

const CustomerTicketHistory: React.FC<CustomerTicketHistoryProps> = ({ customerId }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const router = useRouter();

  // Använd useEffect för att hämta kundens ärenden när komponenten laddas
  useEffect(() => {
    if (!customerId) return;
    
    fetchCustomerTickets();
  }, [customerId, statusFilter, typeFilter, dateFilter]);

  const fetchCustomerTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Bygger URL med filter om det finns
      let url = `/api/tickets?customerId=${customerId}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error("Kunde inte hämta kundens ärenden");
      }
      
      const data = await response.json();
      
      // Applicera alla filter här på klientsidan istället för flera API-anrop
      let filteredData = [...data];
      
      if (statusFilter) {
        filteredData = filteredData.filter(ticket => 
          ticket.status === statusFilter || 
          ticket.customStatus?.name === statusFilter
        );
      }
      
      if (typeFilter) {
        filteredData = filteredData.filter(ticket => 
          ticket.ticketType?.name === typeFilter
        );
      }
      
      if (dateFilter) {
        const filterDate = new Date(dateFilter);
        filteredData = filteredData.filter(ticket => {
          const ticketDate = new Date(ticket.createdAt);
          return ticketDate.toDateString() === filterDate.toDateString();
        });
      }
      
      setTickets(filteredData);
    } catch (error) {
      console.error("Fel vid hämtning av kundens ärenden:", error);
      setError("Ett fel uppstod vid hämtning av ärendehistorik");
    } finally {
      setLoading(false);
    }
  };

  const handleTicketClick = (ticketId: number) => {
    router.push(`/arenden/${ticketId}`);
  };
  
  const handleCreateTicket = () => {
    router.push(`/nytt-arende?customerId=${customerId}`);
  };
  
  const handleRefresh = () => {
    fetchCustomerTickets();
    addToast({
      title: "Uppdaterad",
      description: "Ärendelistan har uppdaterats",
      color: "primary",
      variant: "flat"
    });
  };
  
  const clearFilters = () => {
    setStatusFilter(null);
    setTypeFilter(null);
    setDateFilter(null);
  };
  
  // Paginera tickets
  const paginatedTickets = tickets.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );
  
  // Beräkna antal sidor för paginering
  const totalPages = Math.ceil(tickets.length / rowsPerPage);
  
  // Formatera datum
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString("sv-SE");
    } catch (e) {
      return "-";
    }
  };
  
  // Rendera status med färg
  const renderStatus = (ticket: Ticket) => {
    if (ticket.customStatus) {
      return (
        <Badge style={{ backgroundColor: ticket.customStatus.color || '#6b7994', color: 'white' }}>
          {ticket.customStatus.name}
        </Badge>
      );
    }
    
    // Översätt standardstatusar
    const statusMap: Record<string, string> = {
      'OPEN': 'Öppen',
      'IN_PROGRESS': 'Pågående',
      'RESOLVED': 'Löst',
      'CLOSED': 'Stängd'
    };
    
    const statusColor: Record<string, string> = {
      'OPEN': 'warning',
      'IN_PROGRESS': 'primary',
      'RESOLVED': 'success',
      'CLOSED': 'default'
    };
    
    return (
      <Badge color={statusColor[ticket.status] || 'default'}>
        {statusMap[ticket.status] || ticket.status}
      </Badge>
    );
  };

  // Samla unika ärendetyper för filtret
  const uniqueTypes = Array.from(new Set(
    tickets
      .map(ticket => ticket.ticketType?.name)
      .filter(Boolean)
  ));

  if (loading) {
    return (
      <Card className="w-full">
        <CardBody>
          <div className="flex justify-center items-center py-12">
            <Spinner size="lg" color="primary" />
          </div>
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardBody>
          <div className="text-danger text-center py-8">
            <p>{error}</p>
            <Button 
              color="primary" 
              variant="flat" 
              className="mt-4"
              onPress={fetchCustomerTickets}
            >
              Försök igen
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex justify-between items-center px-6 py-4">
        <h2 className="text-lg font-medium">Ärendehistorik</h2>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Filter för status */}
          <Dropdown>
            <DropdownTrigger>
              <Button 
                variant="flat" 
                size="sm"
                startContent={<MenuIcon size={16} />}
              >
                {statusFilter ? `Status: ${statusFilter}` : 'Status'}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Filtrera på status"
              onAction={(key) => setStatusFilter(key === 'all' ? null : String(key))}
            >
              <DropdownItem key="all">Alla statusar</DropdownItem>
              <DropdownItem key="OPEN">Öppna</DropdownItem>
              <DropdownItem key="IN_PROGRESS">Pågående</DropdownItem>
              <DropdownItem key="RESOLVED">Lösta</DropdownItem>
              <DropdownItem key="CLOSED">Stängda</DropdownItem>
            </DropdownMenu>
          </Dropdown>
          
          {/* Filter för ärendetyp */}
          {uniqueTypes.length > 0 && (
            <Dropdown>
              <DropdownTrigger>
                <Button 
                  variant="flat" 
                  size="sm"
                >
                  {typeFilter ? `Typ: ${typeFilter}` : 'Ärendetyp'}
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Filtrera på ärendetyp"
                onAction={(key) => setTypeFilter(key === 'all' ? null : String(key))}
              >
                <DropdownItem key="all">Alla typer</DropdownItem>
                {uniqueTypes.map((type) => (
                  <DropdownItem key={type}>{type}</DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>
          )}
          
          {/* Filter för datum */}
          <div className="flex items-center">
            <Input
              type="date"
              aria-label="Filtrera på datum"
              placeholder="Välj datum"
              value={dateFilter || ''}
              onValueChange={(value) => setDateFilter(value || null)}
              labelPlacement="outside"
              className="w-40"
              startContent={<TicketIcon size={16} />}
            />
          </div>
          
          {/* Visa "Rensa filter"-knapp om något filter är aktivt */}
          {(statusFilter || typeFilter || dateFilter) && (
            <Button 
              variant="flat" 
              size="sm"
              onPress={clearFilters}
            >
              Rensa filter
            </Button>
          )}
          
          {/* Uppdateringsknapp */}
          <Button 
            variant="flat" 
            size="sm"
            onPress={handleRefresh}
          >
            Uppdatera
          </Button>
          
          {/* Skapa nytt ärende-knapp */}
          <Button 
            variant="flat" 
            color="primary" 
            size="sm"
            onPress={handleCreateTicket}
            startContent={<EditIcon size={16} />}
          >
            Nytt ärende
          </Button>
        </div>
      </CardHeader>
      
      <CardBody className="px-0">
        {tickets.length === 0 ? (
          <div className="text-center py-12 text-default-500">
            <p className="mb-4">Kunden har inga ärenden</p>
            <Button 
              color="primary"
              variant="flat"
              onPress={handleCreateTicket}
              startContent={<EditIcon size={16} />}
            >
              Skapa nytt ärende
            </Button>
          </div>
        ) : (
          <>
            <Table aria-label="Kundens ärendehistorik">
              <TableHeader>
                <TableColumn>Ärende-ID</TableColumn>
                <TableColumn>Typ</TableColumn>
                <TableColumn>Status</TableColumn>
                <TableColumn>Skapad</TableColumn>
                <TableColumn>Förfallodatum</TableColumn>
              </TableHeader>
              <TableBody emptyContent="Inga ärenden hittades med aktuella filter">
                {paginatedTickets.map((ticket) => (
                  <TableRow 
                    key={ticket.id}
                    onClick={() => handleTicketClick(ticket.id)}
                    className="cursor-pointer hover:bg-default-100 transition-colors"
                  >
                    <TableCell>#{ticket.id}</TableCell>
                    <TableCell>{ticket.ticketType?.name || '-'}</TableCell>
                    <TableCell>{renderStatus(ticket)}</TableCell>
                    <TableCell>{formatDate(ticket.createdAt)}</TableCell>
                    <TableCell>
                      {ticket.dueDate ? (
                        <div className={new Date(ticket.dueDate) < new Date() ? "text-danger" : ""}>
                          {formatDate(ticket.dueDate)}
                        </div>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {tickets.length > rowsPerPage && (
              <div className="flex justify-center py-4">
                <Pagination
                  total={totalPages}
                  page={page}
                  onChange={setPage}
                  color="primary"
                  variant="flat"
                />
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
};

export default CustomerTicketHistory;