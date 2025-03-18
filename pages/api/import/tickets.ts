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
        
        // Hitta kunden baserat på external_id, internt id eller e-post
        let customerId: number | undefined;

        // Först: om ett externt id finns med, använd det
        if (ticketData.customer_external_id) {
          const customer = await prisma.customer.findUnique({
            where: { 
              externalId_storeId: {
                externalId: Number(ticketData.customer_external_id),
                storeId: session.user.storeId
              } },
          });
          if (!customer) {
            results.failed++;
            results.errors.push(
              `Rad ${i + 1}: Kunde inte hitta kund med external id ${ticketData.customer_external_id}`
            );
            continue;
          }
          customerId = customer.id;
        }

        // Om inget externt id användes, kolla om ett internt id skickats med
        if (!customerId && ticketData.customerId) {
          customerId = Number(ticketData.customerId);
        }

        // Om det fortfarande saknas, försök att hitta kunden via e-post
        if (!customerId && ticketData.customerEmail) {
          const customer = await prisma.customer.findFirst({
            where: {
              email: ticketData.customerEmail,
              storeId: session.user.storeId,
            },
          });
          if (!customer) {
            results.failed++;
            results.errors.push(
              `Rad ${i + 1}: Kunde inte hitta kund med e-post ${ticketData.customerEmail}`
            );
            continue;
          }
          customerId = customer.id;
        }

        if (!customerId) {
          results.failed++;
          results.errors.push(
            `Rad ${i + 1}: Ingen kund angiven (varken external id, internt id eller e-post)`
          );
          continue;
        }

        
        // Välj ärendetyp, antingen från data eller ta första tillgängliga
        let ticketTypeId = ticketData.ticketTypeId;
        
        if (!ticketTypeId) {
          ticketTypeId = ticketTypes[0].id;
        }
        
        // Konvertera status om den anges som text
        let status = TicketStatus.OPEN; // Standardvärde
        let customStatusObj = null;
        
        if (ticketData.status) {
          if (typeof ticketData.status === 'string') {
            const statusValue = ticketData.status.toUpperCase().trim();
            
            // Kontrollera om det är en dynamisk status (börjar med "CUSTOM_")
            if (statusValue.startsWith('CUSTOM_')) {
              const customStatusId = Number(statusValue.replace('CUSTOM_', ''));
              if (customStatusId) {
                customStatusObj = {
                  connect: { id: customStatusId }
                };
              }
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
        
        // Hantera dynamiska fält - samla alla fält som inte har en direkt mappning
        const dynamicFieldData: Record<string, any> = {};
        
        // Om vi har dynamicFields i den inkommande datan, använd dem som bas
        if (ticketData.dynamicFields && typeof ticketData.dynamicFields === 'object') {
          Object.assign(dynamicFieldData, ticketData.dynamicFields);
        }
        
        // Hitta fält i den inkommande datan som inte finns i standard schema för Ticket
        // och lägg till dem i dynamicFields
        const standardFields = [
          'title', 'description', 'status', 'dueDate', 'ticketTypeId', 
          'customerId', 'customerEmail', 'dynamicFields'
        ];
        
        // Identifiera icke-standard fält i inkommande data
        for (const key in ticketData) {
          if (
            !standardFields.includes(key) && 
            ticketData[key] !== undefined && 
            ticketData[key] !== null
          ) {
            // Lägg till i dynamiska fält
            dynamicFieldData[key] = ticketData[key];
          }
        }
        
        // Ladda ärendetypen för att hämta fältspecifikation
        const ticketType = await prisma.ticketType.findUnique({
          where: { id: ticketTypeId },
          include: { fields: true }
        });
        
        // Om vi har ärendetypspecifika fält, se till att värden valideras och konverteras korrekt
        if (ticketType?.fields && ticketType.fields.length > 0) {
          // Iterera över ärendetypens fält och validera/konvertera värden
          ticketType.fields.forEach(field => {
            const fieldName = field.name;
            // Kontrollera om fältet finns i de dynamiska fälten
            if (dynamicFieldData[fieldName] !== undefined) {
              // Validera och konvertera baserat på fälttyp
              switch (field.fieldType) {
                case 'NUMBER':
                  // Konvertera till nummer om möjligt
                  dynamicFieldData[fieldName] = Number(dynamicFieldData[fieldName]) || 0;
                  break;
                case 'DATE':
                case 'DUE_DATE':
                  // Konvertera till datum om det inte redan är det
                  try {
                    if (typeof dynamicFieldData[fieldName] === 'string') {
                      dynamicFieldData[fieldName] = new Date(dynamicFieldData[fieldName]).toISOString();
                    }
                  } catch (error) {
                    console.warn(`Kunde inte konvertera ${fieldName} till datum:`, error);
                  }
                  break;
                case 'CHECKBOX':
                  // Konvertera till boolean
                  if (typeof dynamicFieldData[fieldName] === 'string') {
                    dynamicFieldData[fieldName] = ['true', 'yes', 'ja', '1', 'y'].includes(
                      dynamicFieldData[fieldName].toLowerCase()
                    );
                  } else {
                    dynamicFieldData[fieldName] = Boolean(dynamicFieldData[fieldName]);
                  }
                  break;
                // TEXT behöver ingen särskild hantering
              }
            }
          });
        }
        
        // Förbered data för att skapa ärendet
        const ticketCreateData: any = {
          title: ticketData.title || 'Importerat ärende',
          description: ticketData.description || '',
          status: status,
          dueDate: ticketData.dueDate ? new Date(ticketData.dueDate) : null,
          dynamicFields: dynamicFieldData, // Använd de bearbetade dynamiska fälten
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
        
        // Validera att nödvändiga datatyper är korrekta innan vi försöker skapa ärendet
        // Detta förhindrar typfel vid skapandet
        if (typeof ticketCreateData.title !== 'string') {
          ticketCreateData.title = String(ticketCreateData.title || 'Importerat ärende');
        }
        
        if (typeof ticketCreateData.description !== 'string') {
          ticketCreateData.description = String(ticketCreateData.description || '');
        }
        
        // Kontrollera att dynamicFields är ett objekt, inte en sträng eller null
        if (typeof ticketCreateData.dynamicFields !== 'object' || ticketCreateData.dynamicFields === null) {
          ticketCreateData.dynamicFields = {}; // Återställ till tomt objekt om det inte är ett objekt
        }
        
        // Validera IDs
        ticketCreateData.store.connect.id = Number(ticketCreateData.store.connect.id);
        ticketCreateData.ticketType.connect.id = Number(ticketCreateData.ticketType.connect.id);
        ticketCreateData.customer.connect.id = Number(ticketCreateData.customer.connect.id);
        
        // Endast lägg till customStatus om vi har ett customStatusObj
        if (customStatusObj) {
          ticketCreateData.customStatus = customStatusObj;
        }
        
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
