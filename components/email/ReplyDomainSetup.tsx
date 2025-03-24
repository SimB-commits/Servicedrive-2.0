// components/email/ReplyDomainSetup.tsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Spinner,
  Divider,
  Tabs,
  Tab,
  addToast
} from '@heroui/react';
import { Stepper, Step, StepLabel } from '@/components/Stepper';
import DnsRecord from '@/components/email/DnsRecord';

interface DomainVerificationInfoProps {
  domains: any[];
  onSetupReplyComplete: () => void;
  onError: (message: string) => void;
}

const ReplyDomainSetup: React.FC<DomainVerificationInfoProps> = ({
  domains,
  onSetupReplyComplete,
  onError
}) => {
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [replySubdomain, setReplySubdomain] = useState('reply');
  const [dnsRecords, setDnsRecords] = useState<any[]>([]);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);

  // Filtrera och formatera domäner (exkludera reply-subdomäner som kanske redan finns)
  const eligibleDomains = domains.filter(domain => 
    !domain.domain.startsWith('reply.') && domain.verified
  );

  // Skapa reply-domänen
  const handleSetupReplyDomain = async () => {
    if (!selectedDomain) {
      onError('Vänligen välj en domän');
      return;
    }

    try {
      setLoading(true);
      
      // Hitta den valda domänen från listan
      const domain = eligibleDomains.find(d => d.domain === selectedDomain);
      if (!domain) {
        throw new Error('Vald domän hittades inte');
      }

      // Skapa en reply-subdomän för denna domän
      const response = await fetch('/api/mail/domains/setup-reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parentDomainId: domain.id,
          subdomain: replySubdomain,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Kunde inte konfigurera reply-domän');
      }

      const data = await response.json();
      
      setDnsRecords(data.dnsRecords || []);
      setVerifyingDomainId(data.id || null);
      setActiveStep(1); // Gå till nästa steg

    } catch (error) {
      console.error('Fel vid konfigurering av reply-domän:', error);
      onError(error.message || 'Ett fel inträffade vid konfigurering av reply-domänen');
    } finally {
      setLoading(false);
    }
  };

  // Verifiera reply-domänen
  const verifyReplyDomain = async () => {
    if (!verifyingDomainId) {
      onError('Ingen domän att verifiera');
      return;
    }

    try {
      setLoading(true);
      setVerificationStatus('pending');
      setVerificationMessage('Verifierar DNS-inställningar...');

      const response = await fetch(`/api/mail/domains/${verifyingDomainId}/verify`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        setVerificationStatus('error');
        setVerificationMessage(errorData.error || 'Kunde inte verifiera domänen');
        throw new Error(errorData.error || 'Kunde inte verifiera domänen');
      }

      const data = await response.json();
      
      if (data.verified) {
        setVerificationStatus('success');
        setVerificationMessage('Domänen har verifierats!');
        setActiveStep(2); // Gå till sista steget
        
        // Uppdatera webhook-adressen i SendGrid
        try {
          const webhookResponse = await fetch('/api/mail/inbound-webhook/setup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              domainId: verifyingDomainId,
            }),
          });
          
          if (!webhookResponse.ok) {
            const webhookError = await webhookResponse.json();
            console.error('Webhook-konfigurering misslyckades:', webhookError);
            // Vi fortsätter ändå eftersom domänen är verifierad
          }
        } catch (webhookError) {
          console.error('Fel vid konfigurering av webhook:', webhookError);
          // Vi fortsätter ändå eftersom domänen är verifierad
        }
        
        // Meddela parent-komponenten att konfigureringen är klar
        onSetupReplyComplete();
      } else {
        setVerificationStatus('error');
        setVerificationMessage('Domänen kunde inte verifieras. Kontrollera att DNS-posterna är korrekt inställda.');
      }
    } catch (error) {
      console.error('Fel vid verifiering av domän:', error);
      setVerificationStatus('error');
      setVerificationMessage(error.message || 'Ett fel inträffade vid verifiering av domänen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Konfigurera mailsvar-domän</h2>
        <p className="text-default-500 text-sm">
          Konfigurera en subdomän för att ta emot svar på ärenden via mail
        </p>
      </CardHeader>
      
      <CardBody>
        <Stepper activeStep={activeStep} alternativeLabel>
          <Step>
            <StepLabel>Välj domän och subdomän</StepLabel>
          </Step>
          <Step>
            <StepLabel>Konfigurera DNS</StepLabel>
          </Step>
          <Step>
            <StepLabel>Bekräfta och aktivera</StepLabel>
          </Step>
        </Stepper>
        
        <div className="mt-8">
          {activeStep === 0 && (
            <div className="space-y-6">
              <div className="bg-info-50 border border-info-200 p-4 rounded">
                <h3 className="text-md font-medium text-info-700 mb-2">Information</h3>
                <p className="text-sm text-info-700">
                  För att kunna ta emot svar på e-postmeddelanden via systemet behöver du 
                  konfigurera en subdomän för svar (t.ex. <strong>reply.dindomän.se</strong>).
                  Detta möjliggör att kundsvar automatiskt kan spåras och läggas in i rätt ärende.
                </p>
              </div>
              
              <div>
                <Select
                  label="Välj domän"
                  placeholder="Välj en verifierad domän"
                  selectedKeys={selectedDomain ? [selectedDomain] : []}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  isDisabled={loading}
                >
                  {eligibleDomains.map((domain) => (
                    <SelectItem key={domain.domain} value={domain.domain}>
                      {domain.domain}
                    </SelectItem>
                  ))}
                </Select>
                
                <p className="text-xs text-default-500 mt-1">
                  Du kan bara välja en domän som redan är verifierad i systemet.
                </p>
              </div>
              
              <div>
                <Input
                  label="Subdomän för svar"
                  value={replySubdomain}
                  onValueChange={setReplySubdomain}
                  placeholder="reply"
                  description="Denna subdomän kommer att användas för att ta emot svar (t.ex. reply.dindomän.se)"
                  isDisabled={loading}
                />
              </div>
              
              <div className="text-right">
                <Button
                  color="primary"
                  onPress={handleSetupReplyDomain}
                  isLoading={loading}
                  isDisabled={loading || !selectedDomain || !replySubdomain}
                >
                  Fortsätt
                </Button>
              </div>
            </div>
          )}
          
          {activeStep === 1 && (
            <div className="space-y-6">
              <div className="bg-warning-50 border border-warning-200 p-4 rounded">
                <h3 className="text-md font-medium text-warning-700 mb-2">DNS-konfiguration</h3>
                <p className="text-sm text-warning-700">
                  Lägg till följande DNS-poster för din domän <strong>{replySubdomain}.{selectedDomain}</strong>. 
                  För att mail-svar ska fungera måste du lägga till en MX-post som pekar till SendGrid.
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-md font-medium">DNS-poster</h3>
                
                {dnsRecords.length > 0 ? (
                  <div className="space-y-4">
                    {dnsRecords.map((record, index) => (
                      <DnsRecord key={index} record={record} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-default-500">Inga DNS-poster hittades</p>
                  </div>
                )}
              </div>
              
              <Divider />
              
              <div className="flex justify-between">
                <Button
                  variant="flat"
                  onPress={() => setActiveStep(0)}
                  isDisabled={loading}
                >
                  Tillbaka
                </Button>
                <Button
                  color="primary"
                  onPress={verifyReplyDomain}
                  isLoading={loading}
                  isDisabled={loading}
                >
                  Verifiera DNS-poster
                </Button>
              </div>
              
              {verificationStatus === 'error' && (
                <div className="bg-danger-50 border border-danger-200 p-3 rounded mt-4">
                  <p className="text-sm text-danger-600">{verificationMessage}</p>
                </div>
              )}
            </div>
          )}
          
          {activeStep === 2 && (
            <div className="space-y-6">
              <div className="bg-success-50 border border-success-200 p-4 rounded">
                <h3 className="text-md font-medium text-success-700 mb-2">Konfiguration slutförd!</h3>
                <p className="text-sm text-success-700">
                  Din mailsvarsdomän <strong>{replySubdomain}.{selectedDomain}</strong> har verifierats 
                  och konfigurerats för inkommande mail. Nu kan kunder svara på mail och deras svar kommer 
                  automatiskt att registreras i rätt ärende.
                </p>
              </div>
              
              <div className="p-4 border rounded">
                <h3 className="text-md font-medium mb-3">Vad händer nu?</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Systemet kommer automatiskt att använda denna domän för Reply-To i utgående mail</li>
                  <li>Inkommande svar från kunder kommer att sparas på rätt ärende</li>
                  <li>Notifikationer skickas till handläggare när kunder svarar</li>
                  <li>Allt fungerar automatiskt utan ytterligare konfiguration</li>
                </ol>
              </div>
              
              <div className="text-right">
                <Button
                  color="primary"
                  onPress={onSetupReplyComplete}
                >
                  Klart
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

export default ReplyDomainSetup;