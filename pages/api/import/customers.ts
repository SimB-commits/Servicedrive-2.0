// Förbättrad version av hela pages/api/import/customers.ts som är mer robust mot oväntade data

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
    const options = req.body.options || { skipExisting: true };

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

        // Kontrollera om e-postadressen redan existerar (om skipExisting=true)
        if (parseResult.data.email) {
          const existingCustomer = await prisma.customer.findFirst({
            where: {
              email: parseResult.data.email,
              storeId: session.user.storeId
            }
          });
          
          if (existingCustomer) {
            if (options.updateExisting) {
              // Uppdatera befintlig kund om e-post matchar
              await prisma.customer.update({
                where: { id: existingCustomer.id },
                data: {
                  firstName: parseResult.data.firstName ?? existingCustomer.firstName,
                  lastName: parseResult.data.lastName ?? existingCustomer.lastName,
                  phoneNumber: parseResult.data.phoneNumber ?? existingCustomer.phoneNumber,
                  address: parseResult.data.address ?? existingCustomer.address,
                  postalCode: parseResult.data.postalCode ?? existingCustomer.postalCode,
                  city: parseResult.data.city ?? existingCustomer.city,
                  country: parseResult.data.country ?? existingCustomer.country,
                  dateOfBirth: parseResult.data.dateOfBirth ? new Date(parseResult.data.dateOfBirth) : existingCustomer.dateOfBirth,
                  newsletter: parseResult.data.newsletter ?? existingCustomer.newsletter,
                  loyal: parseResult.data.loyal ?? existingCustomer.loyal,
                  dynamicFields: parseResult.data.dynamicFields ?? existingCustomer.dynamicFields,
                  // Uppdatera externt ID endast om det inte fanns tidigare
                  externalId: existingCustomer.externalId ?? externalIdValue
                }
              });
              results.success++;
              continue;
            } else if (options.skipExisting) {
              // Hoppa över befintliga kunder men räkna dem som lyckat importerade
              results.success++;
              continue;
            } else {
              results.failed++;
              results.errors.push(`Rad ${i + 1}: En kund med denna e-postadress finns redan`);
              continue;
            }
          }
        }
        
        // Kontrollera om externalId redan finns
        if (externalIdValue) {
          const existingCustomerWithExternalId = await prisma.customer.findFirst({
            where: {
              externalId: externalIdValue,
              storeId: session.user.storeId
            }
          });
          
          if (existingCustomerWithExternalId) {
            if (options.updateExisting) {
              // Uppdatera befintlig kund om externt ID matchar
              await prisma.customer.update({
                where: { id: existingCustomerWithExternalId.id },
                data: {
                  firstName: parseResult.data.firstName ?? existingCustomerWithExternalId.firstName,
                  lastName: parseResult.data.lastName ?? existingCustomerWithExternalId.lastName,
                  email: parseResult.data.email ?? existingCustomerWithExternalId.email,
                  phoneNumber: parseResult.data.phoneNumber ?? existingCustomerWithExternalId.phoneNumber,
                  address: parseResult.data.address ?? existingCustomerWithExternalId.address,
                  postalCode: parseResult.data.postalCode ?? existingCustomerWithExternalId.postalCode,
                  city: parseResult.data.city ?? existingCustomerWithExternalId.city,
                  country: parseResult.data.country ?? existingCustomerWithExternalId.country,
                  dateOfBirth: parseResult.data.dateOfBirth ? new Date(parseResult.data.dateOfBirth) : existingCustomerWithExternalId.dateOfBirth,
                  newsletter: parseResult.data.newsletter ?? existingCustomerWithExternalId.newsletter,
                  loyal: parseResult.data.loyal ?? existingCustomerWithExternalId.loyal,
                  dynamicFields: parseResult.data.dynamicFields ?? existingCustomerWithExternalId.dynamicFields
                }
              });
              results.success++;
              continue;
            } else if (options.skipExisting) {
              // Hoppa över men räkna som framgång
              results.success++;
              continue;
            } else {
              // Rapportera som fel
              results.failed++;
              results.errors.push(`Rad ${i + 1}: En kund med externt ID ${externalIdValue} finns redan`);
              continue;
            }
          }
        }
        
        // Förbered data för att skapa ny kund - endast inkludera fält som finns i Prisma-schemat
        const customerDataForPrisma = {
          firstName: parseResult.data.firstName,
          lastName: parseResult.data.lastName,
          email: parseResult.data.email,
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