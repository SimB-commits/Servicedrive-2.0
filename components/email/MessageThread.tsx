// components/email/MessageThread.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  CardHeader, 
  CardBody, 
  CardFooter, 
  Textarea, 
  Button, 
  Spinner, 
  Divider,
  addToast,
  useDisclosure,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input
} from '@heroui/react';
import { useSession } from 'next-auth/react';
import DOMPurify from 'dompurify';
/* import MessageTestTools from './MessageTestTools'; */

interface Message {
  id: number;
  content: string;
  senderId: string | null;
  ticketId: number;
  createdAt: string;
  isFromCustomer: boolean;
  emailSubject?: string;
  emailFrom?: string;
  emailTo?: string;
  sender?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  } | null;
}

interface Ticket {
  id: number;
  customer: {
    id: number;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

interface MessageThreadProps {
  ticket: Ticket;
  initialMessages?: Message[];
  onMessageSent?: () => void;
}

const MessageThread: React.FC<MessageThreadProps> = ({ 
  ticket, 
  initialMessages = [],
  onMessageSent
}) => {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(initialMessages.length === 0);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [testMailContent, setTestMailContent] = useState('');
  const [testMailSubject, setTestMailSubject] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Skapa en memoized version av fetchMessages för att kunna använda i useEffect
  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tickets/${ticket.id}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      } else {
        console.error('Kunde inte hämta meddelanden');
        addToast({
          title: 'Fel',
          description: 'Kunde inte hämta meddelandehistorik',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid hämtning av meddelanden:', error);
    } finally {
      setLoading(false);
    }
  }, [ticket.id]);

  // Hämta meddelanden när komponenten laddas eller när ticket ändras
  useEffect(() => {
    if (initialMessages.length === 0) {
      fetchMessages();
    }
    
    // Sätt upp automatisk uppdatering av meddelanden var 30:e sekund
    /*const interval = setInterval(() => {
      fetchMessages();
    }, 30000); // 30 sekunder
    
    setRefreshInterval(interval);*/
    
    // Städa upp intervallet när komponenten unmountas
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [ticket.id, fetchMessages, initialMessages.length]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      setSending(true);
      const response = await fetch(`/api/tickets/${ticket.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newMessage,
          sendEmail: true, // Skicka även mail till kunden
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Lägg till det nya meddelandet i listan
        setMessages(prev => [data, ...prev]);
        // Återställ formuläret
        setNewMessage('');
        
        addToast({
          title: 'Framgång',
          description: 'Meddelande skickat till kunden',
          color: 'success',
          variant: 'flat'
        });
        
        // Meddela parent-komponenten att ett meddelande har skickats
        if (onMessageSent) {
          onMessageSent();
        }
      } else {
        const error = await response.json();
        addToast({
          title: 'Fel',
          description: error.message || 'Kunde inte skicka meddelande',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid skickande av meddelande:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid skickande av meddelandet',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setSending(false);
    }
  };

  // Skicka testmail för utvecklingssyfte
  const handleSendTestMail = async () => {
    if (!testMailContent.trim()) return;

    try {
      setSendingTest(true);
      const response = await fetch(`/api/webhooks/test-inbound-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketId: ticket.id,
          content: testMailContent,
          subject: testMailSubject || `Test: Ärende #${ticket.id}`,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        addToast({
          title: 'Framgång',
          description: 'Testmail simulerat och sparat som ett kundmeddelande',
          color: 'success',
          variant: 'flat'
        });
        
        // Hämta meddelanden igen för att få det nya meddelandet
        fetchMessages();
        
        // Stäng modalen och återställ formuläret
        onClose();
        setTestMailContent('');
        setTestMailSubject('');
      } else {
        const error = await response.json();
        addToast({
          title: 'Fel',
          description: error.message || 'Kunde inte simulera testmail',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid simulering av testmail:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid simulering av testmail',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setSendingTest(false);
    }
  };

  // Formatera avsändarnamn
  const formatSenderName = (message: Message) => {
    if (message.isFromCustomer) {
      return `${ticket.customer.firstName || ''} ${ticket.customer.lastName || ''}`.trim() || 
             ticket.customer.email || 'Kund';
    } else if (message.sender) {
      return `${message.sender.firstName || ''} ${message.sender.lastName || ''}`.trim() || 
             message.sender.email || 'Handläggare';
    } else {
      return 'System';
    }
  };

  // Formatera datum
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('sv-SE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  };

  // Sanera HTML-innehåll för säker rendering
  const sanitizeHtml = (html: string) => {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'span', 'div'],
      ALLOWED_ATTR: ['href', 'class', 'style'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button']
    });
  };

  return (
    <>
      <Card className="w-full">
      <CardHeader className="px-6 py-4 flex justify-between items-center">
        <h2 className="text-lg font-medium">Meddelanden</h2>
        <div className="flex gap-2">
          {/* Visa endast TestMail-knappen i utvecklingsmiljö eller för admin-användare */}
          {/* {(process.env.NODE_ENV !== 'production' || session?.user?.role === 'ADMIN') && (
            <MessageTestTools 
              ticketId={ticket.id}
              onTestComplete={fetchMessages}
            />
          )} */}
          <Button 
            size="sm" 
            color="primary" 
            variant="flat"
            onPress={fetchMessages}
          >
            Uppdatera
          </Button>
        </div>
      </CardHeader>
        
        <CardBody className="px-6 py-4">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Spinner />
              <span className="ml-2">Laddar meddelanden...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-default-500">Inga meddelanden ännu</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div 
                  key={message.id}
                  className={`p-4 border rounded-lg ${
                    message.isFromCustomer 
                      ? 'bg-default-50 border-default-200'
                      : 'bg-primary-50 border-primary-200'
                  }`}
                >
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">
                      {formatSenderName(message)}
                    </span>
                    <span className="text-default-500 text-sm">
                      {formatDate(message.createdAt)}
                    </span>
                  </div>
                  
                  {message.emailSubject && (
                    <p className="text-sm text-default-600 mb-2">
                      <strong>Ämne:</strong> {message.emailSubject}
                    </p>
                  )}
                  
                  {/* Visa information om mail source i utvecklingsläge */}
                  {process.env.NODE_ENV !== 'production' && session?.user?.role === 'ADMIN' && message.isFromCustomer && (
                    <div className="text-xs text-default-400 mb-2 p-1 bg-default-100 rounded">
                      {message.emailFrom && <span>Från: {message.emailFrom} </span>}
                      {message.emailTo && <span>Till: {message.emailTo} </span>}
                      {message.id && <span>ID: {message.id}</span>}
                    </div>
                  )}
                  
                  {/* Visa innehållet på ett säkert sätt med sanitering */}
                  {message.content.includes('<') && message.content.includes('>') ? (
                    <div 
                      className="mt-2 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.content) }}
                    />
                  ) : (
                    <p className="mt-2 whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
        
        <Divider />
        
        <CardFooter className="flex flex-col px-6 py-4">
          <div className="w-full">
            <Textarea
              label="Nytt meddelande"
              placeholder="Skriv ett svar till kunden..."
              value={newMessage}
              onValueChange={setNewMessage}
              minRows={3}
              maxRows={10}
            />
            
            <div className="flex justify-between items-center mt-3">
              <p className="text-xs text-default-500">
                Meddelandet kommer att skickas som ett mail till kunden.
              </p>
              
              <Button
                color="primary"
                onPress={handleSendMessage}
                isLoading={sending}
                isDisabled={sending || !newMessage.trim()}
              >
                Skicka meddelande
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>

      {/* Modal för att simulera kundmail (endast för utveckling) 
      <Modal isOpen={isOpen} onOpenChange={onClose}>
        <ModalContent>
          <ModalHeader>Simulera kundmail</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-500 mb-4">
              Detta är ett testverktyg för att simulera inkommande mail från en kund.
              Meddelandet sparas direkt i databasen som om det vore ett riktigt mail.
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
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>Avbryt</Button>
            <Button 
              color="warning" 
              onPress={handleSendTestMail}
              isLoading={sendingTest}
              isDisabled={sendingTest || !testMailContent.trim()}
            >
              Simulera kundmail
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal> */}
    </>
  );
};

export default MessageThread;