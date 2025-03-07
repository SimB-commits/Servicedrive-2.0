// src/types/next-auth.d.ts

import NextAuth, { DefaultSession } from 'next-auth';
import { UserRole } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      storeId: number | null;
      firstName: string | null; // Lägg till name som string eller null
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: UserRole;
    storeId: number | null;
    firstName: string | null; // Lägg till name som string eller null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
    storeId: number | null;
    firstName: string | null; // Lägg till name som string eller null
  }
}

