import React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  Button,
} from "@heroui/react";
import { useRouter } from "next/router";

type Ticket = {
  id: number;
  status: string;
  createdAt: string;
  customer?: {
    id?: number;
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
    phoneNumber?: string;
    address?: string;
    postalCode?: string;
    city?: string;
    country?: string;
    dynamicFields?: { [key: string]: any };
  };
  ticketType?: {
    name: string;
    fields: Array<{ fieldType: string; name: string }>;
  };
  dynamicFields: { [key: string]: any };
  dueDate: any;
  // Lägg till customStatus om den finns
  customStatus?: {
    id: number;
    name: string;
    color: string;
  };
};

type TicketDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  ticket: Ticket | null;
};

const TicketDrawer: React.FC<TicketDrawerProps> = ({ isOpen, onClose, ticket }) => {
  const router = useRouter();
  
  if (!ticket) return null;

  // Funktion för att navigera till den fullständiga ärendesidan
  const navigateToFullView = () => {
    router.push(`/arenden/${ticket.id}`);
  };

  // Funktion för att hämta korrekt visat statusnamn
  const getStatusDisplay = () => {
    if (ticket.customStatus) {
      return ticket.customStatus.name;
    }
    return ticket.status;
  };

  // Funktion för att sammanställa kundnamn baserat på tillgängliga fält
  const getCustomerName = () => {
    if (!ticket.customer) return "-";
    
    // Prioritera att visa namn i följande ordning:
    // 1. Om det finns name-fält (äldre version av kundmodellen)
    if (ticket.customer.name) {
      return ticket.customer.name;
    }

    // 2. Om det finns firstName och/eller lastName, kombinera dem
    if (ticket.customer.firstName || ticket.customer.lastName) {
      const fullName = `${ticket.customer.firstName || ''} ${ticket.customer.lastName || ''}`.trim();
      if (fullName) return fullName;
    }

    // 3. Visa "Kund #[ID]" om ID finns
    if (ticket.customer.id) {
      return `Kund #${ticket.customer.id}`;
    }

    // 4. Sista utvägen - om inget annat finns, visa "Okänd kund"
    return "Okänd kund";
  };

  return (
    <Drawer isOpen={isOpen} onOpenChange={onClose} placement="right" size="md">
      <DrawerContent>
        <DrawerHeader>
          <h2>Ärende detaljer</h2>
        </DrawerHeader>
        <DrawerBody>
          <div className="space-y-2">
            {ticket.customer && (
              <>
                <p>
                  <strong>Kundnamn:</strong> {getCustomerName()}
                </p>
                
                {ticket.customer.email && (
                  <p>
                    <strong>Email:</strong> {ticket.customer.email}
                  </p>
                )}
                {ticket.customer.phoneNumber && (
                  <p>
                    <strong>Telefonnummer:</strong> {ticket.customer.phoneNumber}
                  </p>
                )}
                {ticket.customer.address && (
                  <p>
                    <strong>Adress:</strong> {ticket.customer.address}
                  </p>
                )}
                {ticket.customer.postalCode && (
                  <p>
                    <strong>Postnummer:</strong> {ticket.customer.postalCode}
                  </p>
                )}
                {ticket.customer.city && (
                  <p>
                    <strong>Ort:</strong> {ticket.customer.city}
                  </p>
                )}
                {ticket.customer.country && (
                  <p>
                    <strong>Land:</strong> {ticket.customer.country}
                  </p>
                )}
                
                {/* Visa nyhetsbrev och stamkund status */}
                {ticket.customer.newsletter !== undefined && (
                  <p>
                    <strong>Nyhetsbrev:</strong> {ticket.customer.newsletter ? 'Ja' : 'Nej'}
                  </p>
                )}
                {ticket.customer.loyal !== undefined && (
                  <p>
                    <strong>Stamkund:</strong> {ticket.customer.loyal ? 'Ja' : 'Nej'}
                  </p>
                )}
                
                {/* Visa dynamiska fält om de finns */}
                {ticket.customer.dynamicFields && Object.keys(ticket.customer.dynamicFields).length > 0 && (
                  <>
                    <div className="mt-2 mb-1">
                      <strong>Övriga kundfält:</strong>
                    </div>
                    {Object.entries(ticket.customer.dynamicFields).map(([key, value]) => (
                      <p key={`customer-${key}`}>
                        <strong>{key}:</strong> {String(value)}
                      </p>
                    ))}
                  </>
                )}
              </>
            )}
            <p>
              <strong>Ärendetyp:</strong> {ticket.ticketType ? ticket.ticketType.name : "-"}
            </p>
            <p>
              <strong>Status:</strong> {getStatusDisplay()}
            </p>
            <p>
              <strong>Skapad:</strong>{" "}
              {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString("sv-SE") : "-"}
            </p>
            <p>
              <strong>Senast klar:</strong>{" "}
              {ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString("sv-SE") : "-"}
            </p>
          </div>
          <div className="mt-4">
            <h3 className="font-bold">Ärendeinformation</h3>
            {ticket.ticketType &&
            ticket.ticketType.fields &&
            ticket.ticketType.fields.length > 0 ? (
              <ul className="list-disc ml-5">
                {ticket.ticketType.fields
                  .filter((field) => field.fieldType !== "DUE_DATE")
                  .map((field) => (
                    <li key={field.name}>
                      <strong>{field.name}:</strong>{" "}
                      {ticket.dynamicFields && ticket.dynamicFields[field.name] !== undefined
                        ? field.fieldType === "DATE"
                          ? new Date(ticket.dynamicFields[field.name]).toLocaleDateString("sv-SE")
                          : String(ticket.dynamicFields[field.name])
                        : "-"}
                    </li>
                  ))}
              </ul>
            ) : (
              <p>Inga dynamiska fält</p>
            )}
          </div>
          
          {/* Ny knapp för att navigera till fullständig vy */}
          <Button 
            color="primary" 
            variant="flat"
            className="w-full mt-6"
            onPress={navigateToFullView}
          >
            Visa fullständig ärendevy
          </Button>
        </DrawerBody>
        <DrawerFooter>
          <Button onPress={onClose} variant="flat">
            Stäng
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default TicketDrawer;