// components/MailTemplateTest.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
  Input,
  Textarea,
  Spinner,
  Switch,
  Divider,
  addToast,
  Tabs,
  Tab,
} from '@heroui/react';
import MailTemplatePreview from './MailTemplatePreview';

interface MailTemplate {
  id: number;
  name: string;
  subject: string;
}

interface SenderAddress {
  id: number;
  email: string;
  name?: string;
  isDefault: boolean;
}

interface MailTemplateTestProps {
  templateId: number;
  buttonText?: string;
  variant?: 'primary' | 'flat' | 'light';
  buttonSize?: 'sm' | 'md' | 'lg';
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
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedSenderId, setSelectedSenderId] = useState<string | null>(null);
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
  const [sendSuccess, setSendSuccess] = useState<boolean>(false);
  
  // Referens till modalen för att förhindra oavsiktlig stängning
  const modalRef = useRef(null);
  
  // Flagga för att kontrollera om modalen bör stängas
  const [allowModalClose, setAllowModalClose] = useState(true);

  // Hämta data när modalen öppnas
  useEffect(() => {
    if (isModalOpen) {
      fetchMailTemplates();
      fetchRecentTickets();
      fetchSenderAddresses();
      // Återställ statusvariabeln när modalen öppnas
      setSendSuccess(false);
    }
  }, [isModalOpen]);

  // Om templateId skickas som prop, använd den
  useEffect(() => {
    if (templateId) {
      setSelectedTemplateId(String(templateId));
    }
  }, [templateId]);

  const fetchMailTemplates = async () => {
    try {
      const res = await fetch('/api/mail/templates');
      if (res.ok) {
        const data = await res.json();
        setMailTemplates(Array.isArray(data) ? data : []);
      } else {
        console.error('Kunde inte hämta mailmallar');
        setMailTemplates([]);
      }
    } catch (error) {
      console.error('Fel vid hämtning av mailmallar:', error);
      setMailTemplates([]);
    }
  };

  const fetchRecentTickets = async () => {
    try {
      const res = await fetch('/api/tickets?limit=10');
      if (res.ok) {
        const data = await res.json();
        setTickets(Array.isArray(data) ? data : []);
      } else {
        console.error('Kunde inte hämta ärenden');
        setTickets([]);
      }
    } catch (error) {
      console.error('Fel vid hämtning av ärenden:', error);
      setTickets([]);
    }
  };

  const fetchSenderAddresses = async () => {
    try {
      setLoadingSenders(true);
      const res = await fetch('/api/mail/sender-addresses');
      
      if (res.ok) {
        const data = await res.json();
        const addresses = Array.isArray(data) ? data : [];
        setSenderAddresses(addresses);
        
        // Välj standard-avsändaren om en sådan finns
        const defaultAddress = addresses.find(addr => addr && addr.isDefault === true);
        if (defaultAddress) {
          setSelectedSenderId(String(defaultAddress.id));
        } else if (addresses.length > 0 && addresses[0]) {
          setSelectedSenderId(String(addresses[0].id));
        }
      } else {
        console.error('Kunde inte hämta avsändaradresser');
        setSenderAddresses([]);
      }
    } catch (error) {
      console.error('Fel vid hämtning av avsändaradresser:', error);
      setSenderAddresses([]);
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
    setSendSuccess(false);

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
          addr => addr && String(addr.id) === selectedSenderId
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
        
        setSendSuccess(true);
      } else {
        const error = await res.json();
        throw new Error(error.message || error.error || 'Kunde inte skicka mail');
      }
    } catch (error) {
      console.error('Fel vid skickande av mail:', error);
      addToast({
        title: 'Fel',
        description: error.message || 'Ett fel inträffade vid skickande av mail',
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

  // Säker hantering av dropdown-händelser
  const handleDropdownInteraction = (isOpen: boolean) => {
    // Inaktivera modal-stängning när en dropdown är öppen
    setAllowModalClose(!isOpen);
  };

  // Säkert öppna modalen
  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  // Säkert stänga modalen
  const handleCloseModal = () => {
    // Stäng bara om vi tillåter det (ingen dropdown är öppen)
    if (allowModalClose) {
      // Återställ formuläret
      if (!templateId) {
        setSelectedTemplateId('');
      }
      setSelectedTicketId('');
      setCustomEmail('');
      setCustomVariables('');
      setActiveTab('basic');
      setErrors({});
      setSendSuccess(false);
      
      // Stäng modalen
      setIsModalOpen(false);
    }
  };

  // Specialhanteraren för template-val
  const handleTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTemplateId(e.target.value);
  };

  // Specialhanteraren för ticket-val
  const handleTicketSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTicketId(e.target.value);
  };

  // Specialhanteraren för sender-val
  const handleSenderSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSenderId(e.target.value);
  };

  return (
    <>
      <div className="flex space-x-2">
        <Button 
          color={variant === 'primary' ? 'primary' : 'default'}
          variant={variant === 'primary' ? 'solid' : variant}
          size={buttonSize}
          onPress={handleOpenModal}
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
        ref={modalRef}
        isOpen={isModalOpen}
        onOpenChange={(open) => {
          // Hantera stänghändelsen endast om vi tillåter stängning
          if (!open && allowModalClose) {
            handleCloseModal();
          }
        }}
        backdrop="opaque"
        size="3xl"
        isDismissable={allowModalClose}
        hideCloseButton={!allowModalClose}
      >
        <ModalContent>
          {(onClose) => (
            <>
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
                      <div className="w-full">
                        <label className="block text-sm font-medium mb-2">
                          Välj mailmall
                        </label>
                        <select
                          className="w-full p-2 border border-default-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          value={selectedTemplateId || ""}
                          onChange={handleTemplateSelect}
                        >
                          <option value="">Välj en mall att testa</option>
                          {(mailTemplates || []).map((template) => (
                            template && template.id ? (
                              <option key={String(template.id)} value={String(template.id)}>
                                {template.name}
                              </option>
                            ) : null
                          ))}
                        </select>
                        {errors.template && (
                          <p className="text-xs text-danger mt-1">{errors.template}</p>
                        )}
                      </div>
                      
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
                          <div className="w-full">
                            <label className="block text-sm font-medium mb-2">
                              Välj ärende
                            </label>
                            <select
                              className="w-full p-2 border border-default-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                              value={selectedTicketId || ""}
                              onChange={handleTicketSelect}
                            >
                              <option value="">Välj ett ärende som mall för testdata</option>
                              {(tickets || []).map((ticket) => (
                                ticket && ticket.id ? (
                                  <option key={String(ticket.id)} value={String(ticket.id)}>
                                    #{ticket.id} - {(ticket.customer?.firstName || '')} {(ticket.customer?.lastName || '')} ({ticket.customer?.email || 'Ingen email'})
                                  </option>
                                ) : null
                              ))}
                            </select>
                            {errors.ticket && (
                              <p className="text-xs text-danger mt-1">{errors.ticket}</p>
                            )}
                          </div>
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
                          {(!senderAddresses || senderAddresses.length === 0) ? (
                            <div className="bg-warning-50 border border-warning-200 text-warning-700 p-3 text-sm rounded">
                              <p>Inga verifierade avsändaradresser hittades.</p>
                              <p className="mt-1">För att kunna välja avsändaradress behöver du först verifiera en domän under Inställningar &gt; Domänverifiering.</p>
                            </div>
                          ) : (
                            <div className="w-full">
                              <label className="block text-sm font-medium mb-2">
                                Från avsändare
                              </label>
                              <select
                                className="w-full p-2 border border-default-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                value={selectedSenderId || ""}
                                onChange={handleSenderSelect}
                              >
                                <option value="">Välj avsändare</option>
                                {(senderAddresses || []).map((address) => (
                                  address && address.id ? (
                                    <option key={String(address.id)} value={String(address.id)}>
                                      {address.name ? `${address.name} <${address.email}>` : address.email}
                                      {address.isDefault ? " (Standard)" : ""}
                                    </option>
                                  ) : null
                                ))}
                              </select>
                              {errors.sender && (
                                <p className="text-xs text-danger mt-1">{errors.sender}</p>
                              )}
                            </div>
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
                
                {/* Visa framgångsmeddelande när ett mail har skickats */}
                {sendSuccess && (
                  <div className="mt-4 bg-success-50 border border-success-200 p-3 rounded">
                    <p className="text-success-700 font-medium">Testmail skickat framgångsrikt!</p>
                    <p className="text-success-700 mt-1">
                      Ett mail har skickats till mottagaren. Det kan ta några minuter innan det kommer fram.
                    </p>
                    <p className="text-success-700 text-sm mt-2">
                      Du kan stänga detta fönster eller skicka fler testmail.
                    </p>
                  </div>
                )}
              </ModalBody>
              
              <ModalFooter>
                <Button
                  variant="flat"
                  onPress={() => {
                    if (allowModalClose) {
                      handleCloseModal();
                    }
                  }}
                >
                  Stäng
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
                  Skicka testmail
                </Button>
              </ModalFooter>
            </>
          )}
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