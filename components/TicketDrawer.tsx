import React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  Button,
} from "@heroui/react";

type Ticket = {
  id: number;
  status: string;
  createdAt: string;
  customer?: {
    name: string;
    email?: string;
    phoneNumber?: string;
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
  if (!ticket) return null;

  // Funktion för att hämta korrekt visat statusnamn
  const getStatusDisplay = () => {
    if (ticket.customStatus) {
      return ticket.customStatus.name;
    }
    return ticket.status;
  };

  return (
    <Drawer isOpen={isOpen} onOpenChange={onClose} placement="right" size="md">
      <DrawerContent>
        <DrawerHeader>
          <h2>Ärende detaljer</h2>
        </DrawerHeader>
        <DrawerBody>
          <div className="space-y-2">
            <p>
              <strong>Kundnamn:</strong> {ticket.customer ? ticket.customer.name : "-"}
            </p>
            {ticket.customer && (
              <>
                <p>
                  <strong>Email:</strong> {ticket.customer.email || "-"}
                </p>
                <p>
                  <strong>Telefonnummer:</strong> {ticket.customer.phoneNumber || "-"}
                </p>
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
              {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString("en-GB") : "-"}
            </p>
            <p>
              <strong>Senast klar:</strong>{" "}
              {ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString("en-GB") : "-"}
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
                          ? new Date(ticket.dynamicFields[field.name]).toLocaleDateString("en-GB")
                          : String(ticket.dynamicFields[field.name])
                        : "-"}
                    </li>
                  ))}
              </ul>
            ) : (
              <p>Inga dynamiska fält</p>
            )}
          </div>
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
