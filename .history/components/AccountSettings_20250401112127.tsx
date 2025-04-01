// components/AccountSettings.tsx
import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Form,
  Divider,
  Tabs,
  Tab,
  addToast
} from '@heroui/react';
import SubscriptionOverview from './subscription/SubscriptionOverview';
import PlanSelector from './subscription/PlanSelector';
import useSubscription from '@/hooks/useSubscription';

const AccountSettings = () => {
  const { data: session } = useSession();
  const subscription = useSubscription();
  
  // State för lösenordsbyte
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // State för aktiv prenumerations-flik
  const [activeSubscriptionTab, setActiveSubscriptionTab] = useState('overview');

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    
    // Validera lösenord
    const errors: Record<string, string> = {};
    if (!currentPassword) errors.currentPassword = 'Nuvarande lösenord krävs';
    if (!newPassword) errors.newPassword = 'Nytt lösenord krävs';
    if (newPassword.length < 8) errors.newPassword = 'Lösenordet måste vara minst 8 tecken långt';
    if (newPassword !== confirmPassword) errors.confirmPassword = 'Lösenorden matchar inte';
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      
      if (response.ok) {
        addToast({
          title: 'Framgång',
          description: 'Ditt lösenord har uppdaterats',
          color: 'success',
          variant: 'flat'
        });
        
        // Återställ formuläret
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await response.json();
        if (data.message === 'Nuvarande lösenord stämmer inte') {
          setValidationErrors({ currentPassword: data.message });
        } else {
          addToast({
            title: 'Fel',
            description: data.message || 'Kunde inte uppdatera lösenord',
            color: 'danger',
            variant: 'flat'
          });
        }
      }
    } catch (error) {
      console.error('Fel vid byte av lösenord:', error);
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid byte av lösenord',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Hantera prenumerationsplanförändring
  const handlePlanChanged = () => {
    // Vi behöver inte göra något specifikt här eftersom SubscriptionContext hanterar uppdateringen
    // Komponenten kommer att återrenderas via context
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold mb-4">Kontoinställningar</h2>
      
      {/* Profilinformation */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-medium">Profilinformation</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-default-500">E-post</p>
              <p className="font-medium">{session?.user?.email}</p>
            </div>
            <div>
              <p className="text-sm text-default-500">Roll</p>
              <p className="font-medium">{session?.user?.role}</p>
            </div>
            {session?.user?.firstName && (
              <div>
                <p className="text-sm text-default-500">Namn</p>
                <p className="font-medium">{session.user.firstName}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-default-500">ButiksID</p>
              <p className="font-medium">{session?.user?.storeId}</p>
            </div>
          </div>
        </CardBody>
      </Card>
      
      {/* Prenumerationsinformation */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-medium">Prenumeration</h3>
        </CardHeader>
        <CardBody>
          <Tabs 
            aria-label="Prenumerationsinställningar"
            selectedKey={activeSubscriptionTab}
            onSelectionChange={(key) => setActiveSubscriptionTab(key as string)}
            variant="underlined"
            className="mb-4"
          >
            <Tab key="overview" title="Översikt" />
            <Tab key="change" title="Ändra prenumeration" />
            <Tab key="history" title="Faktureringshistorik" />
          </Tabs>
          
          <div className="mt-4">
            {activeSubscriptionTab === 'overview' && <SubscriptionOverview />}
            
            {activeSubscriptionTab === 'change' && (
              <PlanSelector onPlanChanged={handlePlanChanged} />
            )}
            
            {activeSubscriptionTab === 'history' && (
              <div className="p-6 bg-default-50 rounded-lg text-center">
                <p>Faktureringshistorik kommer i nästa version.</p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>
      
      {/* Lösenordsbyte */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-medium">Byt lösenord</h3>
        </CardHeader>
        <CardBody>
          <Form onSubmit={handlePasswordChange} className="space-y-4">
            <Input
              type="password"
              label="Nuvarande lösenord"
              labelPlacement="outside"
              placeholder="Ange ditt nuvarande lösenord"
              value={currentPassword}
              onValueChange={setCurrentPassword}
              isInvalid={!!validationErrors.currentPassword}
              errorMessage={validationErrors.currentPassword}
              isRequired
            />
            
            <Input
              type="password"
              label="Nytt lösenord"
              labelPlacement="outside"
              placeholder="Ange nytt lösenord"
              value={newPassword}
              onValueChange={setNewPassword}
              isInvalid={!!validationErrors.newPassword}
              errorMessage={validationErrors.newPassword}
              isRequired
            />
            
            <Input
              type="password"
              label="Bekräfta nytt lösenord"
              labelPlacement="outside"
              placeholder="Bekräfta ditt nya lösenord"
              value={confirmPassword}
              onValueChange={setConfirmPassword}
              isInvalid={!!validationErrors.confirmPassword}
              errorMessage={validationErrors.confirmPassword}
              isRequired
            />
            
            <div className="flex justify-end">
              <Button
                color="primary"
                type="submit"
                isLoading={submitting}
                isDisabled={submitting}
              >
                Byt lösenord
              </Button>
            </div>
          </Form>
        </CardBody>
      </Card>
    </div>
  );
};

export default AccountSettings;