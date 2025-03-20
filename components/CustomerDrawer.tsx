import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Spinner
} from "@heroui/react";

type Customer = {
  id: number;
  firstName?: string;
  lastName?: string;
  email: string;
  phoneNumber?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  dateOfBirth?: string;
  newsletter: boolean;
  loyal: boolean;
  dynamicFields?: { [key: string]: any };
  createdAt: string;
};

type Ticket = {
  id: number;
  status: string;
  createdAt: string;
  customerId: number;
  ticketType?: {
    name: string;
  };
  dynamicFields: { [key: string]: any };
  customStatus?: {
    name: string;
  };
};

type CustomerDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
};

const CustomerDrawer: React.FC<CustomerDrawerProps> = ({ isOpen, onClose, customer }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Hämta kundens ärenden när drawern öppnas
  useEffect(() => {
    if (isOpen && customer) {
      fetchCustomerTickets(customer.id);
    } else {
      setTickets([]);
    }
  }, [isOpen, customer]);

  const fetchCustomerTickets = async (customerId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tickets?customerId=${customerId}`);
      if (response.ok) {
        const data = await response.json();
        setTickets(data);
      } else {
        console.error("Kunde inte hämta kundens ärenden");
      }
    } catch (error) {
      console.error("Fel vid hämtning av kundens ärenden:", error);
    } finally {
      setLoading(false);
    }
  };

  // Funktion för att navigera till ärendesidan när en rad klickas
  const handleTicketClick = (ticketId: number) => {
    // Stäng drawern och navigera till ärendesidan
    onClose();
    router.push(`/arenden/${ticketId}`);
  };

  if (!customer) return null;

  // Formatera kund-namn
  const getCustomerName = () => {
    if (customer.firstName || customer.lastName) {
      return `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
    }
    return `Kund #${customer.id}`;
  };

  // Formatera datumet för lättare läsning
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString("sv-SE");
    } catch (e) {
      return "-";
    }
  };

  // Få statusvisning med stöd för customStatus
  const getTicketStatus = (ticket: Ticket) => {
    if (ticket.customStatus) {
      return ticket.customStatus.name;
    }
    
    // Översätt engelska status till svenska
    const statusMap: Record<string, string> = {
      'OPEN': 'Öppen',
      'IN_PROGRESS': 'Pågående',
      'RESOLVED': 'Löst',
      'CLOSED': 'Stängd'
    };
    
    return statusMap[ticket.status] || ticket.status;
  };

  return (
    <Drawer isOpen={isOpen} onOpenChange={onClose} placement="right" size="lg">
      <DrawerContent>
        <DrawerHeader>
          <h2 className="text-xl font-semibold">Kunddetaljer</h2>
        </DrawerHeader>
        <DrawerBody>
          <div className="space-y-6">
            {/* Kundinformation */}
            <div className="bg-content1 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Kundinformation</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p><strong>Namn:</strong> {getCustomerName()}</p>
                  <p><strong>E-post:</strong> {customer.email || "-"}</p>
                  <p><strong>Telefon:</strong> {customer.phoneNumber || "-"}</p>
                  <p><strong>Adress:</strong> {customer.address || "-"}</p>
                  <p><strong>Postnummer:</strong> {customer.postalCode || "-"}</p>
                </div>
                <div>
                  <p><strong>Ort:</strong> {customer.city || "-"}</p>
                  <p><strong>Land:</strong> {customer.country || "-"}</p>
                  <p><strong>Födelsedatum:</strong> {formatDate(customer.dateOfBirth)}</p>
                  <p><strong>Nyhetsbrev:</strong> {customer.newsletter ? "Ja" : "Nej"}</p>
                  <p><strong>Stamkund:</strong> {customer.loyal ? "Ja" : "Nej"}</p>
                </div>
              </div>

              {/* Visa dynamiska fält om de finns */}
              {customer.dynamicFields && Object.keys(customer.dynamicFields).length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Anpassade fält</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Object.entries(customer.dynamicFields).map(([key, value]) => (
                      <p key={`customer-${key}`}>
                        <strong>{key}:</strong> {String(value)}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              
              <p className="mt-4 text-sm text-default-500">
                <strong>Kund sedan:</strong> {formatDate(customer.createdAt)}
              </p>
            </div>

            {/* Ärendehistorik */}
            <div className="bg-content1 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Ärendehistorik</h3>
              
              {loading ? (
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              ) : tickets.length > 0 ? (
                <Table aria-label="Kundens ärenden">
                  <TableHeader>
                    <TableColumn>ID</TableColumn>
                    <TableColumn>Ärendetyp</TableColumn>
                    <TableColumn>Status</TableColumn>
                    <TableColumn>Skapad</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((ticket) => (
                      <TableRow 
                        key={ticket.id}
                        onClick={() => handleTicketClick(ticket.id)}
                        className="cursor-pointer transition-colors hover:bg-default-100"
                      >
                        <TableCell>{ticket.id}</TableCell>
                        <TableCell>{ticket.ticketType?.name || "-"}</TableCell>
                        <TableCell>{getTicketStatus(ticket)}</TableCell>
                        <TableCell>{formatDate(ticket.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-4">Kunden har inga ärenden</p>
              )}
            </div>
          </div>
        </DrawerBody>
        <DrawerFooter>
          <Button 
            onPress={onClose} 
            variant="flat"
          >
            Stäng
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default CustomerDrawer;