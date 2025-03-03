import { useState, useEffect } from 'react';
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
  DatePicker,
  Input
} from '@heroui/react';
import { title } from '@/components/primitives';
import { TicketType } from '@/types/ticket';
import { DeleteIcon, EditIcon } from '@/components/icons';

export default function Arendetyper() {
  const { data: session, status } = useSession();
  const [ticketName, setTicketName] = useState('');
  const [fields, setFields] = useState([{ name: '', fieldType: '', isRequired: false }]);
  const [validationErrors, setValidationErrors] = useState({});
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [editingTicket, setEditingTicket] = useState<TicketType | null>(null);
  const [editName, setEditName] = useState('');
  const [editFields, setEditFields] = useState<any[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Hämta alla ärendetyper vid sidladdning
  useEffect(() => {
    async function fetchTicketTypes() {
      try {
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
      }
    }
    fetchTicketTypes();
  }, []);

  if (status === 'loading') return <p>Laddar...</p>;
  if (!session) return <p>Ingen session – vänligen logga in.</p>;

  const addField = () => {
    setFields([...fields, { name: '', fieldType: '', isRequired: false }]);
  };

  // Skapande av ny ärendetyp (används i skapande-modal)
  const handleSubmit = async (event: { preventDefault: () => void; }) => {
    event.preventDefault();
    const payload = {
      name: ticketName,
      fields,
      storeId: session.user.storeId
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
        setValidationErrors(data.errors || {});
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
    const payload = { name: editName, fields: editFields };
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

  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="inline-block max-w-lg text-center">
        <h1 className={title({ size: 'sm' })}>Ärendetyper</h1>
        <p>Butik ID: {session.user.storeId}</p>
        <Button type="button" onPress={() => setCreateModalOpen(true)} variant="flat">
          Skapa ny ärendetyp
        </Button>
      </div>

      {/* Tabell med ärendetyper */}
      <div className="w-full max-w-full mt-10">
        <h2 className="text-lg font-semibold mb-4">Lista över Ärendetyper</h2>
        <Table>
          <TableHeader>
            <TableColumn>ID</TableColumn>
            <TableColumn>Namn</TableColumn>
            <TableColumn>Fält</TableColumn>
            <TableColumn>Åtgärder</TableColumn>
          </TableHeader>
          <TableBody emptyContent="Inga ärendetyper har skapats än.">
            {ticketTypes.map((tt: TicketType) => (
              <TableRow key={tt.id}>
                <TableCell>{tt.id}</TableCell>
                <TableCell>{tt.name}</TableCell>
                <TableCell>
                  {tt.fields &&
                    tt.fields.map((field: any, index: number) => (
                      <div key={index}>
                        {field.name} ({field.fieldType}) {field.isRequired && <span>Obligatoriskt</span>}
                      </div>
                    ))}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="flat" onPress={() => handleEdit(tt)}>
                      <EditIcon />
                    </Button>
                    <Button type="button" variant="flat" onPress={() => handleDelete(tt.id)}>
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
      {createModalOpen && (
        <Modal
          isOpen={createModalOpen}
          scrollBehavior="inside"
          onOpenChange={setCreateModalOpen}
          backdrop="opaque"
        >
          <ModalContent>
            <ModalHeader>
              <h2 className="text-lg font-semibold">Skapa ny ärendetyp</h2>
            </ModalHeader>
            <ModalBody>
              <Form
                onSubmit={handleSubmit}
                onReset={handleReset}
                validationBehavior="native"
                validationErrors={validationErrors}
                className="w-full"
              >
                <div className="mb-4">
                  <label htmlFor="ticketName" className="block text-left text-sm font-bold mb-2">
                    Namn på ärendetypen
                  </label>
                  <input
                    id="ticketName"
                    name="ticketName"
                    type="text"
                    value={ticketName}
                    onChange={(e) => setTicketName(e.target.value)}
                    required
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                  />
                </div>

                {/* Dynamiska fält för skapande */}
                <div>
                  <h2 className="text-lg font-semibold mb-2">Fält</h2>
                  {fields.map((field, index) => (
                    <div key={index} className="mb-4 p-4 border rounded">
                      <div className="mb-2">
                        <label htmlFor={`field-name-${index}`} className="block text-left text-sm font-bold mb-1">
                          Fältnamn
                        </label>
                        <input
                          id={`field-name-${index}`}
                          name={`fields[${index}].name`}
                          type="text"
                          value={field.name}
                          onChange={(e) => {
                            const updatedFields = [...fields];
                            updatedFields[index].name = e.target.value;
                            setFields(updatedFields);
                          }}
                          required
                          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                        />
                      </div>
                      <div className="mb-2">
                        <label htmlFor={`field-type-${index}`} className="block text-left text-sm font-bold mb-1">
                          Fälttyp
                        </label>
                        <select
                          id={`field-type-${index}`}
                          name={`fields[${index}].fieldType`}
                          value={field.fieldType}
                          onChange={(e) => {
                            const updatedFields = [...fields];
                            updatedFields[index].fieldType = e.target.value;
                            setFields(updatedFields);
                          }}
                          required
                          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                        >
                          <option value="">Välj fälttyp</option>
                          <option value="TEXT">Text</option>
                          <option value="NUMBER">Number</option>
                          <option value="DATE">Datum</option>
                          <option value="DUE_DATE">Senast klar</option>
                        </select>

                      </div>
                      <div className="flex items-center">
                        <input
                          id={`field-required-${index}`}
                          name={`fields[${index}].isRequired`}
                          type="checkbox"
                          checked={field.isRequired}
                          onChange={(e) => {
                            const updatedFields = [...fields];
                            updatedFields[index].isRequired = e.target.checked;
                            setFields(updatedFields);
                          }}
                          className="mr-2 leading-tight"
                        />
                        <label htmlFor={`field-required-${index}`} className="text-sm">
                          Obligatoriskt
                        </label>
                      </div>
                    </div>
                  ))}
                  <Button type="button" onPress={addField} className="bg-focus hover:bg-secondary-700 text-white font-bold py-2 px-4">
                    Lägg till fält
                  </Button>
                </div>

                {/* Submit och reset för skapande */}
                <div className="mt-4 flex justify-between">
                  <Button type="reset" className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4">
                    Återställ
                  </Button>
                  <Button type="submit" className="bg-success hover:bg-secondary-700 text-white font-bold py-2 px-4">
                    Skapa ärendetyp
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

      {/* Modal för redigering av ärendetyp */}
      {editingTicket && (
        <Modal
          isOpen={true}
          scrollBehavior="inside"
          onOpenChange={(isOpen) => {
            if (!isOpen) setEditingTicket(null);
          }}
          backdrop="opaque"
        >
          <ModalContent>
            <ModalHeader>
              <h2 className="text-lg font-semibold">Redigera Ärendetyp</h2>
            </ModalHeader>
            <ModalBody>
              <Form
                onSubmit={handleEditSubmit}
                onReset={() => setEditingTicket(null)}
                className="w-full"
              >
                <div className="mb-4">
                  <label htmlFor="editTicketName" className="block text-left text-sm font-bold mb-2">
                    Namn på ärendetypen
                  </label>
                  <input
                    id="editTicketName"
                    name="editTicketName"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                  />
                </div>
                {/* Redigeringssektion för fält */}
                <div>
                  <h2 className="text-lg font-semibold mb-2">Redigera fält</h2>
                  {editFields.map((field, index) => (
                    <div key={index} className="mb-4 p-4 border rounded">
                      <div className="mb-2">
                        <label htmlFor={`edit-field-name-${index}`} className="block text-left text-sm font-bold mb-1">
                          Fältnamn
                        </label>
                        <input
                          id={`edit-field-name-${index}`}
                          name={`editFields[${index}].name`}
                          type="text"
                          value={field.name}
                          onChange={(e) => {
                            const updatedFields = [...editFields];
                            updatedFields[index].name = e.target.value;
                            setEditFields(updatedFields);
                          }}
                          required
                          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                        />
                      </div>
                      <div className="mb-2">
                        <label htmlFor={`edit-field-type-${index}`} className="block text-left text-sm font-bold mb-1">
                          Fälttyp
                        </label>
                        <select
                          id={`edit-field-type-${index}`}
                          name={`editFields[${index}].fieldType`}
                          value={field.fieldType}
                          onChange={(e) => {
                            const updatedFields = [...editFields];
                            updatedFields[index].fieldType = e.target.value;
                            setEditFields(updatedFields);
                          }}
                          required
                          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                        >
                          <option value="">Välj fälttyp</option>
                          <option value="TEXT">Text</option>
                          <option value="NUMBER">Number</option>
                          <option value="DATE">Datum</option>
                          <option value="DUE_DATE">Senast klar</option>
                        </select>
                      </div>
                      <div className="flex items-center">
                        <input
                          id={`edit-field-required-${index}`}
                          name={`editFields[${index}].isRequired`}
                          type="checkbox"
                          checked={field.isRequired}
                          onChange={(e) => {
                            const updatedFields = [...editFields];
                            updatedFields[index].isRequired = e.target.checked;
                            setEditFields(updatedFields);
                          }}
                          className="mr-2 leading-tight"
                        />
                        <label htmlFor={`edit-field-required-${index}`} className="text-sm">
                          Obligatoriskt
                        </label>
                        <Button
                          type="button"
                          variant="flat"
                          onPress={() => {
                            const updatedFields = [...editFields];
                            updatedFields.splice(index, 1);
                            setEditFields(updatedFields);
                          }}
                          className="ml-4 text-danger"
                        >
                          Ta bort fält
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    onPress={() => setEditFields([...editFields, { name: '', fieldType: '', isRequired: false }])}
                    className="bg-focus hover:bg-secondary-700 text-white font-bold py-2 px-4"
                  >
                    Lägg till fält
                  </Button>
                </div>
                <div className="mt-4 flex justify-end gap-4">
                  <Button type="reset" className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4">
                    Avbryt
                  </Button>
                  <Button type="submit" className="bg-success hover:bg-secondary-700 text-white font-bold py-2 px-4">
                    Spara
                  </Button>
                </div>
              </Form>
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="flat" onPress={() => setEditingTicket(null)}>
                Stäng
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </section>
  );
}
