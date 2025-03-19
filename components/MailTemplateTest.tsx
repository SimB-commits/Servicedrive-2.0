// components/MailTemplateTest.tsx
import React, { useState, useEffect } from 'react';
import {
  Button,
  Input,
  Select,
  SelectItem,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Spinner,
  addToast,
  Tabs,
  Tab,
  Divider
} from '@heroui/react';
import MailTemplatePreview from './email/MailTemplatePreview';

interface MailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
}

interface SenderAddress {
  id: number;
  email: string;
  name?: string;
  isDefault: boolean;
}

interface MailTemplateTestProps {
  templateId?: number; // Om templateId skickas med, används den mallen direkt
  buttonText?: string; // Anpassningsbar knapptext
  variant?: 'primary' | 'flat' | 'light'; // Stil på knappen
  buttonSize?: 'sm' | 'md' | 'lg'; // Storlek på knappen
}

const MailTemplateTest: React.FC<MailTemplateTestProps> = ({ 
  templateId,
  buttonText = 'Testa mailmall',
  variant = 'flat',
  buttonSize = 'sm'
}) => {
  const [mailTemplates, setMailTemplates] = useState<MailTemplate[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [senderAddresses, setSenderAddresses] = useState<SenderAddress[]>([]);
  const [loadingSenders, setLoadingSenders] = useState<boolean>(false);
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templateId?.toString() || '');
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [customSenderEmail, setCustomSenderEmail] = useState<string>('');
  const [customSenderName, setCustomSenderName] = useState<string>('');
  
  const [customEmail, setCustomEmail] = useState<string>('');
  const [customVariables, setCustomVariables] = useState<string>('');
  
  const [useCustomEmail, setUseCustomEmail] = useState<boolean>(false);
  const [useCustomSender, setUseCustomSender] = useState<boolean>(false);
  
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('basic');
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Hämta data när modalen öppnas
  useEffect(() => {
    if (isModalOpen) {
      fetchMailTemplates();
      fetchRecentTickets();
      fetchSenderAddresses();
    }
  }, [isModalOpen]);

  // Om templateId skickas som prop, använd den
  useEffect(() => {
    if (templateId) {
      setSelectedTemplateId(templateId.toString());
    }
  }, [templateId]);

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

  const fetchSenderAddresses = async () => {
    try {
      setLoadingSenders(true);
      const res = await fetch('/api/mail/sender-addresses');
      
      if (res.ok) {
        const data = await res.json();
        setSenderAddresses(data);
        
        // Välj standard-avsändaren om en sådan finns
        const defaultAddress = data.find((addr: SenderAddress) => addr.isDefault);
        if (defaultAddress) {
          setSelectedSenderId(defaultAddress.id.toString());
        } else if (data.length > 0) {
          setSelectedSenderId(data[0].id.toString());
        }
      } else {
        console.error('Kunde inte hämta avsändaradresser');
      }
    } catch (error) {
      console.error('Fel vid hämtning av avsändaradresser:', error);
    } finally {
      setLoadingSenders(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedTemplateId) {
      newErrors.template = 'Välj en mailmall';
    }

    // Validera mottagare
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
    
    // Validera avsändare om anpassad används
    if (useCustomSender) {
      if (!customSenderEmail) {
        newErrors.senderEmail = 'Ange en giltig avsändaradress';
      } else if (!/\S+@\S+\.\S+/.test(customSenderEmail)) {
        newErrors.senderEmail = 'Ogiltig e-postadress';
      }
    } else if (!selectedSenderId && senderAddresses.length > 0) {
      newErrors.sender = 'Välj en avsändaradress';
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

  const handleSubmit = async (e?: React.FormEvent) => {
    // Förhindra sidomladdning endast om det är ett event
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Förbered payload för API-anropet
      const payload: any = {
        templateId: selectedTemplateId,
      };

      // Lägg till mottagarinformation
      if (useCustomEmail) {
        payload.toEmail = customEmail;
      } else {
        payload.ticketId = selectedTicketId;
      }
      
      // Lägg till avsändarinformation
      if (useCustomSender) {
        payload.fromEmail = customSenderEmail;
        if (customSenderName) {
          payload.fromName = customSenderName;
        }
      } else if (selectedSenderId) {
        const selectedSender = senderAddresses.find(
          addr => addr.id.toString() === selectedSenderId
        );
        
        if (selectedSender) {
          payload.fromEmail = selectedSender.email;
          if (selectedSender.name) {
            payload.fromName = selectedSender.name;
          }
        }
      }

      // Lägg till anpassade variabler
      if (customVariables.trim()) {
        try {
          payload.customVariables = JSON.parse(customVariables);
        } catch (e) {
          // Om det inte är giltigt JSON kommer validateForm att fånga det
          addToast({
            title: 'Fel',
            description: 'Ogiltigt JSON-format i variablerna',
            color: 'danger',
            variant: 'flat'
          });
          setIsLoading(false);
          return;
        }
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

  const openPreviewModal = () => {
    if (!selectedTemplateId) {
      addToast({
        title: 'Fel',
        description: 'Välj en mailmall först',
        color: 'danger',
        variant: 'flat'
      });
      return;
    }
    
    setIsPreviewModalOpen(true);
  };

  // Återställ formuläret när modalen stängs
  const handleCloseModal = () => {
    if (!templateId) {
      setSelectedTemplateId('');
    }
    setSelectedTicketId('');
    setCustomEmail('');
    setCustomVariables('');
    setActiveTab('basic');
    setErrors({});
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="flex space-x-2">
        <Button 
          color={variant === 'primary' ? 'primary' : 'default'}
          variant={variant === 'primary' ? 'solid' : variant}
          size={buttonSize}
          onPress={() => setIsModalOpen(true)}
        >
          {buttonText}
        </Button>
        
        {selectedTemplateId && (
          <Button
            variant="flat"
            size={buttonSize}
            onPress={openPreviewModal}
          >
            Förhandsgranska
          </Button>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onOpenChange={handleCloseModal}
        backdrop="opaque"
        size="3xl"
      >
        <ModalContent>
          <ModalHeader>
            <h2 className="text-lg font-bold">Testa mailmall</h2>
          </ModalHeader>
          <ModalBody>
            <Tabs
              selectedKey={activeTab}
              onSelectionChange={(key) => setActiveTab(key as string)}
              variant="underlined"
              color="primary"
              aria-label="Mail test options"
            >
              <Tab key="basic" title="Grundinställningar">
                <div className="space-y-4 py-4">
                  <Select
                    label="Välj mailmall"
                    placeholder="Välj en mall att testa"
                    selectedKeys={selectedTemplateId ? [selectedTemplateId] : []}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    isInvalid={!!errors.template}
                    errorMessage={errors.template}
                  >
                    {mailTemplates.map((template) => (
                      <SelectItem key={template.id.toString()} value={template.id.toString()}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </Select>
                  
                  <Divider className="my-2" />
                  
                  <div className="pt-2">
                    <h3 className="text-sm font-medium mb-3">Mottagare</h3>
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
                          <SelectItem key={ticket.id.toString()} value={ticket.id.toString()}>
                            #{ticket.id} - {ticket.customer?.firstName || ''} {ticket.customer?.lastName || ''} ({ticket.customer?.email})
                          </SelectItem>
                        ))}
                      </Select>
                    )}
                  </div>
                </div>
              </Tab>
              
              <Tab key="sender" title="Avsändare">
                <div className="space-y-4 py-4">
                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="useCustomSender"
                      checked={useCustomSender}
                      onChange={() => setUseCustomSender(!useCustomSender)}
                      className="mr-2"
                    />
                    <label htmlFor="useCustomSender">
                      Använd anpassad avsändaradress
                    </label>
                  </div>
                  
                  {loadingSenders ? (
                    <div className="flex items-center justify-center py-4">
                      <Spinner size="sm" />
                      <span className="ml-2">Laddar avsändaradresser...</span>
                    </div>
                  ) : useCustomSender ? (
                    <div className="space-y-3">
                      <Input
                        label="Avsändarens e-post"
                        placeholder="namn@dinverifieradedomän.se"
                        value={customSenderEmail}
                        onValueChange={setCustomSenderEmail}
                        isInvalid={!!errors.senderEmail}
                        errorMessage={errors.senderEmail}
                      />
                      
                      <Input
                        label="Avsändarens namn (valfritt)"
                        placeholder="Ditt Företag AB"
                        value={customSenderName}
                        onValueChange={setCustomSenderName}
                        description="Detta visas som 'Från: Namn <email>' i mottagarens mail"
                      />
                      
                      <div className="bg-warning-50 border border-warning-200 text-warning-700 p-3 text-sm rounded mt-2">
                        <p><strong>OBS!</strong> Avsändaradressen måste vara från en domän som är verifierad i systemet.</p>
                        <p className="mt-1">Om du är osäker, använd en av de fördefinierade adresserna istället.</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {senderAddresses.length === 0 ? (
                        <div className="bg-warning-50 border border-warning-200 text-warning-700 p-3 text-sm rounded">
                          <p>Inga verifierade avsändaradresser hittades.</p>
                          <p className="mt-1">För att kunna välja avsändaradress behöver du först verifiera en domän under Inställningar &gt; Domänverifiering.</p>
                        </div>
                      ) : (
                        <Select
                          label="Från avsändare"
                          placeholder="Välj avsändare"
                          selectedKeys={selectedSenderId ? [selectedSenderId] : []}
                          onChange={(e) => setSelectedSenderId(e.target.value)}
                          isInvalid={!!errors.sender}
                          errorMessage={errors.sender}
                        >
                          {senderAddresses.map((address) => (
                            <SelectItem key={address.id.toString()} value={address.id.toString()}>
                              {address.name ? `${address.name} <${address.email}>` : address.email}
                              {address.isDefault && " (Standard)"}
                            </SelectItem>
                          ))}
                        </Select>
                      )}
                    </div>
                  )}
                </div>
              </Tab>
              
              <Tab key="variables" title="Variabler">
                <div className="py-4">
                  <label className="block font-medium text-sm mb-2">Anpassade variabler (JSON)</label>
                  <Textarea
                    placeholder={'{"variabelNamn": "värde", "annan_variabel": "annat värde"}'}
                    value={customVariables}
                    onValueChange={setCustomVariables}
                    minRows={6}
                    isInvalid={!!errors.variables}
                    errorMessage={errors.variables}
                  />
                  <p className="text-xs text-default-500 mt-2">
                    Ange anpassade variabler i JSON-format. Dessa kommer ersätta motsvarande {'{variabelNamn}'} i mallen.
                  </p>
                  
                  <div className="border rounded mt-4 p-3 bg-default-50">
                    <h4 className="text-sm font-medium mb-2">Tips på användbara variabler</h4>
                    <ul className="text-xs space-y-1">
                      <li>
                        <code className="bg-default-200 px-1 rounded">{'{kundNamn}'}</code> - Kundens fullständiga namn
                      </li>
                      <li>
                        <code className="bg-default-200 px-1 rounded">{'{ärendeID}'}</code> - Ärendets ID-nummer
                      </li>
                      <li>
                        <code className="bg-default-200 px-1 rounded">{'{ärendeTyp}'}</code> - Typ av ärende
                      </li>
                      <li>
                        <code className="bg-default-200 px-1 rounded">{'{ärendeStatus}'}</code> - Ärendets status
                      </li>
                      <li>
                        <code className="bg-default-200 px-1 rounded">{'{företagsNamn}'}</code> - Ditt företagsnamn
                      </li>
                      <li>
                        <code className="bg-default-200 px-1 rounded">{'{deadline}'}</code> - Ärendets deadline
                      </li>
                    </ul>
                  </div>
                </div>
              </Tab>
            </Tabs>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={handleCloseModal}
            >
              Avbryt
            </Button>
            {selectedTemplateId && (
              <Button
                variant="flat"
                color="primary"
                onPress={openPreviewModal}
              >
                Förhandsgranska
              </Button>
            )}
            <Button
              color="primary"
              onPress={() => handleSubmit()} 
              isLoading={isLoading}
              isDisabled={isLoading}
            >
              Skicka mail
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Förhandsgranskningsmodal */}
      {isPreviewModalOpen && selectedTemplateId && (
        <MailTemplatePreview 
          templateId={Number(selectedTemplateId)} 
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
        />
      )}
    </>
  );
};

export default MailTemplateTest;