import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Card,
  CardBody,
  Button,
  Input,
  Form,
  addToast,
  Divider
} from '@heroui/react';

const AccountSettings = () => {
  const { data: session } = useSession();
  
  // State för lösenordsbyte
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

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

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Kontoinställningar</h2>
      
      <Card className="mb-6">
        <CardBody>
          <h3 className="text-lg font-medium mb-2">Profilinformation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-default-500">E-post</p>
              <p className="font-medium">{session?.user?.email}</p>
            </div>
            <div>
              <p className="text-sm text-default-500">Roll</p>
              <p className="font-medium">{session?.user?.role}</p>
            </div>
            <div>
              <p className="text-sm text-default-500">ButiksID</p>
              <p className="font-medium">{session?.user?.storeId}</p>
            </div>
          </div>
        </CardBody>
      </Card>
      
      <Card className="my-6">
        <CardBody>
          <h3 className="text-lg font-medium mb-4">Byt lösenord</h3>
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
      
      <Card className="my-6">
        <CardBody>
          <h3 className="text-lg font-medium mb-2">Notifieringsinställningar</h3>
          <p className="text-default-500 mb-4">Hantera dina notifieringsinställningar för systemet.</p>
          
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium">Email-notifieringar</p>
              <p className="text-sm text-default-500">Få notifieringar via email vid nya ärenden</p>
            </div>
            <div>
              <Button size="sm" color="primary" variant="flat">
                Aktivera
              </Button>
            </div>
          </div>
          
          <Divider className="my-2" />
          
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium">Påminnelser</p>
              <p className="text-sm text-default-500">Få påminnelser om förfallna ärenden</p>
            </div>
            <div>
              <Button size="sm" color="primary" variant="flat">
                Aktivera
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default AccountSettings;