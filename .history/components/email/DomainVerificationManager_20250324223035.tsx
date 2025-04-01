// components/email/DomainVerificationManager.tsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Spinner,
  Modal,
  ModalContent,
  addToast
} from '@heroui/react';
import DnsRecord from '@/components/email/DnsRecord';
import DomainVerificationResult from '@/components/email/DomainVerificationResult';

interface DomainVerificationManagerProps {
  onDomainVerified?: () => void;
  onAddNewDomain?: () => void;
}

const DomainVerificationManager: React.FC<DomainVerificationManagerProps> = ({
  onDomainVerified,
  onAddNewDomain
}) => {
  const [domainInput, setDomainInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [setupSuccess, setSetupSuccess] = useState(false);
  const [dnsRecords, setDnsRecords] = useState<any[]>([]);
  const [domainId, setDomainId] = useState<string | null>(null);
  const [domain, setDomain] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [showVerificationResult, setShowVerificationResult] = useState(false);
  
  // Validera domännamnet
  const validateDomain = (domain: string) => {
    return domain.match(/^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/);
  };

  // Starta domänverifieringsprocessen
  const handleSetupDomain = async () => {
    // Validera domännamnet
    if (!validateDomain(domainInput)) {
      addToast({
        title: 'Ogiltigt domännamn',
        description: 'Vänligen ange ett giltigt domännamn (t.ex. example.com)',
        color: 'danger'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/mail/domains/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain: domainInput,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || 'Ett fel inträffade');
      }

      const data = await response.json();
      
      // Spara data från respons
      setDnsRecords(data.dnsRecords || []);
      setDomainId(data.id || null);
      setDomain(data.domain || domainInput);
      setSetupSuccess(true);
      
      addToast({
        title: 'Domänkonfiguration startad',
        description: `DNS-poster har genererats för ${domainInput}`,
        color: 'success'
      });
    } catch (error) {
      console.error('Fel vid setup av domän:', error);
      addToast({
        title: 'Fel',
        description: error.message || 'Ett fel inträffade vid setup av domänen',
        color: 'danger'
      });
      setSetupSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  // Verifiera DNS-posterna
  const handleVerifyDomain = async () => {
    if (!domainId) {
      addToast({
        title: 'Fel',
        description: 'Ingen domän att verifiera',
        color: 'danger'
      });
      return;
    }

    setIsVerifying(true);
    try {
      const response = await fetch(`/api/mail/domains/${domainId}/verify`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || 'Ett fel inträffade vid verifiering');
      }

      const result = await response.json();
      
      // Spara verifieringsresultatet
      setVerificationResult(result);
      setShowVerificationResult(true);
      
      if (result.verified) {
        addToast({
          title: 'Domän verifierad!',
          description: `${domain} har verifierats och en reply-subdomän konfigureras automatiskt`,
          color: 'success'
        });
      } else {
        addToast({
          title: 'Verifiering misslyckades',
          description: 'DNS-posterna kunde inte verifieras. Kontrollera att de är korrekt inställda och vänta några minuter.',
          color: 'warning'
        });
      }
    } catch (error) {
      console.error('Fel vid verifiering av domän:', error);
      addToast({
        title: 'Fel',
        description: error.message || 'Ett fel inträffade vid verifiering av domänen',
        color: 'danger'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Återställ formuläret
  const resetForm = () => {
    setDomainInput('');
    setDnsRecords([]);
    setDomainId(null);
    setDomain('');
    setSetupSuccess(false);
    setVerificationResult(null);
    setShowVerificationResult(false);
  };

  // När verifieringen är klar
  const handleVerificationComplete = () => {
    if (onDomainVerified) {
      onDomainVerified();
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Domänverifiering</h2>
        </CardHeader>
        <CardBody>
          {!setupSuccess ? (
            <div className="space-y-4">
              <div className="bg-info-50 border border-info-200 p-4 rounded">
                <p className="text-sm text-info-700">
                  För att kunna skicka mail från din egen domän behöver du verifiera domänen 
                  genom att lägga till DNS-poster. Detta bevisar att du äger domänen.
                </p>
              </div>
              
              <div className="space-y-4">
                <Input
                  label="Domännamn"
                  placeholder="example.com"
                  value={domainInput}
                  onValueChange={setDomainInput}
                  description="Ange domännamnet du vill verifiera"
                  isDisabled={loading}
                />
                
                <Button
                  color="primary"
                  onPress={handleSetupDomain}
                  isLoading={loading}
                  isDisabled={loading || !domainInput.trim()}
                >
                  Starta verifiering
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-warning-50 border border-warning-200 p-4 rounded">
                <h3 className="text-md font-medium text-warning-700 mb-2">DNS-konfiguration</h3>
                <p className="text-sm text-warning-700">
                  Lägg till följande DNS-poster för din domän <strong>{domain}</strong>. 
                  När du har lagt till alla DNS-poster, klicka på "Verifiera DNS-poster".
                </p>
                <p className="text-sm text-warning-700 mt-2">
                  <strong>OBS:</strong> DNS-ändringar kan ta upp till 48 timmar att spridas, men oftast går det mycket snabbare.
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
              
              <div className="flex justify-between">
                <Button
                  variant="flat"
                  onPress={resetForm}
                  isDisabled={loading || isVerifying}
                >
                  Avbryt
                </Button>
                <Button
                  color="primary"
                  onPress={handleVerifyDomain}
                  isLoading={isVerifying}
                  isDisabled={loading || isVerifying}
                >
                  Verifiera DNS-poster
                </Button>
              </div>
              
              <div className="border-t pt-4 mt-4">
                <h3 className="text-md font-medium mb-2">Automatisk konfiguration av e-postsvar</h3>
                <p className="text-sm">
                  När domänen har verifierats kommer systemet automatiskt att skapa en reply-subdomän 
                  (<strong>reply.{domain}</strong>) för att hantera e-postsvar från kunder. 
                  Detta möjliggör att kundernas svar automatiskt registreras i rätt ärende.
                </p>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
      
      {/* Resultatmodal */}
      <Modal
        isOpen={showVerificationResult}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setShowVerificationResult(false);
            // Om domänen verifierades, återställ formuläret
            if (verificationResult?.verified) {
              resetForm();
            }
          }
        }}
        size="2xl"
      >
        <ModalContent>
          {() => (
            <DomainVerificationResult
              verificationResult={verificationResult}
              domain={domain}
              onClose={() => {
                setShowVerificationResult(false);
                // Om domänen verifierades, återställ formuläret
                if (verificationResult?.verified) {
                  resetForm();
                }
              }}
              onVerified={handleVerificationComplete}
            />
          )}
        </ModalContent>
      </Modal>
    </>
  );
};

export default DomainVerificationManager;