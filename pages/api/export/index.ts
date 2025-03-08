// pages/api/export/index.ts
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

    // Endast tillåt GET-metoden för export
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // Hämta frågesträngsparametrar
    const { 
      type = 'all',
      includeRelations = 'true',
      format = 'json',
      limit = '1000' 
    } = req.query;

    const exportType = String(type);
    const withRelations = String(includeRelations) === 'true';
    const exportFormat = String(format);
    const limitCount = Math.min(parseInt(String(limit), 10) || 1000, 5000); // Max 5000 poster

    // Validera exporttyp
    if (!['customers', 'tickets', 'all'].includes(exportType)) {
      return res.status(400).json({ error: 'Ogiltig exporttyp. Måste vara "customers", "tickets" eller "all".' });
    }

    // Validera format 
    if (!['json', 'csv', 'excel'].includes(exportFormat)) {
      return res.status(400).json({ error: 'Ogiltigt format. Måste vara "json", "csv" eller "excel".' });
    }

    // Hämta data baserat på exporttyp
    let data: any = {};

    // Hämta kunder om exporttyp är 'customers' eller 'all'
    if (exportType === 'customers' || exportType === 'all') {
      const customers = await prisma.customer.findMany({
        where: { storeId: session.user.storeId },
        take: limitCount,
        include: {
          tickets: withRelations, // Inkludera tickets endast om relationer önskas
        }
      });
      
      // Transformera kundata för export
      data.customers = customers.map(customer => {
        const exportedCustomer: any = {
          id: customer.id,
          firstName: customer.firstName || '',
          lastName: customer.lastName || '',
          email: customer.email || '',
          phoneNumber: customer.phoneNumber || '',
          address: customer.address || '',
          postalCode: customer.postalCode || '',
          city: customer.city || '',
          country: customer.country || '',
          dateOfBirth: customer.dateOfBirth ? new Date(customer.dateOfBirth).toISOString().split('T')[0] : '',
          newsletter: customer.newsletter || false,
          loyal: customer.loyal || false,
        };

        // Lägg till dynamiska fält om de finns
        if (customer.dynamicFields && typeof customer.dynamicFields === 'object') {
          Object.entries(customer.dynamicFields as object).forEach(([key, value]) => {
            exportedCustomer[`custom_${key}`] = value;
          });
        }

        // Lägg till relationer om de önskas
        if (withRelations && customer.tickets) {
          exportedCustomer.ticketCount = customer.tickets.length;
        }

        return exportedCustomer;
      });
    }

    // Hämta ärenden om exporttyp är 'tickets' eller 'all'
    if (exportType === 'tickets' || exportType === 'all') {
      const tickets = await prisma.ticket.findMany({
        where: { storeId: session.user.storeId },
        take: limitCount,
        include: {
          customer: true,
          user: true,
          assignedUser: true,
          ticketType: {
            include: { fields: true }, // Viktigt för att få med fältinformation
          },
          customStatus: true,
          messages: withRelations, // Inkludera messages endast om relationer önskas
        },
        orderBy: { createdAt: 'desc' }
      });

      // Förbättring 1: Hämta ALLA ärendetyper, inte bara de som finns i aktuella ärenden
      // Detta säkerställer att vi har information om fält från alla möjliga ärendetyper
      const allTicketTypes = await prisma.ticketType.findMany({
        where: { storeId: session.user.storeId },
        include: { fields: true }
      });

      // Förbättring 2: Skapa en sammanslagen mängd av alla dynamiska fält från alla ärendetyper
      const allDynamicFields = new Set<string>();
      
      // Lägg till fält från aktuella ärenden
      tickets.forEach(ticket => {
        if (ticket.dynamicFields && typeof ticket.dynamicFields === 'object') {
          Object.keys(ticket.dynamicFields as object).forEach(key => {
            allDynamicFields.add(key);
          });
        }
      });
      
      // Lägg även till fält från ärendetypsdefinitionerna
      allTicketTypes.forEach(ticketType => {
        if (ticketType.fields && Array.isArray(ticketType.fields)) {
          ticketType.fields.forEach(field => {
            if (field.name) {
              allDynamicFields.add(field.name);
            }
          });
        }
      });
      
      console.log('Alla dynamiska fält som kommer att exporteras:', Array.from(allDynamicFields));

      // Transformera ärendedata för export
      data.tickets = tickets.map(ticket => {
        const exportedTicket: any = {
          id: ticket.id,
          title: ticket.title || '',
          description: ticket.description || '',
          status: ticket.customStatus ? `${ticket.customStatus.name} (Anpassad)` : ticket.status || '',
          createdAt: ticket.createdAt ? new Date(ticket.createdAt).toISOString().split('T')[0] : '',
          updatedAt: ticket.updatedAt ? new Date(ticket.updatedAt).toISOString().split('T')[0] : '',
          dueDate: ticket.dueDate ? new Date(ticket.dueDate).toISOString().split('T')[0] : '',
          
          // Kopplingar
          customerId: ticket.customerId,
          customerEmail: ticket.customer?.email || '',
          customerName: ticket.customer ? `${ticket.customer.firstName || ''} ${ticket.customer.lastName || ''}`.trim() : '',
          ticketTypeId: ticket.ticketTypeId,
          ticketTypeName: ticket.ticketType?.name || '',
        };
        
        // Lägg till anpassad status om det finns
        if (ticket.customStatus) {
          exportedTicket.customStatusName = ticket.customStatus.name;
          exportedTicket.customStatusColor = ticket.customStatus.color;
        }

        // Lägg till ALLA dynamiska fält från alla ärendetyper
        // Använd endast field_* formatet för konsekvent namngivning
        allDynamicFields.forEach(fieldName => {
          const fieldValue = ticket.dynamicFields && typeof ticket.dynamicFields === 'object' 
            ? (ticket.dynamicFields as any)[fieldName] 
            : '';
          exportedTicket[`field_${fieldName}`] = fieldValue !== undefined ? fieldValue : '';
        });
        
        // Lägg till relationer om de önskas
        if (withRelations) {
          if (ticket.messages && Array.isArray(ticket.messages)) {
            exportedTicket.messageCount = ticket.messages.length;
            
            // Sortera för att få det senaste meddelandet först
            if (ticket.messages.length > 0) {
              const sortedMessages = [...ticket.messages].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );
              
              exportedTicket.lastMessageDate = sortedMessages[0]
                ? new Date(sortedMessages[0].createdAt).toISOString().split('T')[0]
                : '';
            } else {
              exportedTicket.lastMessageDate = '';
            }
          }
          
          if (ticket.assignedUser) {
            exportedTicket.assignedUserEmail = ticket.assignedUser.email;
          }
        }
        
        return exportedTicket;
      });
    }

    // Returnera exportdata
    if (exportType === 'all') {
      return res.status(200).json(data);
    } else {
      return res.status(200).json(data[exportType] || []);
    }

  } catch (error: any) {
    console.error('Error in export API:', error.message);

    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }
    
    // Returnera standardiserat felmeddelande
    return res.status(500).json({ 
      message: 'Ett fel uppstod under exporten.',
      error: error.message || 'Internt serverfel'
    });
  } finally {
    await prisma.$disconnect();
  }
}