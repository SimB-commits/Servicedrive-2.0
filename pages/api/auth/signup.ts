// src/pages/api/auth/signup.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { signupSchema } from '../../../utils/validation';
import rateLimiter from '@/lib/rateLimiterApi';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate Limiting: Begränsa antalet förfrågningar per användare/IP
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Metod ej tillåten.' });
    }

    // Validera inkommande data med Zod
    const parseResult = signupSchema.safeParse(req.body);

    if (!parseResult.success) {
      // Extrahera felmeddelanden från Zod
      const errors = parseResult.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));  
      return res.status(400).json({ message: 'Valideringsfel', errors });
    }

    const { email, password, company, address } = parseResult.data;

    // Kontrollera om användaren redan finns
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Användare existerar redan.' });
    }

    // Hash lösenordet
    const hashedPassword = await bcrypt.hash(password, 10);

    // Skapa ny användare
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: 'ADMIN', // Standardroll, justera vid behov
      },
    });

    // Skapa en ny butik och koppla den till användaren
    const newStore = await prisma.store.create({
      data: {
        name: company, // Använd företagets namn som butikens namn
        company,
        address,
        users: {
          create: {
            userId: newUser.id,
          },
        },
      },
    });

    return res.status(201).json({ message: 'Användare och butik skapade framgångsrikt.' });
  } catch (error: any) {
    console.error('Fel vid registrering:', error.message);

    if (error instanceof Error) {
      if (error.constructor.name === 'RateLimiterRes') {
        return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
      }
    }

    // Kontrollera om felet redan har skickats som svar
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Ett fel inträffade under registrering.' });
    }
  } finally {
    await prisma.$disconnect();
  }
}
