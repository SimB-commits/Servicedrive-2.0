// components/email/DomainVerificationResult.tsx
import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardHeader, 
  CardBody, 
  CardFooter,
  Button,
  Modal,
  ModalContent,
  addToast,
  Divider
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
  const [replyDomainVerifierOpen, setReplyDomainVerifierOpen] = useState(false);
  const [replyVerified, setReplyVerified] = useState(false);
  
  // Generera reply-domännamnet
  const replyDomain = `reply.${domain}`;

  // Hantera reply-domänverifieringsresultat
  useEffect(() => {
    if (verificationResult?.verified && verificationResult?.replyDomainInfo) {
      // Om det finns info om reply-domänen, visa popup om den behöver verifieras
      const replyInfo = verificationResult.replyDomainInfo;
      
      // Om status är verified, markera reply-domänen som verifierad
      if (replyInfo.status === 'verified') {
        setReplyVerified(true);
      } 
      // Annars, om det är pending, öppna reply-domänverifieraren automatiskt efter en kort fördröjning
      else if (replyInfo.status === 'pending') {
        setTimeout(() => {
          setReplyDomainVerifierOpen(true);
        }, 1000);
      }
    }
  }, [verificationResult]);

  const handleReplyVerificationSuccess = () => {
    setReplyVerified(true);
    setReplyDomainVerifierOpen(false);
    
    addToast({
      title: 'Framgång',
      description: 'Både domänen och reply-domänen har verifierats!',
      color: 'success',
      variant: 'flat'
    });
    
    // Meddela att hela verifieringen är klar
    if (onVerified) {
      onVerified();
    }
  };

  return (
    <>
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
          
          {/* Separator */}
          {verificationResult?.verified && (
            <Divider className="my-4" />
          )}
          
          {/* Reply-domän status - bara om huvuddomänen är verifierad */}
          {verificationResult?.verified && (
            <div className={`p-4 rounded-md ${
              replyVerified 
                ? 'bg-success-50 border border-success-200' 
                : 'bg-warning-50 border border-warning-200'
            }`}>
              <h4 className={`font-medium text-lg ${
                replyVerified ? 'text-success-700' : 'text-warning-700'
              }`}>
                {replyVerified 
                  ? '✓ Reply-domän verifierad!' 
                  : '⚠️ Reply-domänen behöver verifieras'
                }
              </h4>
              
              <p className={`mt-2 text-sm ${
                replyVerified ? 'text-success-700' : 'text-warning-700'
              }`}>
                {replyVerified
                  ? `Din reply-domän ${replyDomain} är nu verifierad och kan användas för att ta emot svar på e-post!`
                  : `För att kunna ta emot svar på e-post behöver du verifiera reply-domänen ${replyDomain}. Detta kräver ytterligare DNS-konfiguration.`
                }
              </p>
              
              {/* Extra information till användaren för att vara tydlig */}
              {!replyVerified && (
                <div className="mt-2 text-sm text-warning-700">
                  <p><strong>Varför behöver jag detta?</strong> Reply-domänen används för att hantera svar på e-postmeddelanden som skickas från systemet. 
                  När en kund svarar på ett e-postmeddelande behöver svaret gå till denna domän så att systemet kan koppla svaret till rätt ärende.</p>
                  
                  <p className="mt-2"><strong>Vad behöver jag göra?</strong> Du behöver lägga till ytterligare DNS-poster specifikt för reply-domänen. 
                  Klicka på knappen nedan för att se vilka DNS-poster som behövs.</p>
                </div>
              )}
              
              {!replyVerified && (
                <div className="mt-3">
                  <Button 
                    color="primary" 
                    size="sm"
                    onPress={() => setReplyDomainVerifierOpen(true)}
                  >
                    Verifiera reply-domän
                  </Button>
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
                {replyVerified ? (
                  <li>
                    Din reply-domän (<strong>{replyDomain}</strong>) är verifierad och kan användas för att ta emot e-postsvar
                  </li>
                ) : (
                  <li>
                    <strong>För att kunna ta emot svar</strong>, verifiera reply-domänen <strong>{replyDomain}</strong> (ny DNS-konfiguration krävs)
                  </li>
                )}
                <li>
                  Verifiera alla mailmallar och testa att skicka e-post
                </li>
                <li>
                  Gå till E-postsvarsinställningar för att konfigurera hur svar ska hanteras
                </li>
              </ul>
            </div>
          )}
        </CardBody>
        
        <CardFooter>
          <div className="flex justify-end">
            {verificationResult?.verified && replyVerified ? (
              <Button
                color="primary"
                onPress={() => {
                  onClose();
                  // Meddela att hela verifieringen är klar
                  if (onVerified) {
                    onVerified();
                  }
                }}
              >
                Klart
              </Button>
            ) : verificationResult?.verified ? (
              <div className="flex gap-2">
                <Button
                  variant="flat"
                  onPress={onClose}
                >
                  Skjut upp reply-verifiering
                </Button>
                <Button
                  color="primary"
                  onPress={() => setReplyDomainVerifierOpen(true)}
                >
                  Verifiera reply-domän
                </Button>
              </div>
            ) : (
              <Button
                onPress={onClose}
              >
                Stäng
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
      
      
    </>
  );
};

export default DomainVerificationResult;