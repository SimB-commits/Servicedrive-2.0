// Hjälpfunktion för att formatera datum för input[type="date"]
const formatDateForInput = (dateString: string | undefined): string => {
  if (!dateString) return '';
  
  try {
    // Försök formatera datumet från ISO-format till YYYY-MM-DD
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return ''; // Ogiltig datum
    
    // Få år, månad, dag och formatera som YYYY-MM-DD
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.error('Fel vid datumformatering:', error);
    return '';
  }
};

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import {
addToast,
Form,
Button,
Modal,
ModalContent,
ModalHeader,
ModalBody,
ModalFooter,
Table,
TableHeader,
TableRow,
TableBody,
TableCell,
TableColumn,
Input,
Checkbox,
Dropdown,
DropdownTrigger,
DropdownMenu,
DropdownItem,
Pagination
} from '@heroui/react';
import { title, subtitle } from '@/components/primitives';
import { DeleteIcon, EditIcon, EyeIcon } from '@/components/icons';
import CustomerDrawer from '@/components/CustomerDrawer';

interface Customer {
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
dynamicFields?: Record<string, any>;
createdAt: string;
}

interface CustomerCardTemplate {
id: number;
cardName: string;
dynamicFields: Record<string, any>;
isDefault: boolean;
}

export default function KundPage() {
const { data: session, status } = useSession();
const [customers, setCustomers] = useState<Customer[]>([]);
const [loading, setLoading] = useState(true);
const [createModalOpen, setCreateModalOpen] = useState(false);
const [editModalOpen, setEditModalOpen] = useState(false);
const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
const [customerFormValues, setCustomerFormValues] = useState<Record<string, any>>({});
const [editFormValues, setEditFormValues] = useState<Record<string, any>>({});
const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
const [filterValue, setFilterValue] = useState("");
const [page, setPage] = useState(1);
const [rowsPerPage, setRowsPerPage] = useState(10);

// State för att hantera CustomerDrawer
const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

// Kundkortsmallsrelaterade states
const [customerCardTemplates, setCustomerCardTemplates] = useState<CustomerCardTemplate[]>([]);
const [selectedTemplate, setSelectedTemplate] = useState<CustomerCardTemplate | null>(null);
const [loadingTemplates, setLoadingTemplates] = useState(true);

// Funktion för att öppna CustomerDrawer
const handleOpenViewDrawer = (customer: Customer) => {
  setSelectedCustomer(customer);
  setViewDrawerOpen(true);
};

// Hämta kunder vid sidladdning
useEffect(() => {
  if (status === 'loading') return;
  
  if (!session) {
    setLoading(false);
    return;
  }

  fetchCustomers();
}, [session, status]);

// Hämta kundkortsmallar
useEffect(() => {
  if (!session) return;
  
  setLoadingTemplates(true);
  fetch('/api/customerCards')
    .then((res) => res.json())
    .then((data) => {
      if (Array.isArray(data)) {
        setCustomerCardTemplates(data);
        
        // Hitta default-mallen om den finns
        const defaultTemplate = data.find(template => template.isDefault);
        if (defaultTemplate) {
          setSelectedTemplate(defaultTemplate);
          
          // Initiera formuläret med mallfälten
          initializeFormWithTemplate(defaultTemplate, setCustomerFormValues);
        } else if (data.length > 0) {
          setSelectedTemplate(data[0]);
          
          // Initiera formuläret med den första mallens fält
          initializeFormWithTemplate(data[0], setCustomerFormValues);
        }
      } else {
        console.error("API returnerade inte en array för kundkortsmallar:", data);
        setCustomerCardTemplates([]);
      }
      setLoadingTemplates(false);
    })
    .catch((err) => {
      console.error('Fel vid hämtning av kundkortsmallar:', err);
      setLoadingTemplates(false);
    });
}, [session]);

const fetchCustomers = async () => {
  try {
    setLoading(true);
    const res = await fetch('/api/customers');
    if (!res.ok) {
      throw new Error('Kunde inte hämta kunder');
    }
    const data = await res.json();
    setCustomers(data);
  } catch (error) {
    console.error('Fel vid hämtning av kunder:', error);
    addToast({
      title: 'Fel',
      description: 'Kunde inte hämta kunder.',
      color: 'danger',
      variant: 'flat'
    });
  } finally {
    setLoading(false);
  }
};

// Hjälpfunktion för att initiera formulär med mallfält
const initializeFormWithTemplate = (template: CustomerCardTemplate, setFormState: React.Dispatch<React.SetStateAction<Record<string, any>>>) => {
  const initialFormValues: Record<string, any> = {
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    newsletter: false,
    loyal: false
  };
  
  if (template.dynamicFields) {
    Object.entries(template.dynamicFields).forEach(([key, valueStr]) => {
      try {
        // Analysera JSON-strängen om den är en sträng
        const fieldData = typeof valueStr === 'string' ? JSON.parse(valueStr) : valueStr;
        
        // Om detta är ett mappat fält (standard eller dynamiskt)
        if (fieldData.mapping) {
          const fieldName = fieldData.mapping === 'DYNAMIC' ? key : fieldData.mapping;
          
          // Sätt initialvärdet (tom sträng för de flesta fält, false för checkboxar)
          if (fieldName === 'newsletter' || fieldName === 'loyal') {
            initialFormValues[fieldName] = false;
          } else {
            initialFormValues[fieldName] = '';
          }
        }
      } catch (e) {
        console.error(`Error parsing field data for ${key}:`, e);
      }
    });
  }
  
  setFormState(initialFormValues);
};

const handleSelectTemplate = (template: CustomerCardTemplate) => {
  setSelectedTemplate(template);
  initializeFormWithTemplate(template, setCustomerFormValues);
};

const handleInputChange = (value: any, fieldName: string): void => {
  setCustomerFormValues((prev) => ({
    ...prev,
    [fieldName]: value,
  }));
};

const handleEditInputChange = (value: any, fieldName: string): void => {
  setEditFormValues((prev) => ({
    ...prev,
    [fieldName]: value,
  }));
};

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setValidationErrors({});

  try {
    // Separera standardfält från dynamiska fält
    const {
      firstName, 
      lastName,
      email,
      phoneNumber,
      address,
      postalCode,
      city,
      country,
      dateOfBirth,
      newsletter,
      loyal,
      ...dynamicFields // Övriga fält hamnar i dynamicFields
    } = customerFormValues;

    if (!email) {
      setValidationErrors({
        email: 'E-postadress krävs'
      });
      return;
    }

    // Skapa ett kundobjekt som ska skickas till API:et
    const customerInput = {
      firstName,
      lastName,
      email,
      phoneNumber,
      address,
      postalCode,
      city,
      country,
      dateOfBirth: dateOfBirth || undefined,
      newsletter: newsletter || false,
      loyal: loyal || false,
      // Samla alla andra fält i dynamicFields
      dynamicFields: Object.keys(dynamicFields).length > 0 ? dynamicFields : {}
    };

    const response = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customerInput),
    });

    if (!response.ok) {
      const data = await response.json();
      if (data.message === 'Kund med denna email finns redan.') {
        setValidationErrors({
          email: 'Kund med denna e-postadress finns redan'
        });
        return;
      }
      throw new Error(data.message || 'Kunde inte skapa kund');
    }

    const newCustomer = await response.json();
    setCustomers((prev) => [...prev, newCustomer]);
    
    addToast({
      title: 'Framgång',
      description: 'Kunden skapades!',
      color: 'success',
      variant: 'flat'
    });
    
    setCreateModalOpen(false);
    resetCustomerForm();
  } catch (error) {
    console.error('Fel vid skapande av kund:', error);
    addToast({
      title: 'Fel',
      description: error instanceof Error ? error.message : 'Ett fel inträffade',
      color: 'danger',
      variant: 'flat'
    });
  }
};

const handleEditSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!editingCustomer) return;
  
  setValidationErrors({});

  try {
    // Separera standardfält från dynamiska fält
    const {
      firstName, 
      lastName,
      email,
      phoneNumber,
      address,
      postalCode,
      city,
      country,
      dateOfBirth,
      newsletter,
      loyal,
      ...dynamicFields // Övriga fält hamnar i dynamicFields
    } = editFormValues;

    console.log('dateOfBirth från formulär:', dateOfBirth, 'typ:', typeof dateOfBirth);

    if (!email) {
      setValidationErrors({
        email: 'E-postadress krävs'
      });
      return;
    }

    // Skapa ett kundobjekt som ska skickas till API:et
    const customerInput = {
      firstName,
      lastName,
      email,
      phoneNumber,
      address,
      postalCode,
      city,
      country,
      dateOfBirth: dateOfBirth || undefined,
      newsletter: newsletter || false,
      loyal: loyal || false,
      // Samla alla andra fält i dynamicFields
      dynamicFields: Object.keys(dynamicFields).length > 0 ? dynamicFields : {}
    };

    console.log('Skickar uppdatering för kund:', customerInput);

    const response = await fetch(`/api/customers/${editingCustomer.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customerInput),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Fel vid uppdatering:', data);
      
      if (data.message === 'Valideringsfel' && data.errors) {
        // Hantera strukturerade valideringsfel
        const formattedErrors: Record<string, string> = {};
        data.errors.forEach((err: {field: string, message: string}) => {
          formattedErrors[err.field] = err.message;
        });
        setValidationErrors(formattedErrors);
        throw new Error(`Valideringsfel: ${Object.values(formattedErrors).join(', ')}`);
      }
      
      throw new Error(data.message || 'Kunde inte uppdatera kund');
    }

    // Uppdatera kundlistan med den uppdaterade kunden
    setCustomers((prev) => 
      prev.map((customer) => customer.id === data.id ? data : customer)
    );
    
    addToast({
      title: 'Framgång',
      description: 'Kunden uppdaterades!',
      color: 'success',
      variant: 'flat'
    });
    
    setEditModalOpen(false);
    setEditingCustomer(null);
  } catch (error) {
    console.error('Fel vid uppdatering av kund:', error);
    addToast({
      title: 'Fel',
      description: error instanceof Error ? error.message : 'Ett fel inträffade',
      color: 'danger',
      variant: 'flat'
    });
  }
};

const handleDelete = async (id: number) => {
  if (!confirm('Är du säker på att du vill ta bort denna kund? Alla ärenden kopplade till kunden kommer också att tas bort.')) return;

  try {
    const response = await fetch(`/api/customers/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Kunde inte ta bort kunden');
    }
    
    setCustomers((prev) => prev.filter((customer) => customer.id !== id));
    
    addToast({
      title: 'Framgång',
      description: 'Kunden och alla tillhörande ärenden togs bort!',
      color: 'success',
      variant: 'flat'
    });
  } catch (error) {
    console.error('Fel vid borttagning av kund:', error);
    addToast({
      title: 'Fel',
      description: error instanceof Error ? error.message : 'Ett fel inträffade',
      color: 'danger',
      variant: 'flat'
    });
  }
};

