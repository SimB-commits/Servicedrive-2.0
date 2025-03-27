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

// Import centralized status service
import ticketStatusService, { 
  TicketStatus,
  findStatusByUid, 
  getAllStatuses
} from "@/utils/ticketStatusService";

// Define types
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
  // Local form data
  const [formData, setFormData] = useState<any>({});
  // Status options
  const [statusOptions, setStatusOptions] = useState<TicketStatus[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Status confirmation dialog state
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string | null>(null);
  const [selectedStatusInfo, setSelectedStatusInfo] = useState<TicketStatus | null>(null);
  
  // Store user's choice about sending email
  const [shouldSendEmail, setShouldSendEmail] = useState<boolean>(true);

  // Fetch status options when component mounts using centralized service
  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        setLoading(true);
        // Use centralized service to get all statuses
        const allStatuses = await getAllStatuses();
        setStatusOptions(allStatuses);
      } catch (error) {
        console.error('Error fetching statuses:', error);
        addToast({
          title: 'Fel',
          description: 'Kunde inte hämta statusar',
          color: 'danger',
          variant: 'flat'
        });
      } finally {
        setLoading(false);
      }
    };
    fetchStatuses();
  }, []);

  // Set initial values when ticket changes
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
      
      // Use service to get correct status ID
      const statusUid = ticketStatusService.getStatusUid(ticket);
      
      setFormData({
        status: statusUid,
        customer: {
          name: getCustomerName(ticket.customer),
          email: ticket.customer?.email || "",
          phoneNumber: ticket.customer?.phoneNumber || "",
        },
        dynamicFields: initialDynamicFields,
      });
      
      // Reset email choice when new ticket loads
      setShouldSendEmail(true);
    }
  }, [ticket]);

  // Helper function to get customer name
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

  // Handle change for dynamic fields
  const handleDynamicFieldChange = (fieldName: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      dynamicFields: { ...prev.dynamicFields, [fieldName]: value },
    }));
  };

  // Handle status change - show confirmation dialog first
  const handleStatusChange = (statusUid: string) => {
    // Use service to find the selected status by UID
    const selectedOption = findStatusByUid(statusUid, statusOptions);
    
    if (selectedOption) {
      setNewStatus(statusUid);
      setSelectedStatusInfo(selectedOption);
      setConfirmDialogOpen(true);
    } else {
      // If status not found among options (shouldn't happen), set directly
      setFormData((prev: any) => ({
        ...prev,
        status: statusUid,
      }));
    }
  };

  // After confirmation, update status
  const confirmStatusChange = (statusUid: string | null) => {
    if (statusUid) {
      setFormData((prev: any) => ({
        ...prev,
        status: statusUid,
      }));
    }
  };

  // Format date values
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

  // Prepare data for update
  function prepareFormData(formData: any, ticket: Ticket, sendNotification?: boolean): any {
    const prepared = { ...formData, dynamicFields: { ...formData.dynamicFields } };
    
    // Add flag for whether to send notification
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

  // Handle confirmation from StatusConfirmationDialog
  const handleConfirmStatus = (sendEmail: boolean) => {
    confirmStatusChange(newStatus);
    
    // Save user's choice about sending email
    setShouldSendEmail(sendEmail);
    
    setConfirmDialogOpen(false);
    
    // Inform user about the choice
    addToast({
      title: 'Status vald',
      description: sendEmail 
        ? 'Mail kommer att skickas när du sparar ändringarna' 
        : 'Inga mail kommer att skickas när du sparar',
      color: 'primary',
      variant: 'flat'
    });
  };

  // Handle form submission
  const handleSubmit = async () => {
    try {
      setLoading(true);
      // Get information about selected status
      const selectedStatus = findStatusByUid(formData.status, statusOptions);
      
      // Check if it has a mail template
      const statusHasMailTemplate = selectedStatus ? ticketStatusService.hasMailTemplate(selectedStatus) : false;
      
      // Mail is sent only if there's a template AND user chose to send
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
        
        // Förbättrad toasthantering med tydligare meddelanden baserat på den faktiska situationen
        let toastTitle, toastDescription, toastColor;
        
        if (statusHasMailTemplate) {
          if (shouldSendEmail) {
            toastTitle = 'Ärende uppdaterat med mailnotifiering';
            toastDescription = `Status ändrad till "${selectedStatus?.name}" och mail har skickats till kunden`;
            toastColor = 'success';
          } else {
            toastTitle = 'Ärende uppdaterat utan mailnotifiering';
            toastDescription = `Status ändrad till "${selectedStatus?.name}" (inget mail skickades)`;
            toastColor = 'primary';
          }
        } else {
          toastTitle = 'Ärende uppdaterat';
          toastDescription = `Status ändrad till "${selectedStatus?.name}" (ingen mailmall finns konfigurerad)`;
          toastColor = 'primary';
        }
        
        addToast({
          title: toastTitle,
          description: toastDescription,
          color: toastColor,
          variant: 'flat'
        });
      } else {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData.message || 'Kunde inte uppdatera ärendet';
        
        console.error("Error updating ticket:", errorMsg);
        addToast({
          title: 'Fel',
          description: errorMsg,
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (err) {
      console.error("Error updating ticket:", err);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid uppdatering av ärendet',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} onOpenChange={onClose} placement="right" size="md">
      <DrawerContent>
        <DrawerHeader>
          <h2>Redigera Ärende</h2>
        </DrawerHeader>
        <DrawerBody>
          <div className="space-y-4">
            {/* Status dropdown with dynamic options */}
            <div>
              <label className="block font-bold mb-1">Status</label>
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="flat">
                    {
                      // Show status name if found in options, otherwise show UID
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
                    if (keys instanceof Set && keys.size > 0) {
                      const key = Array.from(keys)[0];
                      handleStatusChange(key);
                    }
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

            {/* Render other dynamic fields */}
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
              color="primary"
              onPress={handleSubmit}
              isLoading={loading}
              isDisabled={loading}
            >
              Spara
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
      
      {/* StatusConfirmationDialog for status changes */}
      {selectedStatusInfo && (
        <StatusConfirmationDialog
          isOpen={confirmDialogOpen}
          onClose={() => setConfirmDialogOpen(false)}
          onConfirm={handleConfirmStatus}
          statusName={selectedStatusInfo.name}
          statusColor={selectedStatusInfo.color}
          ticketId={ticket.id}
          hasMailTemplate={ticketStatusService.hasMailTemplate(selectedStatusInfo)}
        />
      )}
    </Drawer>
  );
};

export default TicketEditDrawer;