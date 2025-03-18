// pages/api/customers/batch-delete.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'Ogiltigt kund-ID' });
  }

  // Konvertera alla id till nummer
  const numericIds = ids.map(id => Number(id));
  if (numericIds.some(id => isNaN(id))) {
    return res.status(400).json({ error: 'Ogiltigt kund-ID' });
  }

  try {
    const result = await prisma.customer.deleteMany({
      where: { id: { in: numericIds } }
    });
    res.status(200).json({ message: 'Kunder borttagna', count: result.count });
  } catch (error) {
    console.error('Fel vid batch-borttagning:', error);
    res.status(500).json({ error: 'Ett fel inträffade vid borttagning av kunder' });
  } finally {
    await prisma.$disconnect();
  }
}
