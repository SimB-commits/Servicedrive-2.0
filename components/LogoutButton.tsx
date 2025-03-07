import React from 'react';
import { useRouter } from 'next/router';
import { Button } from '@heroui/react';
import { signOut } from 'next-auth/react';

export default function LogoutButton({ variant = "flat", color = "danger", className = "" }) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      // Anropa NextAuth's signOut-funktion och omdirigera till utloggningssidan
      await signOut({ redirect: false });
      router.push('/auth/login');
    } catch (error) {
      console.error('Fel vid utloggning:', error);
    }
  };

  return (
    <Button 
      variant={variant} 
      color={color}
      className={className}
      onPress={handleLogout}
    >
      Logga ut
    </Button>
  );
}