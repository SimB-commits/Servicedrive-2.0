// components/email/DomainVerificationResult.tsx
import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardHeader, 
  CardBody, 
  CardFooter,
  Button,
  addToast
} from '@heroui/react';

interface VerificationResultProps {
  verificationResult: any;
  domain: string;
  onClose: () => void;
  onVerified: () => void;
}

const DomainVerificationResult: React.FC<VerificationResultProps> = ({ 
  verificationResult, 
  domain,
  onClose,
  onVerified
}) => {
  const [replyStatus, setReplyStatus] = useState<'pending' | 'success' | 'error' | null>(null);
  const [replyMessage, setReplyMessage] = useState<string | null>(null);

  // Lyssna på ändringar i verifikationsresultatet
  useEffect(() => {
    if (verificationResult?.verified && verificationResult?.autoReplyDomain) {
      // Om vi har autoReplyDomain i resultatet, kommer en reply-subdomän att skapas
      setReplyStatus('pending');
      setReplyMessage('Skapar automatiskt en reply-subdomän för inkommande mail...');
      
      // Simulera att reply-domänen skapas efter en kort stund
      // I en verklig implementation skulle vi pollra eller använda WebSockets
      const timer = setTimeout(() => {
        setReplyStatus('success');
        setReplyMessage(`En reply-subdomän (reply.${domain}) har skapats automatiskt!`);
        
        // Meddela att verifieringen är klar, inklusive reply-domänen
        if (onVerified) {
          onVerified();
        }
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [verificationResult, domain]);

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">
          Verifieringsresultat för {domain}
        </h3>
      </CardHeader>
      
      <CardBody>
        {/* Domänverifieringsresultat */}
        <div className={`p-4 rounded-md mb-4 ${
          verificationResult?.verified 
            ? 'bg-success-50 border border-success-200' 
            : 'bg-warning-50 border border-warning-200'
        }`}>
          <h4 className={`font-medium ${
            verificationResult?.verified ? 'text-success-700' : 'text-warning-700'
          }`}>
            {verificationResult?.verified
              ? '✓ Domänen har verifierats!'
              : '⚠️ Domänen har inte verifierats än'
            }
          </h4>
          
          <p className={`mt-2 text-sm ${
            verificationResult?.verified ? 'text-success-700' : 'text-warning-700'
          }`}>
            {verificationResult?.verified
              ? `Din domän ${domain} är nu verifierad och kan användas för mailutskick!`
              : `Domänen ${domain} kunde inte verifieras. Kontrollera att DNS-posterna är korrekt inställda och försök igen.`
            }
          </p>
          
          {verificationResult?.verified && (
            <div className="mt-3">
              <p className="text-sm text-success-700">
                Detaljer:
              </p>
              <ul className="list-disc list-inside text-sm text-success-700 mt-1">
                <li>
                  DKIM: {verificationResult.dkimVerified ? 'Verifierad' : 'Ej verifierad'}
                </li>
                <li>
                  SPF: {verificationResult.spfVerified ? 'Verifierad' : 'Ej verifierad'}
                </li>
              </ul>
            </div>
          )}
        </div>
        
        {/* Reply-domän status */}
        {replyStatus && (
          <div className={`p-4 rounded-md mt-4 ${
            replyStatus === 'success' ? 'bg-success-50 border border-success-200' :
            replyStatus === 'error' ? 'bg-danger-50 border border-danger-200' :
            'bg-info-50 border border-info-200'
          }`}>
            <h4 className={`font-medium ${
              replyStatus === 'success' ? 'text-success-700' :
              replyStatus === 'error' ? 'text-danger-700' :
              'text-info-700'
            }`}>
              {replyStatus === 'success' ? '✓ Reply-domän klar!' :
               replyStatus === 'error' ? '✗ Problem med reply-domän' :
               '⟳ Skapar reply-domän...'}
            </h4>
            
            <p className={`mt-2 text-sm ${
              replyStatus === 'success' ? 'text-success-700' :
              replyStatus === 'error' ? 'text-danger-700' :
              'text-info-700'
            }`}>
              {replyMessage}
            </p>
            
            {replyStatus === 'success' && (
              <div className="mt-3">
                <p className="text-sm text-success-700">
                  Du kan nu ta emot automatiska svar från kunder via mail. När kunder svarar på mail 
                  från systemet kommer deras svar automatiskt att registreras i rätt ärende.
                </p>
              </div>
            )}
          </div>
        )}
        
        {/* Information om nästa steg */}
        {verificationResult?.verified && (
          <div className="mt-6 border-t pt-4">
            <h4 className="font-medium mb-2">Vad händer nu?</h4>
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li>
                Du kan nu konfigurera valfri avsändaradress med domänen <strong>{domain}</strong> i systemet
              </li>
              <li>
                En reply-subdomän (<strong>reply.{domain}</strong>) skapas automatiskt för hantering av e-postsvar
              </li>
              <li>
                Verifiera alla mailmallar och testa att skicka e-post
              </li>
            </ul>
          </div>
        )}
      </CardBody>
      
      <CardFooter>
        <div className="flex justify-end">
          <Button
            onPress={onClose}
            color={verificationResult?.verified ? "primary" : "default"}
          >
            {verificationResult?.verified ? "Klart" : "Stäng"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default DomainVerificationResult;