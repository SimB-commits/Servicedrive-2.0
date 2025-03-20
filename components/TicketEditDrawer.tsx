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
  addToast
} from "@heroui/react";
import StatusConfirmationDialog from "@/components/StatusConfirmationDialog";
import { 
  TicketStatus, 
  combineStatusOptions,
  findStatusByUid, 
  hasMailTemplate,
  getEffectiveStatus 
} from "@/utils/ticketStatusService";

// Definiera typer
type Customer = {
  name?: string;
  firstName?: string;
  lastName?: string;
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
  status: string;
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
  // Statusvalmöjligheter
  const [statusOptions, setStatusOptions] = useState<TicketStatus[]>([]);
  
  // State för statusbekräftelsedialogrutan
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string | null>(null);
  const [selectedStatusInfo, setSelectedStatusInfo] = useState<TicketStatus | null>(null);
  
  // Spara användarens val om mail ska skickas eller inte
  const [shouldSendEmail, setShouldSendEmail] = useState<boolean>(true);

  // Hämta statusalternativ när komponenten monteras
  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const res = await fetch('/api/tickets/statuses');
        if (res.ok) {
          const data = await res.json();
          // Använd den centraliserade funktionen för att kombinera statusar
          const combinedOptions = combineStatusOptions(data);
          setStatusOptions(combinedOptions);
        }
      } catch (error) {
        console.error('Fel vid hämtning av statusar:', error);
      }
    };
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
      
      // Använd getEffectiveStatus för att få rätt status-ID
      const statusUid = getEffectiveStatus(ticket);
      
      setFormData({
        status: statusUid,
        customer: {
          name: getCustomerName(ticket.customer),
          email: ticket.customer?.email || "",
          phoneNumber: ticket.customer?.phoneNumber || "",
        },
        dynamicFields: initialDynamicFields,
      });
      
      // Återställ mail-valet när ny biljett laddas
      setShouldSendEmail(true);
    }
  }, [ticket]);

  // Hjälpfunktion för att hämta kundnamn
  const getCustomerName = (customer?: Customer): string => {
    if (!customer) return "";
    
    if (customer.name) {
      return customer.name;
    }
    
    if (customer.firstName || customer.lastName) {
      return `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
    }
    
    return customer.email || "";
  };

  if (!ticket) return null;

  // Hantera ändring för dynamiska fält
  const handleDynamicFieldChange = (fieldName: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      dynamicFields: { ...prev.dynamicFields, [fieldName]: value },
    }));
  };

  // Hantera statusändring - visa bekräftelsedialog först
  const handleStatusChange = (statusUid: string) => {
    const selectedOption = findStatusByUid(statusUid, statusOptions);
    
    if (selectedOption) {
      setNewStatus(statusUid);
      setSelectedStatusInfo(selectedOption);
      setConfirmDialogOpen(true);
    } else {
      // Om statusen inte hittas bland alternativ (borde inte inträffa), sätt direkt
      setFormData((prev: any) => ({
        ...prev,
        status: statusUid,
      }));
    }
  };

  // Efter bekräftelse, uppdatera status
  const confirmStatusChange = (statusUid: string | null) => {
    if (statusUid) {
      setFormData((prev: any) => ({
        ...prev,
        status: statusUid,
      }));
    }
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
  function prepareFormData(formData: any, ticket: Ticket, sendNotification?: boolean): any {
    const prepared = { ...formData, dynamicFields: { ...formData.dynamicFields } };
    
    // Lägg till flaggan för om notifiering ska skickas
    if (sendNotification !== undefined) {
      prepared.sendNotification = sendNotification;
    }
    
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

  // Hantera bekräftelse från StatusConfirmationDialog
  const handleConfirmStatus = (sendEmail: boolean) => {
    confirmStatusChange(newStatus);
    
    // Spara användarens val om mail ska skickas eller inte
    setShouldSendEmail(sendEmail);
    
    setConfirmDialogOpen(false);
    
    // Informera användaren om valet
    addToast({
      title: 'Status vald',
      description: sendEmail 
        ? 'Mail kommer att skickas när du sparar ändringarna' 
        : 'Inga mail kommer att skickas när du sparar',
      color: 'info',
      variant: 'flat'
    });
  };

  return (
    <Drawer isOpen={isOpen} onOpenChange={onClose} placement="right" size="md">
      <DrawerContent>
        <DrawerHeader>
          <h2>Redigera Ärende</h2>
        </DrawerHeader>
        <DrawerBody>
          <div className="space-y-4">
            {/* Status dropdown med dynamiska alternativ */}
            <div>
              <label className="block font-bold mb-1">Status</label>
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="flat">
                    {
                      // Visa statusnamnet om vi hittar det i alternativen, annars visa uid
                      findStatusByUid(formData.status, statusOptions)?.name ||
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
                    handleStatusChange(key);
                  }}
                  selectionMode="single"
                >
                  {statusOptions.map((option) => (
                    <DropdownItem key={option.uid}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: option.color }} 
                        />
                        {option.name}
                      </div>
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
                  // Hämta information om vald status
                  const selectedStatus = findStatusByUid(formData.status, statusOptions);
                  
                  // Kontrollera om den har en mailmall
                  const statusHasMailTemplate = hasMailTemplate(selectedStatus);
                  
                  // Mail skickas endast om det finns en mall OCH användaren har valt att skicka
                  const sendNotification = statusHasMailTemplate && shouldSendEmail;

                  const preparedData = prepareFormData(formData, ticket, sendNotification);
                  const res = await fetch(`/api/tickets/${ticket.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(preparedData),
                  });
                  
                  if (res.ok) {
                    const updatedTicket = await res.json();
                    onTicketUpdated(updatedTicket);
                    onClose();
                    
                    // Korrekt toastmeddelande baserat på vad som faktiskt sker
                    addToast({
                      title: 'Ärende uppdaterat',
                      description: statusHasMailTemplate && shouldSendEmail
                        ? 'Ärendet har uppdaterats och mail har skickats till kunden'
                        : 'Ärendet har uppdaterats utan mailnotifiering',
                      color: 'success',
                      variant: 'flat'
                    });
                  } else {
                    const errorData = await res.json().catch(() => ({}));
                    const errorMsg = errorData.message || 'Kunde inte uppdatera ärendet';
                    
                    console.error("Fel vid uppdatering:", errorMsg);
                    addToast({
                      title: 'Fel',
                      description: errorMsg,
                      color: 'danger',
                      variant: 'flat'
                    });
                  }
                } catch (err) {
                  console.error("Fel vid uppdatering:", err);
                  addToast({
                    title: 'Fel',
                    description: 'Ett fel inträffade vid uppdatering av ärendet',
                    color: 'danger',
                    variant: 'flat'
                  });
                }
              }}
            >
              Spara
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
      
      {/* StatusConfirmationDialog för statusändringar */}
      {selectedStatusInfo && (
        <StatusConfirmationDialog
          isOpen={confirmDialogOpen}
          onClose={() => setConfirmDialogOpen(false)}
          onConfirm={handleConfirmStatus}
          statusName={selectedStatusInfo.name}
          statusColor={selectedStatusInfo.color}
          ticketId={ticket.id}
          hasMailTemplate={hasMailTemplate(selectedStatusInfo)}
        />
      )}
    </Drawer>
  );
};

export default TicketEditDrawer;