// pages/api/admin/sync-usage-metrics.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Endast POST-metoden är tillåten
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
    
    // Autentisering - endast ADMIN kan köra denna operation
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return res.status(401).json({ error: 'Endast administratörer kan köra denna operation' });
    }

    const storeId = session.user.storeId;
    if (!storeId) {
      return res.status(400).json({ error: 'Ingen butik vald' });
    }

    // Bestäm om vi ska köra för alla butiker eller bara den aktiva
    const { allStores } = req.body;
    const isSuperAdmin = false; // Implementera kontroll av superadmin behörighet om det finns
    
    if (allStores && !isSuperAdmin) {
      return res.status(403).json({ 
        error: 'Otillräcklig behörighet', 
        message: 'Du har inte behörighet att synkronisera alla butiker' 
      });
    }

    const storeIds = allStores && isSuperAdmin 
      ? (await prisma.store.findMany({ select: { id: true } })).map(s => s.id)
      : [storeId];
    
    const syncResults = [];
    
    // Kör synkronisering för varje butik
    for (const id of storeIds) {
      try {
        // 1. Räkna antalet administratörer
        const adminCount = await prisma.userStore.count({
          where: {
            storeId: id,
            user: {
              role: 'ADMIN'
            }
          }
        });
        
        // 2. Räkna antalet ärendetyper
        const customTicketTypeCount = await prisma.ticketType.count({
          where: { storeId: id }
        });
        
        // 3. Räkna antalet anpassade statusar
        const customStatusCount = await prisma.userTicketStatus.count({
          where: { storeId: id }
        });
        
        // 4. Räkna antalet verifierade domäner
        const verifiedDomainCount = await prisma.verifiedDomain.count({
          where: { 
            storeId: id,
            status: 'verified'
          }
        });
        
        // 5. Uppdatera mätvärden
        const result = await prisma.storeUsageMetrics.create({
          data: {
            storeId: id,
            adminCount: Math.max(1, adminCount), // Minst 1 admin
            customTicketTypeCount,
            customStatusCount,
            verifiedDomainCount
          }
        });
        
        syncResults.push({
          storeId: id,
          success: true,
          metrics: {
            adminCount: result.adminCount,
            customTicketTypeCount: result.customTicketTypeCount,
            customStatusCount: result.customStatusCount,
            verifiedDomainCount: result.verifiedDomainCount
          }
        });
        
        logger.info(`Synkroniserade användningsmått för butik ${id}`, {
          adminCount: result.adminCount,
          customTicketTypeCount: result.customTicketTypeCount, 
          customStatusCount: result.customStatusCount,
          verifiedDomainCount: result.verifiedDomainCount
        });
      } catch (storeError) {
        syncResults.push({
          storeId: id,
          success: false,
          error: storeError instanceof Error ? storeError.message : 'Okänt fel'
        });
        
        logger.error(`Fel vid synkronisering av användningsmått för butik ${id}`, {
          error: storeError instanceof Error ? storeError.message : 'Okänt fel'
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      message: `Användningsmått synkroniserade för ${syncResults.filter(r => r.success).length} butiker`,
      results: syncResults
    });
  } catch (error: any) {
    logger.error('Fel vid synkronisering av användningsmått', { 
      error: error instanceof Error ? error.message : 'Okänt fel'
    });
    
    if (error.constructor?.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }
    
    return res.status(500).json({ message: 'Ett internt serverfel uppstod.' });
  } finally {
    await prisma.$disconnect();
  }
}