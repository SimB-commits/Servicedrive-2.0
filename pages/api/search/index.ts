// pages/api/search.ts
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

    // Endast GET-förfrågningar stöds
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { q, type } = req.query;
    
    // Validera sökfrågan
    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.status(400).json({ error: 'Ogiltig sökfråga. Minst 2 tecken krävs.' });
    }

    // Bestäm vilken typ av sökning som ska utföras
    const searchType = typeof type === 'string' ? type : 'all';
    
    const searchTerm = q.trim();
    const storeId = session.user.storeId;
    
    if (!storeId) {
      return res.status(400).json({ error: 'Ingen butik vald' });
    }
    
    // Sökresultat
    const results: any = { 
      customers: [],
      tickets: [],
      settings: []
    };

    // Utför sökning baserat på typ
    if (searchType === 'all' || searchType === 'customers') {
      // Sök efter kunder
      results.customers = await prisma.customer.findMany({
        where: {
          storeId,
          OR: [
            { firstName: { contains: searchTerm, mode: 'insensitive' } },
            { lastName: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { phoneNumber: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
        },
        take: 10,
      });
    }

    if (searchType === 'all' || searchType === 'tickets') {
      // Sök efter ärenden
      results.tickets = await prisma.ticket.findMany({
        where: {
          storeId,
          OR: [
            // Sökning efter ID som strängar (använd CAST i en riktig DB)
            { id: parseInt(searchTerm) > 0 ? parseInt(searchTerm) : undefined },
            // Sökning i ärendetyp
            { 
              ticketType: { 
                name: { contains: searchTerm, mode: 'insensitive' } 
              } 
            },
            // Sökning i kunduppgifter
            { 
              customer: { 
                OR: [
                  { firstName: { contains: searchTerm, mode: 'insensitive' } },
                  { lastName: { contains: searchTerm, mode: 'insensitive' } },
                  { email: { contains: searchTerm, mode: 'insensitive' } },
                ]
              }
            },
            // Försök hitta matchningar i dynamiska fält
            // OBS: Detta är en förenklad implementation; för fullständig textsökning i JSON
            // kan du behöva använda databasspecifika funktioner som jsonb_path_ops i PostgreSQL
            {
              dynamicFields: {
                path: "$",
                string_contains: searchTerm,
              },
            },
          ],
        },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            }
          },
          ticketType: {
            select: {
              name: true,
            }
          },
          customStatus: {
            select: {
              name: true,
              color: true,
            }
          },
        },
        take: 10,
      });
    }

    if (searchType === 'all' || searchType === 'settings') {
      // Sök i inställningar (förenklade matchningar mot vanliga termer)
      // Detta är en enklare implementation - i en fullständig lösning skulle du söka i faktiska inställningsposter
      const searchTermLower = searchTerm.toLowerCase();
      
      if (searchTermLower.includes('ärende') || 
          searchTermLower.includes('arende') || 
          searchTermLower.includes('typ')) {
        results.settings.push({
          type: 'settings',
          name: 'Ärendetyper',
          description: 'Hantera dina ärendetyper',
          url: '/installningar?tab=arendetyper'
        });
      }
      
      if (searchTermLower.includes('mail') || 
          searchTermLower.includes('e-post') || 
          searchTermLower.includes('mall')) {
        results.settings.push({
          type: 'settings',
          name: 'Mailmallar',
          description: 'Hantera dina e-postmallar',
          url: '/installningar?tab=mailmallar'
        });
      }
      
      if (searchTermLower.includes('kund') || 
          searchTermLower.includes('kort') || 
          searchTermLower.includes('mall')) {
        results.settings.push({
          type: 'settings',
          name: 'Kundkortsmallar',
          description: 'Hantera dina kundkortsmallar',
          url: '/installningar?tab=kundkortsmallar'
        });
      }
      
      if (searchTermLower.includes('status') || 
          searchTermLower.includes('ärende')) {
        results.settings.push({
          type: 'settings',
          name: 'Ärendestatusar',
          description: 'Hantera dina ärendestatusar',
          url: '/installningar?tab=arendestatusar'
        });
      }
    }

    // Returnera sökresultaten
    return res.status(200).json({
      query: searchTerm,
      results,
      totalCount: {
        customers: results.customers.length,
        tickets: results.tickets.length,
        settings: results.settings.length,
        total: results.customers.length + results.tickets.length + results.settings.length
      }
    });

  } catch (error) {
    console.error('Search API error:', error);
    
    if (error instanceof Error && error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ error: 'För många förfrågningar. Försök igen senare.' });
    }
    
    return res.status(500).json({ error: 'Ett internt serverfel inträffade.' });
  } finally {
    await prisma.$disconnect();
  }
}