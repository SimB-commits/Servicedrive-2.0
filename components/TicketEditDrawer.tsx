import React, { useState, useEffect } from "react";
import { parseAbsoluteToLocal } from "@internationalized/date";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  Button,
  Input,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DatePicker,
} from "@heroui/react";

// Definiera typer
type Customer = {
  name: string;
  email?: string;
  phoneNumber?: string;
};

type TicketType = {
  name: string;
  fields: Array<{ name: string; fieldType?: string }>;
};

export type Ticket = {
  customStatus: any;
  dueDate: any;
  id: number;
  status: string; // Vi förväntar oss att statusen sparas som en uid (t.ex. "OPEN", "CUSTOM_X")
  createdAt: string;
  customer?: Customer;
  ticketType?: TicketType;
  dynamicFields: { [key: string]: any };
};

type TicketEditDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  ticket: Ticket | null;
  onTicketUpdated: (updatedTicket: Ticket) => void;
};

const TicketEditDrawer: React.FC<TicketEditDrawerProps> = ({
  isOpen,
  onClose,
  ticket,
  onTicketUpdated,
}) => {
  // Lokalt formulärdata
  const [formData, setFormData] = useState<any>({});
  // Dynamiska statusalternativ hämtade från API:t
  const [statusOptions, setStatusOptions] = useState<Array<{ name: string; uid: string; color?: string }>>([]);

  // Hämta statusalternativ när komponenten monteras
  useEffect(() => {
    async function fetchStatuses() {
      try {
        const res = await fetch("/api/tickets/statuses");
        const data = await res.json();
        if (res.ok) {
          const defaultStatuses = [
            { name: "Öppen", uid: "OPEN", color: "#ff9500" },
            { name: "Färdig", uid: "CLOSED", color: "#3BAB48" },
            { name: "Pågående", uid: "IN_PROGRESS", color: "#ffa500" },
          ];
          // Mappa de dynamiska statusarna så att de får ett uid
        const dynamicStatuses = data.map((s: any) => ({ ...s, uid: `CUSTOM_${s.id}` }));
        const merged = [...defaultStatuses];
        dynamicStatuses.forEach((s: any) => {
          if (!merged.some((d) => d.uid === s.uid)) {
            merged.push(s);
          }
        });
        setStatusOptions(merged);
      } else {
        console.error("Kunde inte hämta statusar:", data.message);
      }
    } catch (error) {
      console.error("Fel vid hämtning av statusar:", error);
    }
  }
  fetchStatuses();
}, []);
  

  // Sätt initiala värden när ticket ändras
  useEffect(() => {
    if (ticket) {
      const initialDynamicFields = { ...ticket.dynamicFields };
      if (ticket.ticketType && ticket.ticketType.fields) {
        ticket.ticketType.fields.forEach((field) => {
          if (field.fieldType === "DUE_DATE") {
            initialDynamicFields[field.name] = ticket.dueDate ? parseAbsoluteToLocal(ticket.dueDate) : null;
          }
        });
      }
      setFormData({
        // Om customStatus finns, sätt status till "CUSTOM_" + customStatus.id, annars använd ticket.status
        status: ticket.customStatus ? `CUSTOM_${ticket.customStatus.id}` : ticket.status,
        customer: {
          name: ticket.customer?.name || "",
          email: ticket.customer?.email || "",
          phoneNumber: ticket.customer?.phoneNumber || "",
        },
        dynamicFields: initialDynamicFields,
      });
    }
  }, [ticket]);
  

  if (!ticket) return null;

  // Hantera ändring för dynamiska fält
  const handleDynamicFieldChange = (fieldName: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      dynamicFields: { ...prev.dynamicFields, [fieldName]: value },
    }));
  };

  // Exempel på att formatera datumvärden
  function formatValue(value: any): string {
    if (!value) return "";
    if (typeof value === "string") {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        date.setHours(12, 0, 0, 0);
        return date.toISOString();
      }
    }
    if (value instanceof Date) {
      const date = new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0);
      return date.toISOString();
    }
    if (typeof value === "object" && "year" in value && "month" in value && "day" in value) {
      const { year, month, day } = value;
      const date = new Date(year, month - 1, day, 12, 0, 0);
      return date.toISOString();
    }
    return "";
  }

  // Förbered data för uppdatering
  function prepareFormData(formData: any, ticket: Ticket): any {
    const prepared = { ...formData, dynamicFields: { ...formData.dynamicFields } };
    if (ticket.ticketType && ticket.ticketType.fields) {
      ticket.ticketType.fields.forEach((field) => {
        if (field.fieldType === "DATE" || field.fieldType === "DUE_DATE") {
          const value = formData.dynamicFields?.[field.name];
          const formattedDate = formatValue(value);
          if (field.fieldType === "DUE_DATE") {
            prepared.dueDate = formattedDate ? new Date(formattedDate) : null;
            delete prepared.dynamicFields[field.name];
          } else {
            prepared.dynamicFields[field.name] = formattedDate;
          }
        }
      });
    }
    return prepared;
  }

  return (
    <Drawer isOpen={isOpen} onOpenChange={onClose} placement="right" size="md">
      <DrawerContent>
        <DrawerHeader>
          <h2>Redigera Ärende</h2>
        </DrawerHeader>
        <DrawerBody>
          <div className="space-y-4">
            {/* Nytt fält för att ändra status med dynamiska alternativ */}
            <div>
              <label className="block font-bold mb-1">Status</label>
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="flat">
                    {
                      // Visa statusnamnet om vi hittar det i de dynamiska alternativen,
                      // annars visa uid:t direkt
                      statusOptions.find(opt => opt.uid === formData.status)?.name ||
                      formData.status ||
                      "Välj status"
                    }
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  disallowEmptySelection
                  aria-label="Välj status"
                  selectedKeys={new Set([formData.status])}
                  onSelectionChange={(keys) => {
                    const key = keys.values().next().value;
                    setFormData((prev: any) => ({ ...prev, status: key }));
                  }}
                  selectionMode="single"
                >
                  {statusOptions.map((option) => (
                    <DropdownItem key={option.uid}>
                      {option.name}
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              </Dropdown>
            </div>

            {/* Rendera övriga dynamiska fält */}
            {ticket.ticketType &&
              ticket.ticketType.fields.map((field) => (
                <div key={field.name}>
                  <label className="block font-bold mb-1">{field.name}</label>
                  {field.fieldType === "DATE" || field.fieldType === "DUE_DATE" ? (
                    <DatePicker
                      value={
                        typeof formData.dynamicFields?.[field.name] === "string"
                          ? parseAbsoluteToLocal(formData.dynamicFields[field.name])
                          : formData.dynamicFields?.[field.name] || null
                      }
                      onChange={(date) =>
                        handleDynamicFieldChange(field.name, date)
                      }
                      isRequired
                    />
                  ) : (
                    <Input
                      value={formData.dynamicFields?.[field.name] || ""}
                      onValueChange={(value: string) =>
                        handleDynamicFieldChange(field.name, value)
                      }
                    />
                  )}
                </div>
              ))}
          </div>
        </DrawerBody>
        <DrawerFooter>
          <div className="flex justify-end gap-2">
            <Button variant="flat" onPress={onClose}>
              Avbryt
            </Button>
            <Button
              onPress={async () => {
                try {
                  const preparedData = prepareFormData(formData, ticket);
                  const res = await fetch(`/api/tickets/${ticket.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(preparedData),
                  });
                  if (res.ok) {
                    const updatedTicket = await res.json();
                    onTicketUpdated(updatedTicket);
                    onClose();
                  } else {
                    console.error("Kunde inte uppdatera ärendet");
                  }
                } catch (err) {
                  console.error("Fel vid uppdatering:", err);
                }
              }}
            >
              Spara
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default TicketEditDrawer;
