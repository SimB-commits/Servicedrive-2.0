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
  Textarea
} from '@heroui/react';
import { title } from '@/components/primitives';
import { DeleteIcon, EditIcon } from '@/components/icons';
import MailTemplateTest from '@/components/MailTemplateTest';
import TemplateSettings from '@/components/email/TemplateSettings';

interface MailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
}

export default function MailmallsPage() {
  const { data: session, status } = useSession();
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MailTemplate | null>(null);

  // Form values
  const [templateName, setTemplateName] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Edit form values
  const [editName, setEditName] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');

  // Fetch mail templates on component mount
  useEffect(() => {
    if (status !== 'loading' && session) {
      fetchTemplates();
    } else if (status !== 'loading') {
      setLoading(false);
    }
  }, [session, status]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/mail/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      } else {
        const error = await response.json();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});

    // Validate form
    const errors: Record<string, string> = {};
    if (!templateName.trim()) {
      errors.templateName = 'Mall-namn är obligatoriskt';
    }
    if (!templateSubject.trim()) {
      errors.templateSubject = 'Ämne är obligatoriskt';
    }
    if (!templateBody.trim()) {
      errors.templateBody = 'Innehåll är obligatoriskt';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Prepare the data for the API
    const payload = {
      name: templateName,
      subject: templateSubject,
      body: templateBody
    };

    try {
      const response = await fetch('/api/mail/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const newTemplate = await response.json();
        addToast({
          title: 'Framgång',
          description: 'Mailmall skapades',
          color: 'success',
          variant: 'flat'
        });
        setTemplates([...templates, newTemplate]);
        setCreateModalOpen(false);
        resetForm();
      } else {
        const error = await response.json();
        addToast({
          title: 'Fel',
          description: error.message || 'Kunde inte skapa mailmall',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid skapande av mailmall:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid skapande av mailmallen',
        color: 'danger',
        variant: 'flat'
      });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;

    // Similar validation as in handleSubmit
    const errors: Record<string, string> = {};
    if (!editName.trim()) {
      errors.editName = 'Mall-namn är obligatoriskt';
    }
    if (!editSubject.trim()) {
      errors.editSubject = 'Ämne är obligatoriskt';
    }
    if (!editBody.trim()) {
      errors.editBody = 'Innehåll är obligatoriskt';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Prepare data for API
    const payload = {
      name: editName,
      subject: editSubject,
      body: editBody
    };

    try {
      const response = await fetch(`/api/mail/templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const updatedTemplate = await response.json();
        addToast({
          title: 'Framgång',
          description: 'Mailmallen uppdaterades',
          color: 'success',
          variant: 'flat'
        });
        setTemplates(templates.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
        setEditModalOpen(false);
        setEditingTemplate(null);
      } else {
        const error = await response.json();
        addToast({
          title: 'Fel',
          description: error.message || 'Kunde inte uppdatera mailmall',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid uppdatering av mailmall:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid uppdatering av mailmallen',
        color: 'danger',
        variant: 'flat'
      });
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('Är du säker på att du vill ta bort denna mailmall?')) return;

    try {
      const response = await fetch(`/api/mail/templates/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        addToast({
          title: 'Framgång',
          description: 'Mailmallen togs bort',
          color: 'success',
          variant: 'flat'
        });
        setTemplates(templates.filter(t => t.id !== id));
      } else {
        const error = await response.json();
        addToast({
          title: 'Fel',
          description: error.message || 'Kunde inte ta bort mailmall',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid borttagning av mailmall:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid borttagning av mailmallen',
        color: 'danger',
        variant: 'flat'
      });
    }
  };

  const resetForm = () => {
    setTemplateName('');
    setTemplateSubject('');
    setTemplateBody('');
    setValidationErrors({});
  };

  const handleEditTemplate = (template: MailTemplate) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditSubject(template.subject);
    setEditBody(template.body);
    setEditModalOpen(true);
  };

  // Helper function to format the date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric'
    });
  };

  // Helper function to truncate text
  const truncateText = (text: string, maxLength: number) => {
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  if (loading) {
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
      <div className="inline-block max-w-lg text-center">
        <h1 className={title({ size: 'sm' })}>Mailmallar</h1>
        <p className="mb-4">Skapa och hantera mailmallar för automatiserade utskick</p>
        <div className="w-full max-w-6xl mb-8">
        <TemplateSettings onSettingsUpdated={() => fetchTemplates()} />
      </div>
        <Button 
          type="button" 
          onPress={() => setCreateModalOpen(true)} 
          color="primary"
          variant="flat"
        >
          Skapa ny mailmall
        </Button>
      </div>

      {/* Templates Table */}
      <div className="w-full max-w-6xl mt-8">
        <h2 className="text-lg font-semibold mb-4">Dina mailmallar</h2>
        {templates.length === 0 ? (
          <div className="text-center p-4 border rounded">
            Inga mailmallar skapade ännu. Klicka på "Skapa ny mailmall" för att komma igång.
          </div>
        ) : (
          <Table aria-label="Mail templates">
            <TableHeader>
              <TableColumn>Namn</TableColumn>
              <TableColumn>Ämne</TableColumn>
              <TableColumn>Innehåll</TableColumn>
              <TableColumn>Skapad</TableColumn>
              <TableColumn>Åtgärder</TableColumn>
            </TableHeader>
            <TableBody>
              {templates.map(template => (
                <TableRow key={template.id}>
                  <TableCell>{template.name}</TableCell>
                  <TableCell>{truncateText(template.subject, 30)}</TableCell>
                  <TableCell>{truncateText(template.body, 50)}</TableCell>
                  <TableCell>{formatDate(template.createdAt)}</TableCell>
                  <TableCell>
                  <div className="flex items-center gap-2">
                    <MailTemplateTest />
                    <Button 
                      type="button" 
                      variant="flat" 
                      isIconOnly
                      onPress={() => handleEditTemplate(template)}
                    >
                      <EditIcon />
                    </Button>
                    <Button 
                      type="button" 
                      variant="flat" 
                      isIconOnly
                      color="danger"
                      onPress={() => handleDeleteTemplate(template.id)}
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
      </div>

      {/* Create Template Modal */}
      <Modal
        isOpen={createModalOpen}
        onOpenChange={setCreateModalOpen}
        scrollBehavior="inside"
        size="3xl"
      >
        <ModalContent>
          <ModalHeader>
            <h2 className="text-xl font-bold">Skapa mailmall</h2>
          </ModalHeader>
          <ModalBody>
            <Form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="templateName" className="block text-sm font-medium mb-1">
                  Mallnamn
                </label>
                <Input
                  id="templateName"
                  value={templateName}
                  onValueChange={setTemplateName}
                  placeholder="Skriv mallens namn"
                  isInvalid={!!validationErrors.templateName}
                  errorMessage={validationErrors.templateName}
                />
              </div>

              <div>
                <label htmlFor="templateSubject" className="block text-sm font-medium mb-1">
                  Ämne
                </label>
                <Input
                  id="templateSubject"
                  value={templateSubject}
                  onValueChange={setTemplateSubject}
                  placeholder="Skriv ämnesraden"
                  isInvalid={!!validationErrors.templateSubject}
                  errorMessage={validationErrors.templateSubject}
                />
              </div>

              <div>
                <label htmlFor="templateBody" className="block text-sm font-medium mb-1">
                  Innehåll
                </label>
                <Textarea
                  id="templateBody"
                  value={templateBody}
                  onValueChange={setTemplateBody}
                  placeholder="Skriv e-postmeddelandets innehåll"
                  minRows={6}
                  isInvalid={!!validationErrors.templateBody}
                  errorMessage={validationErrors.templateBody}
                />
                <p className="mt-2 text-sm text-gray-500">
                  Tips: Du kan använda variabler som {'{kundNamn}'}, {'{ärendeID}'}, etc. som kommer ersättas med riktig information vid utskick.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="flat" 
                  onPress={() => {
                    resetForm();
                    setCreateModalOpen(false);
                  }}
                >
                  Avbryt
                </Button>
                <Button type="submit" color="primary">
                  Skapa mall
                </Button>
              </div>
            </Form>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Edit Template Modal */}
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
            <Form onSubmit={handleEditSubmit} className="space-y-6">
              <div>
                <label htmlFor="editName" className="block text-sm font-medium mb-1">
                  Mallnamn
                </label>
                <Input
                  id="editName"
                  value={editName}
                  onValueChange={setEditName}
                  placeholder="Skriv mallens namn"
                  isInvalid={!!validationErrors.editName}
                  errorMessage={validationErrors.editName}
                />
              </div>

              <div>
                <label htmlFor="editSubject" className="block text-sm font-medium mb-1">
                  Ämne
                </label>
                <Input
                  id="editSubject"
                  value={editSubject}
                  onValueChange={setEditSubject}
                  placeholder="Skriv ämnesraden"
                  isInvalid={!!validationErrors.editSubject}
                  errorMessage={validationErrors.editSubject}
                />
              </div>

              <div>
                <label htmlFor="editBody" className="block text-sm font-medium mb-1">
                  Innehåll
                </label>
                <Textarea
                  id="editBody"
                  value={editBody}
                  onValueChange={setEditBody}
                  placeholder="Skriv e-postmeddelandets innehåll"
                  minRows={6}
                  isInvalid={!!validationErrors.editBody}
                  errorMessage={validationErrors.editBody}
                />
                <p className="mt-2 text-sm text-gray-500">
                  Tips: Du kan använda variabler som {'{kundNamn}'}, {'{ärendeID}'}, etc. som kommer ersättas med riktig information vid utskick.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="flat" 
                  onPress={() => {
                    setEditModalOpen(false);
                    setEditingTemplate(null);
                  }}
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
    </section>
  );
}