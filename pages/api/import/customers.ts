// Förbättrad version av pages/api/import/customers.ts med fokus på uppdateringsfunktionaliteten

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import { importCustomerSchema } from '@/utils/validation';
import rateLimiter from '@/lib/rateLimiterApi';

const prisma = new PrismaClient();

// Hjälpfunktion som rekursivt kontrollerar att alla strängar i ett objekt inte innehåller ersättningssymbolen �
function checkUTF8Validity(data: any): boolean {
  if (typeof data === 'string') {
    // Om strängen innehåller Unicode-replaceringssymbolen returneras false
    return !data.includes('\uFFFD');
  } else if (Array.isArray(data)) {
    return data.every(item => checkUTF8Validity(item));
  } else if (typeof data === 'object' && data !== null) {
    return Object.values(data).every(value => checkUTF8Validity(value));
  }
  return true; // För tal, boolean osv.
}

// Hjälpfunktion för att extrahera externt ID från olika möjliga fältnamn
function extractExternalId(data: any): number | undefined {
  const externalIdValue = 
    data.externalId || 
    data.external_id || 
    data.customer_id || 
    data.kundnummer ||
    data.externt_id;
  
  return externalIdValue ? Number(externalIdValue) : undefined;
}

// Hjälpfunktion för att kontrollera om en email är giltig
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

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
    const options = req.body.options || { skipExisting: true, updateExisting: false };

    // Validera att det finns data att importera
    if (!importData || importData.length === 0) {
      return res.status(400).json({ 
        message: 'Ingen data att importera',
        success: 0,
        failed: 0,
        errors: []
      });
    }

    // Kontrollera att data inte innehåller ogiltiga tecken (felaktig kodning)
    if (!checkUTF8Validity(importData)) {
      return res.status(400).json({
        message: 'Filen innehåller ogiltiga tecken. Se till att filen är sparad med UTF-8 encoding.',
        success: 0,
        failed: 0,
        errors: ['Filens teckenkodning är inte giltig UTF-8']
      });
    }

    // Logga det totala datat för felsökning
    console.log(`Importerar ${importData.length} kunder med alternativ:`, options);

    // Initialisera resultaträknare
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Behandla varje kund i importdatan
    for (let i = 0; i < importData.length; i++) {
      const customerData = importData[i];
      
      try {
        // Validera med det flexibla import-schemat
        const parseResult = importCustomerSchema.safeParse(customerData);
        
        if (!parseResult.success) {
          const errors = parseResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }));
          
          results.failed++;
          results.errors.push(`Rad ${i + 1}: Valideringsfel - ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
          continue; // Hoppa över denna kund och fortsätt med nästa
        }
        
        // Extrahera externt ID från olika möjliga fält
        const externalIdValue = extractExternalId(customerData);
        
        // Logga det extraherade externa ID:t för felsökning
        if (externalIdValue) {
          console.log(`Rad ${i + 1}: Hittade externt ID ${externalIdValue}`);
        }

        // Kontrollera om e-postadressen är giltig
        const email = parseResult.data.email;
        if (!email || !isValidEmail(email)) {
          results.failed++;
          results.errors.push(`Rad ${i + 1}: Ogiltig eller saknad e-postadress`);
          continue;
        }

        // Sökning efter befintlig kund baserat på e-post eller externt ID
        let existingCustomer = null;
        
        // Först sök efter e-post
        if (email) {
          existingCustomer = await prisma.customer.findFirst({
            where: {
              email: email,
              storeId: session.user.storeId
            }
          });
        }
        
        // Om ingen kund hittades via e-post, sök med externt ID
        if (!existingCustomer && externalIdValue) {
          existingCustomer = await prisma.customer.findFirst({
            where: {
              externalId: externalIdValue,
              storeId: session.user.storeId
            }
          });
        }
        
        // Vi har hittat en befintlig kund
        if (existingCustomer) {
          // Hantera befintlig kund baserat på valda alternativ
          if (options.updateExisting) {
            // Uppdatera befintlig kund med nya värden
            try {
              // Förbered uppdateringsdata - endast inkludera fält som faktiskt har värden
              // Detta är viktigt för att inte överskriva befintliga värden med null/undefined
              const updateData: any = {};
              
              // Kontrollera varje fält och lägg bara till dem som har ett definierat värde
              if (parseResult.data.firstName !== undefined && parseResult.data.firstName !== null) {
                updateData.firstName = parseResult.data.firstName;
              }
              
              if (parseResult.data.lastName !== undefined && parseResult.data.lastName !== null) {
                updateData.lastName = parseResult.data.lastName;
              }
              
              if (parseResult.data.phoneNumber !== undefined && parseResult.data.phoneNumber !== null) {
                updateData.phoneNumber = parseResult.data.phoneNumber;
              }
              
              if (parseResult.data.address !== undefined && parseResult.data.address !== null) {
                updateData.address = parseResult.data.address;
              }
              
              if (parseResult.data.postalCode !== undefined && parseResult.data.postalCode !== null) {
                updateData.postalCode = parseResult.data.postalCode;
              }
              
              if (parseResult.data.city !== undefined && parseResult.data.city !== null) {
                updateData.city = parseResult.data.city;
              }
              
              if (parseResult.data.country !== undefined && parseResult.data.country !== null) {
                updateData.country = parseResult.data.country;
              }
              
              // Hantera datum särskilt eftersom det kan behöva konverteras
              if (parseResult.data.dateOfBirth) {
                updateData.dateOfBirth = new Date(parseResult.data.dateOfBirth);
              } else if (parseResult.data.dateOfBirth === null) {
                updateData.dateOfBirth = null; // Tillåt explicit radering av födelsedatum
              }
              
              // Boolean-fält
              if (parseResult.data.newsletter !== undefined) {
                updateData.newsletter = parseResult.data.newsletter;
              }
              
              if (parseResult.data.loyal !== undefined) {
                updateData.loyal = parseResult.data.loyal;
              }
              
              // Hantera dynamiska fält - behåll befintliga fält som inte uppdateras
              if (parseResult.data.dynamicFields && typeof parseResult.data.dynamicFields === 'object') {
                // Om kunden har befintliga dynamiska fält, slå ihop dem
                if (existingCustomer.dynamicFields && typeof existingCustomer.dynamicFields === 'object') {
                  updateData.dynamicFields = {
                    ...existingCustomer.dynamicFields,
                    ...parseResult.data.dynamicFields
                  };
                } else {
                  updateData.dynamicFields = parseResult.data.dynamicFields;
                }
              }
              
              // Uppdatera externt ID endast om det inte fanns tidigare och det nu tillhandahålls
              if (externalIdValue && !existingCustomer.externalId) {
                updateData.externalId = externalIdValue;
              }
              
              // Endast uppdatera om vi har fält att uppdatera
              if (Object.keys(updateData).length > 0) {
                // Logga uppdateringen för felsökning
                console.log(`Rad ${i + 1}: Uppdaterar kund ${existingCustomer.id} med data:`, updateData);
                
                // Genomför uppdateringen
                await prisma.customer.update({
                  where: { id: existingCustomer.id },
                  data: updateData
                });
                
                results.success++;
              } else {
                // Inget att uppdatera, räkna som framgång ändå
                console.log(`Rad ${i + 1}: Ingen data att uppdatera för kund ${existingCustomer.id}`);
                results.success++;
              }
            } catch (error: any) {
              results.failed++;
              results.errors.push(`Rad ${i + 1}: Fel vid uppdatering av kund - ${error.message || 'Okänt fel'}`);
            }
          } else if (options.skipExisting) {
            // Hoppa över befintliga kunder men räkna dem som lyckat importerade
            console.log(`Rad ${i + 1}: Hoppar över befintlig kund med e-post ${email}`);
            results.success++;
          } else {
            // Alternativet är att rapportera dem som fel
            results.failed++;
            results.errors.push(`Rad ${i + 1}: En kund med denna e-postadress finns redan`);
          }
          
          // Fortsätt med nästa post eftersom vi har hanterat den befintliga kunden
          continue;
        }
        
        // Om vi kommer hit, ska vi skapa en ny kund
        // Förbered data för att skapa ny kund
        const customerDataForPrisma = {
          firstName: parseResult.data.firstName,
          lastName: parseResult.data.lastName,
          email: email,
          phoneNumber: parseResult.data.phoneNumber,
          address: parseResult.data.address,
          postalCode: parseResult.data.postalCode,
          city: parseResult.data.city,
          country: parseResult.data.country,
          dateOfBirth: parseResult.data.dateOfBirth ? new Date(parseResult.data.dateOfBirth) : null,
          newsletter: parseResult.data.newsletter || false,
          loyal: parseResult.data.loyal || false,
          dynamicFields: parseResult.data.dynamicFields || {},
          storeId: session.user.storeId
        };
        
        // Lägg till externt ID om det finns
        if (externalIdValue) {
          customerDataForPrisma.externalId = externalIdValue;
        }
        
        // Logga data som skapas för felsökning
        console.log(`Rad ${i + 1}: Skapa kund med data:`, JSON.stringify(customerDataForPrisma));
        
        // Skapa kunden i databasen
        await prisma.customer.create({
          data: customerDataForPrisma
        });
        
        results.success++;
      } catch (error: any) {
        results.failed++;
        
        // Logga hela felet för djupare felsökning
        console.error(`Fel vid import av kund (rad ${i + 1}):`, error);
        
        // Hantera specifika databasfel
        if (error.code === 'P2002') {
          // Unikt constraint-fel (t.ex. e-postadressen används redan)
          results.errors.push(`Rad ${i + 1}: En kund med denna e-postadress finns redan`);
        } else {
          results.errors.push(`Rad ${i + 1}: ${error.message || 'Okänt fel'}`);
        }
      }
    }

    // Returnera resultatet
    return res.status(200).json({
      message: `Import slutförd. ${results.success} av ${importData.length} kunder importerade.`,
      success: results.success,
      failed: results.failed,
      errors: results.errors
    });

  } catch (error: any) {
    console.error('Error in import/customers.ts:', error.message);

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