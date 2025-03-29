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
    const promises = [];

    if (searchType === 'all' || searchType === 'customers') {
      // Sök efter kunder
      promises.push(
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
      
      const ticketSearchOptions = {
        where: {
          storeId,
          OR: [
            // Sökning med ID om söktermen är numerisk
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
            // Sökning i meddelanden
            {
              messages: {
                some: {
                  content: { contains: searchTerm, mode: 'insensitive' }
                }
              }
            }
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
        take: 20,
        orderBy: {
          createdAt: 'desc'
        }
      };
      
      promises.push(
        prisma.ticket.findMany(ticketSearchOptions).then(data => {
          results.tickets = data;
        })
      );
      
      // JSON-sökning kan implementeras som en andra sökning om den behövs
      // Denna gör vi separat för att använda en annan syntax som är kompatibel
      // OBS: Denna del kanske inte fungerar på alla Prisma/DB-kombinationer
      try {
        const jsonSearchQuery = prisma.sql`
          SELECT t.id FROM "Ticket" t
          WHERE t."storeId" = ${storeId}
          AND t."dynamicFields"::text ILIKE ${`%${searchTerm}%`}
          ORDER BY t."createdAt" DESC
          LIMIT 20
        `;
        
        promises.push(
          prisma.$queryRaw(jsonSearchQuery)
            .then(async (jsonMatches: any[]) => {
              if (jsonMatches && jsonMatches.length > 0) {
                const ids = jsonMatches.map(match => match.id);
                
                // Hämta fullständiga ärenden baserat på ID:n från JSON-sökningen
                const jsonMatchedTickets = await prisma.ticket.findMany({
                  where: {
                    id: { in: ids },
                    storeId
                  },
                  include: ticketSearchOptions.include,
                });
                
                // Slå ihop resultaten men filtrera bort dubletter
                const existingIds = new Set(results.tickets.map(t => t.id));
                const newTickets = jsonMatchedTickets.filter(t => !existingIds.has(t.id));
                results.tickets = [...results.tickets, ...newTickets];
              }
            })
            .catch(error => {
              // Om JSON-sökningen misslyckas, loggar vi bara ett fel men fortsätter
              logger.error('JSON search error', { error: error.message });
            })
        );
      } catch (jsonError) {
        // Om JSON-sökningen misslyckas helt, fortsätter vi med övriga resultat
        logger.error('JSON search setup error', { error: jsonError.message });
      }
    }

    if (searchType === 'all' || searchType === 'settings') {
      // Sökning i inställningar
      const searchTermLower = searchTerm.toLowerCase();
      const settingsResults = [];
      
      // Utöka sökresultat baserat på sökterm
      const settings = [
        {
          id: 'arendetyper',
          keywords: ['ärende', 'arende', 'typ', 'formulär', 'ticket', 'type', 'fält', 'field'],
          name: 'Ärendetyper',
          description: 'Hantera dina ärendetyper och definiera fält',
          url: '/installningar?tab=arendetyper'
        },
        {
          id: 'mailmallar',
          keywords: ['mail', 'e-post', 'epost', 'mall', 'email', 'template', 'meddelande', 'message', 'kommunikation'],
          name: 'Mailmallar',
          description: 'Hantera dina e-postmallar för kommunikation',
          url: '/installningar?tab=mailmallar'
        },
        {
          id: 'kundkortsmallar',
          keywords: ['kund', 'kort', 'mall', 'customer', 'card', 'person', 'kontakt', 'contact'],
          name: 'Kundkortsmallar',
          description: 'Hantera dina kundkortsmallar',
          url: '/installningar?tab=kundkortsmallar'
        },
        {
          id: 'arendestatusar',
          keywords: ['status', 'ärende', 'tillstånd', 'state', 'läge', 'flow', 'flöde'],
          name: 'Ärendestatusar',
          description: 'Hantera dina ärendestatusar och flöden',
          url: '/installningar?tab=arendestatusar'
        },
        {
          id: 'email',
          keywords: ['email', 'e-post', 'epost', 'smtp', 'mail', 'notif', 'notify', 'subscription'],
          name: 'E-postinställningar',
          description: 'Konfigurera e-postkopplingar och notifieringar',
          url: '/installningar?tab=email'
        },
        {
          id: 'butiker',
          keywords: ['butik', 'store', 'shop', 'company', 'företag', 'organisation', 'organization'],
          name: 'Butikshantering',
          description: 'Hantera dina butiker och organisationer',
          url: '/installningar?tab=butiker'
        },
        {
          id: 'konto',
          keywords: ['account', 'konto', 'user', 'användare', 'profil', 'profile', 'lösenord', 'password'],
          name: 'Kontoinställningar',
          description: 'Hantera ditt konto och säkerhetsinställningar',
          url: '/installningar?tab=konto'
        }
      ];
      
      // Mer intelligent matchning mot inställningar
      // Kontrollera först om det är en exakt matchning på någon nyckelord
      let exactMatches = settings.filter(setting => 
        setting.keywords.some(keyword => keyword === searchTermLower) ||
        setting.name.toLowerCase() === searchTermLower
      );
      
      // Om det inte finns exakta matchningar, använd delvis matchning
      if (exactMatches.length === 0) {
        exactMatches = settings.filter(setting => 
          setting.keywords.some(keyword => keyword.includes(searchTermLower) || 
                                          searchTermLower.includes(keyword))
        );
      }
      
      // Om fortfarande inga matchningar, använd ännu bredare matchning
      if (exactMatches.length === 0) {
        exactMatches = settings.filter(setting => 
          setting.keywords.some(keyword => 
            keyword.length > 3 && 
            (keyword.includes(searchTermLower.substring(0, 3)) || 
             searchTermLower.includes(keyword.substring(0, 3)))
          )
        );
      }
      
      // Lägg till matchande inställningar till resultatet
      results.settings = exactMatches.map(setting => ({
        type: 'settings',
        name: setting.name,
        description: setting.description,
        url: setting.url
      }));
    }

    // Vänta på att alla sökningar ska slutföras
    await Promise.all(promises);

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