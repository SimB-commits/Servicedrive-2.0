import React, { useState, useEffect, FormEvent } from 'react';
import { subtitle, title } from "@/components/primitives";
import { Tabs, Tab, Input, Button, addToast, DatePicker } from '@heroui/react';
import { useSession } from 'next-auth/react';
import { TicketType } from '@/types/ticket';
import { parseZonedDateTime, getLocalTimeZone, ZonedDateTime } from "@internationalized/date";

interface Field {
  name: string;
  fieldType: string;
  isRequired: boolean;
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



export default function DocsPage() {
  const [ticketFormValues, setTicketFormValues] = useState<Record<string, any>>({});
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

  const handleTicketInputChange = (value: any, fieldName: string): void => {
    console.log("Uppdaterar fält", fieldName, "med värde", value);
    setTicketFormValues((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleCustomerInputChange = (value: string, fieldName: string): void => {
    setCustomerFormValues((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
    if (fieldName === 'name') {
      setSelectedCustomer(null);
    }
  };

  // Debounce för kundförslag
  useEffect(() => {
    if (selectedCustomer) {
      setCustomerSuggestions([]);
      return;
    }
    const fetchSuggestions = async () => {
      const searchTerm = customerFormValues.name.trim();
      if (searchTerm.length < 2) {
        setCustomerSuggestions([]);
        return;
      }
      try {
        const res = await fetch(`/api/customers?search=${encodeURIComponent(searchTerm)}`);
        const data = await res.json();
        const filteredSuggestions = data.filter((customer: any) =>
          customer.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setCustomerSuggestions(filteredSuggestions);
      } catch (err) {
        console.error('Fel vid hämtning av kundförslag:', err);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [customerFormValues.name, selectedCustomer]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
        customerData = selectedCustomer;
      } else {
        const customerResponse = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customerFormValues),
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
    } catch (err: any) {
      console.error(err);
      addToast({ title: 'Fel', description: err.message || 'Ett okänt fel inträffade.', color: 'danger', variant: 'flat' });
    }
    setSubmitting(false);
  };

  if (loadingTicketTypes) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div>Laddar ärendetyper...</div>
      </section>
    );
  }

  const selectedTicketType = ticketTypes.find((type) => type.id.toString() === selectedKey);
  let otherFields: Field[] = [];
  let commentField: Field | undefined = undefined;
  if (selectedTicketType && selectedTicketType.fields) {
    otherFields = selectedTicketType.fields.filter((field: Field) => field.name !== "Kommentar");
    commentField = selectedTicketType.fields.find((field: Field) => field.name === "Kommentar");
  }

  let content;
  if (!session) {
    content = <div>Ingen session – vänligen logga in.</div>;
  } else {
    content = (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div className="inline-block max-w-lg text-center">
          <h1 className={title({ size: 'sm' })}>Skapa nytt ärende</h1>
        </div>
        <form onSubmit={handleSubmit} className="w-full max-w-4xl">
          <div className="w-full flex justify-center mb-8">
            <Tabs
              selectedKey={selectedKey}
              onSelectionChange={(key) => setSelectedKey(key as string)}
              variant="solid"
              color="primary"
              classNames={{ tabList: 'flex flex-wrap md:flex-nowrap' }}
            >
              {ticketTypes.map((type) => (
                <Tab key={type.id} title={type.name} titleValue={type.id.toString()} />
              ))}
            </Tabs>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h1 className={subtitle({ size: 'sm' })}>Kundinformation</h1>
              <div className="mt-4 relative grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Input
                    label="Namn"
                    name="name"
                    type="text"
                    isRequired
                    value={customerFormValues.name}
                    onValueChange={(value: string) => handleCustomerInputChange(value, 'name')}
                  />
                  {customerSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full bg-background border border-gray-200 shadow-md">
                      {customerSuggestions.map((customer: any) => (
                        <div
                          key={customer.id}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => {
                            setCustomerFormValues({ name: customer.name, email: customer.email, phoneNumber: customer.phoneNumber });
                            setSelectedCustomer(customer);
                            setCustomerSuggestions([]);
                          }}
                        >
                          {customer.name} - {customer.email}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Input
                  label="Email"
                  name="email"
                  type="email"
                  isRequired
                  value={customerFormValues.email}
                  onValueChange={(value: string) => handleCustomerInputChange(value, 'email')}
                />
                <Input
                  label="Telefonnummer"
                  name="phoneNumber"
                  type="text"
                  isRequired
                  value={customerFormValues.phoneNumber}
                  onValueChange={(value: string) => handleCustomerInputChange(value, 'phoneNumber')}
                />
              </div>
            </div>
            <div>
              <h1 className={subtitle({ size: 'sm' })}>Ärendeinformation</h1>
              <div className="mt-4">
                {selectedTicketType ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      {otherFields.map((field, idx) => (
                        <div key={idx}>
                          {field.fieldType === "DATE" || field.fieldType === "DUE_DATE" ? (
                            <DatePicker
                              label={field.name}
                              name={field.name}
                              value={getZonedValue(ticketFormValues[field.name])}
                              onChange={(value) => {
                                console.log("DUE_DATE onChange raw value:", value);
                                console.log("DUE_DATE onChange type:", typeof value);
                                console.log("DUE_DATE onChange JSON:", JSON.stringify(value, null, 2));
                                handleTicketInputChange(value, field.name);
                              }}
                              isRequired={field.isRequired}
                            />
                          ) : (
                            <Input
                              label={field.name}
                              name={field.name}
                              type="text"
                              isRequired={field.isRequired}
                              value={ticketFormValues[field.name] || ''}
                              onValueChange={(value: string) => handleTicketInputChange(value, field.name)}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    {commentField && (
                      <div className="mt-4">
                        <Input
                          label={commentField.name}
                          name={commentField.name}
                          type="text"
                          isRequired={commentField.isRequired}
                          value={ticketFormValues[commentField.name] || ''}
                          onValueChange={(value: string) => handleTicketInputChange(value, commentField.name)}
                          className="w-full h-32"
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div>Välj en ärendetyp</div>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-center mt-6">
            <Button type="submit" disabled={submitting} className="mt-6 px-4 py-2 bg-success text-background">
              {submitting ? 'Skickar...' : 'Skapa ärende'}
            </Button>
          </div>
        </form>
      </section>
    );
  }

  return <>{content}</>;
}

function zonedToString(value: ZonedDateTime): string {
  if (value instanceof ZonedDateTime) {
    return value.toString();
  } else {
    return "";
  }
}
