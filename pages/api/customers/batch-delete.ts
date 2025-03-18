// pages/api/customers/batch-delete.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate Limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Autentisering
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method !== 'DELETE') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: 'Ogiltigt format för kund-ID. Förväntar array av IDs.' });
    }

    // Konvertera alla id till nummer och validera
    const numericIds = ids.map(id => Number(id));
    if (numericIds.some(id => isNaN(id))) {
      return res.status(400).json({ error: 'Ogiltigt kund-ID. Alla IDs måste vara numeriska.' });
    }

    // Kontrollera att alla kunder tillhör användarens butik
    const customers = await prisma.customer.findMany({
      where: { 
        id: { in: numericIds },
        storeId: session.user.storeId
      },
      select: { id: true }
    });

    // Om antalet hittade kunder inte matchar antalet begärda IDs, finns det kunder som inte tillhör butiken
    if (customers.length !== numericIds.length) {
      return res.status(403).json({ error: 'En eller flera kunder tillhör inte din butik.' });
    }

    // Hämta alla kunders IDs som faktiskt finns
    const validCustomerIds = customers.map(c => c.id);

    // Utför borttagning i en transaktion för att säkerställa att allt tas bort korrekt
    const result = await prisma.$transaction(async (tx) => {
      // 1. Ta bort alla meddelanden kopplade till kundernas ärenden
      await tx.message.deleteMany({
        where: {
          ticket: {
            customerId: { in: validCustomerIds }
          }
        }
      });
      
      // 2. Ta bort alla ärenden kopplade till kunderna
      const deletedTickets = await tx.ticket.deleteMany({
        where: {
          customerId: { in: validCustomerIds },
          storeId: session.user.storeId
        }
      });
      
      // 3. Till sist ta bort kunderna
      const deletedCustomers = await tx.customer.deleteMany({
        where: { 
          id: { in: validCustomerIds },
          storeId: session.user.storeId
        }
      });
      
      return {
        customers: deletedCustomers.count,
        tickets: deletedTickets.count
      };
    });

    res.status(200).json({ 
      message: `${result.customers} kunder borttagna tillsammans med ${result.tickets} relaterade ärenden.`,
      deletedCustomers: result.customers,
      deletedTickets: result.tickets
    });
  } catch (error: any) {
    console.error('Fel vid batch-borttagning:', error);
    
    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }
    
    res.status(500).json({ error: 'Ett fel inträffade vid borttagning av kunder', details: error.message });
  } finally {
    await prisma.$disconnect();
  }
}