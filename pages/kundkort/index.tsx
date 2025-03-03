import React, { useState, useEffect } from 'react';
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
  DropdownItem
} from '@heroui/react';
import { title } from '@/components/primitives';

interface CustomerCard {
  id: number;
  cardName: string;
  dynamicFields?: string ;
  isDefault: boolean;
}

interface DynamicField {
  // Vid DYNAMIC krävs att användaren anger fältnamn
  fieldName?: string;
  mapping: string; // t.ex. "firstName", "lastName", "DYNAMIC"
  inputType?: string; // Gäller endast om mapping === 'DYNAMIC'
  isRequired: boolean;
}

const customerFieldOptions = [
  { value: 'firstName', label: 'Förnamn' },
  { value: 'lastName', label: 'Efternamn' },
  { value: 'address', label: 'Adress' },
  { value: 'postalCode', label: 'Postnummer' },
  { value: 'city', label: 'Ort' },
  { value: 'country', label: 'Land' },
  { value: 'dateOfBirth', label: 'Födelsedatum' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Telefon' },
  { value: 'DYNAMIC', label: 'Dynamiskt fält' },
];

const inputTypeOptions = [
  { value: 'TEXT', label: 'Text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'DATE', label: 'Datum' },
  { value: 'DUE_DATE', label: 'Senast klar' },
];

export default function KundkortPage() {
  const { data: session } = useSession(); // Hämta session
  const [storeId, setStoreId] = useState<number | null>(null);
  const [customerCards, setCustomerCards] = useState<CustomerCard[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Uppdatera storeId när sessionen laddas
  useEffect(() => {
    if (session?.user?.storeId) {
      setStoreId(session.user.storeId);
    }
  }, [session]);
  
  // Mallens namn
  const [cardName, setCardName] = useState('');
  
  // Dynamiska fält – här hanteras mapping och, vid DYNAMIC, extra input för fältnamn och typ
  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>([]);
  
  // Sätt standardkundkort (id)
  const [defaultCardId, setDefaultCardId] = useState<number | null>(null);

  // Hämta kundkort från API:t
  useEffect(() => {
    fetch('/api/customerCards')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCustomerCards(data);
          const defaultCard = data.find((card: CustomerCard) => card.isDefault) || data[0];
          if (defaultCard) {
            setDefaultCardId(defaultCard.id);
          }
        } else {
          setCustomerCards([]);
        }
      })
      .catch((err) => {
        console.error('Fel vid hämtning av kundkort:', err);
        addToast({ title: 'Fel', description: 'Kunde inte hämta kundkort.', color: 'danger', variant: 'flat' });
      });
  }, []);

  // Lägg till ett nytt dynamiskt fält
  const addDynamicField = () => {
    setDynamicFields(prev => [
      ...prev,
      { mapping: '', isRequired: false }
    ]);
  };

  const removeDynamicField = (index: number) => {
    setDynamicFields(prev => prev.filter((_, i) => i !== index));
  };

  const updateDynamicField = (index: number, field: Partial<DynamicField>) => {
    setDynamicFields(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...field };
      return updated;
    });
  };

  // Skapa nytt kundkort via API
