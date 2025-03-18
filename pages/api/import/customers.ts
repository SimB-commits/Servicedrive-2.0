// pages/api/import/customers.ts
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
        
        // Kontrollera om e-postadressen redan existerar (om skipExisting=true)
        if (options.skipExisting && customerData.email) {
          const existingCustomer = await prisma.customer.findFirst({
            where: {
              email: customerData.email,
              storeId: session.user.storeId
            }
          });
          
          if (existingCustomer) {
            // Hoppa över befintliga kunder men räkna dem som lyckat importerade
            results.success++;
            continue;
          }
        }
        
        // Anta att customerData kan innehålla ett fält "customer_id" från det externa systemet
        const validCustomerData = {
          ...parseResult.data,
          storeId: session.user.storeId,
          // Spara det externa id:t om det finns med
          externalId: customerData.customer_id ? Number(customerData.customer_id) : undefined,
          dynamicFields: customerData.dynamicFields || {},
          dateOfBirth: customerData.dateOfBirth ? new Date(customerData.dateOfBirth) : null
        };

        
        // Skapa kunden i databasen
        await prisma.customer.create({
          data: validCustomerData
        });
        
        results.success++;
      } catch (error: any) {
        results.failed++;
        
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
