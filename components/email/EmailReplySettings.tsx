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
  Spinner,
  Divider,
  Tooltip,
  Chip
} from '@heroui/react';

interface EmailReplySettingsProps {
  className?: string;
  onSettingsUpdated?: () => void;
}

const EmailReplySettings: React.FC<EmailReplySettingsProps> = ({ 
  className,
  onSettingsUpdated 
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [useSharedDomain, setUseSharedDomain] = useState(true);
  const [domainSetting, setDomainSetting] = useState('');
  const [currentDomain, setCurrentDomain] = useState('');
  const [verifiedDomains, setVerifiedDomains] = useState<string[]>([]);
  const [replyDomains, setReplyDomains] = useState<string[]>([]);
  const [validationError, setValidationError] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [autoConfigured, setAutoConfigured] = useState(false);
  const [justConfigured, setJustConfigured] = useState(false);

  // Hämta nuvarande inställningar och verifierade domäner
  useEffect(() => {
    fetchSettings();
    fetchVerifiedDomains();
  }, []);

  // Kontrollera om något har ändrats för att aktivera spara-knappen
  useEffect(() => {
    if (useSharedDomain) {
      setHasChanges(currentDomain !== 'reply.servicedrive.se');
    } else {
      // Om egen domän används, kolla om den har ändrats
      setHasChanges(
        domainSetting.trim() !== '' && 
        domainSetting.trim().toLowerCase() !== currentDomain.toLowerCase()
      );
    }
  }, [useSharedDomain, domainSetting, currentDomain]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setValidationError('');
      
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
            // Om domänen börjar med "reply." och inte är den delade domänen, markera som automatiskt konfigurerad
            if (data.replyDomain.startsWith('reply.') && data.autoConfigured) {
              setAutoConfigured(true);
              
              // Kontrollera om användaren kommer från domänverifiering genom att kolla URL-parametrar
              const urlParams = new URLSearchParams(window.location.search);
              if (urlParams.get('justConfigured') === 'true') {
                setJustConfigured(true);
                // Rensa parametern från URL för att undvika upprepning vid uppdatering
                window.history.replaceState({}, document.title, window.location.pathname);
              }
            }
          }
        } else {
          // Om inget svar, använd standardinställningar
          setUseSharedDomain(true);
          setCurrentDomain('reply.servicedrive.se');
        }
      } else {
        const errorData = await res.json();
        addToast({
          title: 'Fel',
          description: errorData.error || 'Kunde inte hämta e-postinställningar',
          color: 'danger',
          variant: 'flat'
        });
        
        // Standardvärden om vi inte kan hämta inställningar
        setUseSharedDomain(true);
        setCurrentDomain('reply.servicedrive.se');
      }
    } catch (error) {
      console.error('Fel vid hämtning av inställningar:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid hämtning av e-postinställningar',
        color: 'danger',
        variant: 'flat'
      });
      
      // Standardvärden
      setUseSharedDomain(true);
      setCurrentDomain('reply.servicedrive.se');
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
        
        // Sortera domänerna i reguljära domäner och reply-domäner
        const regular: string[] = [];
        const reply: string[] = [];
        
        data.forEach((d: any) => {
          const domain = d.domain.toLowerCase();
          if (domain.startsWith('reply.')) {
            reply.push(domain);
          } else {
            regular.push(domain);
          }
        });
        
        setVerifiedDomains(regular);
        setReplyDomains(reply);
      } else {
        console.error('Kunde inte hämta verifierade domäner');
      }
    } catch (error) {
      console.error('Fel vid hämtning av verifierade domäner:', error);
    }
  };

  const validateDomain = (domain: string): boolean => {
    // Trimma och konvertera till lowercase för konsistent validering
    const normalizedDomain = domain.trim().toLowerCase();
    
    if (!normalizedDomain || normalizedDomain === 'reply.servicedrive.se') {
      // Standarddomänen är alltid giltig
      setValidationError('');
      return true;
    }
    
    // Kontrollera om domänen har reply-prefix
    if (!normalizedDomain.startsWith('reply.')) {
      setValidationError('Svarsdomänen måste börja med "reply."');
      return false;
    }
    
    // Kontrollera om hela reply-domänen är verifierad
    if (replyDomains.includes(normalizedDomain)) {
      setValidationError('');
      return true;
    }
    
    // Extrahera basdomänen (ta bort reply.)
    const baseDomain = normalizedDomain.substring(6); // "reply.".length = 6
    
    // Kontrollera om basdomänen är verifierad
    if (verifiedDomains.includes(baseDomain)) {
      setValidationError('');
      return true;
    }
    
    // Om inget av ovanstående, är domänen ogiltig
    setValidationError(`Domänen '${normalizedDomain}' är inte verifierad. Endast verifierade domäner kan användas för e-postsvar.`);
    return false;
  };

  const handleSaveSettings = async () => {
    try {
      // Bestäm vilket domänvärde som ska sparas
      const domainToSave = useSharedDomain 
        ? 'reply.servicedrive.se' 
        : (domainSetting.trim() || currentDomain);
      
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
        const data = await res.json();
        
        // Uppdatera current domain med den faktiska domänen från API:et
        setCurrentDomain(data.replyDomain);
        setHasChanges(false);
        
        // Om nya domänen inte är den delade och inte är samma som tidigare, återställ autoConfigured
        if (data.replyDomain !== 'reply.servicedrive.se' && data.replyDomain !== currentDomain) {
          setAutoConfigured(data.autoConfigured || false);
        }
        
        addToast({
          title: 'Framgång',
          description: 'E-postinställningar sparade',
          color: 'success',
          variant: 'flat'
        });
        
        // Meddela parent om uppdateringen
        if (onSettingsUpdated) {
          onSettingsUpdated();
        }
      } else {
        const error = await res.json();
        throw new Error(error.message || error.error || 'Kunde inte spara inställningar');
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

  // Renderar en lista med tillgängliga domäner
  const renderAvailableDomains = () => {
    if (verifiedDomains.length === 0 && replyDomains.length === 0) {
      return (
        <p className="text-xs text-warning-500 mt-1">
          Inga verifierade domäner hittades. Du måste först verifiera en domän under Domänverifiering.
        </p>
      );
    }
    
    return (
      <div className="mt-2">
        <p className="text-xs text-default-500 mb-1">Tillgängliga svarsdomäner:</p>
        <div className="flex flex-wrap gap-1">
          {replyDomains.map(domain => (
            <Chip 
              key={domain}
              className="cursor-pointer"
              color="primary"
              variant="flat"
              size="sm"
              onClick={() => setDomainSetting(domain)}
            >
              {domain}
              {autoConfigured && domain === currentDomain && (
                <span className="ml-1 text-xs text-success-700">✓</span>
              )}
            </Chip>
          ))}
          
          {verifiedDomains.map(domain => (
            <Tooltip content={`Klicka för att använda reply.${domain}`}>
              <Chip 
                key={domain}
                className="cursor-pointer"
                color="default"
                variant="flat"
                size="sm"
                onClick={() => setDomainSetting(`reply.${domain}`)}
              >
                {domain} → reply.{domain}
              </Chip>
            </Tooltip>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">E-postsvarsinställningar</h2>
          {autoConfigured && (
            <Chip color="success" variant="flat" size="sm">
              Automatiskt konfigurerad
            </Chip>
          )}
        </div>
      </CardHeader>
      
      <CardBody>
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Spinner />
            <span className="ml-2">Laddar inställningar...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Visa en mer framträdande notis om domänen just har konfigurerats */}
            {justConfigured && (
              <div className="bg-success-50 border border-success-200 p-4 rounded mb-4">
                <h3 className="text-lg font-medium text-success-700 mb-1">Svarsdomän skapad automatiskt!</h3>
                <p className="text-sm text-success-700">
                  En svarsdomän har skapats automatiskt för din verifierade domän. Detta gör att
                  kunders svar på e-post kan kopplas till rätt ärende automatiskt. Nedan kan du se och
                  hantera den konfigurerade svarsdomänen.
                </p>
              </div>
            )}
          
            <div className="flex items-start space-x-3">
              <Switch 
                isSelected={useSharedDomain}
                onValueChange={(selected) => {
                  setUseSharedDomain(selected);
                  // Rensa validationError när man växlar
                  setValidationError('');
                }}
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
                  description={autoConfigured ? "Denna svarsdomän konfigurerades automatiskt när du verifierade huvuddomänen" : "Domänen måste vara verifierad i systemet och börja med 'reply.'"}
                  isDisabled={useSharedDomain}
                  isInvalid={!!validationError}
                  errorMessage={validationError}
                />
                
                {renderAvailableDomains()}
              </div>
            )}

            <Divider className="my-4" />
            
            {autoConfigured ? (
              <div className="bg-success-50 border border-success-200 p-3 rounded text-success-700">
                <p className="text-sm">
                  <strong>Automatiskt konfigurerad:</strong> Reply-domänen har skapats och 
                  konfigurerats automatiskt när du verifierade huvuddomänen. Systemet är nu 
                  redo att ta emot e-postsvar från dina kunder.
                </p>
              </div>
            ) : (
              <div className="bg-info-50 border border-info-200 p-3 rounded text-info-700">
                <p className="text-sm">
                  <strong>Information:</strong> Du kan använda vårt delade system för e-postsvar 
                  utan någon ytterligare konfiguration, eller välja en egen reply-domän som 
                  skapats automatiskt när du verifierade en domän.
                </p>
              </div>
            )}
            
            <div className="mt-4">
              <p className="text-sm text-default-500">
                <strong>Nuvarande svarsdomän:</strong> <span className="font-mono">{currentDomain || 'reply.servicedrive.se'}</span>
              </p>
              <p className="text-xs text-default-400 mt-1">
                Detta är domänen som används i Reply-To adressen för utgående e-post.
                När kunder svarar på mail kommer deras svar att gå till denna domän och hanteras av systemet.
              </p>
            </div>
          </div>
        )}
      </CardBody>
      
      <CardFooter>
        <div className="flex justify-between w-full">
          <Button 
            variant="flat" 
            onPress={fetchSettings} 
            isDisabled={loading || saving}
          >
            Återställ
          </Button>
          
          <Button 
            color="primary" 
            onPress={handleSaveSettings}
            isLoading={saving}
            isDisabled={saving || loading || (!useSharedDomain && !!validationError) || !hasChanges}
          >
            Spara inställningar
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default EmailReplySettings;