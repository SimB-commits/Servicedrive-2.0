// pages/api/tickets/print.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';

const prisma = new PrismaClient();

/**
 * API-endpoint för utskrift av ärendekvitton på kvittoskrivare
 * 
 * Egentliga utskriftshanteringen skulle kräva integration med 
 * skrivardrivrutiner eller en tjänst som hanterar utskrifter.
 * I denna implementation simulerar vi bara respons från utskrift.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate Limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');
    
    // Autentisering
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Endast POST tillåts
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    // Validera input
    const { ticketId, printerName } = req.body;
    if (!ticketId || !printerName) {
      return res.status(400).json({ error: 'ticketId and printerName are required' });
    }

    // Hämta ärendet från databasen
    const ticket = await prisma.ticket.findUnique({
      where: { id: Number(ticketId) },
      include: {
        customer: true,
        ticketType: {
          include: { fields: true }
        },
        customStatus: true
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Kontrollera att användaren tillhör samma butik som ärendet
    if (ticket.storeId !== session.user.storeId) {
      return res.status(403).json({ error: 'You do not have access to this ticket' });
    }

    // Logga försök till utskrift
    console.log(`User ${session.user.id} is printing ticket #${ticketId} to ${printerName}`);

    // Här skulle vi implementera faktiskt utskrift till kvittoskrivare
    // Detta skulle bero på vilken typ av integration vi har för skrivare
    // Exempelvis:
    // 1. Direkt kommunikation med lokal skrivare via WebUSB eller liknande
    // 2. Skicka till en utskriftsserver
    // 3. Använda en molntjänst för utskrifter

    // För demo simulerar vi bara en lyckad utskrift
    // Lägg till fördröjning för att simulera utskriftsprocess
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Returnera framgångssvar
    return res.status(200).json({ 
      success: true,
      message: `Ärende #${ticketId} har skickats till skrivare ${printerName}`,
      printJobId: `print-${Date.now()}-${ticketId}`
    });

  } catch (error: any) {
    console.error('Error in print endpoint:', error);

    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }

    return res.status(500).json({ 
      error: 'Server error', 
      message: error.message || 'Ett fel uppstod vid utskrift'
    });
  } finally {
    await prisma.$disconnect();
  }
}