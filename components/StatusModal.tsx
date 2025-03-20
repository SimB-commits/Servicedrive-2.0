// components/StatusModal.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Tabs,
  Tab,
  addToast,
  Badge
} from '@heroui/react';
import StatusMailTemplateIntegration from './email/StatusMailTemplateIntegration';

interface MailTemplate {
  id: number;
  name: string;
}

interface UserTicketStatus {
  id: number;
  name: string;
  color: string;
  mailTemplateId: number | null;
  isSystemStatus?: boolean; // Ny flagga för grundläggande statusar
}

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (status: any) => void;
  editingStatus: UserTicketStatus | null;
  mailTemplates: MailTemplate[];
}

const StatusModal: React.FC<StatusModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingStatus,
  mailTemplates
}) => {
  const [name, setName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [color, setColor] = useState('#ffffff');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [isSystemStatus, setIsSystemStatus] = useState(false);

  // Populera formuläret med data när editingStatus ändras
  useEffect(() => {
    if (editingStatus) {
      setName(editingStatus.name);
      setSelectedTemplateId(editingStatus.mailTemplateId ? String(editingStatus.mailTemplateId) : null);
      setColor(editingStatus.color);
      setIsSystemStatus(!!editingStatus.isSystemStatus);
    } else {
      // Rensa formuläret för ny status
      setName('');
      setSelectedTemplateId(null);
      setColor('#ffffff');
      setIsSystemStatus(false);
    }
    setValidationErrors({});
  }, [editingStatus, isOpen]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    // Om det är en grundläggande status, validera vi bara mailmallen
    if (!isSystemStatus) {
      if (!name.trim()) {
        errors.name = 'Namn är obligatoriskt';
      }
      
      if (!color) {
        errors.color = 'Färg måste anges';
      }
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    setSaving(true);
    
    // För grundläggande statusar skickar vi bara mailmall-ändringen
    const statusData = isSystemStatus 
      ? {
          mailTemplateId: selectedTemplateId ? Number(selectedTemplateId) : null
        }
      : {
          name,
          mailTemplateId: selectedTemplateId ? Number(selectedTemplateId) : null,
          color
        };
    
    onSave(statusData);
    setSaving(false);
  };

  const getModalTitle = () => {
    if (isSystemStatus) {
      return `Koppla mailmall till ${editingStatus?.name || 'status'}`;
    }
    return editingStatus ? `Redigera status: ${editingStatus.name}` : 'Skapa ny status';
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose} size="xl">
      <ModalContent>
        <ModalHeader>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">{getModalTitle()}</h2>
            {isSystemStatus && (
              <Badge color="primary" variant="flat">Grundläggande status</Badge>
            )}
          </div>
        </ModalHeader>
        
        <ModalBody>
          {isSystemStatus ? (
            // För grundläggande statusar, visa bara flik för mailmallval
            <div className="space-y-6 py-4">
              <div className="border-l-4 border-info-500 bg-info-50 p-4 rounded">
                <p className="text-sm text-info-700">
                  <strong>Grundläggande status</strong> - Denna status är inbyggd i systemet och kan inte ändras.
                  Du kan dock koppla en mailmall som kommer att användas när ärenden får denna status.
                </p>
              </div>
              
              <Select
                label="Mailmall för statusen"
                placeholder="Välj en mall för automatiska mail"
                selectedKeys={selectedTemplateId ? [selectedTemplateId] : []}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
              >
                <SelectItem key="" value="">Ingen mall (skickar inget mail)</SelectItem>
                {mailTemplates.map((template) => (
                  <SelectItem key={template.id.toString()} value={template.id.toString()}>
                    {template.name}
                  </SelectItem>
                ))}
              </Select>
              
              <p className="text-sm text-default-600">
                När ett ärende får statusen <strong>{editingStatus?.name}</strong> kommer 
                automatiskt mail att skickas till kunden om du väljer en mailmall ovan.
                Om du väljer "Ingen mall" skickas inget automatiskt mail.
              </p>
            </div>
          ) : (
            // För anpassade statusar, visa alla flikar
            <Tabs 
              selectedKey={activeTab}
              onSelectionChange={(key) => setActiveTab(key as string)}
              aria-label="Status options"
              variant="underlined"
              color="primary"
            >
              <Tab key="general" title="Allmänt">
                <div className="space-y-6 py-4">
                  <Input
                    label="Namn på status"
                    value={name}
                    onValueChange={setName}
                    isRequired
                    placeholder="Exempelvis 'Väntar på delar'"
                    isInvalid={!!validationErrors.name}
                    errorMessage={validationErrors.name}
                  />
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Statusfärg
                    </label>
                    
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-12 h-10 rounded border"
                      />
                      <div 
                        className="w-10 h-10 rounded-full border" 
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-default-600">{color}</span>
                    </div>
                    
                    {validationErrors.color && (
                      <p className="text-danger text-sm mt-1">{validationErrors.color}</p>
                    )}
                  </div>
                  
                  <Select
                    label="Mailmall (valfritt)"
                    placeholder="Välj en mall för automatiska mail"
                    selectedKeys={selectedTemplateId ? [selectedTemplateId] : []}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                  >
                    <SelectItem key="" value="">Ingen mall</SelectItem>
                    {mailTemplates.map((template) => (
                      <SelectItem key={template.id.toString()} value={template.id.toString()}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </Select>
                  
                  <p className="text-sm text-default-500">
                    När ett ärende får denna status kan ett automatiskt mail skickas till kunden. 
                    Om du väljer en mailmall här kommer den att användas för alla ärenden som får denna status.
                  </p>
                </div>
              </Tab>
              
              {editingStatus && (
                <Tab key="mail" title="Mail">
                  <div className="py-4">
                    <StatusMailTemplateIntegration 
                      statusId={editingStatus.id}
                      onTemplateUpdated={() => {
                        // Uppdatera UI:n
                        if (editingStatus.mailTemplateId) {
                          setSelectedTemplateId(String(editingStatus.mailTemplateId));
                        }
                        
                        addToast({
                          title: 'Uppdaterad',
                          description: 'Mailmall för statusen har uppdaterats',
                          color: 'success',
                          variant: 'flat'
                        });
                      }}
                    />
                  </div>
                </Tab>
              )}
            </Tabs>
          )}
        </ModalBody>
        
        <ModalFooter>
          <Button
            variant="flat"
            onPress={onClose}
          >
            Avbryt
          </Button>
          
          <Button
            color="primary"
            onPress={handleSubmit}
            isLoading={saving}
          >
            {isSystemStatus 
              ? 'Spara mailmallinställning' 
              : (editingStatus ? 'Spara ändringar' : 'Skapa status')
            }
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default StatusModal;