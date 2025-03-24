// components/email/ReplyDomainVerifier.tsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Button,
  Spinner,
  addToast
} from '@heroui/react';
import DnsRecord from '@/components/email/DnsRecord';

interface ReplyDomainVerifierProps {
  replyDomainId: string;
  replyDomain: string;
  dnsRecords?: any[];
  onClose: () => void;
  onVerificationSuccess: () => void;
}

const ReplyDomainVerifier: React.FC<ReplyDomainVerifierProps> = ({
  replyDomainId,
  replyDomain,
  dnsRecords = [],
  onClose,
  onVerificationSuccess
}) => {
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [finalDnsRecords, setFinalDnsRecords] = useState<any[]>(dnsRecords);

  // Om DNS-poster skickades med som prop, använd dem
  useEffect(() => {
    if (dnsRecords && dnsRecords.length > 0) {
      setFinalDnsRecords(dnsRecords);
    }
  }, [dnsRecords]);

  const handleVerifyDomain = async () => {
    try {
      setVerifying(true);
      
      const response = await fetch('/api/mail/domains/verify-reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domainId: replyDomainId
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Fel vid verifiering');
      }
      
      const result = await response.json();
      setVerificationResult(result);
      
      // Om API returnerade DNS-poster och vi inte redan har några, använd dem
      if (result.dnsRecords && result.dnsRecords.length > 0 && finalDnsRecords.length === 0) {
        setFinalDnsRecords(result.dnsRecords);
      }
      
      if (result.verified) {
        addToast({
          title: 'Framgång',
          description: 'Din reply-domän har verifierats!',
          color: 'success',
          variant: 'flat'
        });
        
        // Meddela parent-komponenten om framgång
        if (onVerificationSuccess) {
          onVerificationSuccess();
        }
      } else {
        addToast({
          title: 'Verifiering misslyckades',
          description: result.message || 'Kunde inte verifiera reply-domänen. Kontrollera att DNS-posterna är korrekt konfigurerade.',
          color: 'warning',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid verifiering av reply-domän:', error);
      
      addToast({
        title: 'Fel',
        description: error.message || 'Ett fel inträffade vid verifiering av reply-domänen',
        color: 'danger',
        variant: 'flat'
      });
      
      setVerificationResult({
        verified: false,
        message: error.message || 'Ett fel inträffade vid verifiering'
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">
          Verifiera reply-domän: {replyDomain}
        </h2>
      </CardHeader>
      
      <CardBody>
        <div className="space-y-4">
          <div className="bg-warning-50 border border-warning-200 p-4 rounded">
            <h3 className="text-md font-medium text-warning-700 mb-2">Verifiera din reply-domän</h3>
            <p className="text-sm text-warning-700">
              För att kunna ta emot svar på e-post från kunder behöver du verifiera din reply-domän. 
              Lägg till följande DNS-poster för domänen <strong>{replyDomain}</strong> och klicka sedan på "Verifiera DNS-poster".
            </p>
            <p className="text-sm text-warning-700 mt-2">
              <strong>OBS:</strong> Det här är separata DNS-poster som behövs specifikt för reply-domänen, även om du redan har verifierat huvuddomänen.
            </p>
          </div>
          
          {finalDnsRecords.length === 0 ? (
            <div className="text-center p-4 border rounded">
              <p className="text-default-500">Inga DNS-poster tillgängliga. Försök verifiera för att hämta DNS-poster.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-md font-medium">DNS-poster för reply-domänen</h3>
              {finalDnsRecords.map((record, index) => (
                <DnsRecord key={index} record={record} />
              ))}
            </div>
          )}
          
          {/* Resultat av verifieringen */}
          {verificationResult && (
            <div className={`p-4 rounded-md ${
              verificationResult.verified 
                ? 'bg-success-50 border border-success-200' 
                : 'bg-warning-50 border border-warning-200'
            }`}>
              <h4 className="font-medium text-md">
                {verificationResult.verified 
                  ? '✓ Reply-domänen har verifierats!' 
                  : '⚠️ Reply-domänen kunde inte verifieras'
                }
              </h4>
              <p className="mt-2 text-sm">
                {verificationResult.message || 
                  (verificationResult.verified 
                    ? `Din reply-domän ${replyDomain} är nu verifierad och kan användas för att ta emot svar på e-post.` 
                    : `Kontrollera att alla DNS-poster är korrekt konfigurerade och försök igen.`)
                }
              </p>
            </div>
          )}
          
          <div className="bg-info-50 border border-info-200 p-4 rounded mt-4">
            <h4 className="text-md font-medium text-info-700 mb-2">Varför behöver jag verifiera reply-domänen?</h4>
            <p className="text-sm text-info-700">
              Reply-domänen är nödvändig för att kunder ska kunna svara på e-post från systemet. När en kund svarar på ett mail 
              skickas svaret till en adress på formen ticket-X@{replyDomain}, vilket gör att systemet kan koppla svaret till rätt ärende.
            </p>
            <p className="text-sm text-info-700 mt-2">
              Varje domän och subdomän måste verifieras separat i SendGrid för att förhindra missbruk och säkerställa legitima mailavsändare.
            </p>
          </div>
        </div>
      </CardBody>
      
      <CardFooter>
        <div className="flex justify-between">
          <Button
            variant="flat"
            onPress={onClose}
          >
            Avbryt
          </Button>
          <Button
            color="primary"
            onPress={handleVerifyDomain}
            isLoading={verifying}
            isDisabled={verifying || (verificationResult && verificationResult.verified)}
          >
            {verifying ? 'Verifierar...' : 'Verifiera DNS-poster'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ReplyDomainVerifier;