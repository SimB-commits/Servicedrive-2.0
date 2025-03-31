// middleware/planRestrictionsMiddleware.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../pages/api/auth/authOptions';
import { logger } from '../utils/logger';
import * as planRestrictions from '../utils/planRestrictions';

/**
 * Middleware för att kontrollera planbegränsningar i API-anrop
 */
export async function planRestrictionsMiddleware(
  req: NextApiRequest, 
  res: NextApiResponse,
  next: () => Promise<void>
) {
  try {
    // Hämta session för att få storeId
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user?.storeId) {
      // Om ingen session finns kan vi inte kontrollera begränsningar
      // Låt anropet fortsätta, den vanliga autentiseringen kommer hantera detta
      return next();
    }
    
    const storeId = session.user.storeId;
    const { pathname } = req;

    // Kontrollera planbegränsningar baserat på API-rutt och HTTP-metod
    
    // Ärende-skapande
    if (pathname === '/api/tickets' && req.method === 'POST') {
      const { allowed, message } = await planRestrictions.canCreateTicket(storeId);
      if (!allowed) {
        logger.warn(`Ticket creation blocked due to plan limits`, { storeId });
        return res.status(403).json({ 
          error: 'Plan limit reached', 
          message: message || 'Din plan tillåter inte fler ärenden' 
        });
      }
    }
    
    // Ärendetyps-skapande
    if (pathname === '/api/tickets/types' && req.method === 'POST') {
      const { allowed, message } = await planRestrictions.canCreateTicketType(storeId);
      if (!allowed) {
        logger.warn(`Ticket type creation blocked due to plan limits`, { storeId });
        return res.status(403).json({ 
          error: 'Plan limit reached', 
          message: message || 'Din plan tillåter inte fler ärendetyper' 
        });
      }
    }
    
    // Anpassad status-skapande
    if (pathname === '/api/tickets/statuses' && req.method === 'POST') {
      const { allowed, message } = await planRestrictions.canCreateCustomStatus(storeId);
      if (!allowed) {
        logger.warn(`Custom status creation blocked due to plan limits`, { storeId });
        return res.status(403).json({ 
          error: 'Plan limit reached', 
          message: message || 'Din plan tillåter inte fler anpassade statusar' 
        });
      }
    }
    
    // Admin-användare
    if (pathname === '/api/users' && req.method === 'POST') {
      // Endast kontrollera om den nya användaren är ADMIN
      const newUserData = req.body;
      if (newUserData?.role === 'ADMIN') {
        const { allowed, message } = await planRestrictions.canAddAdmin(storeId);
        if (!allowed) {
          logger.warn(`Admin user creation blocked due to plan limits`, { storeId });
          return res.status(403).json({ 
            error: 'Plan limit reached', 
            message: message || 'Din plan tillåter inte fler administratörer' 
          });
        }
      }
    }
    
    // Om vi kommer hit har ingen begränsning brutits
    return next();
    
  } catch (error) {
    logger.error('Error in plan restrictions middleware', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.url
    });
    
    // Låt anropet fortsätta vid fel i middleware (för att undvika att blockera systemet helt)
    return next();
  }
}

/**
 * HOF (Higher Order Function) för att enkelt lägga till middleware i en API-rutt
 */
export function withPlanRestrictions(handler: any) {
  return async function(req: NextApiRequest, res: NextApiResponse) {
    await planRestrictionsMiddleware(req, res, async () => {
      return handler(req, res);
    });
  };
}