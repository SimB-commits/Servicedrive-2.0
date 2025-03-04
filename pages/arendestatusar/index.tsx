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
  Card,
  CardBody,
  CardHeader,
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

  // Hämta tillgängliga mailmallar
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
    setValidationErrors({});

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
    if (!confirm('Är du säker på att du vill ta bort denna status?')) return;
    
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

  const handleEditSubmit = async () => {
    if (!editingStatus) return;
    
    setValidationErrors({});
    
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
        <p className={subtitle()}>Skapa och hantera statusar för dina ärenden</p>
        <Button 
          type="button" 
          onPress={() => setCreateModalOpen(true)} 
          color="primary"
          variant="flat"
          className="mt-4"
        >
          Skapa ny status
        </Button>
      </div>

      {/* Tabell med statusar */}
      <Card className="w-full max-w-6xl mt-6">
        <CardHeader className="flex flex-col">
          <h2 className="text-lg font-semibold">Lista över Statusar</h2>
        </CardHeader>
        <CardBody>
          <Table 
            aria-label="Statusar"
            removeWrapper
            selectionMode="none"
          >
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
                      className="w-6 h-6 rounded-full border border-default-200"
                      style={{ backgroundColor: s.color }}
                    />
                  </TableCell>
                  <TableCell>{s.mailTemplate ? s.mailTemplate.name : '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button 
                        type="button" 
                        variant="flat"
                        isIconOnly
                        size="sm"
                        onPress={() => handleEdit(s)}
                      >
                        <EditIcon />
                      </Button>
                      <Button 
                        type="button" 
                        variant="flat" 
                        isIconOnly
                        size="sm"
                        color="danger"
                        onPress={() => handleDelete(s.id)}
                      >
                        <DeleteIcon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Modal för skapande av ny status */}
      <Modal
        isOpen={createModalOpen}
        onOpenChange={setCreateModalOpen}
        scrollBehavior="inside"
        backdrop="opaque"
        size="md"
      >
        <ModalContent>
          <ModalHeader>
            <h2 className="text-xl font-semibold">Skapa ny status</h2>
          </ModalHeader>
          <ModalBody>
            <Form
              onSubmit={handleSubmit}
              onReset={handleReset}
              validationBehavior="native"
              validationErrors={validationErrors}
              className="space-y-6"
            >
              <div>
                <Input
                  id="statusName"
                  name="statusName"
                  label="Namn på status"
                  labelPlacement="outside"
                  value={statusName}
                  onValueChange={(value) => setStatusName(value)}
                  placeholder="Ange statusens namn"
                  isRequired
                  className="w-full"
                />
              </div>
              
              <div>
                <label htmlFor="mailTemplate" className="block text-sm font-medium mb-2">
                  Välj mailmall
                </label>
                <select
                  id="mailTemplate"
                  name="mailTemplate"
                  value={selectedMailTemplate}
                  onChange={(e) => setSelectedMailTemplate(e.target.value)}
                  className="w-full rounded-md border border-default-200 bg-background p-2"
                >
                  <option value="">Ingen mall vald</option>
                  {mailTemplates.map((mt) => (
                    <option key={mt.id} value={mt.id}>
                      {mt.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="statusColor" className="block text-sm font-medium mb-2">
                  Välj färg
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="statusColor"
                    name="statusColor"
                    type="color"
                    value={statusColor}
                    onChange={(e) => setStatusColor(e.target.value)}
                    className="border border-default-200 rounded p-1 h-10 w-16"
                  />
                  <div className="w-8 h-8 rounded-full border border-default-200" style={{ backgroundColor: statusColor }} />
                  <span className="ml-2 text-sm text-default-600">{statusColor}</span>
                </div>
              </div>
            </Form>
          </ModalBody>
          <ModalFooter>
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
            <Button 
              type="submit" 
              color="primary"
              onPress={(e) => {
                // Simulera ett form submit genom att hitta och klicka på submit-knappen
                const form = document.querySelector('form');
                if (form) {
                  const submitEvent = new Event('submit', { cancelable: true, bubbles: true });
                  form.dispatchEvent(submitEvent);
                }
              }}
            >
              Skapa status
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal för redigering av status */}
      <Modal
        isOpen={!!editingStatus}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditingStatus(null);
        }}
        scrollBehavior="inside"
        backdrop="opaque"
        size="md"
      >
        <ModalContent>
          <ModalHeader>
            <h2 className="text-xl font-semibold">Redigera status</h2>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-6">
              <div>
                <Input
                  id="editStatusName"
                  name="editStatusName"
                  label="Namn på status"
                  labelPlacement="outside"
                  value={editName}
                  onValueChange={(value) => setEditName(value)}
                  placeholder="Ange statusens namn"
                  isRequired
                  className="w-full"
                />
              </div>
              
              <div>
                <label htmlFor="editMailTemplate" className="block text-sm font-medium mb-2">
                  Välj mailmall
                </label>
                <select
                  id="editMailTemplate"
                  name="editMailTemplate"
                  value={editSelectedMailTemplate}
                  onChange={(e) => setEditSelectedMailTemplate(e.target.value)}
                  className="w-full rounded-md border border-default-200 bg-background p-2"
                >
                  <option value="">Ingen mall vald</option>
                  {mailTemplates.map((mt) => (
                    <option key={mt.id} value={mt.id}>
                      {mt.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="editStatusColor" className="block text-sm font-medium mb-2">
                  Välj färg
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="editStatusColor"
                    name="editStatusColor"
                    type="color"
                    value={editStatusColor}
                    onChange={(e) => setEditStatusColor(e.target.value)}
                    className="border border-default-200 rounded p-1 h-10 w-16"
                  />
                  <div className="w-8 h-8 rounded-full border border-default-200" style={{ backgroundColor: editStatusColor }} />
                  <span className="ml-2 text-sm text-default-600">{editStatusColor}</span>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button 
              type="button" 
              variant="flat" 
              onPress={() => setEditingStatus(null)}
            >
              Avbryt
            </Button>
            <Button 
              type="button" 
              color="primary"
              onPress={handleEditSubmit}
            >
              Spara ändringar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </section>
  );
}