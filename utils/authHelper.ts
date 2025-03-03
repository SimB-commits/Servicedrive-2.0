// utils/authHelpers.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../pages/api/auth/authOptions';

export async function getAuthenticatedSession(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    res.status(401).json({ message: 'Du måste vara inloggad' });
    throw new Error('Unauthenticated');
  }

  return session;
}

export function authorizeRoles(session: any, roles: string[]) {
  if (!roles.includes(session.user.role)) {
    throw new Error('Insufficient permissions');
  }
}
