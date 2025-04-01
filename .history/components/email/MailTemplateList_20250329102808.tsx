import React, { useState, useEffect } from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Spinner,
  Badge,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Input,
  addToast,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter
} from '@heroui/react';

import { DeleteIcon, EditIcon, ChevronDownIcon, SearchIcon } from '@/components/icons';
import MailTemplateTest from '@/components/email/MailTemplateTest';
import MailTemplateForm from './MailTemplateForm';

interface MailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
}

interface TemplateListProps {
  refreshTrigger?: number;
  onTemplateChanged?: () => void;
}

const EnhancedTemplateList: React.FC<TemplateListProps> = ({ 
  refreshTrigger = 0, 
  onTemplateChanged 
}) => {
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<MailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MailTemplate | null>(null);
  const [activeUsages, setActiveUsages] = useState<Record<number, string[]>>({});

  // Hämta mallar när komponenten laddas eller när refreshTrigger ändras
  useEffect(() => {
    fetchTemplates();
  }, [refreshTrigger]);

  // Filtrera mallar baserat på sökfrågan
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTemplates(templates);
      return;
    }
    
    const query = searchQuery.toLowerCase().trim();
    const filtered = templates.filter(template => 
      template.name.toLowerCase().includes(query) || 
      template.subject.toLowerCase().includes(query)
    );
    
    setFilteredTemplates(filtered);
  }, [searchQuery, templates]);

  // Hämta mallarna från API
  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/mail/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
        setFilteredTemplates(data);
        
        // Hämta information om mallars användning (statusar, inställningar)
        fetchTemplateUsages(data);
      } else {
        const error = await res.json();
        console.error('Kunde inte hämta mailmallar:', error);
        addToast({
          title: 'Fel',
          description: error.message || 'Kunde inte hämta mailmallar',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid hämtning av mailmallar:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid hämtning av mailmallar',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setLoading(false);
    }
  };

  // Hämta information om mallars användning (var de används)
  const fetchTemplateUsages = async (templates: MailTemplate[]) => {
    try {
      // Hämta inställningar där mallar används
      const settingsRes = await fetch('/api/mail/template-settings');
      if (!settingsRes.ok) return;
      
      const settingsData = await settingsRes.json();
      
      // Hämta statusar där mallar används
      const statusesRes = await fetch('/api/tickets/statuses');
      if (!statusesRes.ok) return;
      
      const statusesData = await statusesRes.json();
      
      // Skapa en mappning mellan template ID och användningsområden
      const usages: Record<number, string[]> = {};
      
      // Analysera inställningar
      Object.entries(settingsData).forEach(([key, value]: [string, any]) => {
        if (value?.templateId) {
          if (!usages[value.templateId]) {
            usages[value.templateId] = [];
          }
          
          // Översätt användningsområden till mer användarvänliga namn
          const usageName = 
            key === 'NEW_TICKET' ? 'Nya ärenden' :
            key === 'FOLLOW_UP' ? 'Uppföljning' :
            key === 'REMINDER' ? 'Påminnelse' :
            key === 'MANUAL' ? 'Manuella utskick' :
            key === 'STATUS_UPDATE' ? 'Statusuppdatering' : 
            key;
          
          usages[value.templateId].push(usageName);
        }
      });
      
      // Analysera statusar
      statusesData.forEach((status: any) => {
        if (status?.mailTemplateId) {
          if (!usages[status.mailTemplateId]) {
            usages[status.mailTemplateId] = [];
          }
          
          usages[status.mailTemplateId].push(`Status: ${status.name}`);
        }
      });
      
      setActiveUsages(usages);
    } catch (error) {
      console.error('Fel vid hämtning av mallanvändning:', error);
    }
  };

  // Redigera en mall
  const handleEditTemplate = (template: MailTemplate) => {
    setSelectedTemplate(template);
    setEditModalOpen(true);
  };

  // Öppna bekräftelsedialog för borttagning
  const handleDeleteConfirm = (template: MailTemplate) => {
    setSelectedTemplate(template);
    setDeleteModalOpen(true);
  };

  // Ta bort en mall
  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      const response = await fetch(`/api/mail/templates/${selectedTemplate.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        addToast({
          title: 'Framgång',
          description: 'Mailmallen togs bort',
          color: 'success',
          variant: 'flat'
        });
        
        // Uppdatera listan, ta bort mallen från templates-array
        setTemplates(templates.filter(t => t.id !== selectedTemplate.id));
        setFilteredTemplates(filteredTemplates.filter(t => t.id !== selectedTemplate.id));
        
        // Meddela parent-komponenten om förändring
        if (onTemplateChanged) {
          onTemplateChanged();
        }
        
        // Stäng modalen
        setDeleteModalOpen(false);
        setSelectedTemplate(null);
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Kunde inte ta bort mailmall');
      }
    } catch (error) {
      console.error('Fel vid borttagning av mailmall:', error);
      addToast({
        title: 'Fel',
        description: error.message || 'Ett fel inträffade vid borttagning av mailmallen',
        color: 'danger',
        variant: 'flat'
      });
    }
  };

  // Spara eller uppdatera en mall
  const handleSaveTemplate = async (templateData: Partial<MailTemplate>) => {
    try {
      const isEditing = !!selectedTemplate?.id;
      const url = isEditing ? `/api/mail/templates/${selectedTemplate.id}` : '/api/mail/templates';
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
      });
      
      if (response.ok) {
        const savedTemplate = await response.json();
        
        if (isEditing) {
          // Uppdatera befintlig mall i listan
          setTemplates(
            templates.map(t => t.id === savedTemplate.id ? savedTemplate : t)
          );
        } else {
          // Lägg till ny mall i listan
          setTemplates([...templates, savedTemplate]);
        }
        
        // Stäng modalen och återställ state
        setCreateModalOpen(false);
        setEditModalOpen(false);
        setSelectedTemplate(null);
        
        // Meddela parent-komponenten om förändring
        if (onTemplateChanged) {
          onTemplateChanged();
        }
        
        return true;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Kunde inte spara mailmallen');
      }
    } catch (error) {
      console.error('Fel vid sparande av mailmall:', error);
      addToast({
        title: 'Fel',
        description: error.message || 'Ett fel inträffade vid sparande av mailmallen',
        color: 'danger',
        variant: 'flat'
      });
      throw error;
    }
  };

  // Formatera datum för visning
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric'
    });
  };

  // Skapa en kopia av en befintlig mall
  const handleDuplicateTemplate = async (template: MailTemplate) => {
    try {
      const duplicateData = {
        name: `${template.name} (kopia)`,
        subject: template.subject,
        body: template.body
      };
      
      const response = await fetch('/api/mail/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(duplicateData)
      });
      
      if (response.ok) {
        const newTemplate = await response.json();
        
        addToast({
          title: 'Framgång',
          description: 'Mailmallen kopierades',
          color: 'success',
          variant: 'flat'
        });
        
        // Lägg till den nya mallen i listan
        setTemplates([...templates, newTemplate]);
        
        // Meddela parent-komponenten om förändring
        if (onTemplateChanged) {
          onTemplateChanged();
        }
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Kunde inte kopiera mailmallen');
      }
    } catch (error) {
      console.error('Fel vid kopiering av mailmall:', error);
      addToast({
        title: 'Fel',
        description: error.message || 'Ett fel inträffade vid kopiering av mailmallen',
        color: 'danger',
        variant: 'flat'
      });
    }
  };

  // Få användningsbadge som visar mallens användningsområden
  const getUsageBadges = (templateId: number) => {
    const usages = activeUsages[templateId] || [];
    
    // Om det är för många användningar, visa bara ett urval
    if (usages.length > 2) {
      return (
        <div className="flex flex-wrap gap-1">
          <Badge color="primary" variant="flat" size="sm">{usages[0]}</Badge>
          <Badge color="primary" variant="flat" size="sm">+{usages.length - 1} till</Badge>
        </div>
      );
    }
    
    return (
      <div className="flex flex-wrap gap-1">
        {usages.map((usage, i) => (
          <Badge key={i} color="primary" variant="flat" size="sm">{usage}</Badge>
        ))}
        {usages.length === 0 && (
          <span className="text-xs text-default-400">Ej tilldelad</span>
        )}
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Dina mailmallar</h2>
          
          <div className="flex gap-2">
            <div className="relative">
              <Input
                placeholder="Sök mallar..."
                value={searchQuery}
                onValueChange={setSearchQuery}
                startContent={<SearchIcon className="text-default-400" />}
                size="sm"
                className="w-64"
              />
            </div>
            
            <Button 
              type="button" 
              onPress={() => setCreateModalOpen(true)} 
              color="primary"
            >
              Skapa ny mailmall
            </Button>
          </div>
        </CardHeader>
        
        <CardBody>
          {loading ? (
            <div className="flex justify-center items-center py-6">
              <Spinner size="md" />
              <p className="ml-3">Laddar mailmallar...</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            searchQuery ? (
              <div className="text-center p-6 border rounded-md bg-default-50">
                <p className="text-default-600 mb-4">
                  Inga mailmallar matchade din sökning "{searchQuery}".
                </p>
                <Button 
                  variant="flat" 
                  onPress={() => setSearchQuery('')}
                >
                  Visa alla mallar
                </Button>
              </div>
            ) : (
              <div className="text-center p-6 border rounded-md bg-default-50">
                <p className="text-default-600 mb-4">
                  Inga mailmallar skapade ännu. Klicka på "Skapa ny mailmall" för att komma igång.
                </p>
                <Button 
                  color="primary" 
                  onPress={() => setCreateModalOpen(true)}
                >
                  Skapa ny mailmall
                </Button>
              </div>
            )
          ) : (
            <Table aria-label="Mail templates">
              <TableHeader>
                <TableColumn>Namn</TableColumn>
                <TableColumn>Ämne</TableColumn>
                <TableColumn>Användning</TableColumn>
                <TableColumn>Skapad</TableColumn>
                <TableColumn>Åtgärder</TableColumn>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map(template => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="font-medium">{template.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="truncate max-w-xs">{template.subject}</div>
                    </TableCell>
                    <TableCell>
                      {getUsageBadges(template.id)}
                    </TableCell>
                    <TableCell>{formatDate(template.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MailTemplateTest templateId={template.id} />
                        <Button 
                          type="button" 
                          variant="flat" 
                          isIconOnly
                          onPress={() => handleEditTemplate(template)}
                        >
                          <EditIcon />
                        </Button>
                        
                        <Dropdown>
                          <DropdownTrigger>
                            <Button 
                              type="button" 
                              variant="flat" 
                              isIconOnly
                            >
                              <ChevronDownIcon />
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu aria-label="Template actions">
                            <DropdownItem 
                              key="duplicate"
                              onPress={() => handleDuplicateTemplate(template)}
                            >
                              Duplicera
                            </DropdownItem>
                            <DropdownItem 
                              key="delete" 
                              className="text-danger"
                              color="danger"
                              onPress={() => handleDeleteConfirm(template)}
                            >
                              Ta bort
                            </DropdownItem>
                          </DropdownMenu>
                        </Dropdown>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Modal för att skapa ny mall */}
      <Modal
        isOpen={createModalOpen}
        onOpenChange={setCreateModalOpen}
        scrollBehavior="inside"
        size="3xl"
      >
        <ModalContent>
          <ModalHeader>
            <h2 className="text-xl font-bold">Skapa ny mailmall</h2>
          </ModalHeader>
          <ModalBody>
            <MailTemplateForm
              onSave={handleSaveTemplate}
              onCancel={() => setCreateModalOpen(false)}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
      
      {/* Modal för att redigera mall */}
      <Modal
        isOpen={editModalOpen}
        onOpenChange={setEditModalOpen}
        scrollBehavior="inside"
        size="3xl"
      >
        <ModalContent>
          <ModalHeader>
            <h2 className="text-xl font-bold">Redigera mailmall</h2>
          </ModalHeader>
          <ModalBody>
            {selectedTemplate && (
              <MailTemplateForm
                initialTemplate={selectedTemplate}
                onSave={handleSaveTemplate}
                onCancel={() => {
                  setEditModalOpen(false);
                  setSelectedTemplate(null);
                }}
                title="Redigera mailmall"
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
      
      {/* Bekräftelsedialog för borttagning */}
      <Modal
        isOpen={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        size="sm"
      >
        <ModalContent>
          <ModalHeader>
            <h3 className="text-lg font-semibold">Bekräfta borttagning</h3>
          </ModalHeader>
          <ModalBody>
            {selectedTemplate && (
              <>
                <p>Är du säker på att du vill ta bort mailmallen "{selectedTemplate.name}"?</p>
                
                {activeUsages[selectedTemplate.id]?.length > 0 && (
                  <div className="mt-2 bg-warning-50 border border-warning-200 p-3 rounded text-sm">
                    <p className="font-medium text-warning-700">Varning: Denna mall används för:</p>
                    <ul className="list-disc list-inside mt-1 text-warning-700">
                      {activeUsages[selectedTemplate.id].map((usage, i) => (
                        <li key={i}>{usage}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-warning-700">
                      Om du tar bort mallen kommer dessa inställningar att sluta fungera.
                    </p>
                  </div>
                )}
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button 
              variant="flat" 
              onPress={() => setDeleteModalOpen(false)}
            >
              Avbryt
            </Button>
            <Button 
              color="danger" 
              onPress={handleDeleteTemplate}
            >
              Ta bort
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default EnhancedTemplateList;