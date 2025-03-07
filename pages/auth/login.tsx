// pages/auth/login.tsx
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import { 
  Form, 
  Input, 
  Button, 
  Card, 
  CardBody, 
  CardHeader, 
  Checkbox, 
  Divider,
  Link
} from '@heroui/react';
import Image from 'next/image';

const LoginPage = () => {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(null);
    setValidationErrors({});
    setIsLoading(true);

    const data = Object.fromEntries(new FormData(e.currentTarget)) as {
      email: string;
      password: string;
    };

    // Enkel klientvalidering
    if (!data.email) {
      setValidationErrors((prev) => ({ ...prev, email: 'Email krävs' }));
      setIsLoading(false);
      return;
    }
    if (!data.password) {
      setValidationErrors((prev) => ({ ...prev, password: 'Lösenord krävs' }));
      setIsLoading(false);
      return;
    }

    // Logga in med NextAuth
    try {
      const res = await signIn('credentials', {
        redirect: false,
        email: data.email,
        password: data.password,
        callbackUrl: '/dashboard',
      });

      if (res?.ok) {
        router.push(res.url || '/');
      } else if (res?.error) {
        // Mappa specifika felkoder till användarvänliga meddelanden
        switch (res.error) {
          case 'RATE_LIMIT_EXCEEDED':
            setServerError('För många inloggningsförsök. Försök igen om en minut.');
            break;
          case 'INVALID_CREDENTIALS':
            setServerError('Felaktig email eller lösenord.');
            break;
          default:
            setServerError('Inloggning misslyckades. Försök igen.');
        }
      }
    } catch (error) {
      setServerError('Ett oväntat fel inträffade. Försök igen.');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-4xl flex shadow-lg rounded-xl overflow-hidden bg-white">
        {/* Vänster sida - Bild och branding */}
        <div className="hidden md:block md:w-1/2 bg-primary-600 text-white relative">
          <div className="p-12 h-full flex flex-col justify-between">
            <div>
              <h1 className="text-3xl font-bold">Servicedrive</h1>
              <p className="mt-2 text-white/80">Ärendehantering för verksamheter</p>
            </div>
            
            <div className="bg-white/10 p-6 rounded-lg backdrop-blur-sm">
              <h2 className="text-xl font-semibold mb-2">Med Servicedrive kan du</h2>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Skapa och hantera ärenden
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Organisera kunder och kontakter
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Få överblick med dashboard
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Automatisera kundkommunikation
                </li>
              </ul>
            </div>
            
            <div className="text-sm text-white/60">
              © 2025 Servicedrive. Alla rättigheter förbehållna.
            </div>
          </div>
        </div>
        
        {/* Höger sida - Login formulär */}
        <div className="w-full md:w-1/2 p-8">
          <div className="mb-6 text-center md:text-left">
            <h2 className="text-2xl font-bold mb-1">Välkommen tillbaka</h2>
            <p className="text-gray-600">Logga in för att fortsätta till systemet</p>
          </div>
          
          {serverError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg">
              {serverError}
            </div>
          )}
          
          <Form onSubmit={onSubmit} className="space-y-6">
            <Input
              isRequired
              label="E-post"
              labelPlacement="outside"
              name="email"
              placeholder="din@email.se"
              type="email"
              size="lg"
              variant="bordered"
              isInvalid={!!validationErrors.email}
              errorMessage={validationErrors.email}
              className="w-full"
              startContent={
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
              }
            />

            <Input
              isRequired
              label="Lösenord"
              labelPlacement="outside"
              name="password"
              placeholder="Ditt lösenord"
              type="password"
              size="lg"
              variant="bordered"
              isInvalid={!!validationErrors.password}
              errorMessage={validationErrors.password}
              className="w-full"
              startContent={
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                </svg>
              }
            />
            
            <div className="flex justify-between items-center gap-4">
              <Checkbox 
                isSelected={rememberMe}
                onValueChange={setRememberMe}
                size="sm"
              >
                Kom ihåg mig
              </Checkbox>
              
              <Link href="#" size="sm" color="primary">
                Glömt lösenordet?
              </Link>
            </div>

            <Button 
              type="submit" 
              color="primary" 
              className="w-full" 
              size="lg"
              isLoading={isLoading}
              disabled={isLoading}
            >
              Logga in
            </Button>
            
            <div className="flex items-center my-4 before:flex-1 before:border-t before:border-gray-300 before:mr-6 after:flex-1 after:border-t after:border-gray-300 after:ml-6">
              <p className="text-center text-sm text-gray-500">eller</p>
            </div>
            
            <Button
              type="button"
              variant="bordered"
              className="w-full"
              size="lg"
              onPress={() => router.push('/auth/signup')}
            >
              Skapa nytt konto
            </Button>
          </Form>
          
          <div className="mt-8 text-center text-sm text-gray-500 md:hidden">
            © 2025 Servicedrive. Alla rättigheter förbehållna.
          </div>
        </div>
      </div>
    </div>
  );
};

// Ser till att denna sida inte använder standardlayouten
// (Detta fungerar om du implementerar layout-kontroll enligt första metoden i svaret)

export default LoginPage;