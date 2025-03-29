// pages/api/search/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { logger } from '@/utils/logger';

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
      return res.status(400).json({ 
        error: 'Ogiltig sökfråga. Minst 2 tecken krävs.',
        query: q || '',
        results: { customers: [], tickets: [], settings: [] },
        totalCount: { customers: 0, tickets: 0, settings: 0, total: 0 }
      });
    }

    // Bestäm vilken typ av sökning som ska utföras
    const searchType = typeof type === 'string' ? type : 'all';
    
    const searchTerm = q.trim();
    const storeId = session.user.storeId;
    
    if (!storeId) {
      return res.status(400).json({ error: 'Ingen butik vald' });
    }
    
    // Logga sökfrågan
    logger.info(`Sökning utförd: "${searchTerm}"`, { 
      userId: session.user.id,
      storeId,
      searchType,
      searchTerm
    });
    
    // Sökresultat
    const results: any = { 
      customers: [],
      tickets: [],
      settings: []
    };

    // Utför parallella sökningar för bättre prestanda
    const searchPromises = [];

    if (searchType === 'all' || searchType === 'customers') {
      // Sök efter kunder
      searchPromises.push(
        prisma.customer.findMany({
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
        }).then(data => {
          results.customers = data;
        })
      );
    }

    if (searchType === 'all' || searchType === 'tickets') {
      // Check if search is a numeric ID
      const isNumeric = /^\d+$/.test(searchTerm);
      
      // Sök efter ärenden
      searchPromises.push(
        prisma.ticket.findMany({
          where: {
            storeId,
            OR: [
              // Sökning efter ID som strängar 
              ...(isNumeric ? [{ id: parseInt(searchTerm) }] : []),
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
              // Sökning i dynamiska fält - med förbättrad JSON-sökning
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
          take: 20, // Ökat antal resultat
          orderBy: {
            createdAt: 'desc' // Nyaste först
          }
        }).then(data => {
          results.tickets = data;
        })
      );
    }

    if (searchType === 'all' || searchType === 'settings') {
      // Sökning i inställningar - mer sofistikerad
      const searchTermLower = searchTerm.toLowerCase();
      const settingsResults = [];
      
      // Ärendetyper
      if (searchTermLower.includes('ärende') || 
          searchTermLower.includes('arende') || 
          searchTermLower.includes('typ') ||
          searchTermLower.includes('formulär') ||
          searchTermLower.includes('ticket') ||
          searchTermLower.includes('type')) {
        settingsResults.push({
          type: 'settings',
          name: 'Ärendetyper',
          description: 'Hantera dina ärendetyper och definiera fält',
          url: '/installningar?tab=arendetyper'
        });
      }
      
      // Mailmallar
      if (searchTermLower.includes('mail') || 
          searchTermLower.includes('e-post') || 
          searchTermLower.includes('epost') || 
          searchTermLower.includes('mall') ||
          searchTermLower.includes('email') ||
          searchTermLower.includes('template')) {
        settingsResults.push({
          type: 'settings',
          name: 'Mailmallar',
          description: 'Hantera dina e-postmallar för kommunikation',
          url: '/installningar?tab=mailmallar'
        });
      }
      
      // Kundkort
      if (searchTermLower.includes('kund') || 
          searchTermLower.includes('kort') || 
          searchTermLower.includes('mall') ||
          searchTermLower.includes('customer') ||
          searchTermLower.includes('card') ||
          searchTermLower.includes('person')) {
        settingsResults.push({
          type: 'settings',
          name: 'Kundkortsmallar',
          description: 'Hantera dina kundkortsmallar',
          url: '/installningar?tab=kundkortsmallar'
        });
      }
      
      // Statusar
      if (searchTermLower.includes('status') || 
          searchTermLower.includes('ärende') ||
          searchTermLower.includes('tillstånd') ||
          searchTermLower.includes('state') ||
          searchTermLower.includes('läge')) {
        settingsResults.push({
          type: 'settings',
          name: 'Ärendestatusar',
          description: 'Hantera dina ärendestatusar och flöden',
          url: '/installningar?tab=arendestatusar'
        });
      }
      
      // E-post
      if (searchTermLower.includes('email') || 
          searchTermLower.includes('e-post') ||
          searchTermLower.includes('epost') ||
          searchTermLower.includes('smtp') ||
          searchTermLower.includes('mail') ||
          searchTermLower.includes('notif')) {
        settingsResults.push({
          type: 'settings',
          name: 'E-postinställningar',
          description: 'Konfigurera e-postkopplingar och notifieringar',
          url: '/installningar?tab=email'
        });
      }
      
      // Butiker
      if (searchTermLower.includes('butik') || 
          searchTermLower.includes('store') ||
          searchTermLower.includes('shop') ||
          searchTermLower.includes('company') ||
          searchTermLower.includes('företag')) {
        settingsResults.push({
          type: 'settings',
          name: 'Butikshantering',
          description: 'Hantera dina butiker och organisationer',
          url: '/installningar?tab=butiker'
        });
      }
      
      results.settings = settingsResults;
    }

    // Vänta på att alla sökningar ska slutföras
    await Promise.all(searchPromises);

    // Returnera sökresultaten med förbättrad metadata
    return res.status(200).json({
      query: searchTerm,
      results,
      totalCount: {
        customers: results.customers.length,
        tickets: results.tickets.length,
        settings: results.settings.length,
        total: results.customers.length + results.tickets.length + results.settings.length
      },
      searchType,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Okänt fel';
    logger.error('Sökfel', { error: errorMessage });
    
    if (error instanceof Error && error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ error: 'För många förfrågningar. Försök igen senare.' });
    }
    
    return res.status(500).json({ error: 'Ett internt serverfel inträffade.' });
  } finally {
    await prisma.$disconnect();
  }
}