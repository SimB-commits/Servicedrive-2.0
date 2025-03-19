// components/MailTemplateTest.tsx
import React, { useState, useEffect } from 'react';
import {
  Button,
  Input,
  Form,
  Select,
  SelectItem,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  addToast
} from '@heroui/react';

interface MailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
}

interface Ticket {
  id: number;
  customer: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
  ticketType?: {
    name: string;
  };
}

const MailTemplateTest: React.FC = () => {
  const [mailTemplates, setMailTemplates] = useState<MailTemplate[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [customEmail, setCustomEmail] = useState<string>('');
  const [customVariables, setCustomVariables] = useState<string>('');
  const [useCustomEmail, setUseCustomEmail] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Hämta mailmallar när komponenten laddas
  useEffect(() => {
    fetchMailTemplates();
    fetchRecentTickets();
  }, []);

  const fetchMailTemplates = async () => {
    try {
      const res = await fetch('/api/mail/templates');
      if (res.ok) {
        const data = await res.json();
        setMailTemplates(data);
      } else {
        console.error('Kunde inte hämta mailmallar');
      }
    } catch (error) {
      console.error('Fel vid hämtning av mailmallar:', error);
    }
  };

  const fetchRecentTickets = async () => {
    try {
      const res = await fetch('/api/tickets?limit=10');
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      } else {
        console.error('Kunde inte hämta ärenden');
      }
    } catch (error) {
      console.error('Fel vid hämtning av ärenden:', error);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedTemplateId) {
      newErrors.template = 'Välj en mailmall';
    }

    if (useCustomEmail) {
      if (!customEmail) {
        newErrors.email = 'Ange en giltig e-postadress';
      } else if (!/\S+@\S+\.\S+/.test(customEmail)) {
        newErrors.email = 'Ogiltig e-postadress';
      }
    } else {
      if (!selectedTicketId) {
        newErrors.ticket = 'Välj ett ärende';
      }
    }

    // Validera att customVariables är giltig JSON om den inte är tom
    if (customVariables.trim()) {
      try {
        JSON.parse(customVariables);
      } catch (error) {
        newErrors.variables = 'Ogiltigt JSON-format';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Förbered payload för API-anropet
      const payload: any = {
        templateId: selectedTemplateId,
      };

      if (useCustomEmail) {
        payload.toEmail = customEmail;
      } else {
        payload.ticketId = selectedTicketId;
      }

      if (customVariables.trim()) {
        payload.customVariables = JSON.parse(customVariables);
      }

      // Skicka mailet via API
      const res = await fetch('/api/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        addToast({
          title: 'Framgång',
          description: 'Mailet har skickats!',
          color: 'success',
          variant: 'flat'
        });
        setIsModalOpen(false);
      } else {
        const error = await res.json();
        addToast({
          title: 'Fel',
          description: error.message || 'Kunde inte skicka mail',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid skickande av mail:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid skickande av mail',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button 
        color="primary" 
        variant="flat" 
        size="sm"
        onPress={() => setIsModalOpen(true)}
      >
        Testa mailmall
      </Button>

      <Modal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        backdrop="opaque"
        size="3xl"
      >
        <ModalContent>
          <ModalHeader>
            <h2 className="text-lg font-bold">Testa mailmall</h2>
          </ModalHeader>
          <ModalBody>
            <Form onSubmit={handleSubmit} className="space-y-4">
              <Select
                label="Välj mailmall"
                placeholder="Välj en mall att testa"
                selectedKeys={selectedTemplateId ? [selectedTemplateId] : []}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                isInvalid={!!errors.template}
                errorMessage={errors.template}
              >
                {mailTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </Select>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="useCustomEmail"
                    checked={useCustomEmail}
                    onChange={() => setUseCustomEmail(!useCustomEmail)}
                    className="mr-2"
                  />
                  <label htmlFor="useCustomEmail">
                    Använd anpassad e-postadress (istället för från ett ärende)
                  </label>
                </div>

                {useCustomEmail ? (
                  <Input
                    label="E-postadress"
                    placeholder="Ange mottagarens e-post"
                    value={customEmail}
                    onValueChange={setCustomEmail}
                    isInvalid={!!errors.email}
                    errorMessage={errors.email}
                  />
                ) : (
                  <Select
                    label="Välj ärende"
                    placeholder="Välj ett ärende som mall för testdata"
                    selectedKeys={selectedTicketId ? [selectedTicketId] : []}
                    onChange={(e) => setSelectedTicketId(e.target.value)}
                    isInvalid={!!errors.ticket}
                    errorMessage={errors.ticket}
                  >
                    {tickets.map((ticket) => (
                      <SelectItem key={ticket.id} value={ticket.id}>
                        #{ticket.id} - {ticket.customer?.firstName || ''} {ticket.customer?.lastName || ''} ({ticket.customer?.email})
                      </SelectItem>
                    ))}
                  </Select>
                )}
              </div>

              <div>
                <label className="block font-medium text-sm mb-1">Anpassade variabler (JSON)</label>
                <Textarea
                  placeholder={'{"variabelNamn": "värde", "annan_variabel": "annat värde"}'}
                  value={customVariables}
                  onValueChange={setCustomVariables}
                  minRows={4}
                  isInvalid={!!errors.variables}
                  errorMessage={errors.variables}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Ange anpassade variabler i JSON-format. Dessa kommer ersätta motsvarande {'{variabelNamn}'} i mallen.
                </p>
              </div>
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={() => setIsModalOpen(false)}
            >
              Avbryt
            </Button>
            <Button
              color="primary"
              onPress={handleSubmit}
              isLoading={isLoading}
              isDisabled={isLoading}
            >
              Skicka mail
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default MailTemplateTest;