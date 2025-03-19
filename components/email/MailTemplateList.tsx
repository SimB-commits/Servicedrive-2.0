// components/email/MailTemplateList.tsx
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
  addToast
} from '@heroui/react';

import { DeleteIcon, EditIcon } from '@/components/icons';
import MailTemplateTest from '@/components/MailTemplateTest';
import MailTemplateForm from './MailTemplateForm';

interface MailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
}

interface MailTemplateListProps {
  refreshTrigger?: number;
  onTemplateChanged?: () => void;
}

const MailTemplateList: React.FC<MailTemplateListProps> = ({ 
  refreshTrigger = 0, 
  onTemplateChanged 
}) => {
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MailTemplate | null>(null);

  // Hämta mallar när komponenten laddas eller när refreshTrigger ändras
  useEffect(() => {
    fetchTemplates();
  }, [refreshTrigger]);

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

  const handleEditTemplate = (template: MailTemplate) => {
    setEditingTemplate(template);
    setEditModalOpen(true);
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
        
        // Meddela parent-komponenten om förändring
        if (onTemplateChanged) {
          onTemplateChanged();
        }
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

  // Formatera datum
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric'
    });
  };

  // Trunkera text
  const truncateText = (text: string, maxLength: number) => {
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  const handleFormSuccess = () => {
    // Stäng modaler
    setCreateModalOpen(false);
    setEditModalOpen(false);
    setEditingTemplate(null);
    
    // Uppdatera listan
    fetchTemplates();
    
    // Meddela parent-komponenten om förändring
    if (onTemplateChanged) {
      onTemplateChanged();
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Dina mailmallar</h2>
          <Button 
            type="button" 
            onPress={() => setCreateModalOpen(true)} 
            color="primary"
          >
            Skapa ny mailmall
          </Button>
        </CardHeader>
        
        <CardBody>
          {loading ? (
            <div className="flex justify-center items-center py-4">
              <Spinner size="md" />
              <p className="ml-3">Laddar mailmallar...</p>
            </div>
          ) : templates.length === 0 ? (
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
                        <MailTemplateTest templateId={template.id} />
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
        </CardBody>
      </Card>

      {/* Modal för att skapa ny mall */}
      <MailTemplateForm 
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleFormSuccess}
      />
      
      {/* Modal för att redigera mall */}
      <MailTemplateForm 
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingTemplate(null);
        }}
        onSuccess={handleFormSuccess}
        initialData={editingTemplate}
      />
    </>
  );
};

export default MailTemplateList;