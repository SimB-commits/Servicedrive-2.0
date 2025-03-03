// src/pages/auth/signup.tsx
import { useState } from 'react';
import { useRouter } from 'next/router';
import { signIn } from 'next-auth/react';
import { Form, Input, Button } from '@heroui/react';

const SignupPage = () => {
  const router = useRouter();
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [success, setSuccess] = useState('');

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationErrors({});
    setGeneralError('');
    setSuccess('');

    const data = Object.fromEntries(new FormData(e.currentTarget)) as {
      email: string;
      password: string;
      confirmPassword: string;
      company: string;
      address: string;
    };

    // Extra klientvalidering: kontrollera att lösenorden stämmer överens
    if (data.password !== data.confirmPassword) {
      setGeneralError('Lösenorden matchar inte.');
      return;
    }

    // Kontrollera att företagets namn och adress finns
    if (!data.company || !data.address) {
      setGeneralError('Företagets namn och adress krävs.');
      return;
    }

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          company: data.company,
          address: data.address,
        }),
      });

      const jsonData = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setGeneralError('För många förfrågningar. Försök igen senare.');
        } else if (jsonData.errors) {
          const fieldErrors: Record<string, string> = {};
          jsonData.errors.forEach((error: { field: string; message: string }) => {
            fieldErrors[error.field] = error.message;
          });
          setValidationErrors(fieldErrors);
        } else {
          setGeneralError(jsonData.message || 'Ett fel inträffade.');
        }
      } else {
        setSuccess(jsonData.message);
        // Optionellt: Logga in användaren automatiskt efter registrering
        const signInRes = await signIn('credentials', {
          redirect: false,
          email: data.email,
          password: data.password,
        });
        if (signInRes?.error) {
          setGeneralError(signInRes.error);
        } else {
          router.push('/auth/login');
        }
      }
    } catch (err) {
      setGeneralError('Ett fel inträffade. Försök igen senare.');
    }
  };

  return (
    <div>
      <h1>Skapa Konto</h1>
      {success && <p>{success}</p>}
      {generalError && <p>{generalError}</p>}
      <Form onSubmit={onSubmit} validationErrors={validationErrors}>
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
            return validationErrors.email;
          }}
        />

        <Input
          isRequired
          label="Lösenord"
          labelPlacement="outside"
          name="password"
          placeholder="Ange ditt lösenord"
          type="password"
          minLength={8}
          errorMessage={({ validationDetails }) => {
            if (validationDetails.valueMissing) {
              return 'Vänligen ange ditt lösenord';
            }
            if (validationDetails.tooShort) {
              return 'Lösenordet måste vara minst 8 tecken';
            }
            return validationErrors.password;
          }}
        />

        <Input
          isRequired
          label="Bekräfta Lösenord"
          labelPlacement="outside"
          name="confirmPassword"
          placeholder="Bekräfta ditt lösenord"
          type="password"
          minLength={8}
          errorMessage={({ validationDetails }) => {
            if (validationDetails.valueMissing) {
              return 'Vänligen bekräfta ditt lösenord';
            }
            if (validationDetails.tooShort) {
              return 'Lösenordet måste vara minst 8 tecken';
            }
            return validationErrors.confirmPassword;
          }}
        />

        <Input
          isRequired
          label="Företagets Namn"
          labelPlacement="outside"
          name="company"
          placeholder="Ange företagets namn"
          errorMessage={({ validationDetails }) => {
            if (validationDetails.valueMissing) {
              return 'Företagets namn krävs';
            }
            return validationErrors.company;
          }}
        />

        <Input
          isRequired
          label="Företagets Adress"
          labelPlacement="outside"
          name="address"
          placeholder="Ange företagets adress"
          errorMessage={({ validationDetails }) => {
            if (validationDetails.valueMissing) {
              return 'Företagets adress krävs';
            }
            return validationErrors.address;
          }}
        />

        <Button type="submit">Skapa Konto</Button>
      </Form>
      <p>
        Har du redan ett konto? <a href="/auth/login">Logga in här</a>.
      </p>
    </div>
  );
};

export default SignupPage;

