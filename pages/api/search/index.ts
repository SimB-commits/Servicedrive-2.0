// pages/api/search/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

// Typ-definitioner för sökresultat
type SearchResultItem = {
  id: number;
  title: string;
  description: string;
  type: 'ticket' | 'customer' | 'setting';
  url: string;
  icon?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, any>;
};

type SearchResponse = {
  tickets: SearchResultItem[];
  customers: SearchResultItem[];
  settings: SearchResultItem[];
  totalCount: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Säkerställ att användaren är inloggad
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Hämta söktermen och kategorifilter från request
    const { q: searchTerm, category = 'all' } = req.query;
    
    // Validera söktermen
    if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim().length < 2) {
      return res.status(400).json({
        error: 'Sökterm krävs och måste vara minst 2 tecken lång'
      });
    }
    
    // Normalisera söktermen och logga för GDPR
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    logger.info(`Användare ${session.user.email} sökte: ${normalizedSearchTerm}`, {
      userId: session.user.id,
      action: 'global_search',
      searchTerm: normalizedSearchTerm
    });

    // Förbered resultatobjekt
    const result: SearchResponse = {
      tickets: [],
      customers: [],
      settings: [],
      totalCount: 0
    };

    // Hämta data från relevanta källor baserat på kategori
    const storeId = session.user.storeId;

    // Bara sök i butiker som användaren har behörighet till
    if (!storeId) {
      return res.status(403).json({ error: 'Ingen aktiv butik vald' });
    }

    // Sök efter ärenden baserat på matchande kunder, dynamicFields, etc.
    if (category === 'all' || category === 'tickets') {
      const tickets = await prisma.ticket.findMany({
        where: {
          storeId,
          OR: [
            // Sök i ärendets dynamiska fält (lägg till fler relevanta fält vid behov)
            {
              dynamicFields: {
                path: '$',
                string_contains: normalizedSearchTerm
              }
            },
            // Sök efter ärenden kopplade till kunder med matchande namn eller email
            {
              customer: {
                OR: [
                  { firstName: { contains: normalizedSearchTerm, mode: 'insensitive' } },
                  { lastName: { contains: normalizedSearchTerm, mode: 'insensitive' } },
                  { email: { contains: normalizedSearchTerm, mode: 'insensitive' } }
                ]
              }
            },
            // Sök i ID (om söktermen är ett nummer)
            ...(/^\d+$/.test(normalizedSearchTerm) ? [{ id: parseInt(normalizedSearchTerm) }] : [])
          ]
        },
        include: {
          customer: true,
          ticketType: true,
          customStatus: true
        },
        take: 20, // Begränsa resultaten för prestanda
      });

      // Mappa ärenden till sökresultatformat
      result.tickets = tickets.map(ticket => {
        // Skapa en beskrivande titel för ärendet
        const ticketTitle = ticket.ticketType ? 
          `${ticket.ticketType.name}` : 
          `Ärende #${ticket.id}`;
        
        // Hitta ett representativt värde från dynamiska fält
        let description = '';
        if (ticket.dynamicFields && typeof ticket.dynamicFields === 'object') {
          // Försök hitta ett beskrivande fält
          const dynamicFields = ticket.dynamicFields as Record<string, any>;
          const keys = Object.keys(dynamicFields);
          if (keys.length > 0) {
            // Prioritera vissa fältnamn om de finns
            const priorityFields = ['beskrivning', 'kommentar', 'produkt', 'ärende', 'problem'];
            const foundKey = priorityFields.find(field => 
              keys.some(key => key.toLowerCase().includes(field))
            );
            
            if (foundKey) {
              const key = keys.find(k => k.toLowerCase().includes(foundKey));
              if (key) description = String(dynamicFields[key]);
            } else {
              // Använd första värdet som är en sträng
              for (const key of keys) {
                if (typeof dynamicFields[key] === 'string') {
                  description = dynamicFields[key];
                  break;
                }
              }
            }
          }
        }
        
        // Om ingen beskrivning hittades, använd kundnamn
        if (!description && ticket.customer) {
          const customerName = ticket.customer.firstName || ticket.customer.lastName ?
            `${ticket.customer.firstName || ''} ${ticket.customer.lastName || ''}`.trim() :
            ticket.customer.email;
          description = `Kund: ${customerName}`;
        }

        // Lägg till status och datum om beskrivningen fortfarande är tom
        if (!description) {
          const status = ticket.customStatus?.name || ticket.status;
          description = `Status: ${status}`;
        }

        return {
          id: ticket.id,
          title: ticketTitle,
          description: description,
          type: 'ticket' as const,
          url: `/arenden/${ticket.id}`,
          icon: 'ticket',
          createdAt: ticket.createdAt?.toISOString(),
          updatedAt: ticket.updatedAt?.toISOString(),
          metadata: {
            status: ticket.customStatus?.name || ticket.status,
            statusColor: ticket.customStatus?.color || null,
            customerId: ticket.customer?.id,
            customerName: ticket.customer ? 
              `${ticket.customer.firstName || ''} ${ticket.customer.lastName || ''}`.trim() : 
              undefined
          }
        };
      });
    }

    // Sök efter kunder
    if (category === 'all' || category === 'customers') {
      const customers = await prisma.customer.findMany({
        where: {
          storeId,
          OR: [
            { firstName: { contains: normalizedSearchTerm, mode: 'insensitive' } },
            { lastName: { contains: normalizedSearchTerm, mode: 'insensitive' } },
            { email: { contains: normalizedSearchTerm, mode: 'insensitive' } },
            { phoneNumber: { contains: normalizedSearchTerm, mode: 'insensitive' } },
            { address: { contains: normalizedSearchTerm, mode: 'insensitive' } },
            { city: { contains: normalizedSearchTerm, mode: 'insensitive' } },
            { postalCode: { contains: normalizedSearchTerm, mode: 'insensitive' } },
            // Sök i ID (om söktermen är ett nummer)
            ...(/^\d+$/.test(normalizedSearchTerm) ? [{ id: parseInt(normalizedSearchTerm) }] : [])
          ]
        },
        take: 20, // Begränsa resultaten för prestanda
      });

      // Mappa kunder till sökresultatformat
      result.customers = customers.map(customer => {
        const customerName = customer.firstName || customer.lastName ?
          `${customer.firstName || ''} ${customer.lastName || ''}`.trim() :
          `Kund #${customer.id}`;
          
        const description = [
          customer.email,
          customer.phoneNumber,
          customer.address ? 
            `${customer.address}${customer.postalCode ? ', ' + customer.postalCode : ''}${customer.city ? ', ' + customer.city : ''}` : 
            null
        ].filter(Boolean).join(' • ');

        return {
          id: customer.id,
          title: customerName,
          description,
          type: 'customer' as const,
          url: `/kunder/${customer.id}`,
          icon: 'customer',
          createdAt: customer.createdAt?.toISOString(),
          updatedAt: customer.updatedAt?.toISOString(),
          metadata: {
            email: customer.email,
            phoneNumber: customer.phoneNumber,
            isLoyal: customer.loyal
          }
        };
      });
    }

    // Sök efter inställningar (baserat på förutsägbara URL:er och namn)
    if (category === 'all' || category === 'settings') {
      // Inställningssökning: Förlita oss på en fördefinierad lista med inställningar
      // och filtrera baserat på sökterm
      const settingsOptions = [
        { 
          id: 1, 
          title: 'Ärendetyper', 
          description: 'Skapa och hantera olika typer av ärenden med anpassade fält', 
          url: '/installningar?tab=arendetyper' 
        },
        { 
          id: 2, 
          title: 'Ärendestatusar', 
          description: 'Skapa och hantera statusar för ärenden', 
          url: '/installningar?tab=arendestatusar' 
        },
        { 
          id: 3, 
          title: 'Kundkortsmallar', 
          description: 'Hantera mallar för kundkort', 
          url: '/installningar?tab=kundkortsmallar' 
        },
        { 
          id: 4, 
          title: 'Mailmallar', 
          description: 'Skapa och hantera mailmallar för automatiserad kommunikation', 
          url: '/installningar?tab=mailmallar' 
        },
        { 
          id: 5, 
          title: 'E-postinställningar', 
          description: 'Konfigurera e-postinställningar för din butik', 
          url: '/installningar?tab=email' 
        },
        { 
          id: 6, 
          title: 'Användarkonto', 
          description: 'Hantera ditt användarkonto, byt lösenord och inställningar', 
          url: '/installningar?tab=konto' 
        },
        { 
          id: 7, 
          title: 'Butiksinställningar', 
          description: 'Hantera butiksinformation och inställningar', 
          url: '/installningar?tab=butiker' 
        },
        { 
          id: 8, 
          title: 'Import/Export', 
          description: 'Importera eller exportera data', 
          url: '/installningar?tab=dataimport' 
        },
      ];
      
      // Filtrera inställningsalternativ baserat på söktermen
      const matches = settingsOptions.filter(setting => {
        return (
          setting.title.toLowerCase().includes(normalizedSearchTerm) ||
          setting.description.toLowerCase().includes(normalizedSearchTerm)
        );
      });
      
      result.settings = matches.map(match => ({
        id: match.id,
        title: match.title,
        description: match.description,
        type: 'setting' as const,
        url: match.url,
        icon: 'setting'
      }));
    }

    // Beräkna totalt antal träffar
    result.totalCount = result.tickets.length + result.customers.length + result.settings.length;

    // Returnera resultatet
    return res.status(200).json(result);
  } catch (error: any) {
    logger.error('Error in global search:', { 
      error: error instanceof Error ? error.message : "Okänt fel",
      query: req.query
    });

    if (error.constructor?.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }

    return res.status(500).json({ message: 'Ett internt serverfel uppstod.' });
  } finally {
    await prisma.$disconnect();
  }
}