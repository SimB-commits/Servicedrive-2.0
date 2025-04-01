// pages/arendestatusar/index.tsx
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  Form,
  Button,
  Table,
  TableHeader,
  TableRow,
  TableBody,
  TableCell,
  TableColumn,
  Card,
  CardBody,
  CardHeader,
  Tabs,
  Tab,
  Spinner,
  Chip,
  Badge
} from '@heroui/react';
import { title, subtitle } from '@/components/primitives';
import { DeleteIcon, EditIcon, ArrowRightIcon } from '@/components/icons';
import StatusModal from '@/components/StatusModal';
import PlanLimitNotice from '@/components/subscription/PlanLimitNotice';
import useSubscription from '@/hooks/useSubscription';

// Importera centraliserad statushantering
import ticketStatusService, { 
  TicketStatus, 
  SystemStatus, 
  CustomStatus, 
  SYSTEM_STATUSES 
} from '@/utils/ticketStatusService';

export default function Arendestatusar() {
  const { data: session, status } = useSession();
  const [customStatuses, setCustomStatuses] = useState<CustomStatus[]>([]);
  const [systemStatuses, setSystemStatuses] = useState<SystemStatus[]>([]);
  const [editingStatus, setEditingStatus] = useState<TicketStatus | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [mailTemplates, setMailTemplates] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('custom');
  const [loading, setLoading] = useState(true);

  // Hämta prenumerationsinformation
  const { plan, canCreate, features, limits, planName } = useSubscription();
  const canUseCustomStatuses = features.customStatuses;

  // Hämta alla statusar vid sidladdning
  useEffect(() => {
    async function fetchStatuses() {
      try {
        setLoading(true);
        
        // Använd vår centraliserade service för att hämta statusar
        const allStatuses = await ticketStatusService.getAllStatuses(true);
        
        // Separera systemstatusar och anpassade statusar
        const sysStatuses = allStatuses.filter((s): s is SystemStatus => 
          'isSystemStatus' in s && s.isSystemStatus === true
        );
        
        const custStatuses = allStatuses.filter((s): s is CustomStatus => 
          !('isSystemStatus' in s) || s.isSystemStatus !== true
        );
        
        setSystemStatuses(sysStatuses);
        setCustomStatuses(custStatuses);
      } catch (error) {
        console.error('Fel vid hämtning av statusar:', error);
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
        if (res.ok) {
          const data = await res.json();
          setMailTemplates(data);
        }
      } catch (error) {
        console.error('Fel vid hämtning av mailmallar:', error);
      }
    }
    fetchMailTemplates();
  }, []);

  if (status === 'loading') return <p>Laddar session...</p>;
  if (!session) return <p>Ingen session – vänligen logga in.</p>;

  // Hantera borttagning av status med vår nya centraliserade service
  const handleDelete = async (id: number) => {
    const success = await ticketStatusService.deleteStatus(id);
    if (success) {
      setCustomStatuses(prev => prev.filter(s => s.id !== id));
    }
  };

  // Öppna redigeringsmodal för en status
  const handleEdit = (status: TicketStatus) => {
    setEditingStatus(status);
  };

  // Hantera uppdatering av systemstatusar
  const handleEditSystemStatus = async (systemStatus: SystemStatus, templateId: number | null) => {
    // Eftersom systemstatusar redan har isSystemStatus = true, kan vi bara uppdatera mailTemplateId
    // MEN vi måste inkludera alla obligatoriska fält för att tillfredsställa API-valideringen
    const statusData = {
      mailTemplateId: templateId,
      // Inkludera dessa fält som krävs av API-valideringen
      name: systemStatus.name,
      color: systemStatus.color
    };
    
    // Anropa vår centraliserade service för att spara statusen
    const updatedStatus = await ticketStatusService.saveStatus(statusData, 
      // Om systemStatus har ett id, använd det (annars är det null)
      'id' in systemStatus ? systemStatus.id : undefined
    );
    
    if (updatedStatus) {
      // Uppdatera systemStatuses med den uppdaterade statusen
      setSystemStatuses(prev => {
        return prev.map(s => {
          if (s.systemName === systemStatus.systemName) {
            // Behåll systemStatus-specifika egenskaper men uppdatera mailTemplateId
            return {
              ...s,
              mailTemplateId: updatedStatus.mailTemplateId
            };
          }
          return s;
        });
      });
    }
  };

  // Hantera uppdatering av anpassad status
  const handleUpdateStatus = async (statusData: any) => {
    if (!editingStatus) return;
    
    // Om det är en systemstatus, uppdatera endast mailTemplateId
    if ('isSystemStatus' in editingStatus && editingStatus.isSystemStatus) {
      await handleEditSystemStatus(editingStatus as SystemStatus, statusData.mailTemplateId);
      setEditingStatus(null);
      return;
    }
    
    // För anpassade statusar, använd vår service för uppdatering
    const updatedStatus = await ticketStatusService.saveStatus(
      statusData, 
      'id' in editingStatus ? editingStatus.id : undefined
    );
    
    if (updatedStatus) {
      // Uppdatera listan med statusar
      setCustomStatuses(prev => prev.map(s => s.id === updatedStatus.id ? updatedStatus : s));
      setEditingStatus(null);
    }
  };

  // Hantera skapande av ny status
  const handleCreateStatus = async (statusData: any) => {
    const newStatus = await ticketStatusService.saveStatus(statusData);
    
    if (newStatus) {
      setCustomStatuses(prev => [...prev, newStatus]);
      setCreateModalOpen(false);
    }
  };

  // Renderar info om planbegränsningar för anpassade statusar
  const renderCustomStatusLimits = () => {
    if (!canUseCustomStatuses) {
      return (
        <div className="mt-4 mb-6">
          <PlanLimitNotice 
            resourceType="customStatus" 
            showUpgradeButton={true}
          />
        </div>
      );
    }

    // Om användaren kan använda anpassade statusar, visa bara en notering om begränsningarna
    const statusLimit = limits.customStatuses === Number.POSITIVE_INFINITY ? 
      'Obegränsat' : limits.customStatuses;
    
    return (
      <div className="flex justify-between items-center mt-2 mb-4">
        <Chip color="primary" variant="flat">
          Din plan: {planName}
        </Chip>
        <Chip color="default" variant="flat">
          Gräns för anpassade statusar: {customStatuses.length} / {statusLimit}
        </Chip>
      </div>
    );
  };

  // Renderar info om planbegränsningar för grundläggande statusar
  const renderSystemStatusInfo = () => {
    return (
      <div className="mt-2 mb-4">
        <div className="flex flex-col sm:flex-row justify-between gap-2">
          <Chip color="primary" variant="flat">
            Din plan: {planName}
          </Chip>
          <div className="text-sm text-default-600">
            Grundläggande statusar ingår i alla planer
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="inline-block max-w-lg text-center">
        <h1 className={title({ size: 'sm' })}>Ärendestatusar</h1>
        <p className={subtitle()}>Skapa och hantera statusar för dina ärenden</p>
        {canUseCustomStatuses && (
          <Button 
            type="button" 
            onPress={() => setCreateModalOpen(true)} 
            color="primary"
            variant="flat"
            className="mt-4"
            isDisabled={!canCreate('customStatus')}
          >
            Skapa ny status
          </Button>
        )}
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
                {renderSystemStatusInfo()}
              </CardHeader>
              <CardBody>
                {loading ? (
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
                                onPress={() => handleEdit(s)}
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
                  {customStatuses.length}
                </span>
                {!canUseCustomStatuses && (
                  <Badge color="warning" variant="flat" size="sm">
                    Premium
                  </Badge>
                )}
              </div>
            }
          >
            <Card className="mt-4">
              <CardHeader className="flex flex-col">
                <div className="flex justify-between items-center w-full">
                  <h2 className="text-lg font-semibold">Anpassade statusar</h2>
                  {canUseCustomStatuses && canCreate('customStatus') && (
                    <Button 
                      type="button" 
                      onPress={() => setCreateModalOpen(true)} 
                      color="primary"
                      size="sm"
                    >
                      Skapa ny status
                    </Button>
                  )}
                </div>
                <p className="text-sm text-default-500">
                  Skapa egna statusar för att anpassa ärendehanteringen efter dina behov.
                </p>
                {renderCustomStatusLimits()}
              </CardHeader>
              <CardBody>
                {loading ? (
                  <div className="flex justify-center items-center py-8">
                    <Spinner size="md" />
                    <span className="ml-3 text-default-600">Laddar anpassade statusar...</span>
                  </div>
                ) : (
                  <div>
                    {!canUseCustomStatuses ? (
                      <div className="py-8 text-center">
                        <p className="text-default-500 mb-4">
                          Anpassade statusar är endast tillgängliga i betalda planer.
                        </p>
                        <Button 
                          as="a"
                          href="/installningar?tab=subscription&upgrade=true"
                          color="primary"
                          endContent={<ArrowRightIcon size={16} />}
                        >
                          Uppgradera din plan
                        </Button>
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
                          {customStatuses.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell>{s.name}</TableCell>
                              <TableCell>
                                <div
                                  className="w-6 h-6 rounded-full border border-default-200"
                                  style={{ backgroundColor: s.color }}
                                />
                              </TableCell>
                              <TableCell>
                                {s.mailTemplateId ? (
                                  <div>{mailTemplates.find(mt => mt.id === s.mailTemplateId)?.name || 'Okänd mall'}</div>
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
                    {customStatuses.length > 0 && !canCreate('customStatus') && (
                      <div className="mt-4">
                        <PlanLimitNotice 
                          resourceType="customStatus" 
                          showUpgradeButton={true}
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>
          </Tab>
        </Tabs>
      </div>

      {/* StatusModal för att skapa/redigera statusar */}
      <StatusModal
        isOpen={createModalOpen || !!editingStatus}
        onClose={() => {
          setCreateModalOpen(false);
          setEditingStatus(null);
        }}
        onSave={(statusData) => {
          if (editingStatus) {
            handleUpdateStatus(statusData);
          } else {
            handleCreateStatus(statusData);
          }
        }}
        editingStatus={editingStatus}
        mailTemplates={mailTemplates}
      />
    </section>
  );
}