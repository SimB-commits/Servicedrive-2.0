// src/pages/auth/login.tsx
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import { Form, Input, Button } from '@heroui/react';

const LoginPage = () => {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(null);
    setValidationErrors({});

    const data = Object.fromEntries(new FormData(e.currentTarget)) as {
      email: string;
      password: string;
    };

    // Enkel klientvalidering (extra om fälten skulle vara tomma)
    if (!data.email) {
      setValidationErrors((prev) => ({ ...prev, email: 'Email krävs' }));
      return;
    }
    if (!data.password) {
      setValidationErrors((prev) => ({ ...prev, password: 'Lösenord krävs' }));
      return;
    }

    // Logga in med NextAuth
    const res = await signIn('credentials', {
      redirect: false,
      email: data.email,
      password: data.password,
      callbackUrl: '/',
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
  };

  return (
    <div>
      <h1>Logga In</h1>
      {serverError && <p>{serverError}</p>}
      <Form onSubmit={onSubmit}>
        <Input
          isRequired
          label="Email"
          labelPlacement="outside"
          name="email"
          placeholder="Ange din email"
          type="email"
          errorMessage={({ validationDetails }) => {
            if (validationDetails.valueMissing) {
              return 'Vänligen ange din email';
            }
            if (validationDetails.typeMismatch) {
              return 'Ange en giltig email-adress';
            }
            return validationErrors['email'];
          }}
        />

        <Input
          isRequired
          label="Lösenord"
          labelPlacement="outside"
          name="password"
          placeholder="Ange ditt lösenord"
          type="password"
          errorMessage={({ validationDetails }) => {
            if (validationDetails.valueMissing) {
              return 'Vänligen ange ditt lösenord';
            }
            return validationErrors['password'];
          }}
        />

        <Button type="submit">Logga In</Button>
      </Form>
      <p>
        Har du inget konto? <a href="/auth/signup">Registrera dig här</a>.
      </p>
    </div>
  );
};

export default LoginPage;
