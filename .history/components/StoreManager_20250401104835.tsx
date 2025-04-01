// components/StoreManager.tsx
import React, { useState, useEffect } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Form,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  addToast,
  Spinner
} from '@heroui/react';
import { useSession } from 'next-auth/react';
import useSubscription from '@/hooks/useSubscription';
import PlanFeatureNotice from '@/components/subscription/PlanFeatureNotice';

interface Store {
  id: number;
  name: string;
  company: string;
  address: string;
}

export default function StoreManager() {
  const { data: session, update } = useSession();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    address: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  
  // Använd subscription hook för att kontrollera om användaren har tillgång till multiStore-funktionen
  const subscription = useSubscription();
  const canUseMultiStore = subscription.canUseFeature('multiStore');
  const hasReachedStoreLimit = stores.length > 1 && !canUseMultiStore;

  // Fetch stores
  useEffect(() => {
    if (!session) return;

    async function fetchStores() {
      try {
        setLoading(true);
        const res = await fetch('/api/stores');
        if (res.ok) {
          const data = await res.json();
          setStores(data);
        } else {
          console.error('Failed to fetch stores');
        }
      } catch (error) {
        console.error('Error fetching stores:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStores();
  }, [session]);

  // Handle form input change
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when field is edited
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Validate the form
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Butiksnamn krävs';
    }
    
    if (!formData.company.trim()) {
      newErrors.company = 'Företagsnamn krävs';
    }
    
    if (!formData.address.trim()) {
      newErrors.address = 'Adress krävs';
    }
    
    // Validera om användaren får skapa fler butiker
    if (hasReachedStoreLimit) {
      newErrors.general = 'Din nuvarande plan tillåter endast en butik. Uppgradera för att skapa fler.';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Create new store
  const handleCreateStore = async (e?: React.FormEvent) => {
    // Only call preventDefault if e exists (when called from form submit)
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setSubmitting(true);
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (res.ok) {
        const newStore = await res.json();
        
        // Add new store to the list
        setStores(prev => [...prev, newStore]);
        
        // Reset form and close modal
        setFormData({ name: '', company: '', address: '' });
        setCreateModalOpen(false);
        
        addToast({
          title: 'Framgång',
          description: 'Butiken skapades!',
          color: 'success',
          variant: 'flat'
        });
        
        // If this is the first store, update session to use it
        if (stores.length === 0) {
          await update({ storeId: newStore.id });
          window.location.reload(); // Force reload to update all components
        }
      } else {
        const error = await res.json();
        addToast({
          title: 'Fel',
          description: error.error || 'Kunde inte skapa butik',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Error creating store:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid skapandet av butiken',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Switch active store
  const handleSwitchStore = async (storeId: number) => {
    if (storeId === session?.user.storeId) return;
    
    try {
      const res = await fetch('/api/stores/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storeId }),
      });

      if (res.ok) {
        // Update the session
        await update({ storeId });
        
        addToast({
          title: 'Framgång',
          description: 'Aktiv butik ändrad!',
          color: 'success',
          variant: 'flat'
        });
        
        // Reload page to reflect new store data
        window.location.reload();
      } else {
        const errorData = await res.json();
        addToast({
          title: 'Fel',
          description: errorData.error || 'Kunde inte byta butik',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Error switching store:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid byte av butik',
        color: 'danger',
        variant: 'flat'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner size="lg" color="primary" />
        <span className="ml-4">Laddar butiker...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Hantera butiker</h2>
        <Button 
          color="primary" 
          onPress={() => setCreateModalOpen(true)}
          isDisabled={hasReachedStoreLimit}
        >
          Skapa ny butik
        </Button>
      </div>
      
      {/* Visa PlanFeatureNotice om användaren inte har tillgång till multiStore */}
      {hasReachedStoreLimit && (
        <PlanFeatureNotice 
          feature="multiStore"
          title="Flerbutiksstöd kräver uppgradering"
          description={`Din ${subscription.planName} plan tillåter endast en butik. Uppgradera till en högre plan för att kunna hantera flera butiker.`}
        />
      )}
      
      <Card>
        <CardHeader>
          <h3 className="text-lg font-medium">Dina butiker</h3>
          <p className="text-sm text-default-500">
            Här kan du se och hantera dina butiker. Du kan byta mellan butiker {canUseMultiStore && "och skapa nya"}.
          </p>
        </CardHeader>
        <CardBody>
          {stores.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-default-500 mb-4">Du har inga butiker ännu.</p>
              <Button color="primary" onPress={() => setCreateModalOpen(true)}>
                Skapa din första butik
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table aria-label="Dina butiker">
                <TableHeader>
                  <TableColumn>Butiksnamn</TableColumn>
                  <TableColumn>Företag</TableColumn>
                  <TableColumn>Adress</TableColumn>
                  <TableColumn>Status</TableColumn>
                  <TableColumn>Åtgärder</TableColumn>
                </TableHeader>
                <TableBody>
                  {stores.map(store => (
                    <TableRow key={store.id}>
                      <TableCell>{store.name}</TableCell>
                      <TableCell>{store.company}</TableCell>
                      <TableCell>{store.address}</TableCell>
                      <TableCell>
                        {store.id === session?.user.storeId ? (
                          <span className="text-success font-medium">Aktiv</span>
                        ) : (
                          <span className="text-default-500">Inaktiv</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {store.id !== session?.user.storeId && (
                          <Button 
                            size="sm"
                            variant="flat"
                            onPress={() => handleSwitchStore(store.id)}
                          >
                            Aktivera
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Modal for creating new store */}
      <Modal
        isOpen={createModalOpen}
        onOpenChange={setCreateModalOpen}
        backdrop="opaque"
      >
        <ModalContent>
          <ModalHeader>
            <h2 className="text-xl font-bold">Skapa ny butik</h2>
          </ModalHeader>
          <ModalBody>
            {/* Visa varning om planbegränsning i modalen också */}
            {hasReachedStoreLimit && (
              <PlanFeatureNotice 
                feature="multiStore"
                compact={true}
                className="mb-4"
              />
            )}
            
            <Form onSubmit={handleCreateStore} className="space-y-4">
              {errors.general && (
                <div className="p-3 bg-danger-50 text-danger-600 rounded border border-danger-200">
                  {errors.general}
                </div>
              )}
              
              <Input
                label="Butiksnamn"
                placeholder="Ange butikens namn"
                value={formData.name}
                onValueChange={(val) => handleInputChange('name', val)}
                labelPlacement="outside"
                isRequired
                isInvalid={!!errors.name}
                errorMessage={errors.name}
              />
              
              <Input
                label="Företagsnamn"
                placeholder="Ange företagets namn"
                value={formData.company}
                onValueChange={(val) => handleInputChange('company', val)}
                labelPlacement="outside"
                isRequired
                isInvalid={!!errors.company}
                errorMessage={errors.company}
              />
              
              <Input
                label="Adress"
                placeholder="Ange butikens adress"
                value={formData.address}
                onValueChange={(val) => handleInputChange('address', val)}
                labelPlacement="outside"
                isRequired
                isInvalid={!!errors.address}
                errorMessage={errors.address}
              />
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={() => setCreateModalOpen(false)}
            >
              Avbryt
            </Button>
            <Button
              color="primary"
              onPress={handleCreateStore}
              isLoading={submitting}
              isDisabled={submitting || hasReachedStoreLimit}
            >
              Skapa butik
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}