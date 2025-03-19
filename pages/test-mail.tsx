// pages/test-mail.tsx
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Card, 
  CardHeader, 
  CardBody, 
  CardFooter, 
  Input, 
  Button, 
  Spinner 
} from '@heroui/react';

export default function TestMailPage() {
  const { data: session, status } = useSession();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSendTest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await fetch('/api/test/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to: email || session?.user?.email }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.message || 'Ett fel inträffade vid skickande av testmail');
      } else {
        setResult(data);
      }
    } catch (err) {
      setError('Ett oväntat fel inträffade: ' + (err.message || 'Okänt fel'));
    } finally {
      setLoading(false);
    }
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
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-xl font-bold">SendGrid Test Verktyg</h1>
          <p className="text-sm text-default-500">
            Skicka ett testmail för att verifiera din SendGrid-konfiguration
          </p>
        </CardHeader>
        
        <CardBody>
          <div className="space-y-4">
            <Input
              label="Mottagarens e-postadress"
              placeholder={`Din e-post (${session.user.email})`}
              value={email}
              onValueChange={setEmail}
              description="Lämna tomt för att skicka till dig själv"
            />
            
            {error && (
              <div className="p-3 bg-danger-50 border border-danger-200 rounded text-danger text-sm">
                <strong>Fel:</strong> {error}
              </div>
            )}
            
            {result && (
              <div className="p-3 bg-success-50 border border-success-200 rounded text-success text-sm">
                <strong>Framgång!</strong> Testmail skickat till {result.details.recipient} 
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
            isDisabled={loading}
          >
            Skicka testmail
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}