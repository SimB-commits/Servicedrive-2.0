// components/email/EmailReplySettings.tsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Switch,
  Input,
  Button,
  addToast,
  Spinner
} from '@heroui/react';

interface EmailReplySettingsProps {
  className?: string;
}

const EmailReplySettings: React.FC<EmailReplySettingsProps> = ({ className }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [useSharedDomain, setUseSharedDomain] = useState(true);
  const [domainSetting, setDomainSetting] = useState('');
  const [currentDomain, setCurrentDomain] = useState('');
  const [verifiedDomains, setVerifiedDomains] = useState<string[]>([]);
  const [validationError, setValidationError] = useState('');

  // Hämta nuvarande inställningar och verifierade domäner
  useEffect(() => {
    fetchSettings();
    fetchVerifiedDomains();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      
      // Hämta inställningar från API
      const res = await fetch('/api/settings/email');
      if (res.ok) {
        const data = await res.json();
        
        if (data.replyDomain) {
          // Kontrollera om den delade domänen används
          const isSharedDomain = data.replyDomain === 'reply.servicedrive.se';
          setUseSharedDomain(isSharedDomain);
          setCurrentDomain(data.replyDomain);
          
          // Om det är en egen domän, visa den i inställningen
          if (!isSharedDomain) {
            setDomainSetting(data.replyDomain);
          }
        }
      } else {
        // Om inget svar, använd standardinställningar
        setUseSharedDomain(true);
        setCurrentDomain('reply.servicedrive.se');
      }
    } catch (error) {
      console.error('Fel vid hämtning av inställningar:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVerifiedDomains = async () => {
    try {
      // Hämta alla verifierade domäner för butiken
      const res = await fetch('/api/mail/domains');
      if (res.ok) {
        const data = await res.json();
        
        // Extrahera domännamnen från svaret
        const domains = data.map((d: any) => d.domain.toLowerCase());
        setVerifiedDomains(domains);
      }
    } catch (error) {
      console.error('Fel vid hämtning av verifierade domäner:', error);
    }
  };

  const validateDomain = (domain: string): boolean => {
    if (!domain || domain === 'reply.servicedrive.se') {
      // Standarddomänen är alltid giltig
      setValidationError('');
      return true;
    }
    
    // Kontrollera om domänen har reply-prefix
    if (!domain.startsWith('reply.')) {
      setValidationError('Svarsdomänen måste börja med "reply."');
      return false;
    }
    
    // Extrahera basdomänen (ta bort reply.)
    const baseDomain = domain.substring(6); // "reply.".length = 6
    
    // Kontrollera om basdomänen eller den fullständiga domänen är verifierad
    if (verifiedDomains.includes(domain) || verifiedDomains.includes(baseDomain)) {
      setValidationError('');
      return true;
    }
    
    // Om inget av ovanstående, är domänen ogiltig
    setValidationError(`Domänen '${domain}' är inte verifierad. Endast verifierade domäner kan användas för e-postsvar.`);
    return false;
  };

  const handleSaveSettings = async () => {
    try {
      // Bestäm vilket domänvärde som ska sparas
      const domainToSave = useSharedDomain 
        ? 'reply.servicedrive.se' 
        : (domainSetting || currentDomain);
      
      // Validera domänen innan vi sparar
      if (!useSharedDomain && !validateDomain(domainToSave)) {
        addToast({
          title: 'Ogiltig domän',
          description: validationError || 'Domänen måste vara verifierad för att användas',
          color: 'danger',
          variant: 'flat'
        });
        return;
      }
      
      setSaving(true);
      
      // Spara inställningar via API
      const res = await fetch('/api/settings/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          replyDomain: domainToSave
        })
      });
      
      if (res.ok) {
        // Uppdatera current domain
        setCurrentDomain(domainToSave);
        
        addToast({
          title: 'Framgång',
          description: 'E-postinställningar sparade',
          color: 'success',
          variant: 'flat'
        });
      } else {
        const error = await res.json();
        throw new Error(error.message || 'Kunde inte spara inställningar');
      }
    } catch (error) {
      console.error('Fel vid sparande av inställningar:', error);
      
      addToast({
        title: 'Fel',
        description: error.message || 'Ett fel inträffade vid sparande av inställningarna',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <h2 className="text-lg font-semibold">E-postsvarsinställningar</h2>
      </CardHeader>
      
      <CardBody>
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Spinner />
            <span className="ml-2">Laddar inställningar...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Switch 
                isSelected={useSharedDomain}
                onValueChange={setUseSharedDomain}
              />
              <div>
                <h3 className="text-md font-medium">Använd delad svarsdomän</h3>
                <p className="text-sm text-default-500">
                  Aktivera för att använda vår delade svarsdomän (reply.servicedrive.se)
                  för inkommande e-postsvar. Detta kräver ingen extra konfiguration.
                </p>
              </div>
            </div>

            {!useSharedDomain && (
              <div className="ml-7 mt-2 border-l-2 pl-4 border-default-200">
                <Input
                  label="Egen svarsdomän"
                  placeholder="t.ex. reply.dindomän.se"
                  value={domainSetting}
                  onValueChange={(val) => {
                    setDomainSetting(val);
                    validateDomain(val);
                  }}
                  description="Domänen måste vara verifierad i systemet"
                  isDisabled={useSharedDomain}
                  isInvalid={!!validationError}
                  errorMessage={validationError}
                />
                {verifiedDomains.length > 0 ? (
                  <div className="mt-2">
                    <p className="text-xs text-default-500 mb-1">Verifierade domäner:</p>
                    <div className="flex flex-wrap gap-1">
                      {verifiedDomains.map(domain => (
                        <span key={domain} className="text-xs bg-default-100 px-2 py-1 rounded">
                          {domain}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-warning-500 mt-1">
                    Inga verifierade domäner hittades. Du måste först verifiera en domän under Domänverifiering.
                  </p>
                )}
              </div>
            )}

            <div className="bg-success-50 border border-success-200 p-3 rounded text-success-700">
              <p className="text-sm">
                <strong>Förenkling:</strong> Du kan använda vårt delade system för e-postsvar 
                utan någon ytterligare konfiguration. Detta innebär att kunder som svarar på 
                mail från systemet kommer använda vår domän reply.servicedrive.se.
              </p>
            </div>
            
            <div className="mt-4">
              <p className="text-sm text-default-500">
                <strong>Nuvarande svarsdomän:</strong> {currentDomain || 'reply.servicedrive.se'}
              </p>
            </div>
          </div>
        )}
      </CardBody>
      
      <CardFooter>
        <Button 
          color="primary" 
          onPress={handleSaveSettings}
          isLoading={saving}
          isDisabled={saving || loading || (!useSharedDomain && !!validationError)}
        >
          Spara inställningar
        </Button>
      </CardFooter>
    </Card>
  );
};

export default EmailReplySettings;