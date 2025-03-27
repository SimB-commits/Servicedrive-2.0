// pages/api/webhooks/test-inbound-email.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';
import rateLimiter from '@/lib/rateLimiterApi';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';

const prisma = new PrismaClient();

/**
 * Testendpoint för att simulera inkommande mail från SendGrid
 * Endast tillgänglig i utvecklingsmiljö och för administratörer
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Verifiera att användaren är autentiserad och admin
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Endast tillåt POST-metod
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // Verifiera att vi är i utvecklingsmiljö
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ 
        error: 'Test endpoint disabled in production',
        message: 'Denna endpoint är endast tillgänglig i utvecklingsmiljö'
      });
    }

    // Validera indata
    const { ticketId, content, subject } = req.body;
    
    if (!ticketId || isNaN(parseInt(ticketId))) {
      return res.status(400).json({ error: 'ticketId krävs och måste vara ett nummer' });
    }
    
    if (!content) {
      return res.status(400).json({ error: 'content krävs' });
    }

    // Hämta ärendet
    const ticket = await prisma.ticket.findUnique({
      where: { id: parseInt(ticketId) },
      include: {
        customer: true,
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ärende hittades inte' });
    }

    // Skapa ett nytt meddelande i databasen som simulerar ett kundmail
    const message = await prisma.message.create({
      data: {
        ticketId: parseInt(ticketId),
        content,
        senderId: null, // null för kundmeddelanden
        isFromCustomer: true,
        emailFrom: ticket.customer.email,
        emailTo: `ticket-${ticketId}@reply.servicedrive.se`,
        emailSubject: subject || `Re: Ärende #${ticketId}`,
        emailMessageId: `test-${Date.now()}@reply.servicedrive.se`,
        createdAt: new Date(),
      }
    });

    logger.info('Test-meddelande skapat för att simulera kundmail', { 
      ticketId, 
      messageId: message.id,
      testMode: true
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Simulerat mail sparat',
      ticketId,
      messageId: message.id,
      customerEmail: ticket.customer.email
    });
  } catch (error) {
    logger.error('Fel vid simulering av inkommande mail', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await prisma.$disconnect();
  }
}