const handleEdit = (customer: Customer) => {
  setEditingCustomer(customer);
  
  // Anpassa formuläret för redigeringen
  const formValues = {
    firstName: customer.firstName || '',
    lastName: customer.lastName || '',
    email: customer.email || '',
    phoneNumber: customer.phoneNumber || '',
    address: customer.address || '',
    postalCode: customer.postalCode || '',
    city: customer.city || '',
    country: customer.country || '',
    // Använd hjälpfunktionen för att formatera datumet
    dateOfBirth: formatDateForInput(customer.dateOfBirth),
    newsletter: customer.newsletter || false,
    loyal: customer.loyal || false,
  };
  
  // Lägg till dynamiska fält om de finns
  if (customer.dynamicFields) {
    Object.entries(customer.dynamicFields).forEach(([key, value]) => {
      formValues[key] = value;
    });
  }
  
  console.log('Redigerar kund med data:', formValues);
  
  setEditFormValues(formValues);
  setEditModalOpen(true);
};

const resetCustomerForm = () => {
  if (selectedTemplate) {
    initializeFormWithTemplate(selectedTemplate, setCustomerFormValues);
  } else {
    setCustomerFormValues({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      newsletter: false,
      loyal: false
    });
  }
  setValidationErrors({});
};

// Filtrera kunder baserat på sökterm
const filteredCustomers = useMemo(() => {
  return customers.filter((customer) => {
    const searchTerm = filterValue.toLowerCase();
    if (!searchTerm) return true;
    
    const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim().toLowerCase();
    return fullName.includes(searchTerm) || 
           (customer.email && customer.email.toLowerCase().includes(searchTerm)) ||
           (customer.phoneNumber && customer.phoneNumber.toLowerCase().includes(searchTerm));
  });
}, [customers, filterValue]);

// Paginering
const pages = Math.ceil(filteredCustomers.length / rowsPerPage);

const displayedCustomers = useMemo(() => {
  const start = (page - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  return filteredCustomers.slice(start, end);
}, [filteredCustomers, page, rowsPerPage]);

// Sökfunktionalitet
const onSearchChange = (value: string) => {
  setFilterValue(value);
  setPage(1);
};

// Uppdatera antal rader per sida
const onRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
  setRowsPerPage(Number(e.target.value));
  setPage(1);
};

