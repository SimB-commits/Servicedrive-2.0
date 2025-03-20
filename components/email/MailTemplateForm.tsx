// components/email/MailTemplateForm.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Form,
  addToast
} from '@heroui/react';

interface MailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
}

interface MailTemplateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: MailTemplate | null;
}

const MailTemplateForm: React.FC<MailTemplateFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData = null
}) => {
  // Form state
  const [templateName, setTemplateName] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Populera formuläret när initialData ändras eller när modalen öppnas
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Redigeringsläge
        setTemplateName(initialData.name);
        setTemplateSubject(initialData.subject);
        setTemplateBody(initialData.body);
      } else {
        // Skapa ny mall
        resetForm();
      }
      // Rensa valideringsfel
      setValidationErrors({});
    }
  }, [isOpen, initialData]);

  const resetForm = () => {
    setTemplateName('');
    setTemplateSubject('');
    setTemplateBody('');
    setValidationErrors({});
  };

  const validateForm = () => {
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
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Här är problemet! Vi behöver hantera när handleSubmit kallas från Button.onPress
  // som inte skickar ett event-objekt
  const handleSubmit = async (e?: React.FormEvent) => {
    // Endast anropa preventDefault om e existerar (när anropat från form submit)
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    if (!validateForm()) {
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Förbered payload
      const payload = {
        name: templateName,
        subject: templateSubject,
        body: templateBody
      };
      
      // Bestäm URL och metod baserat på om vi redigerar eller skapar
      const url = initialData 
        ? `/api/mail/templates/${initialData.id}` 
        : '/api/mail/templates';
      
      const method = initialData ? 'PUT' : 'POST';
      
      // Gör API-anropet
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Visa framgångsmeddelande
        addToast({
          title: 'Framgång',
          description: initialData 
            ? 'Mailmallen uppdaterades' 
            : 'Mailmall skapades',
          color: 'success',
          variant: 'flat'
        });
        
        // Meddela parent-komponenten om framgång
        onSuccess();
      } else {
        // Hantera fel
        const error = await response.json();
        addToast({
          title: 'Fel',
          description: error.message || 'Kunde inte spara mailmallen',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid spara mailmall:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid sparande av mailmallen',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onClose}
      scrollBehavior="inside"
      size="3xl"
    >
      <ModalContent>
        <ModalHeader>
          <h2 className="text-xl font-bold">
            {initialData ? 'Redigera mailmall' : 'Skapa mailmall'}
          </h2>
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
                minRows={8}
                isInvalid={!!validationErrors.templateBody}
                errorMessage={validationErrors.templateBody}
              />
              
              <div className="mt-2 text-sm text-default-500">
                <p className="font-medium mb-1">Tillgängliga variabler</p>
                <p>
                  Du kan använda dessa variabler som ersätts med riktig information när mailet skickas:
                </p>
                <ul className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1">
                  <li><code className="bg-default-100 px-1 rounded">{'{kundNamn}'}</code> - Kundens namn</li>
                  <li><code className="bg-default-100 px-1 rounded">{'{kundEmail}'}</code> - Kundens e-post</li>
                  <li><code className="bg-default-100 px-1 rounded">{'{ärendeID}'}</code> - Ärendets ID</li>
                  <li><code className="bg-default-100 px-1 rounded">{'{ärendeTyp}'}</code> - Ärendetyp</li>
                  <li><code className="bg-default-100 px-1 rounded">{'{ärendeStatus}'}</code> - Ärendets status</li>
                  <li><code className="bg-default-100 px-1 rounded">{'{deadline}'}</code> - Deadline för ärendet</li>
                  <li><code className="bg-default-100 px-1 rounded">{'{handläggare}'}</code> - Handläggarens namn</li>
                  <li><code className="bg-default-100 px-1 rounded">{'{företagsNamn}'}</code> - Ditt företag</li>
                </ul>
              </div>
            </div>
          </Form>
        </ModalBody>
        
        <ModalFooter>
          <Button 
            type="button" 
            variant="flat" 
            onPress={onClose}
          >
            Avbryt
          </Button>
          <Button 
            color="primary" 
            onPress={() => handleSubmit()} // Viktigt! Anropa utan event-objekt här
            isLoading={submitting}
            isDisabled={submitting}
          >
            {initialData ? 'Spara ändringar' : 'Skapa mall'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default MailTemplateForm;