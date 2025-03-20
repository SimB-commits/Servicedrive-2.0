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
  const [statusOptions, setStatusOptions] = useState<Array<{ name: string; uid: string; color?: string; mailTemplateId?: number | null }>>([]);
  
  // State för statusbekräftelsedialogrutan
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string | null>(null);
  const [selectedStatusInfo, setSelectedStatusInfo] = useState<{ name: string; color: string; mailTemplateId?: number | null } | null>(null);

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
          const dynamicStatuses = data.map((s: any) => ({ 
            ...s, 
            uid: `CUSTOM_${s.id}`,
            mailTemplateId: s.mailTemplateId
          }));
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

  // Hantera statusändring - visa bekräftelsedialog först
  const handleStatusChange = (statusUid: string) => {
    const selectedOption = statusOptions.find(option => option.uid === statusUid);
    
    if (selectedOption) {
      setNewStatus(statusUid);
      setSelectedStatusInfo({
        name: selectedOption.name,
        color: selectedOption.color || '#000000',
        mailTemplateId: selectedOption.mailTemplateId
      });
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
    
    // Här skulle vi kunna spara direkt, men vi väljer att vänta till användaren klickar på Spara
    // för att ge användaren möjlighet att avbryta/göra andra ändringar
    
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
                    handleStatusChange(key);
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
                  // Hämta information om vald status för att kontrollera om den har en mailmall
                  const selectedStatus = statusOptions.find(opt => opt.uid === formData.status);
                  const hasMailTemplate = selectedStatus?.mailTemplateId !== null && 
                                         selectedStatus?.mailTemplateId !== undefined;
                  const sendNotification = hasMailTemplate; // Standardvärde baserat på StatusConfirmationDialog

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
                    
                    addToast({
                      title: 'Ärende uppdaterat',
                      description: hasMailTemplate && sendNotification
                        ? 'Ärendet har uppdaterats och mail har skickats till kunden'
                        : 'Ärendet har uppdaterats',
                      color: 'success',
                      variant: 'flat'
                    });
                  } else {
                    console.error("Kunde inte uppdatera ärendet");
                    addToast({
                      title: 'Fel',
                      description: 'Kunde inte uppdatera ärendet',
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
      <StatusConfirmationDialog
        isOpen={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        onConfirm={handleConfirmStatus}
        statusName={selectedStatusInfo?.name || ''}
        statusColor={selectedStatusInfo?.color || '#000000'}
        ticketId={ticket.id}
        hasMailTemplate={selectedStatusInfo?.mailTemplateId !== null && selectedStatusInfo?.mailTemplateId !== undefined}
      />
    </Drawer>
  );
};

export default TicketEditDrawer;