// Navigering mellan sidor
const onNextPage = () => {
  if (page < pages) setPage(page + 1);
};

const onPreviousPage = () => {
  if (page > 1) setPage(page - 1);
};

// Komponera tabelltoppdelen med sök och filter
const topContent = useMemo(() => (
  <div className="flex flex-col gap-4">
    <div className="flex justify-between gap-3 items-end">
      <Input
        isClearable
        className="w-full sm:max-w-[44%]"
        placeholder="Sök på kund..."
        value={filterValue}
        onClear={() => onSearchChange("")}
        onValueChange={onSearchChange}
      />
      <div className="flex gap-3">
        <Button color="primary" onPress={() => setCreateModalOpen(true)}>
          Lägg till kund
        </Button>
      </div>
    </div>
    <div className="flex justify-between items-center">
      <span className="text-default-400 text-small">
        Totalt {filteredCustomers.length} kunder
      </span>
      <label className="flex items-center text-default-400 text-small">
        Rader per sida:
        <select
          className="bg-transparent outline-none text-default-400 text-small ml-2"
          onChange={onRowsPerPageChange}
          value={rowsPerPage}
        >
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="15">15</option>
        </select>
      </label>
    </div>
  </div>
), [filterValue, filteredCustomers.length, rowsPerPage]);

// Komponera tabellbottendelen med paginering
const bottomContent = useMemo(() => (
  <div className="py-2 px-2 flex justify-between items-center">
    <span className="w-[30%] text-small text-default-400">
      {`Visar ${displayedCustomers.length} av ${filteredCustomers.length} kunder`}
    </span>
    <Pagination
      isCompact
      showControls
      showShadow
      color="primary"
      page={page}
      total={pages}
      onChange={setPage}
    />
    <div className="hidden sm:flex w-[30%] justify-end gap-2">
      <Button isDisabled={page === 1} size="sm" variant="flat" onPress={onPreviousPage}>
        Föregående
      </Button>
      <Button isDisabled={page === pages} size="sm" variant="flat" onPress={onNextPage}>
        Nästa
      </Button>
    </div>
  </div>
), [page, pages, filteredCustomers.length, displayedCustomers.length]);

// Funktion för att rendera formulärfält baserat på den valda mallen
const renderTemplateFields = (
  template: CustomerCardTemplate | null, 
  formValues: Record<string, any>,
  onChangeHandler: (value: any, fieldName: string) => void,
  formErrors: Record<string, string> = {}
) => {
  if (!template || !template.dynamicFields) return null;
  
  return (
    <>
      {Object.entries(template.dynamicFields)
        .map(([key, value]) => {
          try {
            const fieldData = typeof value === 'string' ? JSON.parse(value) : value;
            return {
              key,
              fieldData,
              // Använd order-egenskapen för sortering om den finns, annars högsta värdet
              order: fieldData.order !== undefined ? fieldData.order : 9999
            };
          } catch (e) {
            console.error('Error parsing field data:', e);
            return null;
          }
        })
        .filter(Boolean)
        // Sortera baserat på order-egenskapen
        .sort((a, b) => (a?.order || 0) - (b?.order || 0))
        .map(field => {
          if (!field) return null;
          
          // Hantera olika typer av fält
          const fieldName = field.fieldData.mapping === 'DYNAMIC' ? field.key : field.fieldData.mapping;
          const fieldLabel = field.fieldData.mapping === 'DYNAMIC' 
            ? field.key 
            : (fieldName.charAt(0).toUpperCase() + fieldName.slice(1));
          
          // Speciella fält (utöver text)
          if (fieldName === 'newsletter' || fieldName === 'loyal') {
            return (
              <div key={field.key} className="col-span-2 mt-2">
                <Checkbox
                  isSelected={formValues[fieldName] || false}
                  onValueChange={(checked) => onChangeHandler(checked, fieldName)}
                >
                  {fieldLabel}
                </Checkbox>
              </div>
            );
          }
          
          // Bestäm vilken typ av input som ska användas
          let inputType = "text";
          if (field.fieldData.inputType === 'NUMBER') {
            inputType = "number";
          } else if (field.fieldData.inputType === 'DATE' || fieldName === 'dateOfBirth') {
            inputType = "date";
          } else if (fieldName === 'email') {
            inputType = "email";
          }
          
          return (
            <div key={field.key} className={field.fieldData.mapping === 'DYNAMIC' || fieldName === 'address' ? 'col-span-2' : 'col-span-1'}>
              <Input
                label={fieldLabel}
                name={fieldName}
                type={inputType}
                isRequired={field.fieldData.isRequired || fieldName === 'email'}
                value={formValues[fieldName] || ''}
                onValueChange={(value) => onChangeHandler(value, fieldName)}
                isInvalid={!!formErrors[fieldName]}
                errorMessage={formErrors[fieldName]}
              />
            </div>
          );
        })
      }
    </>
  );
};

