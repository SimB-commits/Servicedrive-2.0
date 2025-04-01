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
import { DeleteIcon, EditIcon } from '@/components/icons';

// Typdefinition för ärendetyp
export type TicketType = {
  id: number;
  name: string;
  fields: { 
    id?: number;
    name: string; 
    fieldType: string;
    isRequired: boolean;
  }[];
  storeId: number;
};

// Typdefinition för fält inom ärendetyp
interface Field {
  name: string;
  fieldType: string;
  isRequired: boolean;
}

export default function Arendetyper() {
  const { data: session, status } = useSession();
  const [ticketName, setTicketName] = useState('');
  const [fields, setFields] = useState<Field[]>([{ name: '', fieldType: '', isRequired: false }]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [editingTicket, setEditingTicket] = useState<TicketType | null>(null);
  const [editName, setEditName] = useState('');
  const [editFields, setEditFields] = useState<Field[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterValue, setFilterValue] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // Hämta alla ärendetyper vid sidladdning
  useEffect(() => {
    fetchTicketTypes();
  }, []);

  const fetchTicketTypes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tickets/types', { method: 'GET' });
      const data = await res.json();
      if (res.ok) {
        setTicketTypes(data);
      } else {
        addToast({
          title: 'Fel',
          description: data.message || 'Kunde inte hämta ärendetyper.',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid hämtning av ärendetyper:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid hämtning av ärendetyper.',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setLoading(false);
    }
  };

  const addField = () => {
    setFields([...fields, { name: '', fieldType: '', isRequired: false }]);
  };

  // Sökfunktionalitet
  const onSearchChange = (value: string) => {
    setFilterValue(value);
    setPage(1);
  };

  // Filtrera ärendetyper baserat på sökterm
  const filteredTicketTypes = useMemo(() => {
    return ticketTypes.filter((type) => {
      if (!filterValue.trim()) return true;
      
      return type.name.toLowerCase().includes(filterValue.toLowerCase());
    });
  }, [ticketTypes, filterValue]);

  // Paginering
  const pages = Math.ceil(filteredTicketTypes.length / rowsPerPage);

  const displayedTicketTypes = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredTicketTypes.slice(start, end);
  }, [filteredTicketTypes, page, rowsPerPage]);

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

  // Skapande av ny ärendetyp (används i skapande-modal)
  const handleSubmit = async (event: { preventDefault: () => void; }) => {
    event.preventDefault();
    setValidationErrors({});

    // Validera formuläret
    const errors: Record<string, string> = {};
    if (!ticketName.trim()) {
      errors.ticketName = 'Namn på ärendetyp krävs';
    }

    fields.forEach((field, index) => {
      if (!field.name.trim()) {
        errors[`field_${index}_name`] = 'Fältnamn krävs';
      }
      if (!field.fieldType) {
        errors[`field_${index}_type`] = 'Fälttyp krävs';
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    const payload = {
      name: ticketName,
      fields,
      storeId: session?.user.storeId
    };

    try {
      const res = await fetch('/api/tickets/types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const newTicketType = await res.json();
        addToast({
          title: 'Ärendetyp skapad',
          description: 'Den nya ärendetypen skapades framgångsrikt!',
          color: 'success',
          variant: 'flat'
        });
        setTicketTypes((prev) => [...prev, newTicketType]);
        setTicketName('');
        setFields([{ name: '', fieldType: '', isRequired: false }]);
        setValidationErrors({});
        setCreateModalOpen(false); // Stäng modalen vid lyckat skapande
      } else {
        const data = await res.json();
        if (data.errors) {
          const fieldErrors: Record<string, string> = {};
          data.errors.forEach((error: { field: string; message: string }) => {
            fieldErrors[error.field] = error.message;
          });
          setValidationErrors(fieldErrors);
        }
        addToast({
          title: 'Fel',
          description: data.message || 'Något gick fel vid skapandet.',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid skapande av ärendetyp:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid skapandet av ärendetypen.',
        color: 'danger',
        variant: 'flat'
      });
    }
  };

  const handleReset = () => {
    setTicketName('');
    setFields([{ name: '', fieldType: '', isRequired: false }]);
    setValidationErrors({});
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Är du säker på att du vill ta bort denna ärendetyp? Detta kan påverka befintliga ärenden.')) {
      return;
    }
    
    try {
      const res = await fetch(`/api/tickets/types/${id}`, { method: 'DELETE' });
      if (res.ok) {
        addToast({
          title: 'Ärendetyp borttagen',
          description: 'Ärendetypen togs bort.',
          color: 'success',
          variant: 'flat'
        });
        setTicketTypes((prev) => prev.filter((tt) => tt.id !== id));
      } else {
        const data = await res.json();
        addToast({
          title: 'Fel',
          description: data.message || 'Kunde inte ta bort ärendetypen.',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid borttagning av ärendetyp:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid borttagning av ärendetypen.',
        color: 'danger',
        variant: 'flat'
      });
    }
  };

  const handleEdit = (ticket: TicketType) => {
    setEditingTicket(ticket);
    setEditName(ticket.name);
    setEditFields(ticket.fields || []);
  };

  // Redigeringssubmit: uppdatera befintlig ärendetyp
  const handleEditSubmit = async (event: { preventDefault: () => void; }) => {
    event.preventDefault();
    if (!editingTicket) return;
    
    // Validera formuläret
    const errors: Record<string, string> = {};
    if (!editName.trim()) {
      errors.editName = 'Namn på ärendetyp krävs';
    }

    editFields.forEach((field, index) => {
      if (!field.name.trim()) {
        errors[`editField_${index}_name`] = 'Fältnamn krävs';
      }
      if (!field.fieldType) {
        errors[`editField_${index}_type`] = 'Fälttyp krävs';
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    const payload = { 
      name: editName, 
      fields: editFields.map(field => ({
        name: field.name,
        fieldType: field.fieldType,
        isRequired: field.isRequired
      }))
    };
    
    try {
      const res = await fetch(`/api/tickets/types/${editingTicket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const updatedTicket = await res.json();
        addToast({
          title: 'Ärendetyp uppdaterad',
          description: 'Ärendetypen uppdaterades framgångsrikt!',
          color: 'success',
          variant: 'flat'
        });
        setTicketTypes((prev) =>
          prev.map((tt) => (tt.id === updatedTicket.id ? updatedTicket : tt))
        );
        setEditingTicket(null);
      } else {
        const data = await res.json();
        if (data.errors) {
          const fieldErrors: Record<string, string> = {};
          data.errors.forEach((error: { field: string; message: string }) => {
            fieldErrors[error.field] = error.message;
          });
          setValidationErrors(fieldErrors);
        }
        addToast({
          title: 'Fel',
          description: data.message || 'Kunde inte uppdatera ärendetypen.',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid uppdatering av ärendetyp:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid uppdatering av ärendetypen.',
        color: 'danger',
        variant: 'flat'
      });
    }
  };

  // Komponera tabelltoppdelen med sök och filter
  const topContent = useMemo(() => (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between gap-3 items-end">
        <Input
          isClearable
          className="w-full sm:max-w-[44%]"
          placeholder="Sök på ärendetyp..."
          value={filterValue}
          onClear={() => onSearchChange("")}
          onValueChange={onSearchChange}
        />
        <div className="flex gap-3">
          <Button color="primary" onPress={() => setCreateModalOpen(true)}>
            Skapa ny ärendetyp
          </Button>
        </div>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-default-400 text-small">
          Totalt {filteredTicketTypes.length} ärendetyper
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
  ), [filterValue, filteredTicketTypes.length, rowsPerPage]);

  // Komponera tabellbottendelen med paginering
  const bottomContent = useMemo(() => (
    <div className="py-2 px-2 flex justify-between items-center">
      <span className="w-[30%] text-small text-default-400">
        {`Visar ${displayedTicketTypes.length} av ${filteredTicketTypes.length} ärendetyper`}
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
  ), [page, pages, filteredTicketTypes.length, displayedTicketTypes.length]);

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
      <div className="inline-block max-w-lg text-center mb-6">
        <h1 className={title({ size: 'sm' })}>Ärendetyper</h1>
        <p className="text-default-600">Hantera ärendetyper för ditt konto</p>
      </div>

      {/* Tabell med ärendetyper */}
      <div className="w-full max-w-6xl">
        <Table
          aria-label="Ärendetyper"
          topContent={topContent}
          topContentPlacement="outside"
          bottomContent={bottomContent}
          bottomContentPlacement="outside"
        >
          <TableHeader>
            <TableColumn>ID</TableColumn>
            <TableColumn>Namn</TableColumn>
            <TableColumn>Fält</TableColumn>
            <TableColumn>Åtgärder</TableColumn>
          </TableHeader>
          <TableBody emptyContent="Inga ärendetyper hittades" >
            {displayedTicketTypes.map((tt) => (
              <TableRow key={tt.id}>
                <TableCell>{tt.id}</TableCell>
                <TableCell>{tt.name}</TableCell>
                <TableCell>
                  <div className="max-h-24 overflow-y-auto">
                    {tt.fields && tt.fields.map((field, index) => (
                      <div key={index} className="text-sm">
                        {field.name} ({field.fieldType})
                        {field.isRequired && <span className="text-danger ml-1">*</span>}
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button 
                      type="button" 
                      variant="flat" 
                      isIconOnly
                      onPress={() => handleEdit(tt)}
                    >
                      <EditIcon />
                    </Button>
                    <Button 
                      type="button" 
                      variant="flat" 
                      isIconOnly
                      color="danger"
                      onPress={() => handleDelete(tt.id)}
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

      {/* Modal för skapande av ny ärendetyp */}
      <Modal
        isOpen={createModalOpen}
        onOpenChange={setCreateModalOpen}
        scrollBehavior="inside"
        size="3xl"
        // Viktig tillägg: Lägg till denna prop för att förhindra stängning vid klick inne i modalen
        isDismissable={false}
        // Stängning via escape fortfarande möjlig
        closeButton={true}
      >
        <ModalContent>
          <ModalHeader>
            <h2 className="text-xl font-bold">Skapa ny ärendetyp</h2>
          </ModalHeader>
          <ModalBody>
            <Form
              onSubmit={handleSubmit}
              onReset={handleReset}
              className="space-y-6"
            >
              <div>
                <label htmlFor="ticketName" className="block text-sm font-medium mb-1">
                  Namn på ärendetypen
                </label>
                <Input
                  id="ticketName"
                  value={ticketName}
                  onValueChange={setTicketName}
                  placeholder="Skriv namn på ärendetypen"
                  isInvalid={!!validationErrors.ticketName}
                  errorMessage={validationErrors.ticketName}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-md font-medium">Fält</h3>
                  <Button 
                    type="button" 
                    size="sm"
                    variant="flat"
                    color="primary"
                    onPress={addField}
                  >
                    Lägg till fält
                  </Button>
                </div>

                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={index} className="p-4 border rounded-md">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-sm font-medium">Fält {index + 1}</h4>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            size="sm"
                            isIconOnly
                            variant="flat"
                            color="danger"
                            onPress={() => {
                              const updatedFields = [...fields];
                              updatedFields.splice(index, 1);
                              setFields(updatedFields);
                            }}
                          >
                            <DeleteIcon />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor={`field-${index}-name`} className="block text-sm mb-1">
                            Fältnamn
                          </label>
                          <Input
                            id={`field-${index}-name`}
                            value={field.name}
                            onValueChange={(value) => {
                              const updatedFields = [...fields];
                              updatedFields[index].name = value;
                              setFields(updatedFields);
                            }}
                            placeholder="Skriv fältnamn"
                            isInvalid={!!validationErrors[`field_${index}_name`]}
                            errorMessage={validationErrors[`field_${index}_name`]}
                          />
                        </div>
                        
                        <div>
                          <label htmlFor={`field-${index}-type`} className="block text-sm mb-1">
                            Fälttyp
                          </label>
                          <Dropdown>
                            <DropdownTrigger>
                              <Button 
                                variant="flat" 
                                className="w-full justify-start"
                                isInvalid={!!validationErrors[`field_${index}_type`]}
                              >
                                {field.fieldType || "Välj fälttyp"}
                              </Button>
                            </DropdownTrigger>
                            <DropdownMenu 
                              aria-label="Välj fälttyp"
                              onAction={(key) => {
                                const updatedFields = [...fields];
                                updatedFields[index].fieldType = key as string;
                                setFields(updatedFields);
                              }}
                            >
                              <DropdownItem key="TEXT">Text</DropdownItem>
                              <DropdownItem key="NUMBER">Nummer</DropdownItem>
                              <DropdownItem key="DATE">Datum</DropdownItem>
                              <DropdownItem key="DUE_DATE">Senast klar</DropdownItem>
                            </DropdownMenu>
                          </Dropdown>
                          {validationErrors[`field_${index}_type`] && (
                            <p className="text-danger text-xs mt-1">
                              {validationErrors[`field_${index}_type`]}
                            </p>
                          )}
                        </div>
                        
                        <div className="sm:col-span-2">
                          <Checkbox
                            isSelected={field.isRequired}
                            onValueChange={(checked) => {
                              const updatedFields = [...fields];
                              updatedFields[index].isRequired = checked;
                              setFields(updatedFields);
                            }}
                          >
                            Obligatoriskt fält
                          </Checkbox>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="flat" 
                  onPress={() => {
                    handleReset();
                    setCreateModalOpen(false);
                  }}
                >
                  Avbryt
                </Button>
                <Button type="submit" color="primary">
                  Skapa ärendetyp
                </Button>
              </div>
            </Form>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Modal för redigering av ärendetyp */}
      {editingTicket && (
        <Modal
          isOpen={!!editingTicket}
          onOpenChange={(isOpen) => {
            if (!isOpen) setEditingTicket(null);
          }}
          scrollBehavior="inside"
          size="3xl"
        >
          <ModalContent>
            <ModalHeader>
              <h2 className="text-xl font-bold">Redigera ärendetyp</h2>
            </ModalHeader>
            <ModalBody>
              <Form
                onSubmit={handleEditSubmit}
                className="space-y-6"
              >
                <div>
                  <label htmlFor="editName" className="block text-sm font-medium mb-1">
                    Namn på ärendetypen
                  </label>
                  <Input
                    id="editName"
                    value={editName}
                    onValueChange={setEditName}
                    placeholder="Skriv namn på ärendetypen"
                    isInvalid={!!validationErrors.editName}
                    errorMessage={validationErrors.editName}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-md font-medium">Fält</h3>
                    <Button 
                      type="button" 
                      size="sm"
                      variant="flat"
                      color="primary"
                      onPress={() => setEditFields([...editFields, { name: '', fieldType: '', isRequired: false }])}
                    >
                      Lägg till fält
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {editFields.map((field, index) => (
                      <div key={index} className="p-4 border rounded-md">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-sm font-medium">Fält {index + 1}</h4>
                          {editFields.length > 1 && (
                            <Button
                              type="button"
                              size="sm"
                              isIconOnly
                              variant="flat"
                              color="danger"
                              onPress={() => {
                                const updatedFields = [...editFields];
                                updatedFields.splice(index, 1);
                                setEditFields(updatedFields);
                              }}
                            >
                              <DeleteIcon />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label htmlFor={`editField-${index}-name`} className="block text-sm mb-1">
                              Fältnamn
                            </label>
                            <Input
                              id={`editField-${index}-name`}
                              value={field.name}
                              onValueChange={(value) => {
                                const updatedFields = [...editFields];
                                updatedFields[index].name = value;
                                setEditFields(updatedFields);
                              }}
                              placeholder="Skriv fältnamn"
                              isInvalid={!!validationErrors[`editField_${index}_name`]}
                              errorMessage={validationErrors[`editField_${index}_name`]}
                            />
                          </div>
                          
                          <div>
                            <label htmlFor={`editField-${index}-type`} className="block text-sm mb-1">
                              Fälttyp
                            </label>
                            <Dropdown>
                              <DropdownTrigger>
                                <Button 
                                  variant="flat" 
                                  className="w-full justify-start"
                                  isInvalid={!!validationErrors[`editField_${index}_type`]}
                                >
                                  {field.fieldType || "Välj fälttyp"}
                                </Button>
                              </DropdownTrigger>
                              <DropdownMenu 
                                aria-label="Välj fälttyp"
                                onAction={(key) => {
                                  const updatedFields = [...editFields];
                                  updatedFields[index].fieldType = key as string;
                                  setEditFields(updatedFields);
                                }}
                              >
                                <DropdownItem key="TEXT">Text</DropdownItem>
                                <DropdownItem key="NUMBER">Nummer</DropdownItem>
                                <DropdownItem key="DATE">Datum</DropdownItem>
                                <DropdownItem key="DUE_DATE">Senast klar</DropdownItem>
                              </DropdownMenu>
                            </Dropdown>
                            {validationErrors[`editField_${index}_type`] && (
                              <p className="text-danger text-xs mt-1">
                                {validationErrors[`editField_${index}_type`]}
                              </p>
                            )}
                          </div>
                          
                          <div className="sm:col-span-2">
                            <Checkbox
                              isSelected={field.isRequired}
                              onValueChange={(checked) => {
                                const updatedFields = [...editFields];
                                updatedFields[index].isRequired = checked;
                                setEditFields(updatedFields);
                              }}
                            >
                              Obligatoriskt fält
                            </Checkbox>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="flat" 
                    onPress={() => setEditingTicket(null)}
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
      )}
    </section>
  );
}