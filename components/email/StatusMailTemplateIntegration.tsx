// components/email/StatusMailTemplateIntegration.tsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  Select,
  SelectItem,
  Button,
  Spinner,
  Divider,
  addToast
} from '@heroui/react';
import MailTemplateTest from './MailTemplateTest';

interface MailTemplate {
  id: number;
  name: string;
  subject: string;
}

interface UserTicketStatus {
  id: number;
  name: string;
  color: string;
  mailTemplateId: number | null;
  mailTemplate?: MailTemplate;
}

interface StatusMailTemplateIntegrationProps {
  statusId?: number;
  defaultOpen?: boolean;
  onTemplateUpdated?: () => void;
}

const StatusMailTemplateIntegration: React.FC<StatusMailTemplateIntegrationProps> = ({
  statusId,
  defaultOpen = true,
  onTemplateUpdated
}) => {
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [status, setStatus] = useState<UserTicketStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(statusId ? true : false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Hämta alla mailmallar
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/mail/templates');
        if (res.ok) {
          const data = await res.json();
          setTemplates(data);
        } else {
          console.error('Kunde inte hämta mailmallar');
          setError('Kunde inte hämta mailmallar');
        }
      } catch (error) {
        console.error('Fel vid hämtning av mailmallar:', error);
        setError('Ett fel inträffade vid hämtning av mailmallar');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  // Hämta status om statusId är angivet
  useEffect(() => {
    if (statusId) {
      fetchStatus(statusId);
    }
  }, [statusId]);

  const fetchStatus = async (id: number) => {
    try {
      setLoadingStatus(true);
      const res = await fetch(`/api/tickets/statuses/${id}`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setSelectedTemplateId(data.mailTemplateId ? data.mailTemplateId.toString() : null);
      } else {
        console.error('Kunde inte hämta statusen');
        setError('Kunde inte hämta statusen');
      }
    } catch (error) {
      console.error('Fel vid hämtning av status:', error);
      setError('Ett fel inträffade vid hämtning av status');
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleSave = async () => {
    if (!statusId) return;
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      const payload = {
        mailTemplateId: selectedTemplateId ? Number(selectedTemplateId) : null,
      };
      
      const res = await fetch(`/api/tickets/statuses/${statusId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (res.ok) {
        const updatedStatus = await res.json();
        setStatus(updatedStatus);
        setSuccess('Mailmall sparad för statusen');
        
        if (onTemplateUpdated) {
          onTemplateUpdated();
        }
        
        addToast({
          title: 'Framgång',
          description: 'Mailmall har uppdaterats för statusen',
          color: 'success',
          variant: 'flat'
        });
      } else {
        const errorData = await res.json();
        setError(errorData.message || 'Kunde inte uppdatera statusen');
        
        addToast({
          title: 'Fel',
          description: 'Kunde inte uppdatera mailmallen för statusen',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid uppdatering av status:', error);
      setError('Ett fel inträffade vid uppdatering av statusen');
      
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid uppdatering av statusen',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadingStatus) {
    return (
      <Card>
        <CardBody className="flex justify-center items-center py-6">
          <Spinner size="sm" />
          <p className="ml-2 text-sm">Laddar...</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="px-6 py-4">
        <div className="flex justify-between items-center">
          <h3 className="text-md font-medium">
            {status 
              ? `Mail för status: ${status.name}` 
              : 'Mailmall för statusuppdatering'}
          </h3>
          
          {status && status.mailTemplateId && (
            <MailTemplateTest 
              templateId={status.mailTemplateId}
              buttonText="Testa mall"
              buttonSize="sm"
            />
          )}
        </div>
      </CardHeader>
      
      <CardBody className="px-6 py-4">
        {error && (
          <div className="p-3 mb-4 bg-danger-50 border border-danger-200 text-danger text-sm rounded">
            {error}
          </div>
        )}
        
        {success && (
          <div className="p-3 mb-4 bg-success-50 border border-success-200 text-success text-sm rounded">
            {success}
          </div>
        )}
        
        <div className="space-y-4">
          <p className="text-sm text-default-600">
            När ett ärende uppdateras till denna status kan ett automatiskt mail skickas till kunden.
            <strong> Om ingen mall väljs kommer inga automatiska mail att skickas</strong> när ärenden får denna status.
          </p>
          
          <div className="p-3 mb-4 bg-info-50 border border-info-200 rounded">
            <p className="text-sm text-info-700">
              <strong>Viktig ändring:</strong> Systemet använder inte längre någon standardmall för statusuppdateringar.
              Endast statusar med en specifik kopplad mailmall skickar automatiska mail.
            </p>
          </div>
          
          <div className="pb-3">
            <Select
              label="Mailmall för statusen"
              placeholder="Välj en mall för automatiskt mail"
              selectedKeys={selectedTemplateId ? [selectedTemplateId] : []}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="max-w-md"
            >
              <SelectItem key="" value="">Ingen mall (skickar inget mail)</SelectItem>
              {templates.map((template) => (
                <SelectItem key={template.id.toString()} value={template.id.toString()}>
                  {template.name}
                </SelectItem>
              ))}
            </Select>
          </div>
          
          <Divider />
          
          <div className="flex justify-end pt-2">
            <Button
              color="primary"
              onPress={handleSave}
              isLoading={saving}
              isDisabled={saving || !statusId}
            >
              Spara inställningar
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default StatusMailTemplateIntegration;