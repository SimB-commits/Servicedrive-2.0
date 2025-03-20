// pages/api/tickets/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/authOptions';
import { updateTicketSchema } from '@/utils/validation';
import { getAuthenticatedSession } from '@/utils/authHelper';
import { sendTicketStatusEmail } from '@/utils/mail-service';
import rateLimiter from '@/lib/rateLimiterApi';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Rate Limiting
    await rateLimiter.consume(req.socket.remoteAddress || 'unknown');

    // Authenticate using helper function
    const session = await getAuthenticatedSession(req, res);

    // Check if request refers to a valid ticket ID
    const { id } = req.query;
    if (!id || typeof id !== 'string' || isNaN(Number(id))) {
      return res.status(400).json({ message: 'Ogiltigt ärende-ID' });
    }

    const ticketId = parseInt(id);

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET': {
        // Fetch ticket with relations
        const ticket = await prisma.ticket.findUnique({
          where: {
            id: ticketId,
          },
          include: {
            customer: true,
            ticketType: {
              include: {
                fields: true,
              },
            },
            customStatus: {
              include: {
                mailTemplate: {
                  select: {
                    id: true,
                    name: true,
                    subject: true,
                  },
                },
              },
            },
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            assignedUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            messages: {
              orderBy: {
                createdAt: 'desc',
              },
              include: {
                sender: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
            store: {
              select: {
                id: true,
                name: true,
                company: true,
              },
            },
          },
        });

        if (!ticket) {
          return res.status(404).json({ message: 'Ärendet hittades inte' });
        }

        // Check if user has access to this ticket through their store
        if (ticket.storeId !== session.user.storeId) {
          return res.status(403).json({ message: 'Du har inte åtkomst till detta ärende' });
        }

        return res.status(200).json(ticket);
      }

      case 'PUT': {
        // Validate input data
        const parseResult = updateTicketSchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(400).json({
            message: 'Valideringsfel',
            errors: parseResult.error.errors,
          });
        }

        // Find the ticket to update
        const ticket = await prisma.ticket.findUnique({
          where: {
            id: ticketId,
          },
          include: {
            customStatus: true,
            customer: true,
            ticketType: {
              include: {
                fields: true,
              },
            },
            user: true,
            assignedUser: true,
            store: true,
          },
        });

        if (!ticket) {
          return res.status(404).json({ message: 'Ärendet hittades inte' });
        }

        // Check if user has access to this ticket through their store
        if (ticket.storeId !== session.user.storeId) {
          return res.status(403).json({ message: 'Du har inte åtkomst till detta ärende' });
        }

        // Prepare data for update
        const data = parseResult.data;
        const oldStatus = ticket.status;
        const oldCustomStatusId = ticket.customStatusId;

        let customStatusId = ticket.customStatusId;

        // Special handling for status updates:
        // If status starts with "CUSTOM_", it refers to a custom status
        if (data.status && data.status.startsWith('CUSTOM_')) {
          const customId = parseInt(data.status.replace('CUSTOM_', ''));
          customStatusId = customId;
          data.status = undefined; // Don't update the status field
        } else if (data.status) {
          // If a regular status is selected, clear any custom status
          customStatusId = null;
        }

        // Update the ticket in the database
        const updatedTicket = await prisma.ticket.update({
          where: {
            id: ticketId,
          },
          data: {
            ...(data.description && { description: data.description }),
            ...(data.status && { status: data.status }),
            customStatusId: customStatusId,
            ...(data.dueDate !== undefined && {
              dueDate: data.dueDate ? new Date(data.dueDate) : null,
            }),
            ...(data.dynamicFields && { dynamicFields: data.dynamicFields }),
          },
          include: {
            customer: true,
            ticketType: {
              include: {
                fields: true,
              },
            },
            customStatus: {
              include: {
                mailTemplate: true,
              },
            },
            user: true,
            assignedUser: true,
            store: true,
          },
        });

        // Determine if status has changed
        const statusChanged =
          updatedTicket.status !== oldStatus || updatedTicket.customStatusId !== oldCustomStatusId;

        // Send email notification if status changed and we have the sendNotification flag
        if (statusChanged) {
          try {
            // Check if we should send email (default to true if not specified)
            const shouldSendEmail = req.body.sendNotification !== false;
            
            if (shouldSendEmail) {
              await sendTicketStatusEmail(updatedTicket, oldStatus, oldCustomStatusId);
            } else {
              console.log('Skipping email notification as requested by user');
            }
          } catch (emailError) {
            console.error('Error sending email notification:', emailError);
            // We don't fail the request if email sending fails
          }
        }

        return res.status(200).json(updatedTicket);
      }

      case 'DELETE': {
        // Find the ticket to delete
        const ticket = await prisma.ticket.findUnique({
          where: {
            id: ticketId,
          },
        });

        if (!ticket) {
          return res.status(404).json({ message: 'Ärendet hittades inte' });
        }

        // Check if user has access to this ticket through their store
        if (ticket.storeId !== session.user.storeId) {
          return res.status(403).json({ message: 'Du har inte åtkomst till detta ärende' });
        }

        // Delete the ticket
        await prisma.ticket.delete({
          where: {
            id: ticketId,
          },
        });

        return res.status(200).json({ message: 'Ärendet har tagits bort' });
      }

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('Error handling ticket request:', error);
    
    if (error.constructor?.name === 'RateLimiterRes') {
      return res.status(429).json({ message: 'För många förfrågningar. Försök igen senare.' });
    }
    
    return res.status(500).json({ message: 'Ett serverfel inträffade' });
  } finally {
    await prisma.$disconnect();
  }
}