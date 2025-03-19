// pages/api/test/send-email.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/authOptions';
import { initSendGrid, sendEmail } from '@/utils/sendgrid';
import { logger } from '@/utils/logger';

// OBS: Ta bort denna endpoint innan du går till produktion
// Den är endast avsedd för testning!

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Säkerställ att endast autentiserade administratörer kan testa
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Acceptera endast POST-anrop
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Hämta mottagaradress från förfrågan eller använd avsändarens egen email
    const { to = session.user.email } = req.body;
    
    if (!to || typeof to !== 'string' || !to.includes('@')) {
      return res.status(400).json({ error: 'Giltig e-postadress krävs' });
    }
    
    // Initiera SendGrid
    const initialized = initSendGrid();
    if (!initialized) {
      return res.status(500).json({ 
        error: 'Kunde inte initiera SendGrid', 
        message: 'Kontrollera att SENDGRID_API_KEY är konfigurerad i miljövariabler'
      });
    }
    
    // Skapa HTML-innehåll med diagnostikinformation
    const htmlContent = `
      <h1>SendGrid Testmail från Servicedrive</h1>
      <p>Om du ser detta mail fungerar din SendGrid-integration!</p>
      <hr>
      <h2>Diagnostikinformation:</h2>
      <ul>
        <li><strong>Tidpunkt:</strong> ${new Date().toISOString()}</li>
        <li><strong>Avsändaradress:</strong> ${process.env.EMAIL_FROM || 'Ej konfigurerad'}</li>
        <li><strong>Verifierade domäner:</strong> ${process.env.SENDGRID_VERIFIED_DOMAINS || 'Ej konfigurerade'}</li>
        <li><strong>Miljö:</strong> ${process.env.NODE_ENV}</li>
        <li><strong>Användare:</strong> ${session.user.email}</li>
      </ul>
      <p>Detta är ett automatiskt mail från din Servicedrive-applikation.</p>
    `;
    
    // Skicka ett testmail
    const result = await sendEmail({
      to: to,
      from: process.env.EMAIL_FROM || 'no-reply@example.com',
      subject: 'SendGrid Test från Servicedrive',
      text: 'Om du ser detta mail fungerar din SendGrid-integration!',
      html: htmlContent,
      categories: ['test', 'setup']
    });
    
    logger.info('Test mail skickat från API', { 
      recipient: to,
      sender: process.env.EMAIL_FROM,
      messageId: result[0]?.headers['x-message-id'] 
    });
    
    return res.status(200).json({ 
      success: true, 
      message: 'Testmail skickat!',
      details: {
        messageId: result[0]?.headers['x-message-id'],
        recipient: to,
        sentAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Fel vid skickande av testmail', { error: error.message });
    
    return res.status(500).json({ 
      error: 'Kunde inte skicka testmail', 
      message: error.message,
      help: 'Kontrollera dina SendGrid-inställningar och verifiera att din avsändaradress är godkänd.'
    });
  }
}