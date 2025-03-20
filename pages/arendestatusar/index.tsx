// pages/arendestatusar/index.tsx
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
  Divider,
  Tabs,
  Tab,
  Spinner
} from '@heroui/react';
import { title, subtitle } from '@/components/primitives';
import { DeleteIcon, EditIcon } from '@/components/icons';
import StatusModal from '@/components/StatusModal';
import StatusMailTemplateIntegration from '@/components/email/StatusMailTemplateIntegration';

// Definiera de grundläggande statusarna
const BASIC_STATUSES = [
  { id: 'OPEN', name: 'Öppen', color: '#22c55e', systemName: 'OPEN' },
  { id: 'IN_PROGRESS', name: 'Pågående', color: '#3b82f6', systemName: 'IN_PROGRESS' },
  { id: 'RESOLVED', name: 'Löst', color: '#6366f1', systemName: 'RESOLVED' },
  { id: 'CLOSED', name: 'Stängd', color: '#64748b', systemName: 'CLOSED' }
];

export default function Arendestatusar() {
  const { data: session, status } = useSession();
  const [statusName, setStatusName] = useState('');
  const [selectedMailTemplate, setSelectedMailTemplate] = useState('');
  const [statusColor, setStatusColor] = useState('#ffffff'); // Defaultfärg
  const [validationErrors, setValidationErrors] = useState({});
  const [statuses, setStatuses] = useState<any[]>([]);
  const [systemStatuses, setSystemStatuses] = useState<any[]>([]);
  const [editingStatus, setEditingStatus] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editSelectedMailTemplate, setEditSelectedMailTemplate] = useState('');
  const [editStatusColor, setEditStatusColor] = useState('#ffffff');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [mailTemplates, setMailTemplates] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('custom');
  const [loading, setLoading] = useState(true);
  const [systemStatusesLoading, setSystemStatusesLoading] = useState(true);

  // Hämta alla statusar vid sidladdning
  useEffect(() => {
    async function fetchStatuses() {
      try {
        setLoading(true);
        const res = await fetch('/api/tickets/statuses', { method: 'GET' });
        const data = await res.json();
        if (res.ok) {
          // Filtrera bort eventuella grundläggande statusar från vanliga statusar
          const customStatuses = data.filter(status => 
            !BASIC_STATUSES.some(bs => bs.name.toLowerCase() === status.name.toLowerCase())
          );
          setStatuses(customStatuses);
          
          // Kontrollera om vi har UserTicketStatus-poster för grundläggande statusar
          const foundSystemStatuses = [];
          
          for (const basicStatus of BASIC_STATUSES) {
            const existingStatus = data.find(status => 
              status.name.toLowerCase() === basicStatus.name.toLowerCase()
            );
            
            if (existingStatus) {
              foundSystemStatuses.push({
                ...existingStatus,
                isSystemStatus: true,
                systemName: basicStatus.systemName
              });
            } else {
              // Om det inte finns en UserTicketStatus för denna grundläggande status,
              // skapar vi ett objektrepresentation för UI
              foundSystemStatuses.push({
                id: null,
                name: basicStatus.name,
                color: basicStatus.color,
                isSystemStatus: true,
                systemName: basicStatus.systemName,
                mailTemplateId: null
              });
            }
          }
          
          setSystemStatuses(foundSystemStatuses);
          setSystemStatusesLoading(false);
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
      } finally {
        setLoading(false);
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

  const handleEditSystemStatus = async (systemStatus: any, templateId: number | null) => {
    try {
      // Om det är en befintlig status, uppdatera den
      if (systemStatus.id) {
        const res = await fetch(`/api/tickets/statuses/${systemStatus.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mailTemplateId: templateId
          })
        });

        if (res.ok) {
          const updatedStatus = await res.json();
          addToast({
            title: 'Mailmall uppdaterad',
            description: `Mailmallen för ${systemStatus.name} har uppdaterats.`,
            color: 'success',
            variant: 'flat'
          });
          
          // Uppdatera systemStatuses
          setSystemStatuses(prev => 
            prev.map(s => s.id === updatedStatus.id ? {
              ...updatedStatus,
              isSystemStatus: true,
              systemName: systemStatus.systemName
            } : s)
          );
        } else {
          throw new Error('Kunde inte uppdatera statusen');
        }
      } 
      // Om det inte är en befintlig status, skapa en ny för denna grundläggande status
      else {
        const res = await fetch('/api/tickets/statuses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: systemStatus.name,
            color: systemStatus.color,
            mailTemplateId: templateId
          })
        });

        if (res.ok) {
          const newStatus = await res.json();
          addToast({
            title: 'Mailmall kopplad',
            description: `Mailmallen har kopplats till ${systemStatus.name}.`,
            color: 'success',
            variant: 'flat'
          });
          
          // Uppdatera systemStatuses
          setSystemStatuses(prev => 
            prev.map(s => s.systemName === systemStatus.systemName ? {
              ...newStatus,
              isSystemStatus: true,
              systemName: systemStatus.systemName
            } : s)
          );
        } else {
          throw new Error('Kunde inte skapa statusen');
        }
      }
    } catch (error) {
      console.error('Fel vid hantering av systemstatus:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid hantering av systemstatusen.',
        color: 'danger',
        variant: 'flat'
      });
    }
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

  const handleSelectMailTemplate = (systemStatus: any) => {
    // Öppna modal för att redigera status, men anpassa för systemstatus
    setEditingStatus({
      ...systemStatus,
      isSystemStatus: true
    });
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

      {/* Statusflikar för att skilja mellan grundläggande och anpassade statusar */}
      <div className="w-full max-w-6xl mt-6">
        <Tabs 
          selectedKey={activeTab}
          onSelectionChange={key => setActiveTab(key as string)}
          aria-label="Statustyper"
          color="primary"
        >
          <Tab 
            key="system" 
            title={
              <div className="flex items-center gap-2">
                <span>Grundläggande statusar</span>
                <span className="bg-default-100 text-default-800 text-xs px-2 py-1 rounded-full">
                  {systemStatuses.length}
                </span>
              </div>
            }
          >
            <Card className="mt-4">
              <CardHeader className="flex flex-col">
                <h2 className="text-lg font-semibold">Grundläggande statusar</h2>
                <p className="text-sm text-default-500">
                  Dessa statusar är inbyggda i systemet och kan inte tas bort. Du kan däremot koppla mailmallar till dem.
                </p>
              </CardHeader>
              <CardBody>
                {systemStatusesLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <Spinner size="md" />
                    <span className="ml-3 text-default-600">Laddar grundläggande statusar...</span>
                  </div>
                ) : (
                  <Table 
                    aria-label="Grundläggande Statusar"
                    removeWrapper
                    selectionMode="none"
                  >
                    <TableHeader>
                      <TableColumn>Status</TableColumn>
                      <TableColumn>Färg</TableColumn>
                      <TableColumn>Mailmall</TableColumn>
                      <TableColumn>Åtgärder</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="Inga grundläggande statusar hittades.">
                      {systemStatuses.map((s) => (
                        <TableRow key={s.systemName}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{s.name}</span>
                              <span className="bg-primary-100 text-primary-700 text-xs px-2 py-1 rounded-full">
                                Grundläggande
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div
                              className="w-6 h-6 rounded-full border border-default-200"
                              style={{ backgroundColor: s.color }}
                            />
                          </TableCell>
                          <TableCell>
                            {s.mailTemplateId ? (
                              <div className="flex items-center">
                                {mailTemplates.find(mt => mt.id === s.mailTemplateId)?.name || 'Okänd mall'}
                              </div>
                            ) : (
                              <span className="text-default-400">Ingen mall kopplad</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button 
                                type="button" 
                                variant="flat"
                                color="primary"
                                size="sm"
                                onPress={() => handleSelectMailTemplate(s)}
                              >
                                Koppla mailmall
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardBody>
            </Card>
          </Tab>
          
          <Tab 
            key="custom" 
            title={
              <div className="flex items-center gap-2">
                <span>Anpassade statusar</span>
                <span className="bg-default-100 text-default-800 text-xs px-2 py-1 rounded-full">
                  {statuses.length}
                </span>
              </div>
            }
          >
            <Card className="mt-4">
              <CardHeader className="flex flex-col">
                <div className="flex justify-between items-center w-full">
                  <h2 className="text-lg font-semibold">Anpassade statusar</h2>
                  <Button 
                    type="button" 
                    onPress={() => setCreateModalOpen(true)} 
                    color="primary"
                    size="sm"
                  >
                    Skapa ny status
                  </Button>
                </div>
                <p className="text-sm text-default-500">
                  Skapa egna statusar för att anpassa ärendehanteringen efter dina behov.
                </p>
              </CardHeader>
              <CardBody>
                {loading ? (
                  <div className="flex justify-center items-center py-8">
                    <Spinner size="md" />
                    <span className="ml-3 text-default-600">Laddar anpassade statusar...</span>
                  </div>
                ) : (
                  <Table 
                    aria-label="Anpassade Statusar"
                    removeWrapper
                    selectionMode="none"
                  >
                    <TableHeader>
                      <TableColumn>Status</TableColumn>
                      <TableColumn>Färg</TableColumn>
                      <TableColumn>Mailmall</TableColumn>
                      <TableColumn>Åtgärder</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="Inga anpassade statusar har skapats än.">
                      {statuses.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>{s.name}</TableCell>
                          <TableCell>
                            <div
                              className="w-6 h-6 rounded-full border border-default-200"
                              style={{ backgroundColor: s.color }}
                            />
                          </TableCell>
                          <TableCell>
                            {s.mailTemplate ? (
                              <div>{s.mailTemplate.name}</div>
                            ) : (
                              <span className="text-default-400">Ingen mall kopplad</span>
                            )}
                          </TableCell>
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
                )}
              </CardBody>
            </Card>
          </Tab>
        </Tabs>
      </div>

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
      <StatusModal
        isOpen={!!editingStatus}
        onClose={() => setEditingStatus(null)}
        onSave={(statusData) => {
          if (editingStatus?.isSystemStatus) {
            // För systemstatusar, tillåt endast ändring av mailmall
            handleEditSystemStatus(editingStatus, statusData.mailTemplateId);
          } else {
            // För vanliga statusar, tillåt fullständig redigering
            handleEditSubmit();
          }
        }}
        editingStatus={editingStatus}
        mailTemplates={mailTemplates}
      />
    </section>
  );
}