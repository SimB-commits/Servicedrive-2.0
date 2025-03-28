// pages/arenden/[id].tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { 
  Card, 
  CardHeader, 
  CardBody, 
  Button, 
  Spinner, 
  Tabs, 
  Tab, 
  Divider, 
  Dropdown, 
  DropdownTrigger, 
  DropdownMenu, 
  DropdownItem,
  Input,
  DatePicker,
  addToast
} from '@heroui/react';
import { parseAbsoluteToLocal } from "@internationalized/date";
import { title } from '@/components/primitives';
import { PrinterIcon, EditIcon } from '@/components/icons';
import StatusConfirmationDialog from '@/components/StatusConfirmationDialog';
import MessageThread from '@/components/email/MessageThread';

// Importera vår centraliserade statushantering
import ticketStatusService, { 
  TicketStatus, 
  findStatusByUid, 
  getStatusDisplay, 
  hasMailTemplate
} from '@/utils/ticketStatusService';

interface Ticket {
  customStatus: any;
  dueDate: any;
  id: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  customer?: any;
  ticketType?: any;
  dynamicFields: { [key: string]: any };
  messages?: any[];
}

export default function TicketPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [statusOptions, setStatusOptions] = useState<TicketStatus[]>([]);
  const [activeTab, setActiveTab] = useState('details');
  
  // State för statusbekräftelsedialog
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus | null>(null);

  // Nytt state för redigeringsläge
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({
    dynamicFields: {}
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Hämta ärende
  const fetchTicket = async () => {
    if (!id || !session) return;
    
    try {
      setLoading(true);
      const res = await fetch(`/api/tickets/${id}`);
      if (!res.ok) {
        throw new Error('Kunde inte hämta ärende');
      }
      const data = await res.json();
      setTicket(data);
      
      // Initiera formulärdata när ärendet laddas
      initializeFormData(data);
    } catch (error) {
      console.error('Fel vid hämtning av ärende:', error);
      addToast({
        title: 'Fel',
        description: 'Kunde inte hämta ärendet',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setLoading(false);
    }
  };

  // Initialisera formulärdata från ärendedata
  const initializeFormData = (ticketData: Ticket) => {
    if (!ticketData) return;
    
    const initialDynamicFields = { ...ticketData.dynamicFields };
    
    // Säker hantering av dueDate
    if (ticketData.dueDate) {
      try {
        initialDynamicFields._dueDate = formatDateForInput(ticketData.dueDate);
      } catch (e) {
        console.error('Fel vid formatering av dueDate:', e);
        initialDynamicFields._dueDate = null;
      }
    }
    
    setFormData({
      dynamicFields: initialDynamicFields
    });
  };
  
  // Hämta ärende
  useEffect(() => {
    fetchTicket();    
  }, [id, session]);

  // Hämta statusar via vår centraliserade service
  useEffect(() => {
    const loadStatuses = async () => {
      const allStatuses = await ticketStatusService.getAllStatuses();
      setStatusOptions(allStatuses);
    };
    loadStatuses();
  }, []);

  // Visa bekräftelsedialog istället för att uppdatera direkt
  const handleStatusChange = (statusOption: TicketStatus) => {
    setSelectedStatus(statusOption);
    setConfirmDialogOpen(true);
  };

  // Faktisk uppdatering av status via den centraliserade servicen
  const updateStatus = async (newStatus: string, sendEmail: boolean) => {
    if (!ticket || !id) return;

    try {
      // Använd den centraliserade funktionen för statusuppdatering
      const updatedTicket = await ticketStatusService.updateTicketStatus(
        Number(id),
        newStatus,
        sendEmail
      );
      
      // Uppdatera det lokala ticketobjektet
      setTicket(updatedTicket);
    } catch (error) {
      // Felhantering hanteras redan i servicen genom addToast
      console.error('Fel vid statusuppdatering');
    }
  };

  // Hantera ändringar i formulärfält
  const handleInputChange = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      dynamicFields: { 
        ...prev.dynamicFields, 
        [fieldName]: value 
      }
    }));
  };

  // Säker datumformatering för inputs
  const formatDateForInput = (dateValue: any): string => {
    if (!dateValue) return '';
    
    try {
      // Om det är ett Date-objekt
      if (dateValue instanceof Date) {
        return dateValue.toISOString().split('T')[0];
      }
      
      // Om det är en ISO-sträng
      if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
      
      return '';
    } catch (e) {
      console.error('Fel vid formatering av datum:', e);
      return '';
    }
  };
  
  // Formatera datum säkert för API-anrop
  const formatDateForApi = (value: any): string | null => {
    if (!value) return null;
    
    try {
      if (value instanceof Date) {
        return value.toISOString();
      }
      
      if (typeof value === 'string') {
        // Hantera 'YYYY-MM-DD' format
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          const date = new Date(`${value}T12:00:00Z`); // Lägg till tid för att undvika tidszonsproblem
          if (!isNaN(date.getTime())) {
            return date.toISOString();
          }
        }
        
        // Testa standardparsning
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
      
      return null;
    } catch (e) {
      console.error('Fel vid formatering av datum för API:', e);
      return null;
    }
  };

  // Validera formuläret
  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    // Kontrollera obligatoriska fält baserat på ticketType.fields
    if (ticket?.ticketType?.fields) {
      ticket.ticketType.fields.forEach(field => {
        if (field.isRequired && !formData.dynamicFields[field.name]) {
          errors[field.name] = `${field.name} är obligatoriskt`;
        }
      });
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Förbered data för uppdatering
  const prepareUpdateData = () => {
    if (!ticket) return null;
    
    const prepared: any = {
      dynamicFields: { ...formData.dynamicFields }
    };
    
    // Hantera dueDate särskilt
    if (formData.dynamicFields._dueDate !== undefined) {
      const dueDateValue = formData.dynamicFields._dueDate;
      prepared.dueDate = formatDateForApi(dueDateValue);
      delete prepared.dynamicFields._dueDate;
    }
    
    // Hantera datumfält baserat på fälttyp
    if (ticket.ticketType?.fields) {
      ticket.ticketType.fields.forEach(field => {
        if (field.fieldType === 'DATE' && formData.dynamicFields[field.name]) {
          prepared.dynamicFields[field.name] = formatDateForApi(formData.dynamicFields[field.name]);
        }
      });
    }
    
    return prepared;
  };

  // Spara ändringar
  const handleSaveChanges = async () => {
    if (!ticket || !id) return;
    
    if (!validateForm()) {
      addToast({
        title: 'Valideringsfel',
        description: 'Vänligen åtgärda felen i formuläret',
        color: 'danger',
        variant: 'flat'
      });
      return;
    }
    
    const updateData = prepareUpdateData();
    if (!updateData) return;
    
    try {
      setIsSaving(true);
      
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Kunde inte uppdatera ärendet');
      }
      
      const updatedTicket = await res.json();
      
      // Kontrollera om uppdaterad ärendedata innehåller nödvändiga fält
      if (!updatedTicket.ticketType || !updatedTicket.ticketType.fields) {
        console.warn('Uppdaterad ärendedata saknar nödvändiga fält, hämtar ärendet på nytt');
        // Hämta hela ärendet på nytt för att säkerställa komplett data
        await fetchTicket();
      } else {
        // Uppdatera state med den kompletta ärendedatan
        setTicket(updatedTicket);
        initializeFormData(updatedTicket);
      }
      
      // Stäng redigeringsläget
      setIsEditing(false);
      
      // Visa bekräftelse till användaren
      addToast({
        title: 'Ärende uppdaterat',
        description: 'Ändringarna har sparats',
        color: 'success',
        variant: 'flat'
      });
    } catch (error) {
      console.error('Fel vid uppdatering av ärende:', error);
      addToast({
        title: 'Fel',
        description: error instanceof Error ? error.message : 'Ett fel inträffade vid uppdatering',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Avbryt redigering
  const handleCancelEdit = () => {
    if (confirm('Är du säker på att du vill avbryta redigeringen? Ändringar kommer att förloras.')) {
      // Återställ formuläret till ursprungsvärden
      initializeFormData(ticket as Ticket);
      setIsEditing(false);
      setValidationErrors({});
    }
  };

  // Funktion för att formatera kundinformation
  const getCustomerInfo = () => {
    if (!ticket?.customer) return { name: 'Okänd kund' };

    let customerName = '';
    if (ticket.customer.firstName || ticket.customer.lastName) {
      customerName = `${ticket.customer.firstName || ''} ${ticket.customer.lastName || ''}`.trim();
    } else if (ticket.customer.name) {
      // Bakåtkompatibilitet med äldre kundmodell
      customerName = ticket.customer.name;
    } else {
      customerName = ticket.customer.email || `Kund #${ticket.customer.id}`;
    }

    return {
      name: customerName,
      email: ticket.customer.email,
      phone: ticket.customer.phoneNumber,
      address: ticket.customer.address,
      postalCode: ticket.customer.postalCode,
      city: ticket.customer.city
    };
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div>Ingen session – vänligen logga in.</div>
        <Button color="primary" onPress={() => router.push("/auth/login")}>
          Logga in
        </Button>
      </section>
    );
  }

  if (!ticket) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div>Ärende hittades inte.</div>
        <Button onPress={() => router.push('/arenden')}>Tillbaka till ärendelistan</Button>
      </section>
    );
  }

  // Använd vår centraliserade funktion för att få statusvisning
  const statusDisplay = getStatusDisplay(ticket);
  const customerInfo = getCustomerInfo();

  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="w-full max-w-6xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className={title({ size: 'sm' })}>Ärende #{ticket.id}</h1>
            <p className="text-default-500 mt-1">
              {ticket.ticketType?.name} • Skapad {new Date(ticket.createdAt).toLocaleDateString('sv-SE')}
            </p>
          </div>
          
          {/* Knappar för åtgärder */}
          <div className="flex gap-3">
            {/* Statushantering (behåll som den är) */}
            <Dropdown>
              <DropdownTrigger>
                <Button variant="flat" style={{ backgroundColor: statusDisplay.color + '20', color: statusDisplay.color }} disabled={isEditing}>
                  Status: {statusDisplay.name}
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Ändra status">
                {statusOptions.map((option) => (
                  <DropdownItem 
                    key={option.uid} 
                    onPress={() => handleStatusChange(option)}
                    disabled={isEditing} // Inaktivera när man redigerar
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: option.color || '#cccccc' }} 
                      />
                      {option.name}
                    </div>
                  </DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>
            
            {/* Redigeringsknappar */}
            {isEditing ? (
              <>
                <Button
                  color="primary"
                  onPress={handleSaveChanges}
                  isLoading={isSaving}
                  isDisabled={isSaving}
                >
                  Spara ändringar
                </Button>
                <Button
                  variant="flat"
                  onPress={handleCancelEdit}
                  isDisabled={isSaving}
                >
                  Avbryt
                </Button>
              </>
            ) : (
              <Button
                color="primary"
                variant="flat"
                startContent={<EditIcon />}
                onPress={() => setIsEditing(true)}
              >
                Redigera ärende
              </Button>
            )}
            
            <Button
              variant="flat"
              color="primary"
              onPress={() => router.push('/arenden')}
              isDisabled={isEditing} // Inaktivera när man redigerar
            >
              Tillbaka till ärendelistan
            </Button>
          </div>
        </div>

        <Tabs 
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as string)}
          variant="underlined"
          color="primary"
          className="mb-4"
        >
          <Tab key="details" title="Ärendedetaljer" />
          <Tab key="messages" title="Meddelanden" isDisabled={isEditing} /> {/* Inaktivera när man redigerar */}
          <Tab key="history" title="Historik" isDisabled={isEditing} /> {/* Inaktivera när man redigerar */}
        </Tabs>

        {activeTab === 'details' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Kundinformation */}
            <Card className="col-span-1">
              <CardHeader className="px-6 py-4">
                <h2 className="text-lg font-medium">Kundinformation</h2>
              </CardHeader>
              <CardBody className="px-6 py-4">
                <div className="space-y-2">
                  <p className="font-medium text-lg">{customerInfo.name}</p>
                  
                  {customerInfo.email && (
                    <p>
                      <span className="text-default-500">E-post:</span> {customerInfo.email}
                    </p>
                  )}
                  
                  {customerInfo.phone && (
                    <p>
                      <span className="text-default-500">Telefon:</span> {customerInfo.phone}
                    </p>
                  )}
                  
                  {customerInfo.address && (
                    <div className="mt-4">
                      <span className="text-default-500">Adress:</span>
                      <p>{customerInfo.address}</p>
                      <p>{customerInfo.postalCode} {customerInfo.city}</p>
                    </div>
                  )}
                </div>
                
                <Divider className="my-4" />
                
                <Button 
                  size="sm"
                  variant="flat"
                  color="primary"
                  className="w-full"
                  onPress={() => router.push(`/kunder/${ticket.customer?.id}`)}
                  isDisabled={isEditing} // Inaktivera när man redigerar
                >
                  Visa kundprofil
                </Button>
              </CardBody>
            </Card>
            
            {/* Ärendeinformation */}
            <Card className="col-span-1 md:col-span-2">
              <CardHeader className="px-6 py-4 flex justify-between items-center">
                <h2 className="text-lg font-medium">Ärendeinformation</h2>
              </CardHeader>
              
              <CardBody className="px-6 py-4">
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-default-500">Ärendetyp</p>
                      <p className="font-medium">{ticket.ticketType?.name || 'Ej angiven'}</p>
                    </div>
                    
                    <div>
                      <p className="text-default-500">Status</p>
                      <p 
                        className="font-medium" 
                        style={{ color: statusDisplay.color }}
                      >
                        {statusDisplay.name}
                      </p>
                    </div>
                    
                    {/* Visa deadline som vanlig text eller som datepicker i redigeringsläge */}
                    <div>
                      <p className="text-default-500">Deadline</p>
                      {isEditing ? (
                        <Input
                          type="date"
                          value={formData.dynamicFields._dueDate || ''}
                          onValueChange={(value) => handleInputChange('_dueDate', value)}
                          isInvalid={!!validationErrors._dueDate}
                          errorMessage={validationErrors._dueDate}
                        />
                      ) : (
                        <p className="font-medium">
                          {ticket.dueDate 
                            ? new Date(ticket.dueDate).toLocaleDateString('sv-SE') 
                            : 'Ingen deadline'}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <Divider />
                  
                  {/* Dynamiska fält */}
                  {ticket.ticketType?.fields && ticket.ticketType.fields.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {ticket.ticketType.fields
                        .filter((field) => field.fieldType !== "DUE_DATE")
                        .map((field) => (
                          <div key={field.name} className={field.name === 'Kommentar' ? 'col-span-2' : ''}>
                            <p className="text-default-500">{field.name}</p>
                            
                            {/* Visa som formulärfält i redigeringsläge */}
                            {isEditing ? (
                              field.fieldType === "DATE" ? (
                                <Input
                                  type="date"
                                  value={formData.dynamicFields[field.name] || ''}
                                  onValueChange={(value) => handleInputChange(field.name, value)}
                                  isInvalid={!!validationErrors[field.name]}
                                  errorMessage={validationErrors[field.name]}
                                />
                              ) : field.fieldType === "NUMBER" ? (
                                <Input
                                  type="number"
                                  value={formData.dynamicFields[field.name] || ''}
                                  onValueChange={(value) => handleInputChange(field.name, value)}
                                  isInvalid={!!validationErrors[field.name]}
                                  errorMessage={validationErrors[field.name]}
                                />
                              ) : (
                                <Input
                                  value={formData.dynamicFields[field.name] || ''}
                                  onValueChange={(value) => handleInputChange(field.name, value)}
                                  isInvalid={!!validationErrors[field.name]}
                                  errorMessage={validationErrors[field.name]}
                                />
                              )
                            ) : (
                              <p className="font-medium">
                                {ticket.dynamicFields && ticket.dynamicFields[field.name] !== undefined
                                  ? field.fieldType === "DATE"
                                    ? new Date(ticket.dynamicFields[field.name]).toLocaleDateString("sv-SE")
                                    : String(ticket.dynamicFields[field.name])
                                  : "-"}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-center text-default-500">Inga ärendefält</p>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {activeTab === 'messages' && (
          <MessageThread 
            ticket={ticket}
            onMessageSent={() => {
              // Uppdatera ärendet vid nytt meddelande
              fetchTicket();
            }}
          />
        )}

        {activeTab === 'history' && (
          <Card>
            <CardHeader className="px-6 py-4">
              <h2 className="text-lg font-medium">Ärendehistorik</h2>
            </CardHeader>
            <CardBody className="px-6 py-4">
              <div className="space-y-6">
                <div className="flex items-center">
                  <div className="bg-success rounded-full w-4 h-4 mr-3"></div>
                  <div className="flex-1">
                    <p className="text-sm text-default-500">
                      {new Date(ticket.createdAt).toLocaleDateString('sv-SE', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    <p>Ärendet skapades</p>
                  </div>
                </div>
                
                {ticket.updatedAt !== ticket.createdAt && (
                  <div className="flex items-center">
                    <div className="bg-primary rounded-full w-4 h-4 mr-3"></div>
                    <div className="flex-1">
                      <p className="text-sm text-default-500">
                        {new Date(ticket.updatedAt).toLocaleDateString('sv-SE', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      <p>Ärendet uppdaterades senast</p>
                    </div>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        )}

        {/* StatusConfirmationDialog för att bekräfta statusändring */}
        {selectedStatus && (
          <StatusConfirmationDialog
            isOpen={confirmDialogOpen}
            onClose={() => setConfirmDialogOpen(false)}
            onConfirm={(sendEmail) => {
              if (selectedStatus) {
                // Indikera till användaren vad som kommer att hända genom en tillfällig toast
                addToast({
                  title: 'Status uppdateras',
                  description: sendEmail && hasMailTemplate(selectedStatus)
                    ? `Uppdaterar till "${selectedStatus.name}" med mailnotifiering` 
                    : `Uppdaterar till "${selectedStatus.name}" utan mailnotifiering`,
                  color: 'primary',
                  variant: 'flat'
                });
                
                // Genomför statusuppdateringen
                updateStatus(selectedStatus.uid, sendEmail);
                setConfirmDialogOpen(false);
              }
            }}
            statusName={selectedStatus.name}
            statusColor={selectedStatus.color}
            ticketId={ticket.id}
            hasMailTemplate={hasMailTemplate(selectedStatus)}
          />
        )}
      </div>
    </section>
  );
}