if (status === 'loading' || loading) {
  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div>Laddar...</div>
    </section>
  );
}

if (!session) {
  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div>Ingen session – vänligen logga in.</div>
    </section>
  );
}

return (
  <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
    <div className="inline-block max-w-lg text-center">
      <h1 className={title({ size: 'sm' })}>Kunder</h1>
      <p className="mb-4">Hantera dina kunder</p>
    </div>

    {/* Kundtabell */}
    <div className="w-full max-w-6xl mt-4">
      <Table
        aria-label="Kunder"
        topContent={topContent}
        topContentPlacement="outside"
        bottomContent={bottomContent}
        bottomContentPlacement="outside"
      >
        <TableHeader>
          <TableColumn>Namn</TableColumn>
          <TableColumn>E-post</TableColumn>
          <TableColumn>Telefon</TableColumn>
          <TableColumn>Adress</TableColumn>
          <TableColumn>Kundtyp</TableColumn>
          <TableColumn>Åtgärder</TableColumn>
        </TableHeader>
        <TableBody emptyContent="Inga kunder hittades">
          {displayedCustomers.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell>
                {(customer.firstName || customer.lastName) 
                  ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() 
                  : '-'}
              </TableCell>
              <TableCell>{customer.email || '-'}</TableCell>
              <TableCell>{customer.phoneNumber || '-'}</TableCell>
              <TableCell>
                {customer.address 
                  ? `${customer.address}, ${customer.postalCode || ''} ${customer.city || ''}`.trim() 
                  : '-'}
              </TableCell>
              <TableCell>
                {customer.loyal ? 
                  <span className="text-success">Stamkund</span> : 
                  <span className="text-default-500">Standard</span>}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button 
                    type="button" 
                    variant="flat" 
                    isIconOnly
                    onPress={() => handleOpenViewDrawer(customer)}
                  >
                    <EyeIcon />
                  </Button>
                  <Button 
                    type="button" 
                    variant="flat" 
                    isIconOnly
                    onPress={() => handleEdit(customer)}
                  >
                    <EditIcon />
                  </Button>
                  <Button 
                    type="button" 
                    variant="flat" 
                    isIconOnly
                    color="danger"
                    onPress={() => handleDelete(customer.id)}
                  >
                    <DeleteIcon />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    {/* Modal för att skapa ny kund */}
    <Modal
      isOpen={createModalOpen}
      onOpenChange={setCreateModalOpen}
      scrollBehavior="inside"
      size="3xl"
    >
      <ModalContent>
        <ModalHeader>
          <h2 className="text-xl font-bold">Lägg till ny kund</h2>
        </ModalHeader>
        <ModalBody>
          {customerCardTemplates.length > 1 && (
            <div className="mb-4">
              <Dropdown>
                <DropdownTrigger>
                  <Button 
                    variant="flat" 
                    className="w-full justify-start"
                  >
                    {selectedTemplate ? `Mall: ${selectedTemplate.cardName}` : 'Välj kundkortsmall'}
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Kundkortsmallar">
                  {customerCardTemplates.map(template => (
                    <DropdownItem 
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                    >
                      {template.cardName} {template.isDefault && '(Standard)'}
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              </Dropdown>
            </div>
          )}
          
          <Form 
            onSubmit={handleSubmit} 
            className="space-y-6"
            validationErrors={validationErrors}
          >
            <div className="grid grid-cols-2 gap-4">
              {renderTemplateFields(selectedTemplate, customerFormValues, handleInputChange, validationErrors)}
            </div>
            
            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="flat" 
                onPress={() => {
                  resetCustomerForm();
                  setCreateModalOpen(false);
                }}
              >
                Avbryt
              </Button>
              <Button type="submit" color="primary">
                Skapa kund
              </Button>
            </div>
          </Form>
        </ModalBody>
      </ModalContent>
    </Modal>

    {/* Modal för att redigera kund */}
    <Modal
      isOpen={editModalOpen}
      onOpenChange={setEditModalOpen}
      scrollBehavior="inside"
      size="3xl"
    >
      <ModalContent>
        <ModalHeader>
          <h2 className="text-xl font-bold">Redigera kund</h2>
        </ModalHeader>
        <ModalBody>
          <Form 
            onSubmit={handleEditSubmit} 
            className="space-y-6"
            validationErrors={validationErrors}
          >
            <div className="grid grid-cols-2 gap-4">
              {/* Standardfält för redigering */}
              <div className="col-span-1">
                <Input
                  label="Förnamn"
                  name="firstName"
                  value={editFormValues.firstName || ''}
                  onValueChange={(value) => handleEditInputChange(value, 'firstName')}
                />
              </div>
              <div className="col-span-1">
                <Input
                  label="Efternamn"
                  name="lastName"
                  value={editFormValues.lastName || ''}
                  onValueChange={(value) => handleEditInputChange(value, 'lastName')}
                />
              </div>
              <div className="col-span-1">
                <Input
                  label="E-post"
                  name="email"
                  type="email"
                  isRequired
                  value={editFormValues.email || ''}
                  onValueChange={(value) => handleEditInputChange(value, 'email')}
                  isInvalid={!!validationErrors.email}
                  errorMessage={validationErrors.email}
                />
              </div>
              <div className="col-span-1">
                <Input
                  label="Telefon"
                  name="phoneNumber"
                  value={editFormValues.phoneNumber || ''}
                  onValueChange={(value) => handleEditInputChange(value, 'phoneNumber')}
                />
              </div>
              <div className="col-span-2">
                <Input
                  label="Adress"
                  name="address"
                  value={editFormValues.address || ''}
                  onValueChange={(value) => handleEditInputChange(value, 'address')}
                />
              </div>
              <div className="col-span-1">
                <Input
                  label="Postnummer"
                  name="postalCode"
                  value={editFormValues.postalCode || ''}
                  onValueChange={(value) => handleEditInputChange(value, 'postalCode')}
                />
              </div>
              <div className="col-span-1">
                <Input
                  label="Ort"
                  name="city"
                  value={editFormValues.city || ''}
                  onValueChange={(value) => handleEditInputChange(value, 'city')}
                />
              </div>
              <div className="col-span-1">
                <Input
                  label="Land"
                  name="country"
                  value={editFormValues.country || ''}
                  onValueChange={(value) => handleEditInputChange(value, 'country')}
                />
              </div>
              <div className="col-span-1">
                <Input
                  label="Födelsedatum"
                  name="dateOfBirth"
                  type="date"
                  value={editFormValues.dateOfBirth || ''}
                  onValueChange={(value) => {
                    console.log('Nytt datumvärde:', value);
                    handleEditInputChange(value || undefined, 'dateOfBirth');
                  }}
                />
              </div>
              <div className="col-span-1 mt-2">
                <Checkbox
                  isSelected={editFormValues.newsletter || false}
                  onValueChange={(checked) => handleEditInputChange(checked, 'newsletter')}
                >
                  Nyhetsbrev
                </Checkbox>
              </div>
              <div className="col-span-1 mt-2">
                <Checkbox
                  isSelected={editFormValues.loyal || false}
                  onValueChange={(checked) => handleEditInputChange(checked, 'loyal')}
                >
                  Stamkund
                </Checkbox>
              </div>
              
              {/* Dynamiska fält från kundkortsmall */}
              {editingCustomer?.dynamicFields && Object.entries(editingCustomer.dynamicFields).map(([key, value]) => {
                if (key === 'newsletter' || key === 'loyal') return null;
                
                return (
                  <div key={key} className="col-span-2">
                    <Input
                      label={key}
                      name={key}
                      value={editFormValues[key] || ''}
                      onValueChange={(value) => handleEditInputChange(value, key)}
                    />
                  </div>
                );
              })}
            </div>
            
            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="flat" 
                onPress={() => {
                  setEditModalOpen(false);
                  setEditingCustomer(null);
                }}
              >
                Avbryt
              </Button>
              <Button type="submit" color="primary">
                Spara ändringar
              </Button>
            </div>
          </Form>
        </ModalBody>
      </ModalContent>
    </Modal>

    {/* CustomerDrawer-komponent som visar kunddetaljer */}
    <CustomerDrawer
      isOpen={viewDrawerOpen}
      onClose={() => setViewDrawerOpen(false)}
      customer={selectedCustomer}
    />
  </section>
);
}