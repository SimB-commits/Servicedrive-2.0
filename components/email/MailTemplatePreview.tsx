// components/email/MailTemplatePreview.tsx
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
  Spinner,
  Tabs,
  Tab,
  addToast,
} from '@heroui/react';

interface MailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
}

interface MailTemplatePreviewProps {
  templateId: number;
  isOpen: boolean;
  onClose: () => void;
}

const MailTemplatePreview: React.FC<MailTemplatePreviewProps> = ({ 
  templateId, 
  isOpen, 
  onClose 
}) => {
  const [preview, setPreview] = useState<{subject: string; body: string} | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('preview');
  const [template, setTemplate] = useState<MailTemplate | null>(null);
  
  // Testdata för förhandsgranskning
  const [variables, setVariables] = useState({
    ärendeID: '12345',
    kundNamn: 'Anna Andersson',
    kundEmail: 'anna.andersson@example.com',
    ärendeTyp: 'Reparation',
    ärendeStatus: 'Pågående',
    ärendeDatum: new Date().toISOString(),
    företagsNamn: 'Demo Företag AB',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    handläggare: 'Martin Svensson',
    handläggareEmail: 'martin.svensson@example.com',
    gammalStatus: 'Öppen',
    aktuellDatum: new Date().toISOString()
  });

  // Hämta mallen när komponenten laddas
  useEffect(() => {
    if (isOpen && templateId) {
      fetchTemplate();
    }
  }, [isOpen, templateId]);

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch(`/api/mail/templates/${templateId}`);
      if (!res.ok) {
        throw new Error('Kunde inte hämta mailmall');
      }
      
      const data = await res.json();
      setTemplate(data);
      
      // Generera förhandsgranskning direkt
      generatePreview(data);
    } catch (error) {
      console.error('Fel vid hämtning av mall:', error);
      setError('Kunde inte hämta mailmallen');
    } finally {
      setLoading(false);
    }
  };

  // Generera förhandsgranskning baserat på mall och variabler
  const generatePreview = (templateData = template) => {
    if (!templateData) return;
    
    try {
      let subject = templateData.subject;
      let body = templateData.body;
      
      // Ersätt variabler i ämne och brödtext
      Object.entries(variables).forEach(([key, value]) => {
        // Formatera datum om det behövs
        let displayValue = value;
        if (value && typeof value === 'string' && 
            (value.includes('T') || value.includes('Z')) && 
            !isNaN(new Date(value).getTime())) {
          try {
            displayValue = new Date(value).toLocaleDateString('sv-SE');
          } catch (e) {
            // Använd ursprungsvärdet om datum-konvertering misslyckas
          }
        }
        
        // Ersätt alla förekomster av variabeln
        const regex = new RegExp(`{${key}}`, 'g');
        subject = subject.replace(regex, String(displayValue));
        body = body.replace(regex, String(displayValue));
      });
      
      setPreview({ subject, body });
      setError(null);
    } catch (error) {
      console.error('Fel vid generering av förhandsgranskning:', error);
      setError('Kunde inte generera förhandsgranskning');
    }
  };

  // Uppdatera en variabel och generera ny förhandsgranskning
  const updateVariable = (key: string, value: string) => {
    setVariables(prev => {
      const updated = { ...prev, [key]: value };
      return updated;
    });
    
    // Använd setTimeout för att säkerställa att state är uppdaterat
    setTimeout(() => generatePreview(), 0);
  };

  // Skicka ett testmail med aktuella variabler
  const sendTestEmail = async () => {
    try {
      setLoading(true);
      
      const res = await fetch('/api/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId,
          toEmail: variables.kundEmail,
          customVariables: variables
        })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Kunde inte skicka testmail');
      }
      
      addToast({
        title: 'Testmail skickat',
        description: `Mail skickat till ${variables.kundEmail}`,
        color: 'success',
        variant: 'flat'
      });
    } catch (error) {
      console.error('Fel vid skickande av testmail:', error);
      setError(`Kunde inte skicka testmail: ${error.message}`);
      
      addToast({
        title: 'Fel',
        description: error.message || 'Kunde inte skicka testmail',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onClose}
      size="3xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">
              {template ? `Förhandsgranskning: ${template.name}` : 'Laddar mall...'}
            </h2>
          </div>
        </ModalHeader>
        
        <ModalBody>
          {loading && !template ? (
            <div className="flex justify-center items-center py-8">
              <Spinner size="lg" />
            </div>
          ) : error && !template ? (
            <div className="bg-danger-50 border border-danger-200 text-danger p-4 rounded">
              {error}
            </div>
          ) : (
            <>
              <Tabs 
                selectedKey={activeTab}
                onSelectionChange={(key) => setActiveTab(key as string)}
                variant="underlined"
                color="primary"
              >
                <Tab key="preview" title="Förhandsgranskning" />
                <Tab key="variables" title="Testvariabler" />
              </Tabs>
              
              {activeTab === 'preview' && preview && (
                <div className="mt-4">
                  <div className="mb-4">
                    <h3 className="text-md font-medium mb-2">Ämne:</h3>
                    <div className="p-3 border rounded-md bg-default-50">
                      {preview.subject}
                    </div>
                  </div>
                  
                  <h3 className="text-md font-medium mb-2">Innehåll:</h3>
                  <div className="border rounded-md overflow-hidden">
                    <div 
                      className="p-4 bg-white"
                      dangerouslySetInnerHTML={{ __html: preview.body }}
                    />
                  </div>
                  
                  <div className="mt-4 flex justify-between items-center">
                    <p className="text-sm text-default-500">
                      Detta är en förhandsgranskning. Skicka ett testmail för att se exakt hur det kommer att se ut.
                    </p>
                    <Button 
                      color="primary"
                      size="sm"
                      onPress={sendTestEmail}
                      isLoading={loading}
                    >
                      Skicka testmail
                    </Button>
                  </div>
                </div>
              )}
              
              {activeTab === 'variables' && (
                <div className="mt-4 space-y-6">
                  <p className="text-sm">
                    Ändra värdena nedan för att se hur mailmallen ser ut med olika data.
                    Variabler i mallen anges med {'{'} och {'}'}, t.ex. {'{kundNamn}'}.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input 
                      label="Ärende-ID"
                      value={variables.ärendeID}
                      onValueChange={(value) => updateVariable('ärendeID', value)}
                    />
                    
                    <Input 
                      label="Kundnamn"
                      value={variables.kundNamn}
                      onValueChange={(value) => updateVariable('kundNamn', value)}
                    />
                    
                    <Input 
                      label="Kundens e-post"
                      value={variables.kundEmail}
                      onValueChange={(value) => updateVariable('kundEmail', value)}
                    />
                    
                    <Input 
                      label="Ärendetyp"
                      value={variables.ärendeTyp}
                      onValueChange={(value) => updateVariable('ärendeTyp', value)}
                    />
                    
                    <Input 
                      label="Ärendestatus"
                      value={variables.ärendeStatus}
                      onValueChange={(value) => updateVariable('ärendeStatus', value)}
                    />
                    
                    <Input 
                      label="Tidigare status"
                      value={variables.gammalStatus}
                      onValueChange={(value) => updateVariable('gammalStatus', value)}
                    />
                    
                    <Input 
                      label="Handläggare"
                      value={variables.handläggare}
                      onValueChange={(value) => updateVariable('handläggare', value)}
                    />
                    
                    <Input 
                      label="Deadline"
                      type="date"
                      value={variables.deadline ? new Date(variables.deadline).toISOString().split('T')[0] : ''}
                      onValueChange={(value) => {
                        if (value) {
                          updateVariable('deadline', new Date(value).toISOString());
                        }
                      }}
                    />
                    
                    <Input 
                      label="Företagsnamn"
                      value={variables.företagsNamn}
                      onValueChange={(value) => updateVariable('företagsNamn', value)}
                    />
                  </div>
                  
                  <div className="flex justify-end">
                    <Button 
                      color="primary" 
                      onPress={() => generatePreview()}
                    >
                      Uppdatera förhandsgranskning
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </ModalBody>
        
        <ModalFooter>
          <Button 
            variant="flat"
            onPress={onClose}
          >
            Stäng
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default MailTemplatePreview;