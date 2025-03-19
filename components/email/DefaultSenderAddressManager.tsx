// components/email/DefaultSenderAddressManager.tsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Select,
  SelectItem,
  Input,
  Switch,
  Divider,
  Spinner,
  addToast
} from '@heroui/react';

interface SenderAddress {
  id: number;
  email: string;
  name?: string;
  isDefault: boolean;
  isVerified: boolean;
}

interface DefaultSenderAddressManagerProps {
  title?: string;
  description?: string;
  className?: string;
  onAddressUpdated?: () => void;
}

const DefaultSenderAddressManager: React.FC<DefaultSenderAddressManagerProps> = ({
  title = "Standardavsändare för e-post",
  description = "Ange vilken avsändaradress som ska användas för automatiska utskick.",
  className = "",
  onAddressUpdated
}) => {
  const [senderAddresses, setSenderAddresses] = useState<SenderAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  
  const [showAddNew, setShowAddNew] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [makeNewDefault, setMakeNewDefault] = useState(true);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Hämta avsändaradresser när komponenten laddas
  useEffect(() => {
    fetchSenderAddresses();
  }, []);

  const fetchSenderAddresses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch('/api/mail/sender-addresses');
      
      if (res.ok) {
        const data = await res.json();
        
        // Filtrera bort eventuella ogiltiga addresses (null/undefined)
        const validAddresses = Array.isArray(data) 
          ? data.filter((addr): addr is SenderAddress => 
              addr !== null && addr !== undefined && typeof addr === 'object' && addr.id !== undefined
            )
          : [];
        
        setSenderAddresses(validAddresses);
        
        // Välj standardadressen om den finns
        const defaultAddress = validAddresses.find(addr => addr && addr.isDefault);
        if (defaultAddress && defaultAddress.id !== undefined) {
          setSelectedAddressId(String(defaultAddress.id));
        } else if (validAddresses.length > 0 && validAddresses[0]?.id !== undefined) {
          setSelectedAddressId(String(validAddresses[0].id));
        }
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Kunde inte hämta avsändaradresser');
      }
    } catch (error) {
      console.error('Fel vid hämtning av avsändaradresser:', error);
      setError('Ett oväntat fel inträffade vid hämtning av avsändaradresser');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefaultAddress = async () => {
    if (!selectedAddressId) return;
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      // Hitta den valda adressen
      const selectedAddress = senderAddresses.find(
        addr => addr && addr.id !== undefined && String(addr.id) === selectedAddressId
      );
      
      if (!selectedAddress) {
        setError('Vald adress kunde inte hittas');
        return;
      }
      
      // Om adressen redan är standard, behöver vi inte göra något
      if (selectedAddress.isDefault) {
        setSuccess('Adressen är redan inställd som standard');
        return;
      }
      
      // Skicka till API för att uppdatera standardadress
      const res = await fetch('/api/mail/sender-addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: selectedAddress.email,
          name: selectedAddress.name,
          isDefault: true,
        }),
      });
      
      if (res.ok) {
        setSuccess('Standardavsändare har uppdaterats');
        
        // Uppdatera listan efter ändringen
        await fetchSenderAddresses();
        
        // Meddela parent-komponenten om uppdatering
        if (onAddressUpdated) {
          onAddressUpdated();
        }
        
        addToast({
          title: 'Framgång',
          description: 'Standardavsändare har uppdaterats',
          color: 'success',
          variant: 'flat'
        });
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Kunde inte uppdatera standardavsändare');
        
        addToast({
          title: 'Fel',
          description: 'Kunde inte uppdatera standardavsändare',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid uppdatering av standardavsändare:', error);
      setError('Ett oväntat fel inträffade vid uppdatering av standardavsändare');
      
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid uppdatering av standardavsändare',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNewAddress = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      // Validera e-postadressen
      if (!newEmail || !newEmail.includes('@')) {
        setError('Ange en giltig e-postadress');
        setSaving(false);
        return;
      }
      
      // Skicka till API för att lägga till ny avsändaradress
      const res = await fetch('/api/mail/sender-addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newEmail,
          name: newName || undefined,
          isDefault: makeNewDefault,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        
        setSuccess('Ny avsändaradress har lagts till');
        setNewEmail('');
        setNewName('');
        setShowAddNew(false);
        
        // Uppdatera listan efter ändringen
        await fetchSenderAddresses();
        
        // Meddela parent-komponenten om uppdatering
        if (onAddressUpdated) {
          onAddressUpdated();
        }
        
        addToast({
          title: 'Framgång',
          description: 'Ny avsändaradress har lagts till',
          color: 'success',
          variant: 'flat'
        });
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Kunde inte lägga till ny avsändaradress');
        
        addToast({
          title: 'Fel',
          description: 'Kunde inte lägga till ny avsändaradress',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid tillägg av ny avsändaradress:', error);
      setError('Ett oväntat fel inträffade vid tillägg av ny avsändaradress');
      
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid tillägg av ny avsändaradress',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setSaving(false);
    }
  };

  // Filtrerar bort ogiltiga adresser för rendering
  const validSenderAddresses = senderAddresses.filter(
    address => address && address.id !== undefined && address.email
  );

  return (
    <Card className={className}>
      <CardHeader>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-default-500 text-sm">{description}</p>
      </CardHeader>
      
      <CardBody>
        {loading ? (
          <div className="flex justify-center items-center py-4">
            <Spinner size="md" />
            <p className="ml-2">Laddar avsändaradresser...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {error && (
              <div className="bg-danger-50 border border-danger-200 text-danger p-3 rounded">
                {error}
              </div>
            )}
            
            {success && (
              <div className="bg-success-50 border border-success-200 text-success p-3 rounded">
                {success}
              </div>
            )}
            
            {/* Om inga avsändaradresser finns */}
            {validSenderAddresses.length === 0 ? (
              <div className="bg-warning-50 border border-warning-200 p-4 rounded">
                <p className="text-warning-700">
                  Inga verifierade avsändaradresser hittades. Lägg till en för att använda den för automatiska utskick.
                </p>
                <p className="mt-2 text-warning-700 text-sm">
                  För att kunna lägga till en avsändaradress behöver du först verifiera en domän under 
                  Inställningar &gt; Domänverifiering.
                </p>
                <Button 
                  className="mt-4" 
                  color="primary" 
                  variant="flat"
                  size="sm"
                  onPress={() => setShowAddNew(true)}
                >
                  Lägg till avsändaradress
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <p className="text-sm">
                    Välj vilken avsändaradress som ska användas som standard för alla automatiska 
                    mailutskick från systemet.
                  </p>
                  
                  <Select
                    label="Standardavsändare"
                    placeholder="Välj en avsändaradress"
                    selectedKeys={selectedAddressId ? [selectedAddressId] : []}
                    onChange={(e) => setSelectedAddressId(e.target.value)}
                    className="max-w-md"
                  >
                    {validSenderAddresses.map((address) => (
                      <SelectItem 
                        key={String(address.id)} 
                        value={String(address.id)}
                        textValue={address.name ? `${address.name} <${address.email}>` : address.email}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p>{address.name ? `${address.name} <${address.email}>` : address.email}</p>
                          </div>
                          {address.isDefault && (
                            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                              Standard
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </Select>
                  
                  <div className="flex justify-between items-center mt-4">
                    <Button 
                      color="primary"
                      onPress={handleSetDefaultAddress}
                      isLoading={saving}
                      isDisabled={saving || !selectedAddressId || validSenderAddresses.some(
                        addr => addr && String(addr.id) === selectedAddressId && addr.isDefault
                      )}
                    >
                      Sätt som standard
                    </Button>
                    
                    <Button
                      variant="flat"
                      onPress={() => setShowAddNew(!showAddNew)}
                    >
                      {showAddNew ? 'Avbryt' : 'Lägg till ny'}
                    </Button>
                  </div>
                </div>
                
                {/* Lista av befintliga avsändaradresser */}
                <div className="mt-6">
                  <h4 className="text-md font-medium mb-3">Dina avsändaradresser</h4>
                  <div className="grid gap-2">
                    {validSenderAddresses.map((address) => (
                      <div 
                        key={String(address.id)}
                        className={`p-3 rounded-md border ${
                          address.isDefault 
                            ? 'border-primary bg-primary-50' 
                            : 'border-default-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{address.name || address.email}</p>
                            <p className="text-xs text-default-500">{address.email}</p>
                          </div>
                          {address.isDefault && (
                            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                              Standard
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            
            {/* Formulär för att lägga till ny avsändaradress */}
            {showAddNew && (
              <div className="mt-6 border p-4 rounded-md">
                <h4 className="text-md font-medium mb-4">Lägg till ny avsändaradress</h4>
                
                <div className="space-y-4">
                  <Input
                    label="E-postadress"
                    placeholder="no-reply@din-verifierade-doman.se"
                    value={newEmail}
                    onValueChange={setNewEmail}
                    description="Adressen måste tillhöra en verifierad domän"
                    isRequired
                  />
                  
                  <Input
                    label="Visningsnamn (valfritt)"
                    placeholder="Ditt Företagsnamn"
                    value={newName}
                    onValueChange={setNewName}
                    description="Detta visas som 'Från: Namn <email>' i mottagarens mail"
                  />
                  
                  <div className="flex items-center">
                    <Switch
                      isSelected={makeNewDefault}
                      onValueChange={setMakeNewDefault}
                      className="mr-2"
                    />
                    <label htmlFor="makeDefault">
                      Använd som ny standardadress
                    </label>
                  </div>
                  
                  <div className="flex justify-end gap-2 mt-4">
                    <Button 
                      variant="flat"
                      onPress={() => setShowAddNew(false)}
                    >
                      Avbryt
                    </Button>
                    <Button
                      color="primary"
                      onPress={handleSaveNewAddress}
                      isLoading={saving}
                      isDisabled={saving || !newEmail}
                    >
                      Spara avsändaradress
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            <Divider className="my-4" />
            
            <div className="text-sm text-default-500">
              <p className="font-medium mb-1">Information</p>
              <p>Standardavsändaren används för:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 mt-1">
                <li>Automatiska bekräftelsemail för nya ärenden</li>
                <li>Mail som skickas vid statusändringar</li>
                <li>Påminnelsemail och uppföljningar</li>
              </ul>
              <p className="mt-2">
                Avsändaradressen måste vara från en domän som du har verifierat i systemet.
                Om du behöver verifiera en ny domän, gå till Inställningar &gt; Domänverifiering.
              </p>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default DefaultSenderAddressManager;