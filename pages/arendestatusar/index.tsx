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
  Input
} from '@heroui/react';
import { title, subtitle } from '@/components/primitives';
import { DeleteIcon, EditIcon } from '@/components/icons';

export default function Arendestatusar() {
  const { data: session, status } = useSession();
  const [statusName, setStatusName] = useState('');
  const [selectedMailTemplate, setSelectedMailTemplate] = useState('');
  const [statusColor, setStatusColor] = useState('#ffffff'); // Defaultfärg
  const [validationErrors, setValidationErrors] = useState({});
  const [statuses, setStatuses] = useState<any[]>([]);
  const [editingStatus, setEditingStatus] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editSelectedMailTemplate, setEditSelectedMailTemplate] = useState('');
  const [editStatusColor, setEditStatusColor] = useState('#ffffff');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [mailTemplates, setMailTemplates] = useState<any[]>([]);

  // Hämta alla statusar vid sidladdning
  useEffect(() => {
    async function fetchStatuses() {
      try {
        const res = await fetch('/api/tickets/statuses', { method: 'GET' });
        const data = await res.json();
        if (res.ok) {
          setStatuses(data);
        } else {
          addToast({
            title: 'Fel',
            description: data.message || 'Kunde inte hämta statusar.',
            color: 'danger',
            variant: 'flat'
          });
        }
      } catch (error) {
        console.error('Fel vid hämtning av statusar:', error);
        addToast({
          title: 'Fel',
          description: 'Ett fel inträffade vid hämtning av statusar.',
          color: 'danger',
          variant: 'flat'
        });
      }
    }
    fetchStatuses();
  }, []);

  // Hämta tillgängliga mailmallar (förutsätter att du har en API-rutt på /api/mail/templates)
  useEffect(() => {
    async function fetchMailTemplates() {
      try {
        const res = await fetch('/api/mail/templates', { method: 'GET' });
        const data = await res.json();
        if (res.ok) {
          setMailTemplates(data);
        } else {
          addToast({
            title: 'Fel',
            description: data.message || 'Kunde inte hämta mailmallar.',
            color: 'danger',
            variant: 'flat'
          });
        }
      } catch (error) {
        console.error('Fel vid hämtning av mailmallar:', error);
        addToast({
          title: 'Fel',
          description: 'Ett fel inträffade vid hämtning av mailmallar.',
          color: 'danger',
          variant: 'flat'
        });
      }
    }
    fetchMailTemplates();
  }, []);

  if (status === 'loading') return <p>Laddar session...</p>;
  if (!session) return <p>Ingen session – vänligen logga in.</p>;

  // Skapa ny status
  const handleSubmit = async (event: { preventDefault: () => void; }) => {
    event.preventDefault();
    const payload = {
      name: statusName,
      mailTemplateId: selectedMailTemplate ? Number(selectedMailTemplate) : null,
      color: statusColor
    };

    try {
      const res = await fetch('/api/tickets/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const newStatus = await res.json();
        addToast({
          title: 'Status skapad',
          description: 'Den nya statusen skapades framgångsrikt!',
          color: 'success',
          variant: 'flat'
        });
        setStatuses((prev) => [...prev, newStatus]);
        setStatusName('');
        setSelectedMailTemplate('');
        setStatusColor('#ffffff');
        setValidationErrors({});
        setCreateModalOpen(false);
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
      console.error('Fel vid skapande av status:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid skapandet av statusen.',
        color: 'danger',
        variant: 'flat'
      });
    }
  };

  const handleReset = () => {
    setStatusName('');
    setSelectedMailTemplate('');
    setStatusColor('#ffffff');
    setValidationErrors({});
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/tickets/statuses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        addToast({
          title: 'Status borttagen',
          description: 'Statusen togs bort.',
          color: 'success',
          variant: 'flat'
        });
        setStatuses((prev) => prev.filter((s) => s.id !== id));
      } else {
        const data = await res.json();
        addToast({
          title: 'Fel',
          description: data.message || 'Kunde inte ta bort statusen.',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid borttagning av status:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid borttagning av statusen.',
        color: 'danger',
        variant: 'flat'
      });
    }
  };

  const handleEdit = (status: any) => {
    setEditingStatus(status);
    setEditName(status.name);
    setEditSelectedMailTemplate(status.mailTemplateId ? status.mailTemplateId.toString() : '');
    setEditStatusColor(status.color || '#ffffff');
  };

  const handleEditSubmit = async (event: { preventDefault: () => void; }) => {
    event.preventDefault();
    if (!editingStatus) return;
    const payload = {
      name: editName,
      mailTemplateId: editSelectedMailTemplate ? Number(editSelectedMailTemplate) : null,
      color: editStatusColor
    };
    try {
      const res = await fetch(`/api/tickets/statuses/${editingStatus.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const updatedStatus = await res.json();
        addToast({
          title: 'Status uppdaterad',
          description: 'Statusen uppdaterades framgångsrikt!',
          color: 'success',
          variant: 'flat'
        });
        setStatuses((prev) =>
          prev.map((s) => (s.id === updatedStatus.id ? updatedStatus : s))
        );
        setEditingStatus(null);
      } else {
        const data = await res.json();
        addToast({
          title: 'Fel',
          description: data.message || 'Kunde inte uppdatera statusen.',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid uppdatering av status:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid uppdatering av statusen.',
        color: 'danger',
        variant: 'flat'
      });
    }
  };

  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="inline-block max-w-lg text-center">
        <h1 className={title({ size: 'sm' })}>Ärendestatusar</h1>
        <p>Butik ID: {session.user.storeId}</p>
        <Button type="button" onPress={() => setCreateModalOpen(true)} variant="flat">
          Skapa ny status
        </Button>
      </div>

      {/* Tabell med statusar */}
      <div className="w-full max-w-full mt-10">
        <h2 className="text-lg font-semibold mb-4">Lista över Statusar</h2>
        <Table>
          <TableHeader>
            <TableColumn>ID</TableColumn>
            <TableColumn>Namn</TableColumn>
            <TableColumn>Färg</TableColumn>
            <TableColumn>Mailmall</TableColumn>
            <TableColumn>Åtgärder</TableColumn>
          </TableHeader>
          <TableBody emptyContent="Inga statusar har skapats än.">
            {statuses.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.id}</TableCell>
                <TableCell>{s.name}</TableCell>
                <TableCell>
                  <div
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                </TableCell>
                <TableCell>{s.mailTemplate ? s.mailTemplate.name : '-'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="flat" onPress={() => handleEdit(s)}>
                      <EditIcon />
                    </Button>
                    <Button type="button" variant="flat" onPress={() => handleDelete(s.id)}>
                      <DeleteIcon />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Modal för skapande av ny status */}
      {createModalOpen && (
        <Modal
          isOpen={createModalOpen}
          scrollBehavior="inside"
          onOpenChange={setCreateModalOpen}
          backdrop="opaque"
        >
          <ModalContent>
            <ModalHeader>
              <h2 className="text-lg font-semibold">Skapa ny status</h2>
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
                  <label htmlFor="statusName" className="block text-left text-sm font-bold mb-2">
                    Namn på status
                  </label>
                  <input
                    id="statusName"
                    name="statusName"
                    type="text"
                    value={statusName}
                    onChange={(e) => setStatusName(e.target.value)}
                    required
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="mailTemplate" className="block text-left text-sm font-bold mb-2">
                    Välj mailmall
                  </label>
                  <select
                    id="mailTemplate"
                    name="mailTemplate"
                    value={selectedMailTemplate}
                    onChange={(e) => setSelectedMailTemplate(e.target.value)}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                  >
                    <option value="">Ingen mall vald</option>
                    {mailTemplates.map((mt) => (
                      <option key={mt.id} value={mt.id}>
                        {mt.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label htmlFor="statusColor" className="block text-left text-sm font-bold mb-2">
                  Välj färg
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="statusColor"
                      name="statusColor"
                      type="color"
                      value={statusColor}
                      onChange={(e) => setStatusColor(e.target.value)}
                      className="shadow appearance-none border rounded py-2 px-3"
                    />
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: statusColor }} />
                </div>
              </div>
                  
                <div className="mt-4 flex justify-between">
                  <Button type="reset" className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
                    Återställ
                  </Button>
                  <Button type="submit" className="bg-success hover:bg-secondary-700 text-white font-bold py-2 px-4 rounded">
                    Skapa status
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

      {/* Modal för redigering av status */}
      {editingStatus && (
        <Modal
          isOpen={true}
          scrollBehavior="inside"
          onOpenChange={(isOpen) => {
            if (!isOpen) setEditingStatus(null);
          }}
          backdrop="opaque"
        >
          <ModalContent>
            <ModalHeader>
              <h2 className="text-lg font-semibold">Redigera status</h2>
            </ModalHeader>
            <ModalBody>
              <Form
                onSubmit={handleEditSubmit}
                onReset={() => setEditingStatus(null)}
                className="w-full"
              >
                <div className="mb-4">
                  <label htmlFor="editStatusName" className="block text-left text-sm font-bold mb-2">
                    Namn på status
                  </label>
                  <input
                    id="editStatusName"
                    name="editStatusName"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="editMailTemplate" className="block text-left text-sm font-bold mb-2">
                    Välj mailmall
                  </label>
                  <select
                    id="editMailTemplate"
                    name="editMailTemplate"
                    value={editSelectedMailTemplate}
                    onChange={(e) => setEditSelectedMailTemplate(e.target.value)}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700"
                  >
                    <option value="">Ingen mall vald</option>
                    {mailTemplates.map((mt) => (
                      <option key={mt.id} value={mt.id}>
                        {mt.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
  <label htmlFor="statusColor" className="block text-left text-sm font-bold mb-2">
    Välj färg
  </label>
  <div className="flex items-center gap-2">
    <input
      id="editstatusColor"
      name="editstatusColor"
      type="color"
      value={editStatusColor}
      onChange={(e) => {
        console.log("Ny färg:", e.target.value);
        setEditStatusColor(e.target.value);
      }}
      className="shadow appearance-none border rounded py-2 px-3"
    />
    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: editStatusColor }} />
  </div>
</div>

                <div className="mt-4 flex justify-end gap-4">
                  <Button type="reset" className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
                    Avbryt
                  </Button>
                  <Button type="submit" className="bg-success hover:bg-secondary-700 text-white font-bold py-2 px-4 rounded">
                    Spara
                  </Button>
                </div>
              </Form>
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="flat" onPress={() => setEditingStatus(null)}>
                Stäng
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </section>
  );
}
