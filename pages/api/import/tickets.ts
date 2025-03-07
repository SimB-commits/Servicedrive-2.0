// pages/api/import/tickets.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, TicketStatus } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import { importTicketSchema } from '@/utils/validation';
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

    // Endast tillåt POST-metoden
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // Hämta importdata - stöd både enstaka objekt och array
    const importData = Array.isArray(req.body.data) ? req.body.data : [req.body.data];
    const options = req.body.options || {};

    // Validera att det finns data att importera
    if (!importData || importData.length === 0) {
      return res.status(400).json({ 
        message: 'Ingen data att importera',
        success: 0,
        failed: 0,
        errors: []
      });
    }

    // Hämta alla ärendetyper för användarens butik
    const ticketTypes = await prisma.ticketType.findMany({
      where: { storeId: session.user.storeId },
      include: { fields: true }
    });

    if (ticketTypes.length === 0) {
      return res.status(400).json({
        message: 'Inga ärendetyper hittades för din butik. Skapa minst en ärendetyp innan du importerar ärenden.',
        success: 0,
        failed: importData.length,
        errors: ['Inga ärendetyper tillgängliga']
      });
    }

    // Initialisera resultaträknare
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Behandla varje ärende i importdatan
    for (let i = 0; i < importData.length; i++) {
      const ticketData = importData[i];
      
      try {
        // Validera med det flexibla import-schemat
        const parseResult = importTicketSchema.safeParse(ticketData);
        
        if (!parseResult.success) {
          const errors = parseResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }));
          
          results.failed++;
          results.errors.push(`Rad ${i + 1}: Valideringsfel - ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
          continue; // Hoppa över detta ärende och fortsätt med nästa
        }
        
        // Hitta kunden baserat på e-post eller id
        let customerId = ticketData.customerId;
        
        if (!customerId && ticketData.customerEmail) {
          const customer = await prisma.customer.findFirst({
            where: {
              email: ticketData.customerEmail,
              storeId: session.user.storeId
            }
          });
          
          if (!customer) {
            results.failed++;
            results.errors.push(`Rad ${i + 1}: Kunde inte hitta kund med e-post ${ticketData.customerEmail}`);
            continue;
          }
          
          customerId = customer.id;
        }
        
        if (!customerId) {
          results.failed++;
          results.errors.push(`Rad ${i + 1}: Ingen kund angiven (varken ID eller e-post)`);
          continue;
        }
        
        // Välj ärendetyp, antingen från data eller ta första tillgängliga
        let ticketTypeId = ticketData.ticketTypeId;
        
        if (!ticketTypeId) {
          ticketTypeId = ticketTypes[0].id;
        }
        
        // Konvertera status om den anges som text
        let status = TicketStatus.OPEN; // Standardvärde
        let customStatusId = null;
        
        if (ticketData.status) {
          if (typeof ticketData.status === 'string') {
            const statusValue = ticketData.status.toUpperCase().trim();
            
            // Kontrollera om det är en dynamisk status (börjar med "CUSTOM_")
            if (statusValue.startsWith('CUSTOM_')) {
              customStatusId = Number(statusValue.replace('CUSTOM_', ''));
            } else {
              // Försök mappa till enum-värden
              switch (statusValue) {
                case 'OPEN':
                case 'OPENED':
                case 'NEW':
                case 'NYA':
                case 'ÖPPEN':
                case 'ÖPPET':
                case 'ÖPPNA':
                  status = TicketStatus.OPEN;
                  break;
                case 'IN_PROGRESS':
                case 'INPROGRESS':
                case 'IN-PROGRESS':
                case 'ONGOING':
                case 'PÅGÅR':
                case 'PÅGÅENDE':
                  status = TicketStatus.IN_PROGRESS;
                  break;
                case 'RESOLVED':
                case 'LÖST':
                case 'SOLVED':
                  status = TicketStatus.RESOLVED;
                  break;
                case 'CLOSED':
                case 'CLOSE':
                case 'DONE':
                case 'COMPLETED':
                case 'FÄRDIG':
                case 'KLAR':
                case 'AVSLUTAD':
                case 'STÄNGD':
                  status = TicketStatus.CLOSED;
                  break;
                default:
                  // Om det inte matchar något känt värde, använd OPEN
                  status = TicketStatus.OPEN;
              }
            }
          }
        }
        
        // Förbered data för att skapa ärendet
        const ticketCreateData = {
          title: ticketData.title || 'Importerat ärende',
          description: ticketData.description || '',
          status: status,
          customStatusId: customStatusId,
          dueDate: ticketData.dueDate ? new Date(ticketData.dueDate) : null,
          dynamicFields: ticketData.dynamicFields || {},
          store: {
            connect: { id: session.user.storeId }
          },
          user: {
            connect: { id: session.user.id }
          },
          customer: {
            connect: { id: customerId }
          },
          ticketType: {
            connect: { id: ticketTypeId }
          }
        };
        
        // Skapa ärendet i databasen
        await prisma.ticket.create({
          data: ticketCreateData
        });
        
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Rad ${i + 1}: ${error.message || 'Okänt fel'}`);
      }
    }

    // Returnera resultatet
    return res.status(200).json({
      message: `Import slutförd. ${results.success} av ${importData.length} ärenden importerade.`,
      success: results.success,
      failed: results.failed,
      errors: results.errors
    });

  } catch (error: any) {
    console.error('Error in import/tickets.ts:', error.message);

    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }
    
    // Returnera standardiserat felmeddelande
    return res.status(500).json({ 
      message: 'Ett fel uppstod under importen.',
      success: 0,
      failed: 1,
      errors: [error.message || 'Internt serverfel']
    });
  } finally {
    await prisma.$disconnect();
  }
}