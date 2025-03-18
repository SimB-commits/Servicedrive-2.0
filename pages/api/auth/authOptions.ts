// src/pages/api/auth/authOptions.ts

import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { NextApiRequest, NextApiResponse } from 'next';
import loginRateLimiter from '@/lib/rateLimiter';

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text', placeholder: 'john.doe@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        try {
          // Typantagelse: Konvertera 'req' till 'NextApiRequest'
          const nextReq = req as unknown as NextApiRequest;
      
          // Hämta IP-adressen från förfrågan
          const ip =
            nextReq.headers['x-forwarded-for']?.toString().split(',')[0] ||
            nextReq.socket.remoteAddress ||
            '';
          
          // Rate limiting
          try {
            await loginRateLimiter.consume(ip as string);
            // ... fortsätt autentisering
          } catch (rejRes) {
            console.log('RateLimiterRejRes => ', rejRes);
            // Kolla om rejRes är en RateLimiterRes
            if (rejRes && typeof rejRes === 'object' && 'remainingPoints' in rejRes) {
              // => Du överskred gränsen
              throw new Error('RATE_LIMIT_EXCEEDED');
            }
            throw rejRes; // Om det är något annat fel
          }
          
      
          // Hitta användaren i databasen
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            include: { 
              stores: true,
              preference: true 
            },
          });
      
          if (user && await bcrypt.compare(credentials.password, user.password)) {
            let storeId = null;
            
            // Check if the user has a preferred store
            if (user.preference?.selectedStoreId) {
              // Verify the user still has access to this store
              const hasAccess = user.stores.some(store => 
                store.storeId === user.preference?.selectedStoreId
              );
              
              if (hasAccess) {
                storeId = user.preference.selectedStoreId;
              }
            }
            
            // If no valid preference, fall back to the first store
            if (storeId === null && user.stores.length > 0) {
              storeId = user.stores[0].storeId;
            }
      
            return {
              id: user.id,
              email: user.email,
              role: user.role,
              storeId: storeId,
              firstName: user.firstName,
            };
          }

          // Felaktiga inloggningsuppgifter
          throw new Error('INVALID_CREDENTIALS');
        } catch (error) {
          if (error.message === 'RATE_LIMIT_EXCEEDED') {
            throw new Error('RATE_LIMIT_EXCEEDED');  // Om rate limit överskrids, kasta detta fel
          }
          
          console.error('Authorize Error:', error);
          throw error;  // Kasta andra fel som de är
        }
      }
    }),
  ],
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.storeId = token.storeId;
        session.user.firstName = token.firstName;
      }
      return session;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.storeId = user.storeId;
        token.firstName = user.firstName;
      }
      
      // Handle updates from client side (store switching)
      if (trigger === "update" && session?.storeId) {
        token.storeId = session.storeId;
      }
      
      return token;
    },
  },
  session: {
    strategy: 'jwt',
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    // Sätt inga encryption-attribut
  },
  secret: process.env.NEXTAUTH_SECRET,
};
