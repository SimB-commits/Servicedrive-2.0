// middleware/planRestrictions.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/authOptions';
import * as planRestrictions from '@/utils/planRestrictions';
import { logger } from '@/utils/logger';

/**
 * Type-definition för Next.js API-handler
 */
type ApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

/**
 * Middleware som kontrollerar planbegränsningar för olika API-rutter
 * @param handler Nästa handler i kedjan som ska anropas om kontrollen lyckas
 * @returns En ny handler som inkluderar begränsningskontroll
 */
export function withPlanRestrictions(handler: ApiHandler): ApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      // Hämta användarens session
      const session = await getServerSession(req, res, authOptions);
      
      // Om ingen session finns eller användaren inte har en storeId, kör handler direkt
      // Vi förlitar oss på att autentiseringsmiddleware redan kontrollerar behörighet
      if (!session?.user?.storeId) {
        return handler(req, res);
      }
      
      const storeId = session.user.storeId;
      const method = req.method;
      const { pathname } = req.url ? new URL(req.url, 'http://localhost') : { pathname: '' };
      
      logger.debug('Kontrollerar planbegränsningar', { 
        path: pathname, 
        method, 
        storeId,
        userId: session.user.id 
      });
      
      // Kontrollera olika begränsningar baserat på API-endpoint
      
      // 1. Begränsning för att skapa nya ärenden
      if (pathname.match(/^\/api\/tickets\/?$/) && method === 'POST') {
        const result = await planRestrictions.canCreateTicket(storeId);
        
        if (!result.allowed) {
          logger.info('Begränsning: Kan inte skapa ärende pga planbegränsning', {
            storeId,
            userId: session.user.id,
            currentUsage: result.currentUsage,
            limit: result.limit
          });
          
          return res.status(403).json({
            error: 'Plan limit reached', 
            message: result.message || 'Planbegränsning nådd',
            currentUsage: result.currentUsage,
            limit: result.limit
          });
        }
        
        // Räkna upp ärenderäknaren efter kontrollen
        // Vi gör detta här för att räknaren ska ökas även om nästa handler misslyckas
        // med att skapa ärendet av annan anledning
        await planRestrictions.incrementTicketCount(storeId);
      }
      
      // 2. Begränsning för att skapa nya ärendetyper
      if (pathname.match(/^\/api\/tickets\/types\/?$/) && method === 'POST') {
        const result = await planRestrictions.canCreateTicketType(storeId);
        
        if (!result.allowed) {
          logger.info('Begränsning: Kan inte skapa ärendetyp pga planbegränsning', {
            storeId,
            userId: session.user.id,
            currentUsage: result.currentUsage,
            limit: result.limit
          });
          
          return res.status(403).json({
            error: 'Plan limit reached', 
            message: result.message || 'Planbegränsning nådd',
            currentUsage: result.currentUsage,
            limit: result.limit
          });
        }
      }
      
      // 3. Begränsning för att skapa anpassade statusar
      if (pathname.match(/^\/api\/tickets\/statuses\/?$/) && method === 'POST') {
        const result = await planRestrictions.canCreateCustomStatus(storeId);
        
        if (!result.allowed) {
          logger.info('Begränsning: Kan inte skapa anpassad status pga planbegränsning', {
            storeId,
            userId: session.user.id,
            currentUsage: result.currentUsage,
            limit: result.limit
          });
          
          return res.status(403).json({
            error: 'Plan limit reached', 
            message: result.message || 'Planbegränsning nådd',
            currentUsage: result.currentUsage,
            limit: result.limit
          });
        }
      }
      
      // 4. Kontrollera återställning av månatliga räknare vid varje API-anrop
      // Detta körs som en bakgrundsuppgift och påverkar inte aktuell förfrågan
      planRestrictions.resetMonthlyTicketCountIfNeeded()
        .catch(error => {
          logger.error('Fel vid återställning av månatliga räknare', { 
            error: error instanceof Error ? error.message : 'Okänt fel'
          });
        });
      
      // Fortsätt till nästa handler i kedjan om alla kontroller är godkända
      return handler(req, res);
    } catch (error) {
      logger.error('Fel i planbegränsnings-middleware', { 
        error: error instanceof Error ? error.message : 'Okänt fel',
        url: req.url
      });
      
      // Vid fel i middleware, fortsätt till nästa handler
      // för att systemet inte ska blockeras av begränsningskontroller
      return handler(req, res);
    }
  };
}