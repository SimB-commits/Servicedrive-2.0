// pages/api/mail/template-settings.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, MailTemplateUsage } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { logger } from '@/utils/logger';
import { z } from 'zod';

const prisma = new PrismaClient();

// Valideringsschema för att hämta inställningar
const getSettingsSchema = z.object({
  usage: z.nativeEnum(MailTemplateUsage).optional(),
});

// Valideringsschema för att uppdatera inställningar
const updateSettingsSchema = z.object({
  templateId: z.number().int().nullable(),
  usage: z.nativeEnum(MailTemplateUsage),
});

// Interface för strukturerad typsäkerhet
interface TemplateSettingResponse {
  templateId: number | null;
  template: {
    id: number;
    name: string;
    subject: string;
  } | null;
}

// Type för samlade inställningar
type FormattedSettings = {
  [key in MailTemplateUsage]?: TemplateSettingResponse;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate Limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Autentisering
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Kontrollera att butik finns i sessionen
    if (!session.user.storeId) {
      return res.status(400).json({ error: 'Ingen butik vald' });
    }
    
    const storeId = session.user.storeId;

    switch (req.method) {
      case 'GET':
        // Hämta inställningar för mailmallar
        try {
          // Validera query parametrar
          const result = getSettingsSchema.safeParse(req.query);
          if (!result.success) {
            return res.status(400).json({ 
              error: 'Ogiltig förfrågan', 
              details: result.error.errors 
            });
          }
          
          const { usage } = result.data;
          
          // Bygg sökvillkor baserat på om specifik usage är angiven
          const whereClause = {
            storeId,
            ...(usage ? { usage } : {}),
          };
          
          // Hämta inställningar från databasen
          const settings = await prisma.mailTemplateSettings.findMany({
            where: whereClause,
            include: {
              template: {
                select: {
                  id: true,
                  name: true,
                  subject: true,
                }
              }
            }
          });
          
          // Om specifik usage efterfrågas och ingen inställning finns,
          // returnera ett tomt objekt för den usagen
          if (usage && settings.length === 0) {
            return res.status(200).json({ 
              [usage]: { 
                templateId: null, 
                template: null 
              } 
            });
          }
          
          // Formatera resultatet som ett objekt med usage som nycklar
          const formattedSettings: FormattedSettings = {};
          
          // Fyll objektet med data
          settings.forEach(setting => {
            formattedSettings[setting.usage] = {
              templateId: setting.templateId,
              template: setting.template
            };
          });
          
          return res.status(200).json(formattedSettings);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          logger.error('Fel vid hämtning av mailmallinställningar', {
            error: errorMessage,
            storeId
          });
          
          if (error instanceof z.ZodError) {
            return res.status(400).json({ 
              error: 'Ogiltig förfrågan', 
              details: error.errors 
            });
          }
          
          return res.status(500).json({ error: 'Kunde inte hämta mallinställningar' });
        }

      case 'PUT':
        // Uppdatera inställningar för en mailmall
        try {
          // Logga inkommande data för felsökning
          console.log('Inkommande data för PUT:', req.body);
          
          // Validera inkommande data
          const result = updateSettingsSchema.safeParse(req.body);
          
          if (!result.success) {
            return res.status(400).json({ 
              error: 'Ogiltig förfrågan', 
              details: result.error.errors 
            });
          }
          
          const { templateId, usage } = result.data;
          
          logger.info('Uppdaterar mallinställning', {
            storeId,
            usage,
            templateId
          });
          
          // Kontrollera att templateId tillhör denna butik om det är angivet
          if (templateId !== null) {
            const template = await prisma.mailTemplate.findUnique({
              where: { id: templateId }
            });
            
            if (!template) {
              return res.status(404).json({ error: 'Mall hittades inte' });
            }
            
            if (template.storeId !== storeId) {
              return res.status(403).json({ error: 'Mallen tillhör inte din butik' });
            }
          }
          
          // Upsert-operation (skapa om den inte finns, uppdatera annars)
          try {
            // Säkerställ att templateId är korrekt formaterat för databasen
            const sanitizedTemplateId = templateId === null ? null : templateId;
            
            const updatedSetting = await prisma.mailTemplateSettings.upsert({
              where: {
                storeId_usage: {
                  storeId,
                  usage
                }
              },
              update: {
                templateId: sanitizedTemplateId
              },
              create: {
                storeId,
                usage,
                templateId: sanitizedTemplateId
              },
              include: {
                template: {
                  select: {
                    id: true,
                    name: true,
                    subject: true
                  }
                }
              }
            });
            
            return res.status(200).json({
              message: 'Mallinställning uppdaterad',
              setting: {
                usage: updatedSetting.usage,
                templateId: updatedSetting.templateId,
                template: updatedSetting.template
              }
            });
          } catch (prismaError) {
            logger.error('Prisma-fel vid uppdatering av mallinställning', {
              error: prismaError instanceof Error ? prismaError.message : 'Unknown error',
              stack: prismaError instanceof Error ? prismaError.stack : undefined,
              storeId,
              usage,
              templateId: templateId // Logga templateId för att se vad som skickas
            });
            
            return res.status(500).json({ 
              error: 'Databasfel: Kunde inte uppdatera mallinställning',
              details: prismaError instanceof Error ? prismaError.message : 'Unknown database error'
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          logger.error('Fel vid uppdatering av mailmallinställning', {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            storeId,
            requestBody: req.body
          });
          
          if (error instanceof z.ZodError) {
            return res.status(400).json({ 
              error: 'Ogiltig förfrågan', 
              details: error.errors 
            });
          }
          
          return res.status(500).json({ 
            error: 'Kunde inte uppdatera mallinställning',
            details: errorMessage
          });
        }

      default:
        res.setHeader('Allow', ['GET', 'PUT']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in template-settings.ts:', { 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });

    if (error instanceof Error && error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }

    return res.status(500).json({ 
      message: 'Ett internt serverfel uppstod.', 
      details: errorMessage 
    });
  } finally {
    await prisma.$disconnect();
  }
}