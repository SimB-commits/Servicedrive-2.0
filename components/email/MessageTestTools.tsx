// components/email/MessageTestTools.tsx
import React, { useState } from 'react';
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Textarea,
  Spinner,
  Switch,
  addToast,
  Divider
} from '@heroui/react';

interface MessageTestToolsProps {
  ticketId: number;
  onTestComplete?: () => void;
}

const MessageTestTools: React.FC<MessageTestToolsProps> = ({ ticketId, onTestComplete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [testMailContent, setTestMailContent] = useState('');
  const [testMailSubject, setTestMailSubject] = useState('');
  const [sendNotification, setSendNotification] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSendTestMail = async () => {
    if (!testMailContent.trim()) return;

    try {
      setSending(true);
      setResult(null);
      
      const response = await fetch(`/api/webhooks/test-inbound-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketId,
          content: testMailContent,
          subject: testMailSubject || `Test: Ärende #${ticketId}`,
          testNotification: sendNotification
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
        
        addToast({
          title: 'Framgång',
          description: 'Testmail simulerat och sparat som ett kundmeddelande',
          color: 'success',
          variant: 'flat'
        });
        
        // Anropa callback om den finns
        if (onTestComplete) {
          onTestComplete();
        }
      } else {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Kunde inte simulera testmail');
      }
    } catch (error) {
      console.error('Fel vid simulering av testmail:', error);
      setResult({ error: error.message || 'Ett okänt fel inträffade' });
      
      addToast({
        title: 'Fel',
        description: error.message || 'Ett fel inträffade vid simulering av testmail',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    // Återställ formuläret efter stängning
    setTimeout(() => {
      setTestMailContent('');
      setTestMailSubject('');
      setResult(null);
    }, 300);
  };

  return (
    <>
      <Button 
        size="sm" 
        color="warning" 
        variant="flat"
        onPress={() => setIsOpen(true)}
      >
        Testa kundmeddelande
      </Button>

      <Modal isOpen={isOpen} onOpenChange={handleClose} size="2xl">
        <ModalContent>
          <ModalHeader>Simulera kundmeddelande och notifikation</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-700 mb-4">
              Detta testverktyg simulerar ett inkommande mail från en kund och testar även notifieringsmail
              till handläggare. Meddelandet sparas direkt i databasen som om det vore ett riktigt mail.
            </p>
            
            <Input
              label="Ämne"
              placeholder="Re: Ärende #123"
              value={testMailSubject}
              onValueChange={setTestMailSubject}
              className="mb-3"
            />
            
            <Textarea
              label="Meddelande"
              placeholder="Skriv ett testmeddelande som om det vore från kunden..."
              value={testMailContent}
              onValueChange={setTestMailContent}
              minRows={5}
              className="mb-3"
            />
            
            <div className="flex items-center mb-3">
              <Switch
                isSelected={sendNotification}
                onValueChange={setSendNotification}
                className="mr-2"
              />
              <span>Testa även notifikationsmail till handläggare</span>
            </div>
            
            {result && (
              <>
                <Divider className="my-3" />
                <div className={`p-4 rounded-md ${result.error ? 'bg-danger-50' : 'bg-success-50'}`}>
                  <h3 className="font-medium mb-2">Testresultat</h3>
                  
                  {result.error ? (
                    <p className="text-danger-700">{result.error}</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-success-700">
                        Kundmeddelande simulerat och sparat i databasen med ID: {result.messageId}
                      </p>
                      
                      {result.notificationResult && (
                        <div className="mt-2">
                            <p className="font-medium">Notifikationsresultat:</p>
                            {result.notificationResult.success ? (
                            <ul className="list-disc list-inside text-sm space-y-1 ml-1 mt-1">
                                <li>Notifikation skickad till: {result.notificationResult.truncatedRecipient}</li>
                                <li>Mottagartyp: {
                                result.notificationResult.recipientType === 'assigned_user' ? 'Tilldelad handläggare' :
                                result.notificationResult.recipientType === 'store_default_sender' ? 'Butikens standardavsändare' :
                                result.notificationResult.recipientType === 'ticket_creator' ? 'Ärendets skapare' : 
                                result.notificationResult.recipientType === 'current_user' ? 'Nuvarande användare (endast vid test)' :
                                'Okänd'
                                }</li>
                                <li>Mail-ID: {result.notificationResult.messageId}</li>
                            </ul>
                            ) : (
                            <p className="text-warning-700">
                                {result.notificationResult.reason || result.notificationResult.error || 'Kunde inte skicka notifikation'}
                            </p>
                            )}
                        </div>
                        )}
                    </div>
                  )}
                </div>
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={handleClose}>Stäng</Button>
            <Button 
              color="warning" 
              onPress={handleSendTestMail}
              isLoading={sending}
              isDisabled={sending || !testMailContent.trim()}
            >
              Simulera kundmail
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default MessageTestTools;