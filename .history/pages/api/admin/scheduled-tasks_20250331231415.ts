// pages/api/admin/scheduled-tasks.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { 
  resetMonthlyTicketCountIfNeeded, 
  archiveOldTickets, 
  runAllScheduledTasks 
} from '@/utils/scheduledTasks';
import { 
  checkAndRenewSubscriptions, 
  checkUsageLimits 
} from '@/utils/scheduledSubscriptionTasks';
import { logger } from '@/utils/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Endast POST-metoden är tillåten
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
    
    // Autentisering - endast ADMIN kan utlösa schemalagda uppgifter
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return res.status(401).json({ error: 'Endast administratörer kan utföra denna åtgärd' });
    }
    
    // Bestäm vilken uppgift som ska köras baserat på task-parametern
    const { task } = req.body;
    
    if (!task) {
      return res.status(400).json({ error: 'En uppgift måste anges' });
    }
    
    let result = { success: true, message: '' };
    
    switch (task) {
      case 'reset-ticket-counts':
        await resetMonthlyTicketCountIfNeeded();
        result.message = 'Månadsantal för ärenden har återställts';
        break;
        
      case 'archive-old-tickets':
        await archiveOldTickets();
        result.message = 'Gamla ärenden har arkiverats';
        break;
        
      case 'check-subscriptions':
        await checkAndRenewSubscriptions();
        result.message = 'Prenumerationer har kontrollerats och förnyats vid behov';
        break;
        
      case 'check-limits':
        await checkUsageLimits();
        result.message = 'Användning mot plangränser har kontrollerats';
        break;
        
      case 'run-all':
        await runAllScheduledTasks();
        result.message = 'Alla schemalagda uppgifter har körts';
        break;
        
      default:
        return res.status(400).json({ error: `Okänd uppgift: ${task}` });
    }
    
    logger.info(`Schemalagd uppgift kördes manuellt: ${task}`, { adminId: session.user.id });
    return res.status(200).json(result);
    
  } catch (error) {
    logger.error('Fel vid körning av schemalagd uppgift', { 
      error: error instanceof Error ? error.message : 'Okänt fel'
    });
    
    if (error.constructor?.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }
    
    return res.status(500).json({ message: 'Ett internt serverfel uppstod.' });
  }
}