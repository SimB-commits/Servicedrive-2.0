// pages/installningar/domainVerification.tsx
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Card, 
  CardHeader, 
  CardBody, 
  Button, 
  Input, 
  Spinner, 
  Tabs, 
  Tab, 
  Divider,
  addToast
} from '@heroui/react';
import { title } from '@/components/primitives';
import DnsRecord from '@/components/email/DnsRecord';
import DomainVerificationStatus from '@/components/email/DomainVerificationStatus';
import DomainVerificationInfo from '@/components/email/DomainVerificationInfo';
import { Stepper, Step, StepLabel } from '@/components/Stepper';

export default function DomainVerificationPage() {
  const { data: session, status } = useSession();
  const [domain, setDomain] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [needSubdomain, setNeedSubdomain] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verificationData, setVerificationData] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [verifiedDomains, setVerifiedDomains] = useState([]);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [error, setError] = useState('');
  const [subdomainError, setSubdomainError] = useState('');
  const [activeTab, setActiveTab] = useState('verify');

  // Hämta redan verifierade domäner
  useEffect(() => {
    if (status === 'authenticated') {
      fetchVerifiedDomains();
    }
  }, [status]);

  const fetchVerifiedDomains = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/mail/domains');
      if (res.ok) {
        const data = await res.json();
        setVerifiedDomains(data);
      } else {
        console.error('Kunde inte hämta verifierade domäner');
      }
    } catch (error) {
      console.error('Fel vid hämtning av verifierade domäner:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartVerification = async () => {
    setError('');
    setSubdomainError('');
    
    // Validera domän
    if (!domain) {
      setError('Domän krävs');
      return;
    }
    
    // Enkel validering av domänformat
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      setError('Ogiltig domän. Ange ett korrekt domännamn som exempel.se');
      return;
    }
    
    // Validera subdomän om den är angiven
    if (needSubdomain) {
      if (!subdomain) {
        setSubdomainError('Subdomän krävs eftersom denna domän redan är registrerad');
        return;
      }
      
      const subdomainRegex = /^[a-z0-9][a-z0-9\-]{0,61}[a-z0-9]$/;
      if (!subdomainRegex.test(subdomain)) {
        setSubdomainError('Ogiltig subdomän. Använd endast bokstäver (a-z), siffror och bindestreck');
        return;
      }
    }
    
    try {
      setLoading(true);
      const res = await fetch('/api/mail/domains/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          domain,
          subdomain: needSubdomain ? subdomain : undefined
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (data.needSubdomain) {
          // Om domänen redan finns men kan registreras med en anpassad subdomän
          setNeedSubdomain(true);
          setError(data.message || 'Domänen är redan registrerad. Ange en anpassad subdomän.');
          setLoading(false);
          return;
        }
        
        setError(data.error || 'Kunde inte starta verifieringsprocessen');
        setLoading(false);
        return;
      }
      
      setVerificationData(data);
      setActiveStep(1);
      setNeedSubdomain(false);
    } catch (error) {
      console.error('Fel vid start av verifiering:', error);
      setError('Ett fel inträffade vid start av verifieringsprocessen');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!verificationData) return;
    
    try {
      setIsCheckingStatus(true);
      const res = await fetch(`/api/mail/domains/${verificationData.id}/verify`, {
        method: 'POST',
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Kunde inte verifiera domänen');
        return;
      }
      
      if (data.verified) {
        // Om verifieringen lyckades, tvinga uppdatering av domäncachen
        try {
          await fetch('/api/mail/domains/refresh-cache', { 
            method: 'POST' 
          });
          console.log('Domäncache uppdaterad efter lyckad verifiering');
        } catch (cacheError) {
          console.error('Fel vid uppdatering av domäncache:', cacheError);
          // Fortsätt även om cache-uppdateringen misslyckas
        }
        
        addToast({
          title: 'Domän verifierad',
          description: 'Din domän har verifierats framgångsrikt!',
          color: 'success',
          variant: 'flat'
        });
        
        setActiveStep(2);
        // Uppdatera listan med verifierade domäner
        fetchVerifiedDomains();
      } else {
        setError('DNS-inställningarna är ännu inte aktiva. Det kan ta upp till 48 timmar för DNS-ändringar att spridas, men oftast går det fortare. Försök igen om en stund.');
      }
    } catch (error) {
      console.error('Fel vid verifiering:', error);
      setError('Ett fel inträffade vid verifiering av domänen');
    } finally {
      setIsCheckingStatus(false);
    }
  }

  const handleDeleteDomain = async (domainId) => {
    if (!confirm('Är du säker på att du vill ta bort denna domän? Detta kommer att påverka mailutskick från denna domän.')) return;
    
    try {
      const res = await fetch(`/api/mail/domains/${domainId}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        addToast({
          title: 'Domän borttagen',
          description: 'Domänen har tagits bort från ditt konto',
          color: 'success',
          variant: 'flat'
        });
        // Uppdatera listan med verifierade domäner
        fetchVerifiedDomains();
      } else {
        const data = await res.json();
        addToast({
          title: 'Fel',
          description: data.error || 'Kunde inte ta bort domänen',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid borttagning av domän:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid borttagning av domänen',
        color: 'danger',
        variant: 'flat'
      });
    }
  };

  const handleRefreshDomainStatus = async (domainId) => {
    try {
      setError('');
      const res = await fetch(`/api/mail/domains/${domainId}/verify`, {
        method: 'POST',
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Kunde inte verifiera domänen');
        return;
      }
      
      if (data.verified) {
        addToast({
          title: 'Domän verifierad',
          description: 'Din domän har verifierats framgångsrikt!',
          color: 'success',
          variant: 'flat'
        });
        // Uppdatera listan med verifierade domäner
        await fetchVerifiedDomains();
      } else {
        setError('DNS-inställningarna är ännu inte aktiva. Det kan ta upp till 48 timmar för DNS-ändringar att spridas, men oftast går det fortare. Försök igen om en stund.');
      }
    } catch (error) {
      console.error('Fel vid verifiering:', error);
      setError('Ett fel inträffade vid verifiering av domänen');
    }
  };

  const steps = [
    'Ange domän',
    'Uppdatera DNS-inställningar',
    'Bekräfta verifiering'
  ];

  // Funktion för navigering till verifieringsfliken och nollställning av formuläret
  const handleStartNewVerification = () => {
    setActiveTab('verify');
    setActiveStep(0);
    setVerificationData(null);
    setDomain('');
    setSubdomain('');
    setNeedSubdomain(false);
    setError('');
    setSubdomainError('');
  };

  // Rendering för olika steg i processen
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <div className="space-y-6">
            <p>Ange den domän du vill verifiera för att kunna skicka mail från. Detta måste vara en domän som du äger och har tillgång till DNS-inställningarna för.</p>
            
            <Input
              label="Domän"
              placeholder="exempel.se"
              value={domain}
              onValueChange={setDomain}
              isInvalid={!!error && !needSubdomain}
              errorMessage={!needSubdomain ? error : ''}
              className="max-w-md"
            />
            
            {needSubdomain && (
              <div className="mt-4">
                <div className="p-4 bg-warning-50 border border-warning-200 rounded-lg mb-4">
                  <p className="text-sm">{error || 'Denna domän är redan registrerad hos SendGrid. För att kunna använda den behöver du ange en anpassad subdomän.'}</p>
                </div>
                
                <Input
                  label="Subdomän"
                  placeholder="mail2"
                  value={subdomain}
                  onValueChange={setSubdomain}
                  description="Exempel: För subdomänen 'mail2' skapas DKIM-posten som 'mail2._domainkey.dindomän.se'"
                  isInvalid={!!subdomainError}
                  errorMessage={subdomainError}
                  className="max-w-md"
                />
              </div>
            )}
            
            <Button
              color="primary"
              onPress={handleStartVerification}
              isLoading={loading}
              isDisabled={loading || !domain || (needSubdomain && !subdomain)}
            >
              Starta verifiering
            </Button>
          </div>
        );
      
      case 1:
        return (
          <div className="space-y-6">
            <p className="mb-4">
              För att verifiera din domän <strong>{domain}</strong>
              {verificationData?.subdomain && ` (med subdomänen ${verificationData.subdomain})`}, 
              behöver du lägga till följande DNS-poster hos din DNS-leverantör. 
              Detta bevisar för SendGrid att du äger domänen.
            </p>
            
            <div className="bg-warning-50 border border-warning-200 rounded-md p-4 mb-6">
              <h4 className="font-medium text-warning-700">Viktigt att tänka på</h4>
              <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                <li>Det kan ta upp till 48 timmar för DNS-ändringar att spridas över internet</li>
                <li>Du behöver åtkomst till din domäns DNS-inställningar eller kontakta din IT-avdelning</li>
                <li>Befintliga e-postinställningar kommer inte att påverkas av dessa ändringar</li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium">1. CNAME-poster för domänverifiering</h3>
              <div className="space-y-3">
                {verificationData?.dnsRecords?.map((record, index) => (
                  <DnsRecord key={index} record={record} />
                ))}
              </div>
              
              <h3 className="text-lg font-medium mt-6">2. SPF-post för bättre leveranssäkerhet</h3>
              <div className="space-y-3">
                <DnsRecord
                  record={{
                    type: 'TXT',
                    host: '@',
                    data: 'v=spf1 include:sendgrid.net ~all'
                  }}
                />
                <p className="text-sm text-default-600">
                  <strong>Notera:</strong> Om du redan har en SPF-post behöver du lägga till "include:sendgrid.net" i den befintliga posten, inte skapa en ny.
                </p>
              </div>
            </div>
            
            <div className="flex justify-between mt-8">
              <Button 
                variant="flat" 
                onPress={() => setActiveStep(0)}
              >
                Tillbaka
              </Button>
              
              <Button
                color="primary"
                onPress={handleCheckVerification}
                isLoading={isCheckingStatus}
              >
                Kontrollera verifiering
              </Button>
            </div>
            
            {error && (
              <div className="p-3 mt-4 bg-danger-50 border border-danger-200 rounded text-danger">
                {error}
              </div>
            )}
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-6">
            <div className="bg-success-50 border border-success-200 rounded-md p-6 text-center">
              <svg
                className="w-16 h-16 mx-auto text-success"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <h3 className="text-xl font-medium mt-4 text-success-700">Domänen är verifierad!</h3>
              <p className="mt-2">
                Din domän <strong>{domain}</strong> har verifierats framgångsrikt och är redo att användas för mailutskick.
              </p>
            </div>
            
            <div className="mt-6">
              <h3 className="text-lg font-medium">Vad händer nu?</h3>
              <p className="mt-2">
                Du kan nu skicka mail från vilken adress som helst @{domain}. Gå till:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Card className="p-4 bg-primary-50 border border-primary-200">
                  <h4 className="font-medium">Avsändarinställningar</h4>
                  <p className="text-sm mt-1">Konfigurera avsändaradresser för att använda din nya domän</p>
                  <Button 
                    color="primary" 
                    variant="flat"
                    size="sm"
                    className="mt-3"
                    onPress={() => window.location.href = '/mailmallar?tab=settings'}
                  >
                    Hantera avsändare
                  </Button>
                </Card>

                <Card className="p-4 bg-primary-50 border border-primary-200">
                  <h4 className="font-medium">Test-verktyg</h4>
                  <p className="text-sm mt-1">Testa din nya domän med testverktyget för mail</p>
                  <Button 
                    color="primary"
                    size="sm"
                    className="mt-3"
                    onPress={() => window.location.href = '/test-mail'}
                  >
                    Testa mail
                  </Button>
                </Card>
              </div>
            </div>
            
            <div className="flex justify-between mt-8">
              <Button 
                variant="flat" 
                className="mt-4"
                onPress={() => setActiveTab('domains')}
              >
                Visa alla domäner
              </Button>
              <Button 
                variant="solid"
                color="primary"
                onPress={handleStartNewVerification}
              >
                Verifiera en ny domän
              </Button>
            </div>
          </div>
        );
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!session || session.user.role !== 'ADMIN') {
    return (
      <div className="py-8">
        <Card>
          <CardBody>
            <p>Åtkomst nekad. Du måste vara inloggad som administratör.</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <Tabs 
        aria-label="Domänverifiering" 
        selectedKey={activeTab}
        onSelectionChange={key => setActiveTab(key as string)}
      >
        <Tab key="verify" title="Verifiera domän">
          <div className="max-w-4xl mx-auto mt-8">
            <h1 className={title({ size: 'sm' })}>Domänverifiering för mail</h1>
            <p className="text-default-600 mt-2 mb-6">
              Verifiera din domän för att kunna skicka mail från ditt företags e-postadresser och förbättra leveranssäkerheten.
            </p>
            
            <Card className="mb-6">
              <CardBody>
                <Stepper activeStep={activeStep} alternativeLabel>
                  {steps.map((label) => (
                    <Step key={label}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
                
                <div className="mt-8">
                  {renderStepContent()}
                </div>
              </CardBody>
            </Card>
          </div>
        </Tab>
        
        <Tab key="domains" title="Hanterade domäner">
          <div className="max-w-4xl mx-auto mt-8">
            <h1 className={title({ size: 'sm' })}>Verifierade domäner</h1>
            <p className="text-default-600 mt-2 mb-6">
              Här ser du alla domäner du har verifierat och kan hantera dem.
            </p>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Vänstra delen (75% bredd på större skärmar) */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Verifierade domäner</h2>
                    <Button 
                      color="primary" 
                      onPress={handleStartNewVerification}
                    >
                      Lägg till domän
                    </Button>
                  </CardHeader>
                  <CardBody>
                    {loading ? (
                      <div className="py-8 text-center">
                        <Spinner />
                        <p className="mt-2 text-default-500">Laddar domäner...</p>
                      </div>
                    ) : verifiedDomains.length === 0 ? (
                      <div className="py-8 text-center">
                        <p className="text-default-500">Inga verifierade domäner än</p>
                        <p className="text-sm text-default-400 mt-1 mb-4">
                          Du har servicedrive.se som standarddomän, men du kan lägga till egna domäner
                        </p>
                        <Button 
                          color="primary" 
                          onPress={handleStartNewVerification}
                        >
                          Verifiera din första domän
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {verifiedDomains.map((domain) => (
                          <DomainVerificationStatus 
                            key={domain.id} 
                            domain={domain} 
                            onDelete={() => handleDeleteDomain(domain.id)}
                            onRefreshStatus={
                              domain.verified ? undefined : () => handleRefreshDomainStatus(domain.id)
                            }
                          />
                        ))}
                      </div>
                    )}
                  </CardBody>
                </Card>
                
                {verifiedDomains.length > 0 && verifiedDomains.some(d => !d.verified) && (
                  <div className="mt-4 p-4 bg-info-50 border border-info-200 rounded-md">
                    <h3 className="text-md font-medium text-info-700">Väntar på verifiering?</h3>
                    <p className="text-sm text-info-600 mt-1">
                      Domäner som väntar på verifiering behöver ha korrekta DNS-inställningar. 
                      Klicka på "Uppdatera status" för att kontrollera om DNS-posterna är aktiva.
                    </p>
                  </div>
                )}
              </div>
              
              {/* Högra delen (25% bredd på större skärmar) - Informationsruta */}
              <div className="lg:col-span-1">
                <DomainVerificationInfo onAddNewClick={handleStartNewVerification} />
              </div>
            </div>
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}