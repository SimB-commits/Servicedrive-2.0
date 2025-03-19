// pages/auth/logout.tsx
import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { Card, CardBody, CardHeader, Spinner } from '@heroui/react';

export default function LogoutPage() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const performLogout = async () => {
      try {
        setIsLoggingOut(true);
        // Anropa NextAuth's signOut-funktion
        await signOut({ redirect: false });
        // Omdirigera till inloggningssidan
        router.push('/auth/login');
      } catch (error) {
        console.error('Fel vid utloggning:', error);
        setError('Ett fel uppstod vid utloggning. Försök igen.');
        setIsLoggingOut(false);
      }
    };

    performLogout();
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader className="flex justify-center">
          <h1 className="text-xl font-bold">Loggar ut...</h1>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col items-center py-8">
            {isLoggingOut ? (
              <>
                <Spinner size="lg" color="primary" />
                <p className="mt-4 text-center">Du loggas ut från systemet...</p>
              </>
            ) : (
              <>
                <p className="text-center text-danger">{error}</p>
                <button
                  className="mt-4 px-4 py-2 bg-primary text-white rounded"
                  onPress={() => router.push('/auth/login')}
                >
                  Återgå till inloggning
                </button>
              </>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}