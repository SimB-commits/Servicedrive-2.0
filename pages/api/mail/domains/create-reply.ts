// pages/api/mail/domains/create-reply.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/authOptions';
import rateLimiter from '@/lib/rateLimiterApi';
import { createAutoReplyDomain } from '@/utils/autoReplyDomainHelper';
import { logger } from '@/utils/logger';
import { z } from 'zod';

const prisma = new PrismaClient();

// Schema för validering av förfrågan
const createReplySchema = z.object({
  baseDomain: z.string().min(3, 'Domännamn måste vara minst 3 tecken')
    .regex(/^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/, {
      message: "Ogiltigt domännamn. Använd ett korrekt formaterat domännamn (t.ex. example.com)"
    })
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate Limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Autentisering
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return res.status(401).json({ error: 'Ej behörig' });
    }

    // Kontrollera att butik finns i sessionen
    if (!session.user.storeId) {
      return res.status(400).json({ error: 'Ingen butik vald' });
    }
    
    const storeId = session.user.storeId;

    // Endast POST-metod är tillåten
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // Validera inkommande data med zod
    const parseResult = createReplySchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return res.status(400).json({ error: 'Valideringsfel', errors });
    }

    const { baseDomain } = parseResult.data;

    // Kontrollera att basdomänen faktiskt är verifierad
    const baseVerifiedDomain = await prisma.verifiedDomain.findFirst({
      where: {
        domain: baseDomain,
        status: 'verified',
        storeId
      }
    });

    if (!baseVerifiedDomain) {
      return res.status(400).json({ 
        error: 'Ogiltig basdomän', 
        message: `Domänen '${baseDomain}' är inte verifierad i systemet. Verifiera den först under Domänverifiering.`
      });
    }

    // Kontrollera att det inte redan finns en reply-domän för denna basdomän
    const replyDomain = `reply.${baseDomain}`;
    const existingReply = await prisma.verifiedDomain.findFirst({
      where: {
        domain: replyDomain,
        storeId
      }
    });

    if (existingReply) {
      // Om den redan finns, returnera information om den
      return res.status(200).json({
        replyDomain,
        domainId: existingReply.domainId,
        status: existingReply.status,
        message: `Reply-domänen ${replyDomain} finns redan${existingReply.status === 'verified' ? ' och är verifierad' : ' men behöver verifieras'}.`
      });
    }

    // Skapa reply-domänen
    try {
      logger.info(`Skapar reply-domän för ${baseDomain}`, { storeId });
      
      const replyResult = await createAutoReplyDomain(baseDomain, storeId);
      
      if (!replyResult.success) {
        throw new Error(replyResult.message);
      }
      
      // Lyckades skapa reply-domänen
      logger.info(`Reply-domän skapad för ${baseDomain}`, { 
        replyDomain: replyResult.replyDomain, 
        domainId: replyResult.domainId,
        storeId 
      });
      
      return res.status(201).json({
        replyDomain: replyResult.replyDomain,
        domainId: replyResult.domainId,
        dnsRecords: replyResult.dnsRecords,
        status: replyResult.needsVerification ? 'pending' : 'verified',
        needsVerification: replyResult.needsVerification,
        message: replyResult.message
      });
    } catch (error) {
      logger.error('Fel vid skapande av reply-domän', {
        error: error.message,
        baseDomain,
        storeId
      });
      
      return res.status(500).json({ 
        error: 'Kunde inte skapa reply-domän', 
        message: error.message 
      });
    }
  } catch (error: any) {
    logger.error('Error in mail/domains/create-reply.ts:', { error: error.message });

    if (error.constructor.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }

    return res.status(500).json({ message: 'Ett internt serverfel uppstod.', details: error.message });
  } finally {
    await prisma.$disconnect();
  }
}