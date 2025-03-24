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

  // Hämta nuvarande inställningar
  useEffect(() => {
    fetchSettings();
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

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      
      // Bestäm vilket domänvärde som ska sparas
      const domainToSave = useSharedDomain 
        ? 'reply.servicedrive.se' 
        : (domainSetting || currentDomain);
      
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
                  onValueChange={setDomainSetting}
                  description="Kräver DNS-konfiguration. Använd endast om du har verifierat din domän."
                  isDisabled={useSharedDomain}
                />
                <p className="text-xs text-warning-500 mt-1">
                  OBS: För att använda egen svarsdomän måste du konfigurera DNS-poster.
                  Kontakta support för instruktioner.
                </p>
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
          isDisabled={saving || loading}
        >
          Spara inställningar
        </Button>
      </CardFooter>
    </Card>
  );
};

export default EmailReplySettings;