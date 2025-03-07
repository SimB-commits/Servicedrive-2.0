// Uppdatera layouts/default.tsx

import { Link } from "@heroui/link";
import { useRouter } from "next/router";

import { Head } from "./head";
import { Navbar } from "@/components/navbar";

export default function DefaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Använd useRouter för att få nuvarande sökväg
  const router = useRouter();
  
  // Lista över sökvägar som ska undantas från att visa navbar
  const excludedPaths = [
    '/auth/login',
    '/auth/signup',
    // Lägg till andra autentiseringsrelaterade sidor här
  ];
  
  // Kontrollera om nuvarande sökväg ska undantas
  const shouldExcludeNavbar = excludedPaths.includes(router.pathname);

  return (
    <div className="relative flex flex-col h-screen">
      <Head />
      {/* Visa endast navbar om nuvarande sökväg inte är undantagen */}
      {!shouldExcludeNavbar && <Navbar />}
      <main className={`container mx-auto max-w-7xl px-6 flex-grow ${!shouldExcludeNavbar ? 'pt-16' : ''}`}>
        {children}
      </main>
      <footer className="w-full flex items-center justify-center py-3">
        
      </footer>
    </div>
  );
}
