import React, { useState, useEffect, FormEvent } from 'react';
import { subtitle, title } from "@/components/primitives";
import { 
  Tabs, 
  Tab, 
  Input, 
  Button, 
  addToast, 
  DatePicker, 
  Dropdown, 
  DropdownTrigger, 
  DropdownMenu, 
  DropdownItem, 
  Checkbox,
  Card,
  CardHeader,
  CardBody,
  Divider
} from '@heroui/react';
import { useSession } from 'next-auth/react';
import { TicketType } from '@/types/ticket';
import { parseZonedDateTime, getLocalTimeZone, ZonedDateTime } from "@internationalized/date";

interface Field {
  name: string;
  fieldType: string;
  isRequired: boolean;
}

interface CustomerCardTemplate {
  id: number;
  cardName: string;
  dynamicFields: Record<string, any>;
  isDefault: boolean;
}

// Hjälpfunktion – konverterad till en arrow-funktion för att undvika TS1252
const formatValue = (value: any): string => {
  if (!value) return "";
  
  // Handle ZonedDateTime objects directly
  if (value && typeof value === "object" && "calendar" in value) {
    try {
      // Extract the date components and create an ISO string
      const { year, month, day } = value;
      // Create a Date object (month is 0-indexed in JavaScript)
      const date = new Date(year, month - 1, day);
      return date.toISOString();
    } catch (err) {
      console.error("Failed to format ZonedDateTime:", err);
      return "";
    }
  }
  
  // Handle string dates
  if (typeof value === "string") {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  
  // Handle Date objects
  if (value instanceof Date) {
    return value.toISOString();
  }
  
  // Handle date objects with year, month, day properties
  if (typeof value === "object" && "year" in value && "month" in value && "day" in value) {
    const { year, month, day } = value;
    const date = new Date(year, month - 1, day);
    return date.toISOString();
  }
  
  return "";
};

export default function CreateTicketPage() {
  const [ticketFormValues, setTicketFormValues] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { data: session, status } = useSession();
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loadingTicketTypes, setLoadingTicketTypes] = useState(true);
  const [customerFormValues, setCustomerFormValues] = useState<{ name: string; email: string; phoneNumber: string; }>({
    name: '',
    email: '',
    phoneNumber: ''
  });
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Nya states för kundkortsmallar
  const [customerCardTemplates, setCustomerCardTemplates] = useState<CustomerCardTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<CustomerCardTemplate | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Hjälpfunktion för att säkerställa ZonedDateTime
  const getZonedValue = (value: any) => {
    if (!value) return null;
    if (typeof value === "string") {
      return parseZonedDateTime(`${value}[Europe/Stockholm]`);
    }
    if (value && typeof value === "object" && "calendar" in value) {
      return value;
    }
    return null;
  };

  // Hämta ärendetyper
  useEffect(() => {
    if (!session) return;
    fetch('/api/tickets/types')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const filteredTypes = data.filter((type: TicketType) => type.storeId === session.user.storeId);
          setTicketTypes(filteredTypes);
          if (filteredTypes.length > 0) {
            setSelectedKey(filteredTypes[0].id.toString());
          }
        } else {
          console.error("API returnerade inte en array:", data);
          setTicketTypes([]);
        }
        setLoadingTicketTypes(false);
      })
      .catch((err) => {
        console.error('Fel vid hämtning av ärendetyper:', err);
        setLoadingTicketTypes(false);
      });
  }, [session]);

  // Hämta kundkortsmallar
  useEffect(() => {
    if (!session) return;
    
    setLoadingTemplates(true);
    fetch('/api/customerCards')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCustomerCardTemplates(data);
          
          // Hitta default mallen om den finns
          const defaultTemplate = data.find(template => template.isDefault);
          if (defaultTemplate) {
            setSelectedTemplate(defaultTemplate);
          } else if (data.length > 0) {
            setSelectedTemplate(data[0]);
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

  // Fyll i kundinformationen baserat på vald mall
  useEffect(() => {
    if (selectedTemplate && !selectedCustomer) {
      // Skapa en ny formulärobjekt baserat på mallen
      const formValues: Record<string, any> = { 
        name: '' // Bara name behövs för sökningen
      };
      
      // Förbered alla fält från mallen med tomma värden
      if (selectedTemplate.dynamicFields) {
        Object.entries(selectedTemplate.dynamicFields).forEach(([key, value]) => {
          try {
            const fieldData = typeof value === 'string' ? JSON.parse(value) : value;
            const fieldName = fieldData.mapping === 'DYNAMIC' ? key : fieldData.mapping;
            
            // Sätt standardvärden för olika fälttyper
            if (fieldName === 'newsletter' || fieldName === 'loyal') {
              formValues[fieldName] = false; // Checkboxar är avstängda som standard
            } else {
              formValues[fieldName] = ''; // Textfält är tomma som standard
            }
          } catch (e) {
            console.error('Error setting up form field:', e);
          }
        });
      }
      
      setCustomerFormValues(formValues as any);
    }
  }, [selectedTemplate, selectedCustomer]);

  // Uppdaterad funktion för att rendera mallfält inklusive checkboxar
  const renderTemplateField = (key: string, fieldData: any, formValues: Record<string, any>) => {
    const fieldName = fieldData.mapping === 'DYNAMIC' ? key : fieldData.mapping;
    const fieldLabel = fieldData.mapping === 'DYNAMIC' 
      ? key 
      : (fieldName.charAt(0).toUpperCase() + fieldName.slice(1));
    
    // Specialhantering för nyhetsbrev och stamkund - använd Checkbox
    if (fieldName === 'newsletter') {
      return (
        <div key={key} className="col-span-1 mt-4">
          <Checkbox
            isSelected={formValues.newsletter || false}
            onValueChange={(checked) => {
              setCustomerFormValues(prev => ({
                ...prev,
                newsletter: checked
              }));
            }}
          >
            Nyhetsbrev
          </Checkbox>
        </div>
      );
    }
    
    if (fieldName === 'loyal') {
      return (
        <div key={key} className="col-span-1 mt-4">
          <Checkbox
            isSelected={formValues.loyal || false}
            onValueChange={(checked) => {
              setCustomerFormValues(prev => ({
                ...prev,
                loyal: checked
              }));
            }}
          >
            Stamkund
          </Checkbox>
        </div>
      );
    }
    
    // Bestäm vilken typ av input som ska användas
    let inputType = "text";
    if (fieldData.inputType === 'NUMBER') {
      inputType = "number";
    } else if (fieldData.inputType === 'DATE' || fieldName === 'dateOfBirth') {
      inputType = "date";
    } else if (fieldName === 'email') {
      inputType = "email";
    }
    
    return (
      <div key={key} className={fieldData.mapping === 'DYNAMIC' || fieldName === 'address' ? 'col-span-2' : 'col-span-1'}>
        <Input
          label={fieldLabel}
          name={fieldName}
          type={inputType}
          isRequired={fieldData.isRequired || fieldName === 'email'}
          value={formValues[fieldName] || ''}
          onValueChange={(value) => {
            setCustomerFormValues(prev => ({ ...prev, [fieldName]: value }));
          }}
          isInvalid={!!formErrors[fieldName]}
          errorMessage={formErrors[fieldName]}
        />
      </div>
    );
  };

  const handleTicketInputChange = (value: any, fieldName: string): void => {
    console.log("Uppdaterar fält", fieldName, "med värde", value);
    setTicketFormValues((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
    
    // Rensa eventuellt felmeddelande för detta fält när användaren ändrar värdet
    if (formErrors[fieldName]) {
      setFormErrors(prev => {
        const newErrors = {...prev};
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const handleCustomerInputChange = (value: string, fieldName: string): void => {
    setCustomerFormValues((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
    if (fieldName === 'name') {
      setSelectedCustomer(null);
    }
    
    // Rensa eventuellt felmeddelande för detta fält
    if (formErrors[fieldName]) {
      setFormErrors(prev => {
        const newErrors = {...prev};
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };
  
  // Uppdaterad funktion för att hantera kund som valts från söklistan
  const handleSelectCustomer = (customer: any) => {
    // Gör en mer omfattande uppdatering av formuläret
    const formValues: Record<string, string> = {};
    
    // Lägg till standardfälten från kunden
    if (customer.firstName) formValues.firstName = customer.firstName;
    if (customer.lastName) formValues.lastName = customer.lastName;
    if (customer.email) formValues.email = customer.email;
    if (customer.phoneNumber) formValues.phoneNumber = customer.phoneNumber;
    if (customer.address) formValues.address = customer.address;
    if (customer.postalCode) formValues.postalCode = customer.postalCode;
    if (customer.city) formValues.city = customer.city;
    if (customer.country) formValues.country = customer.country;
    
    // Om det finns dynamiska fält i kunden, lägg till dem också
    if (customer.dynamicFields) {
      Object.entries(customer.dynamicFields).forEach(([key, value]) => {
        formValues[key] = value as string;
      });
    }

    formValues.name = getCustomerDisplayName(customer);
    
    setCustomerFormValues(formValues);
    setSelectedCustomer(customer);
    setCustomerSuggestions([]);
  };

  // Hjälpfunktion för att formatera kundnamn för visning
  const getCustomerDisplayName = (customer: any): string => {
    if (!customer) return '';
    
    if (customer.name) {
      return customer.name;
    }
    
    if (customer.firstName || customer.lastName) {
      return `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
    }
    
    if (customer.email) {
      return customer.email;
    }
    
    return `Kund #${customer.id}`;
  };

  // Debounce för kundförslag
  useEffect(() => {
    if (selectedCustomer) {
      setCustomerSuggestions([]);
      return;
    }
    const fetchSuggestions = async () => {
      const searchTerm = customerFormValues.name?.trim();
      if (!searchTerm || searchTerm.length < 2) {
        setCustomerSuggestions([]);
        return;
      }
      try {
        const res = await fetch(`/api/customers?search=${encodeURIComponent(searchTerm)}`);
        const data = await res.json();
        
        // Filtrera resultat baserat på söktermen
        // Skapa en visningsnamnegenskap från firstName + lastName för kunder som inte har ett 'name'-fält
        const filteredSuggestions = data.filter((customer: any) => {
          // Hantera namnmatchning på olika sätt beroende på vilka fält som finns
          if (customer.name) {
            return customer.name.toLowerCase().includes(searchTerm.toLowerCase());
          } else if (customer.firstName || customer.lastName) {
            const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
            customer.name = fullName; // Lägg till en name-egenskap för visning
            return fullName.toLowerCase().includes(searchTerm.toLowerCase());
          } else if (customer.email) {
            // Om varken name eller firstName/lastName finns, sök på email
            customer.name = customer.email; // Använd email som visningsnamn
            return customer.email.toLowerCase().includes(searchTerm.toLowerCase());
          }
          return false;
        });
        
        setCustomerSuggestions(filteredSuggestions);
      } catch (err) {
        console.error('Fel vid hämtning av kundförslag:', err);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [customerFormValues.name, selectedCustomer]);

  const handleSelectTemplate = (template: CustomerCardTemplate) => {
    setSelectedTemplate(template);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    const selectedTicketType = ticketTypes.find((type) => type.id.toString() === selectedKey);
    
    // Validera kundinformation
    if (!selectedCustomer && !customerFormValues.email) {
      errors['email'] = 'E-postadress krävs för att skapa en ny kund';
    }
    
    // Validera ärendefält
    if (selectedTicketType?.fields) {
      selectedTicketType.fields.forEach(field => {
        if (field.isRequired && !ticketFormValues[field.name]) {
          errors[field.name] = `${field.name} är obligatoriskt`;
        }
      });
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validera formuläret innan vi skickar
    if (!validateForm()) {
      addToast({ 
        title: 'Valideringsfel', 
        description: 'Vänligen kontrollera de markerade fälten och försök igen.', 
        color: 'danger', 
        variant: 'flat' 
      });
      return;
    }
    
    setSubmitting(true);

    const selectedTicketType = ticketTypes.find((type) => type.id.toString() === selectedKey);
    if (!selectedTicketType) {
      addToast({ title: 'Fel', description: 'Ogiltig ärendetyp.', color: 'danger', variant: 'flat' });
      setSubmitting(false);
      return;
    }

    try {
      let customerData: any;
      if (selectedCustomer) {
        // Om vi har en befintlig kund, använd den direkt
        customerData = selectedCustomer;
      } else {
        // Separera standardfält från dynamiska fält
        const {
          name, // name används bara för sökning, behöver inte skickas till API:et
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
          ...otherFields // Övriga fält hamnar i dynamicFields
        } = customerFormValues;
  
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
          dateOfBirth,
          // Säkerställ att newsletter och loyal skickas som booleans
          newsletter: newsletter === true,
          loyal: loyal === true,
          // Samla alla andra fält i dynamicFields
          dynamicFields: otherFields 
        };
  
        const customerResponse = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customerInput),
        });
  
        if (!customerResponse.ok) {
          const errData = await customerResponse.json();
          throw new Error(errData.message || 'Kunde inte skapa kund.');
        }
        customerData = await customerResponse.json();
      }

      // Förbered fälten – DUE_DATE hanteras separat
      const prepareDynamicFields = () => {
        const formattedFields: Record<string, string> = {};
        let dueDateValue = "";
        
        selectedTicketType.fields.forEach((field: Field) => {
          const value = ticketFormValues[field.name];
          console.log(`Processing field ${field.name} (${field.fieldType}) with value:`, value);
          
          if (field.fieldType === "DATE") {
            formattedFields[field.name] = formatValue(value);
          } else if (field.fieldType === "DUE_DATE") {
            dueDateValue = formatValue(value);
            console.log(`DUE_DATE for ${field.name} formatted to:`, dueDateValue);
          } else {
            // Endast konvertera till sträng för TEXT/NUMBER-fält
            formattedFields[field.name] = value !== undefined ? String(value) : "";
          }
        });
        
        return { formattedFields, dueDateValue };
      };
      
      const { formattedFields, dueDateValue } = prepareDynamicFields();
      console.log("About to send request with dueDateValue:", dueDateValue);

      // Log the full request body
      const requestBody = {
        ticketTypeId: selectedTicketType.id,
        customerId: customerData.id,
        dynamicFields: formattedFields,
        dueDate: dueDateValue || null,
        storeId: session.user.storeId,
        userId: session.user.id,
        status: 'OPEN'
      };
      console.log("Full request body:", JSON.stringify(requestBody));

      const ticketResponse = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!ticketResponse.ok) {
        const errData = await ticketResponse.json();
        throw new Error(errData.message || 'Kunde inte skapa ärende.');
      }
      await ticketResponse.json();
      addToast({ title: 'Framgång', description: 'Ärendet skapades!', color: 'success', variant: 'flat' });
      setTicketFormValues({});
      setCustomerFormValues({ name: '', email: '', phoneNumber: '' });
      setCustomerSuggestions([]);
      setSelectedCustomer(null);
      setFormErrors({});
    } catch (err: any) {
      console.error(err);
      addToast({ title: 'Fel', description: err.message || 'Ett okänt fel inträffade.', color: 'danger', variant: 'flat' });
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setTicketFormValues({});
    setCustomerFormValues({ name: '', email: '', phoneNumber: '' });
    setCustomerSuggestions([]);
    setSelectedCustomer(null);
    setFormErrors({});
  };

  if (loadingTicketTypes || loadingTemplates) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div>Laddar...</div>
      </section>
    );
  }

  const selectedTicketType = ticketTypes.find((type) => type.id.toString() === selectedKey);
  
  // Gruppera ärendefält efter typ för bättre organisation
  const groupFields = (fields: Field[]) => {
    if (!fields) return { basic: [], dates: [], comment: null };
    
    const basic = fields.filter(field => 
      field.fieldType !== "DATE" && 
      field.fieldType !== "DUE_DATE" &&
      field.name !== "Kommentar");
    
    const dates = fields.filter(field => 
      field.fieldType === "DATE" || 
      field.fieldType === "DUE_DATE");
    
    const comment = fields.find(field => field.name === "Kommentar");
    
    return { basic, dates, comment };
  };
  
  const groupedFields = selectedTicketType ? 
    groupFields(selectedTicketType.fields) : 
    { basic: [], dates: [], comment: null };

  let content;
  if (!session) {
    content = <div>Ingen session – vänligen logga in.</div>;
  } else {
    content = (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div className="inline-block max-w-lg text-center mb-6">
          <h1 className={title({ size: 'sm' })}>Skapa nytt ärende</h1>
        </div>
        
        <div className="w-full max-w-5xl mx-auto px-4">
          <form onSubmit={handleSubmit} className="w-full">
            <div className="w-full flex justify-center mb-8">
              {/* Visa alltid dropdown på mobil */}
              <div className="sm:hidden w-full">
                <Dropdown className="w-full">
                  <DropdownTrigger className="w-full">
                    <Button 
                      variant="flat" 
                      className="w-full justify-between" 
                      endContent={<span className="text-lg">▼</span>}
                    >
                      <div className="flex items-center">
                        <span className="mr-2">Ärendetyp:</span>
                        <span className="font-semibold">{selectedTicketType ? selectedTicketType.name : "Välj"}</span>
                      </div>
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu 
                    aria-label="Ärendetyper" 
                    selectionMode="single"
                    selectedKeys={selectedKey ? new Set([selectedKey]) : new Set()}
                    onSelectionChange={(keys) => {
                      const selected = keys.values().next().value;
                      if (selected) setSelectedKey(selected);
                    }}
                  >
                    {ticketTypes.map((type) => (
                      <DropdownItem key={type.id.toString()}>{type.name}</DropdownItem>
                    ))}
                  </DropdownMenu>
                </Dropdown>
              </div>
              
              {/* På desktop: visa tabs om det finns få typer, annars dropdown */}
              <div className="hidden sm:block">
                {ticketTypes.length > 5 ? (
                  <Dropdown>
                    <DropdownTrigger>
                      <Button variant="flat" className="px-8">
                        {selectedTicketType ? selectedTicketType.name : "Välj ärendetyp"}
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu 
                      aria-label="Ärendetyper" 
                      selectionMode="single"
                      selectedKeys={selectedKey ? new Set([selectedKey]) : new Set()}
                      onSelectionChange={(keys) => {
                        const selected = keys.values().next().value;
                        if (selected) setSelectedKey(selected);
                      }}
                    >
                      {ticketTypes.map((type) => (
                        <DropdownItem key={type.id.toString()}>{type.name}</DropdownItem>
                      ))}
                    </DropdownMenu>
                  </Dropdown>
                ) : (
                  <Tabs
                    selectedKey={selectedKey}
                    onSelectionChange={(key) => setSelectedKey(key as string)}
                    variant="solid"
                    color="primary"
                    classNames={{ 
                      tabList: 'flex flex-row flex-nowrap',
                      tab: 'px-8'
                    }}
                  >
                    {ticketTypes.map((type) => (
                      <Tab key={type.id.toString()} title={type.name} />
                    ))}
                  </Tabs>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              {/* Kundinformation */}
              <div>
                <Card className="mb-6">
                  <CardHeader className="flex justify-between items-center px-6 py-4">
                    <h2 className="text-xl font-semibold">Kundinformation</h2>
                    
                    {/* Visa mall-väljare om det finns flera mallar */}
                    {customerCardTemplates.length > 1 && (
                      <Dropdown>
                        <DropdownTrigger>
                          <Button 
                            variant="flat" 
                            size="sm"
                          >
                            {selectedTemplate ? `Mall: ${selectedTemplate.cardName}` : 'Välj kundkortsmall'}
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Kundkortsmallar">
                          {customerCardTemplates.map(template => (
                            <DropdownItem 
                              key={template.id}
                              onPress={() => handleSelectTemplate(template)}
                            >
                              {template.cardName} {template.isDefault && '(Standard)'}
                            </DropdownItem>
                          ))}
                        </DropdownMenu>
                      </Dropdown>
                    )}
                  </CardHeader>
                  
                  <CardBody className="px-6 py-4">
                  <div className="relative mb-6">
                    <Input
                      label="Sök kund"
                      name="customerSearch"
                      type="text"
                      placeholder="Skriv kundnamn för att söka..."
                      value={customerFormValues.name || ''}
                      onValueChange={(value: string) => handleCustomerInputChange(value, 'name')}
                    />
                    {customerSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {customerSuggestions.map((customer: any) => (
                          <div
                            key={customer.id}
                            className="px-4 py-3 border-b last:border-b-0 hover:bg-default-100 cursor-pointer transition-colors"
                            onClick={() => handleSelectCustomer(customer)}
                          >
                            <div className="font-medium">{getCustomerDisplayName(customer)}</div>
                            {customer.email && <div className="text-sm text-default-500">{customer.email}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                    
                    {selectedCustomer ? (
                      <div className="mb-4 p-4 bg-gray-50 rounded-md">
                        <div className="flex justify-between mb-2">
                          <h3 className="font-medium">Vald kund:</h3>
                          <Button 
                            size="sm" 
                            variant="flat" 
                            color="danger"
                            onPress={() => setSelectedCustomer(null)}
                          >
                            Ändra
                          </Button>
                        </div>
                        <p><strong>Namn:</strong> {getCustomerDisplayName(selectedCustomer)}</p>
                        {selectedCustomer.email && <p><strong>E-post:</strong> {selectedCustomer.email}</p>}
                        {selectedCustomer.phoneNumber && <p><strong>Telefon:</strong> {selectedCustomer.phoneNumber}</p>}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        {selectedTemplate && selectedTemplate.dynamicFields && (
                          <>
                            {/* Vi använder Object.entries och sorterar baserat på order-egenskapen */}
                            {Object.entries(selectedTemplate.dynamicFields)
                              .map(([key, value]) => {
                                try {
                                  const fieldData = typeof value === 'string' ? JSON.parse(value) : value;
                                  return {
                                    key,
                                    fieldData,
                                    // Använd order-egenskapen för sortering om den finns, annars använd högsta värdet
                                    order: fieldData.order !== undefined ? fieldData.order : 9999
                                  };
                                } catch (e) {
                                  console.error('Error parsing field data:', e);
                                  return null;
                                }
                              })
                              .filter(Boolean)
                              // Sortera explicit baserat på order-egenskapen för att garantera ordningen
                              .sort((a, b) => (a?.order || 0) - (b?.order || 0))
                              .map(field => {
                                if (!field) return null;
                                // Anropa renderTemplateField för att hantera varje fält
                                return renderTemplateField(field.key, field.fieldData, customerFormValues);
                              })
                            }
                          </> 
                        )}
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>
              
              {/* Ärendeinformation */}
              <div>
                <Card>
                  <CardHeader className="px-6 py-4">
                    <h2 className="text-xl font-semibold">Ärendeinformation</h2>
                  </CardHeader>
                  
                  <CardBody className="px-6 py-4">
                    {selectedTicketType ? (
                      <>
                        {/* Grundläggande fält */}
                        {groupedFields.basic.length > 0 && (
                          <div className="grid grid-cols-2 gap-4 mb-6">
                            {groupedFields.basic.map((field, idx) => (
                              <div key={idx} className={field.name.length > 15 ? "col-span-2" : "col-span-1"}>
                                <Input
                                  label={field.name}
                                  name={field.name}
                                  type={field.fieldType === "NUMBER" ? "number" : "text"}
                                  isRequired={field.isRequired}
                                  value={ticketFormValues[field.name] || ''}
                                  onValueChange={(value: string) => handleTicketInputChange(value, field.name)}
                                  isInvalid={!!formErrors[field.name]}
                                  errorMessage={formErrors[field.name]}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Datum fält */}
                        {groupedFields.dates.length > 0 && (
                          <>
                            <Divider className="my-4" />
                            <h3 className="text-md font-medium mb-4">Datumuppgifter</h3>
                            <div className="grid grid-cols-2 gap-4 mb-6">
                              {groupedFields.dates.map((field, idx) => (
                                <div key={idx} className="col-span-1">
                                  <DatePicker
                                    label={field.name}
                                    name={field.name}
                                    value={getZonedValue(ticketFormValues[field.name])}
                                    onChange={(value) => {
                                      console.log(`${field.fieldType} onChange:`, value);
                                      handleTicketInputChange(value, field.name);
                                    }}
                                    isRequired={field.isRequired}
                                    isInvalid={!!formErrors[field.name]}
                                    errorMessage={formErrors[field.name]}
                                  />
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        
                        {/* Kommentarsfält */}
                        {groupedFields.comment && (
                          <>
                            <Divider className="my-4" />
                            <h3 className="text-md font-medium mb-4">Kommentar</h3>
                            <div className="mb-4">
                              <Input
                                label={groupedFields.comment.name}
                                name={groupedFields.comment.name}
                                type="text"
                                isRequired={groupedFields.comment.isRequired}
                                value={ticketFormValues[groupedFields.comment.name] || ''}
                                onValueChange={(value: string) => handleTicketInputChange(value, groupedFields.comment.name)}
                                className="w-full min-h-20"
                                isInvalid={!!formErrors[groupedFields.comment.name]}
                                errorMessage={formErrors[groupedFields.comment.name]}
                              />
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-default-500">Välj en ärendetyp för att fortsätta</p>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-8">
              <Button 
                type="button" 
                variant="flat" 
                onPress={resetForm}
              >
                Avbryt
              </Button>
              <Button 
                type="submit" 
                color="primary"
                isDisabled={submitting || !selectedTicketType}
              >
                {submitting ? 'Skickar...' : 'Skapa ärende'}
              </Button>
            </div>
          </form>
        </div>
      </section>
    );
  }

  return <>{content}</>;
}