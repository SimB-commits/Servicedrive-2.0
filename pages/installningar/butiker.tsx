// pages/installningar/butiker.tsx
import React from 'react';
import { useSession } from 'next-auth/react';
import { title } from '@/components/primitives';
import StoreManager from '@/components/StoreManager';
import { Spinner } from '@heroui/react';

export default function StoreSettingsPage() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <Spinner size="lg" />
        <div>Laddar...</div>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div>Ingen session – vänligen logga in.</div>
      </section>
    );
  }

  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="inline-block max-w-lg text-center mb-6">
        <h1 className={title({ size: 'sm' })}>Butiksinställningar</h1>
        <p className="text-default-600">Hantera dina butiker</p>
      </div>
      
      <div className="w-full max-w-6xl">
        <StoreManager />
      </div>
    </section>
  );
}