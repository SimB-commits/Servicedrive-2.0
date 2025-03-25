// components/email/ReplyDomainVerifier.tsx
import React, { useState, useEffect, useRef } from 'react';
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
  const [loadingDnsRecords, setLoadingDnsRecords] = useState(dnsRecords.length === 0);
  const hasFetchedRecords = useRef(false); // Använd useRef för att spåra om vi redan har hämtat poster

  // Ändrad useEffect för att undvika loopar
  useEffect(() => {
    // Om vi redan har DNS-poster, använd dem
    if (dnsRecords && dnsRecords.length > 0) {
      setFinalDnsRecords(dnsRecords);
      setLoadingDnsRecords(false);
      hasFetchedRecords.current = true; // Markera att vi har poster
    } 
    // Annars, hämta poster ENDAST om vi inte redan har gjort det
    else if (replyDomainId && !hasFetchedRecords.current) {
      hasFetchedRecords.current = true; // Markera INNAN anrop för att undvika dubbla anrop
      fetchDnsRecords();
    }
  }, [replyDomainId]); // Ta bort dnsRecords från dependency array

  // Funktion för att hämta DNS-poster (lägg till debounce)
  const fetchDnsRecords = async () => {
    // Om vi redan laddar, avbryt för att undvika dubbla anrop
    if (loadingDnsRecords) return;
    
    try {
      setLoadingDnsRecords(true);
      
      // Anropa en GET-endpoint för att hämta DNS-poster
      // Alternativt, använd POST men utan att faktiskt försöka verifiera
      const response = await fetch('/api/mail/domains/verify-reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domainId: replyDomainId,
          onlyFetchDns: true // Sätt en flagga att vi bara vill hämta DNS-poster
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Kunde inte hämta DNS-poster');
      }
      
      const result = await response.json();
      
      // Om vi fick DNS-poster, använd dem
      if (result.dnsRecords && result.dnsRecords.length > 0) {
        setFinalDnsRecords(result.dnsRecords);
      } else {
        // Annars generera fallback DNS-poster
        const fallbackRecords = generateFallbackDnsRecords(replyDomain);
        setFinalDnsRecords(fallbackRecords);
        console.warn('Inga DNS-poster returnerades från API, använder fallback-poster');
      }
    } catch (error) {
      console.error('Fel vid hämtning av DNS-poster:', error);
      // Generera fallback DNS-poster vid fel
      const fallbackRecords = generateFallbackDnsRecords(replyDomain);
      setFinalDnsRecords(fallbackRecords);
    } finally {
      setLoadingDnsRecords(false);
    }
  };

  // Generera fallback DNS-poster om API inte svarar korrekt
  const generateFallbackDnsRecords = (domain: string) => {
    return [
      {
        type: 'MX',
        host: domain,
        data: 'mx.sendgrid.net',
        priority: 10,
        name: 'För hantering av inkommande mail'
      },
      {
        type: 'TXT',
        host: domain,
        data: 'v=spf1 include:sendgrid.net ~all',
        name: 'SPF-post för mailautentisering'
      },
      {
        type: 'CNAME',
        host: `em.${domain}`,
        data: 'u17504275.wl.sendgrid.net', // Kan behöva ändras beroende på SendGrid-konfiguration
        name: 'För verifiering av subdomän'
      }
    ];
  };

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
        // Även om det är ett felmeddelande, kolla om det returnerar DNS-poster
        if (errorData.dnsRecords && errorData.dnsRecords.length > 0) {
          setFinalDnsRecords(errorData.dnsRecords);
        }
        throw new Error(errorData.error || errorData.message || 'Fel vid verifiering');
      }
      
      const result = await response.json();
      setVerificationResult(result);
      
      // Uppdatera DNS-posterna om vi fick nya
      if (result.dnsRecords && result.dnsRecords.length > 0) {
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
          
          {loadingDnsRecords ? (
            <div className="flex justify-center items-center p-6">
              <Spinner size="sm" />
              <p className="ml-2">Hämtar DNS-poster...</p>
            </div>
          ) : finalDnsRecords.length === 0 ? (
            <div className="text-center p-4 border rounded">
              <p className="text-default-500">Inga DNS-poster tillgängliga. Försök verifiera för att hämta DNS-poster.</p>
              <Button 
                color="primary" 
                size="sm" 
                className="mt-2"
                onPress={fetchDnsRecords}
              >
                Hämta DNS-poster
              </Button>
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
                    : `Kontrollera att alla DNS-poster är korrekt konfigurerade och försök igen. Det kan ta upp till 48 timmar för DNS-ändringar att spridas.`)
                }
              </p>
            </div>
          )}
          
          <div className="bg-info-50 border border-info-200 p-4 rounded mt-4">
            <h4 className="text-md font-medium text-info-700 mb-2">Tips för framgångsrik verifiering</h4>
            <ul className="list-disc list-inside text-sm text-info-700 space-y-1">
              <li>Lägg till alla DNS-poster exakt som de visas ovan</li>
              <li>För MX-posten, var noga med att ange prioriteten (10)</li>
              <li>DNS-ändringar kan ta mellan några minuter och 48 timmar att spridas</li>
              <li>Kontrollera med din DNS-leverantör om du är osäker på hur du lägger till poster</li>
              <li>Se till att du lägger till posterna för <strong>{replyDomain}</strong>, inte för huvuddomänen</li>
            </ul>
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
            isDisabled={verifying || loadingDnsRecords || (verificationResult && verificationResult.verified)}
          >
            {verifying ? 'Verifierar...' : 'Verifiera DNS-poster'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ReplyDomainVerifier;