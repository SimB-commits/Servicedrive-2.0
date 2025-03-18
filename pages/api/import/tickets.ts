// pages/api/import/tickets.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, TicketStatus } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import { importTicketSchema } from '@/utils/validation';
import rateLimiter from '@/lib/rateLimiterApi';
import { parseDate } from '@/utils/date-formatter';

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

    // Skapa en mappning av ärendetyper för snabb uppslag
    const ticketTypeById = new Map();
    const ticketTypeByName = new Map();
    
    ticketTypes.forEach(type => {
      ticketTypeById.set(type.id, type);
      ticketTypeByName.set(type.name.toLowerCase(), type);
    });

    // Logga tillgängliga ärendetyper för felsökning
    console.log('Tillgängliga ärendetyper:', ticketTypes.map(t => ({ id: t.id, name: t.name })));

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
        
        let customerId: number | undefined;

        // Normalize external ID fields - look for various common field names
        const customerExternalId = ticketData.customer_external_id || 
                                  ticketData.external_id || 
                                  ticketData.customer_id ||
                                  ticketData.kundnummer;

        // Först: om ett externt id finns med, använd det
        if (customerExternalId) {
          const externalId = Number(customerExternalId);
          
          // Använd findFirst för att hitta kund med externt ID
          const customer = await prisma.customer.findFirst({
            where: { 
              externalId: externalId,
              storeId: session.user.storeId
            }
          });
          
          if (!customer) {
            results.failed++;
            results.errors.push(
              `Rad ${i + 1}: Kunde inte hitta kund med externt id ${externalId}`
            );
            continue;
          }
          customerId = customer.id;
        }

        // Om inget externt id användes, kolla om ett internt id skickats med
        if (!customerId && ticketData.customerId) {
          customerId = Number(ticketData.customerId);
          
          // Verifiera att kunden faktiskt finns
          const customer = await prisma.customer.findFirst({
            where: { 
              id: customerId,
              storeId: session.user.storeId
            }
          });
          
          if (!customer) {
            results.failed++;
            results.errors.push(
              `Rad ${i + 1}: Kunde inte hitta kund med id ${customerId}`
            );
            continue;
          }
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
            `Rad ${i + 1}: Ingen kund angiven (varken externt id, internt id eller e-post)`
          );
          continue;
        }

        // Välj ärendetyp baserat på id eller namn
        let ticketTypeId = null;
        let resolvedTicketType = null;
        
        // Försök hitta ärendetyp via ID
        if (ticketData.ticketTypeId) {
          const typeId = Number(ticketData.ticketTypeId);
          resolvedTicketType = ticketTypeById.get(typeId);
          
          // Om ID:t inte finns i vår databas, logga detta
          if (!resolvedTicketType) {
            console.log(`Rad ${i + 1}: Ärendetyp med ID ${typeId} hittades inte i databasen.`);
          }
        }
        
        // Om ingen ärendetyp hittades via ID, försök med namn
        if (!resolvedTicketType && ticketData.ticketTypeName) {
          const typeName = String(ticketData.ticketTypeName).toLowerCase();
          resolvedTicketType = ticketTypeByName.get(typeName);
          
          // Om namnet inte matchar exakt, försök med partiell matchning
          if (!resolvedTicketType) {
            for (const [name, type] of ticketTypeByName.entries()) {
              if (name.includes(typeName) || typeName.includes(name)) {
                resolvedTicketType = type;
                console.log(`Rad ${i + 1}: Partiell matchning av ärendetyp: "${typeName}" -> "${name}"`);
                break;
              }
            }
          }
        }
        
        // Om vi fortfarande inte hittat en ärendetyp, använd den första i listan
        if (!resolvedTicketType) {
          resolvedTicketType = ticketTypes[0];
          console.log(`Rad ${i + 1}: Använder default ärendetyp: ${resolvedTicketType.name}`);
        }
        
        ticketTypeId = resolvedTicketType.id;
        
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
                // Först kontrollera att status faktiskt finns i databasen
                const statusExists = await prisma.userTicketStatus.findFirst({
                  where: { 
                    id: customStatusId,
                    storeId: session.user.storeId
                  }
                });
                
                if (statusExists) {
                  customStatusObj = {
                    connect: { id: customStatusId }
                  };
                }
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
                case 'FÄRDIGT':
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
          'customerId', 'customerEmail', 'dynamicFields', 'createdAt', 'updatedAt'
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
        
        // Konvertera fältvärden baserat på ärendetypens fältspecifikationer
        if (resolvedTicketType.fields && resolvedTicketType.fields.length > 0) {
          // Iterera över ärendetypens fält och validera/konvertera värden
          resolvedTicketType.fields.forEach(field => {
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
                  // Konvertera till datum med parseDate-funktionen
                  const parsedDate = parseDate(dynamicFieldData[fieldName]);
                  if (parsedDate) {
                    dynamicFieldData[fieldName] = parsedDate;
                    
                    // Om detta är ett DUE_DATE-fält, sätt även dueDate på ärendet
                    if (field.fieldType === 'DUE_DATE' && !ticketCreateData.dueDate) {
                      ticketCreateData.dueDate = new Date(parsedDate);
                    }
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
          // Använd parseDate för att hantera olika datumformat
          dueDate: parseDate(ticketData.dueDate) ? new Date(parseDate(ticketData.dueDate) as string) : null,
          dynamicFields: dynamicFieldData,
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
        
        // NY FUNKTIONALITET: Hantera createdAt och updatedAt från importerad data
        
        // Kontrollera om createdAt finns i importdatan och är giltigt
        if (ticketData.createdAt) {
          const parsedCreatedAt = parseDate(ticketData.createdAt);
          if (parsedCreatedAt) {
            // Använd raw Prisma query parameter för att kunna sätta createdAt 
            // Dessa fält är normalt hanterade av Prisma automatiskt
            ticketCreateData.createdAt = new Date(parsedCreatedAt);
          }
        }
        
        // Kontrollera om updatedAt finns i importdatan och är giltigt
        if (ticketData.updatedAt) {
          const parsedUpdatedAt = parseDate(ticketData.updatedAt);
          if (parsedUpdatedAt) {
            // Om både createdAt och updatedAt finns, se till att updatedAt inte är tidigare än createdAt
            if (ticketCreateData.createdAt && new Date(parsedUpdatedAt) < ticketCreateData.createdAt) {
              // Ignorera updatedAt om det är tidigare än createdAt
              console.log(`Rad ${i + 1}: updatedAt (${parsedUpdatedAt}) är tidigare än createdAt (${ticketCreateData.createdAt}), använder createdAt för updatedAt`);
              ticketCreateData.updatedAt = ticketCreateData.createdAt;
            } else {
              ticketCreateData.updatedAt = new Date(parsedUpdatedAt);
            }
          }
        } else if (ticketCreateData.createdAt) {
          // Om bara createdAt finns, använd det för updatedAt också
          ticketCreateData.updatedAt = ticketCreateData.createdAt;
        }
        
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
        
        // Logga data innan vi skapar ärendet (för felsökning)
        console.log(`Rad ${i + 1}: Skapar ärende med ärendetyp ID ${ticketTypeId}`);
        if (ticketCreateData.createdAt) {
          console.log(`Rad ${i + 1}: Använder createdAt från importdata: ${ticketCreateData.createdAt}`);
        }
        
        try {
          // Skapa ärendet i databasen
          await prisma.ticket.create({
            data: ticketCreateData
          });
          
          results.success++;
        } catch (error: any) {
          results.failed++;
          
          // Förbättrad felhantering för Prisma-fel
          if (error.code === 'P2025') {
            // Record not found - mer specifikt felmeddelande
            if (error.message.includes('TicketType')) {
              results.errors.push(`Rad ${i + 1}: Ärendetypen med ID ${ticketTypeId} hittades inte i databasen. Skapa denna ärendetyp först eller använd en befintlig.`);
            } else if (error.message.includes('Customer')) {
              results.errors.push(`Rad ${i + 1}: Kunden med ID ${customerId} hittades inte i databasen.`);
            } else {
              results.errors.push(`Rad ${i + 1}: En nödvändig relation hittades inte: ${error.message}`);
            }
          } else {
            // Förenklat felmeddelande
            const simplifiedError = error.message.split('\n')[0];  // Ta bara första raden av felmeddelandet
            results.errors.push(`Rad ${i + 1}: ${simplifiedError}`);
          }
        }
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