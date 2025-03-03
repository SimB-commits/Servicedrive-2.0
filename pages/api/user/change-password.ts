// src/pages/api/user/change-password.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getAuthenticatedSession } from '../../../utils/authHelper';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import rateLimiter from '@/lib/rateLimiterApi';
import { changePasswordSchema } from '../../../utils/validation';

const prisma = new PrismaClient();

// POST /api/user/change-password
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {

    // Rate Limiting: Begränsa antalet förfrågningar per användare/IP
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Säkerställ att användaren är autentiserad
    const session = await getAuthenticatedSession(req, res);

    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Metod ej tillåten' });
    }

    // Validera inkommande data med Zod
    const parseResult = changePasswordSchema.safeParse(req.body);

    if (!parseResult.success) {
      // Extrahera felmeddelanden från Zod
      const errors = parseResult.error.errors.map((err) => err.message);
      return res.status(400).json({ message: 'Valideringsfel', errors });
    }

    // Hämta body-data (nuvarande lösenord, nya lösenord)
    const { currentPassword, newPassword } = req.body;

    // Kontrollera att fälten finns
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Både nuvarande och nya lösenord krävs' });
    }

    // Hämta användaren från databasen
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return res.status(404).json({ message: 'Användare hittades inte' });
    }

    // Verifiera nuvarande lösenord
    const isCorrectPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isCorrectPassword) {
      return res.status(401).json({ message: 'Nuvarande lösenord stämmer inte' });
    }

    // Hasha och uppdatera det nya lösenordet i databasen
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { email: session.user.email },
      data: { password: hashedPassword },
    });

    // Returnera ett framgångssvar
    return res.status(200).json({ message: 'Lösenord uppdaterades' });
  } catch (error: any) {
    console.error('Change password error:', error.message);

    // Kontrollera om felet redan har skickats som svar
    if (error instanceof Error) {
      if (error.constructor.name === 'RateLimiterRes') {
        return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
      }

      if (error.message === 'Unauthenticated') {
        return res.status(401).json({ message: 'Du måste vara inloggad' });
      }
    }

    // Kontrollera om felet redan har skickats som svar
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Något gick fel vid lösenordsbyte' });
    }
  }
}