const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();

  if (!storeId) {
    addToast({
      title: 'Fel',
      description: 'Butiks-ID saknas',
      color: 'danger',
      variant: 'flat'
    });
    return;
  }

  // Förbered ett objekt med standardfält, som motsvarar kolumnerna i databasen
  const standardFields: Partial<Record<string, string | undefined>> = {
    firstName: undefined,
    lastName: undefined,
    address: undefined,
    postalCode: undefined,
    city: undefined,
    country: undefined,
    dateOfBirth: undefined,
    email: undefined,
    phone: undefined
  };

  // För dynamiska fält som verkligen är dynamiska
  const dynamicData: { [key: string]: string } = {};

  // Gå igenom de dynamiska fälten i formuläret
  dynamicFields.forEach(field => {
    if (field.mapping === 'DYNAMIC') {
      // Vid DYNAMIC förväntas användaren ange ett fältnamn
      const key = field.fieldName?.trim() || '';
      if (key) {
        dynamicData[key] = JSON.stringify({
          mapping: field.mapping,
          inputType: field.inputType,
          isRequired: field.isRequired,
        });
      }
    } else {
      // För standardfält mappas värdet direkt till standardkolumnen.
      // Här sätter vi värdet till en tom sträng (eller du kan använda null) eftersom
      // användaren inte fyllt i något separat värde för dessa i formuläret.
      // Du kan senare uppdatera dessa värden i ett separat flöde.
      // Mapping-värdet motsvarar kolumnnamnet, ex. "firstName", "lastName", "email" etc.
      if (field.mapping in standardFields) {
        standardFields[field.mapping] = '';
      }
    }
  });
  

  // Sätt ihop payloaden med standardfält och de dynamiska fälten
  const payload = {
    cardName,
    // Sprid standardfälten direkt ut så att de hamnar i sina egna kolumner
    ...standardFields,
    // Endast om det finns dynamiska fält som verkligen är DYNAMIC
    ...(Object.keys(dynamicData).length > 0 && { dynamicFields: dynamicData }),
    isDefault: customerCards.length === 0,
    storeId, // Nu hämtas storeId från sessionen
  };

  try {
    const res = await fetch('/api/customerCards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.message || 'Kunde inte skapa kundkort.');
    }
    const newCard = await res.json();
    addToast({
      title: 'Framgång',
      description: 'Kundkort skapat!',
      color: 'success',
      variant: 'flat'
    });
    setCustomerCards(prev => [...prev, newCard]);
    if (!defaultCardId) setDefaultCardId(newCard.id);
    // Återställ formuläret
    setCardName('');
    setDynamicFields([]);
    setCreateModalOpen(false);
  } catch (err: any) {
    console.error(err);
    addToast({
      title: 'Fel',
      description: err.message || 'Ett fel inträffade.',
      color: 'danger',
      variant: 'flat'
    });
  }
};


  // Rendera tabell med kundkort
  const renderTable = () => (
    <Table>
      <TableHeader>
        <TableColumn>ID</TableColumn>
        <TableColumn>Mallnamn</TableColumn>
        <TableColumn>Fält</TableColumn>
        <TableColumn>Standard</TableColumn>
      </TableHeader>
      <TableBody emptyContent="Inga kundkort skapade än.">
        {customerCards.map((card) => (
          <TableRow key={card.id}>
            <TableCell>{card.id}</TableCell>
            <TableCell>{card.cardName}</TableCell>
            <TableCell>
              {card.dynamicFields
                ? Object.entries(card.dynamicFields).map(([key, jsonValue]) => {
                    const parsed = JSON.parse(jsonValue);
                    return (
                      <div key={key}>
                        {key} (
                        {parsed.mapping === 'DYNAMIC'
                          ? `Ny – ${parsed.inputType}`
                          : customerFieldOptions.find(opt => opt.value === parsed.mapping)?.label || parsed.mapping}
                        
                        {parsed.isRequired && <span> (Obligatoriskt)</span>}
                      </div>
                    );
                  })
                : '-'}
            </TableCell>
            <TableCell>{card.isDefault ? 'Ja' : 'Nej'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <section className="flex flex-col items-center justify-center gap-8 py-8 md:py-10">
      <div className="inline-block max-w-lg text-center">
        <h1 className={title({ size: 'sm' })}>Kundkort (mallar)</h1>
        <Button type="button" onPress={() => setCreateModalOpen(true)} variant="flat">
          Skapa nytt kundkort
        </Button>
      </div>
      {renderTable()}
      {/* Modal för skapande av kundkort */}
      {createModalOpen && (
        <Modal
          isOpen={createModalOpen}
          scrollBehavior="inside"
          onOpenChange={setCreateModalOpen}
          backdrop="opaque"
        >
          <ModalContent>
            <ModalHeader>
              <h2 className="text-lg font-semibold">Skapa nytt kundkort</h2>
            </ModalHeader>
            <ModalBody>
              <Form onSubmit={handleSubmit} className="w-full space-y-4">
                {/* Mallnamn */}
                <div>
                  <label htmlFor="cardName" className="block text-left text-sm font-bold mb-2">
                    Mallnamn
                  </label>
                  <Input
                    id="cardName"
                    name="cardName"
                    placeholder="Ange mallnamn"
                    value={cardName}
                    onValueChange={setCardName}
                  />
                </div>
                {/* Dynamiska fält */}
                <div>
                  <h3 className="text-left text-sm font-bold mb-2">Fält</h3>
                  {dynamicFields.map((field, index) => (
                    <div key={index} className="mb-4 p-4 border rounded flex flex-col gap-2">
                      {/* Dropdown för fältmappning */}
                      <div>
                        <label className="block text-xs font-semibold mb-1">Välj fält</label>
                        <Dropdown>
                          <DropdownTrigger>
                            <Button variant="flat" size="sm">
                              {field.mapping
                                ? customerFieldOptions.find(opt => opt.value === field.mapping)?.label
                                : 'Välj fält'}
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu
                            selectionMode="single"
                            selectedKeys={field.mapping ? new Set([field.mapping]) : new Set()}
                            onSelectionChange={(keys: any) => {
                              const selected = Array.from(keys)[0] || '';
                              updateDynamicField(index, { mapping: selected as string });
                            }}
                          >
                            {customerFieldOptions.map((option) => (
                              <DropdownItem key={option.value}>
                                {option.label}
                              </DropdownItem>
                            ))}
                          </DropdownMenu>
                        </Dropdown>
                      </div>
                      {/* Om valt fält är "Dynamiskt fält", visa inmatningsfält för fältnamn och extra dropdown för inmatningstyp */}
                      {field.mapping === 'DYNAMIC' && (
                        <>
                          <div>
                            <label className="block text-xs font-semibold mb-1">Fältnamn</label>
                            <Input
                              placeholder="Ange fältnamn"
                              value={field.fieldName || ''}
                              onValueChange={(val) => updateDynamicField(index, { fieldName: val })}
                              size="sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1">Välj inmatningstyp</label>
                            <Dropdown>
                              <DropdownTrigger>
                                <Button variant="flat" size="sm">
                                  {field.inputType
                                    ? inputTypeOptions.find(opt => opt.value === field.inputType)?.label
                                    : 'Välj typ'}
                                </Button>
                              </DropdownTrigger>
                              <DropdownMenu
                                selectionMode="single"
                                selectedKeys={field.inputType ? new Set([field.inputType]) : new Set()}
                                onSelectionChange={(keys: any) => {
                                  const selected = Array.from(keys)[0] || '';
                                  updateDynamicField(index, { inputType: selected as string });
                                }}
                              >
                                {inputTypeOptions.map((option) => (
                                  <DropdownItem key={option.value}>
                                    {option.label}
                                  </DropdownItem>
                                ))}
                              </DropdownMenu>
                            </Dropdown>
                          </div>
                        </>
                      )}
                      {/* Checkbox och ta bort-knapp */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <Checkbox
                          isSelected={field.isRequired}
                          onChange={(e) =>
                            updateDynamicField(index, { isRequired: e.target.checked })
                          }
                        >
                          <span className="text-xs">Obligatoriskt</span>
                        </Checkbox>
                        <Button
                          type="button"
                          variant="flat"
                          onPress={() => removeDynamicField(index)}
                          className="text-danger text-xs"
                        >
                          Ta bort
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button type="button" onPress={addDynamicField} className="mt-2">
                    Lägg till fält
                  </Button>
                </div>
                <div className="flex flex-col gap-2">
                  <Button type="reset" className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
                    Återställ
                  </Button>
                  <Button type="submit" className="bg-success hover:bg-secondary-700 text-white font-bold py-2 px-4 rounded">
                    Skapa kundkort
                  </Button>
                </div>
              </Form>
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="flat" onPress={() => setCreateModalOpen(false)}>
                Stäng
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </section>
  );
}
