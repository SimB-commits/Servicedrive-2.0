// pages/test-mail.tsx
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Card, 
  CardHeader, 
  CardBody, 
  CardFooter, 
  Input, 
  Button, 
  Spinner,
  Tabs,
  Tab,
  Select,
  SelectItem,
  Divider,
  addToast
} from '@heroui/react';

interface SenderAddress {
  email: string;
  name?: string;
  default?: boolean;
  isVerified: boolean;
}

export default function TestMailPage() {
  const { data: session, status } = useSession();
  const [email, setEmail] = useState('');
  const [selectedTab, setSelectedTab] = useState('existing');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [customSenderEmail, setCustomSenderEmail] = useState('');
  const [customSenderName, setCustomSenderName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSenders, setLoadingSenders] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [senderAddresses, setSenderAddresses] = useState<SenderAddress[]>([]);
  const [createNewAddress, setCreateNewAddress] = useState(false);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // Hämta verifierade avsändaradresser när sidan laddas
  useEffect(() => {
    if (status === 'authenticated') {
      fetchSenderAddresses();
    }
  }, [status]);

  const fetchSenderAddresses = async () => {
    try {
      setLoadingSenders(true);
      const res = await fetch('/api/mail/sender-addresses');
      if (res.ok) {
        const data = await res.json();
        setSenderAddresses(data);
        
        // Välj standardadressen om den finns
        const defaultAddress = data.find((addr: SenderAddress) => addr.default);
        if (defaultAddress) {
          setSenderEmail(defaultAddress.email);
          setSenderName(defaultAddress.name || '');
        } else if (data.length > 0) {
          setSenderEmail(data[0].email);
          setSenderName(data[0].name || '');
        }
      } else {
        console.error('Kunde inte hämta avsändaradresser');
      }
    } catch (error) {
      console.error('Fel vid hämtning av avsändaradresser:', error);
    } finally {
      setLoadingSenders(false);
    }
  };

  const handleSaveSenderAddress = async () => {
    try {
      setCreateError(null);
      setCreateSuccess(null);
      setLoading(true);
      
      const res = await fetch('/api/mail/sender-addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: customSenderEmail,
          name: customSenderName || undefined,
          isDefault: saveAsDefault
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setCreateError(data.error || data.message || 'Kunde inte spara avsändaradressen');
      } else {
        setCreateSuccess('Avsändaradressen sparades!');
        setCustomSenderEmail('');
        setCustomSenderName('');
        setSaveAsDefault(false);
        setCreateNewAddress(false);
        
        // Uppdatera listan med avsändaradresser
        await fetchSenderAddresses();
        
        // Ställ in den nya adressen som aktiv
        setSenderEmail(data.email);
        setSenderName(data.name || '');
        setSelectedTab('existing');
      }
    } catch (error) {
      setCreateError('Ett oväntat fel inträffade: ' + (error.message || 'Okänt fel'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      // Använd vald avsändaradress baserat på vilken flik som är aktiv
      const fromEmail = selectedTab === 'existing' ? senderEmail : customSenderEmail;
      const fromName = selectedTab === 'existing' ? senderName : customSenderName;
      
      const response = await fetch('/api/test/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          to: email || session?.user?.email,
          from: fromEmail,
          fromName: fromName || undefined
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || data.message || 'Ett fel inträffade vid skickande av testmail');
        if (data.details) {
          setError(`${data.error}: ${data.details}`);
        }
      } else {
        setResult(data);
        addToast({
          title: 'Framgång',
          description: 'Testmail skickat!',
          color: 'success',
          variant: 'flat'
        });
      }
    } catch (err) {
      setError('Ett oväntat fel inträffade: ' + (err.message || 'Okänt fel'));
    } finally {
      setLoading(false);
    }
  };
  
  const handleSelectSender = (address: SenderAddress) => {
    setSenderEmail(address.email);
    setSenderName(address.name || '');
  };
  
  // Kontrollera om användaren är inloggad och är admin
  if (status === 'loading') {
    return <div className="flex justify-center items-center h-screen"><Spinner /></div>;
  }
  
  if (!session || session.user.role !== 'ADMIN') {
    return (
      <div className="flex justify-center items-center h-screen">
        <Card className="w-full max-w-md">
          <CardBody>
            <h1 className="text-xl font-bold mb-4">Tillgång nekad</h1>
            <p>Du måste vara inloggad som administratör för att använda detta verktyg.</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <h1 className="text-xl font-bold">SendGrid Test Verktyg</h1>
          <p className="text-sm text-default-500">
            Skicka ett testmail för att verifiera din SendGrid-konfiguration
          </p>
        </CardHeader>
        
        <CardBody>
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-medium mb-2">Mottagare</h2>
              <Input
                label="Mottagarens e-postadress"
                placeholder={`Din e-post (${session.user.email})`}
                value={email}
                onValueChange={setEmail}
                description="Lämna tomt för att skicka till dig själv"
              />
            </div>
            
            <Divider />
            
            <div>
              <h2 className="text-lg font-medium mb-2">Avsändare</h2>
              
              <Tabs 
                selectedKey={selectedTab}
                onSelectionChange={(key) => setSelectedTab(key as string)}
                variant="underlined"
                color="primary"
                className="mb-4"
              >
                <Tab key="existing" title="Välj avsändaradress" />
                <Tab key="custom" title="Använd anpassad adress" />
              </Tabs>
              
              {selectedTab === 'existing' && (
                <div className="space-y-4">
                  {loadingSenders ? (
                    <div className="py-8 text-center">
                      <Spinner size="sm" />
                      <p className="mt-2 text-sm text-default-500">Laddar avsändaradresser...</p>
                    </div>
                  ) : senderAddresses.length === 0 ? (
                    <div className="py-4 text-center">
                      <p className="text-default-500">Inga avsändaradresser konfigurerade</p>
                      <Button 
                        size="sm" 
                        color="primary" 
                        variant="flat" 
                        className="mt-2"
                        onPress={() => setSelectedTab('custom')}
                      >
                        Skapa ny avsändaradress
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-2">
                        {senderAddresses.map((address) => (
                          <div 
                            key={address.email}
                            className={`p-3 rounded-md border cursor-pointer transition-colors ${
                              senderEmail === address.email 
                                ? 'border-primary bg-primary-50' 
                                : 'border-default-200 hover:bg-default-100'
                            }`}
                            onClick={() => handleSelectSender(address)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{address.name || address.email}</p>
                                <p className="text-xs text-default-500">{address.email}</p>
                              </div>
                              {address.default && (
                                <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                                  Standard
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <Button 
                        size="sm" 
                        variant="flat" 
                        className="mt-2"
                        onPress={() => setCreateNewAddress(true)}
                      >
                        Lägg till ny avsändaradress
                      </Button>
                    </>
                  )}
                  
                  {createNewAddress && (
                    <Card className="mt-4">
                      <CardBody>
                        <h3 className="text-md font-medium mb-3">Lägg till ny avsändaradress</h3>
                        
                        <div className="space-y-3">
                          <Input
                            label="E-postadress"
                            placeholder="no-reply@exempeldoman.se"
                            value={customSenderEmail}
                            onValueChange={setCustomSenderEmail}
                            isRequired
                          />
                          
                          <Input
                            label="Visningsnamn"
                            placeholder="Mitt Företag"
                            value={customSenderName}
                            onValueChange={setCustomSenderName}
                            description="Valfritt namn som visas som avsändare"
                          />
                          
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="saveAsDefault"
                              checked={saveAsDefault}
                              onChange={(e) => setSaveAsDefault(e.target.checked)}
                              className="mr-2"
                            />
                            <label htmlFor="saveAsDefault">
                              Använd som standardadress
                            </label>
                          </div>
                          
                          {createError && (
                            <div className="p-2 bg-danger-50 border border-danger-200 rounded text-danger text-sm">
                              {createError}
                            </div>
                          )}
                          
                          {createSuccess && (
                            <div className="p-2 bg-success-50 border border-success-200 rounded text-success text-sm">
                              {createSuccess}
                            </div>
                          )}
                          
                          <div className="flex gap-2 justify-end mt-3">
                            <Button 
                              size="sm"
                              variant="flat"
                              onPress={() => setCreateNewAddress(false)}
                            >
                              Avbryt
                            </Button>
                            <Button 
                              size="sm"
                              color="primary"
                              onPress={handleSaveSenderAddress}
                              isLoading={loading}
                              isDisabled={!customSenderEmail}
                            >
                              Spara avsändaradress
                            </Button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  )}
                </div>
              )}
              
              {selectedTab === 'custom' && (
                <div className="space-y-4">
                  <Input
                    label="Avsändaradress"
                    placeholder="no-reply@exempeldoman.se"
                    value={customSenderEmail}
                    onValueChange={setCustomSenderEmail}
                    description="Måste vara från en verifierad domän"
                    isRequired
                  />
                  
                  <Input
                    label="Visningsnamn"
                    placeholder="Mitt Företag"
                    value={customSenderName}
                    onValueChange={setCustomSenderName}
                    description="Valfritt namn som visas som avsändare"
                  />
                  
                  <div className="bg-primary-50 border border-primary-200 rounded p-3 mt-3">
                    <p className="text-sm">
                      <strong>OBS:</strong> Avsändaradressen måste vara från en verifierad domän. 
                      Verifierade domäner: {process.env.SENDGRID_VERIFIED_DOMAINS?.split(',').join(', ') || 'Inga konfigurerade'}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {error && (
              <div className="p-3 bg-danger-50 border border-danger-200 rounded text-danger text-sm">
                <strong>Fel:</strong> {error}
              </div>
            )}
            
            {result && (
              <div className="p-3 bg-success-50 border border-success-200 rounded text-success text-sm">
                <strong>Framgång!</strong> Testmail skickat till {result.details.recipient} 
                <p className="mt-1">Från: {result.details.sender}</p>
                {result.details.messageId && <p className="text-xs mt-1">Message ID: {result.details.messageId}</p>}
              </div>
            )}
          </div>
        </CardBody>
        
        <CardFooter>
          <Button 
            color="primary" 
            className="w-full" 
            onPress={handleSendTest}
            isLoading={loading}
            isDisabled={loading || (selectedTab === 'existing' && !senderEmail) || (selectedTab === 'custom' && !customSenderEmail)}
          >
            Skicka testmail
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}