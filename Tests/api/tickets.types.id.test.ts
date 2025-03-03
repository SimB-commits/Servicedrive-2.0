// src/Tests/api/tickets.types.id.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMocks } from 'node-mocks-http'
import handler from '../../pages/api/tickets/types/[id]'

// === Mocka next-auth (getServerSession) och authOptions ===
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('../../pages/api/auth/authOptions', () => ({
  authOptions: {},
}))

// === Mocka PrismaClient ===
vi.mock('@prisma/client', () => {
  const prismaMock = {
    ticketType: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $disconnect: vi.fn(),
  }
  return {
    PrismaClient: vi.fn().mockImplementation(() => prismaMock),
  }
})

// === Mocka rateLimiter ===
vi.mock('../../../lib/rateLimiterApi', () => ({
  __esModule: true,
  default: {
    consume: vi.fn(),
  },
}))

import { getServerSession } from 'next-auth/next'
import { PrismaClient } from '@prisma/client'
import rateLimiter from '../../lib/rateLimiterApi'
import { authOptions } from '../../pages/api/auth/authOptions'

const prismaMock = new PrismaClient() as unknown as {
  ticketType: {
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
  $disconnect: ReturnType<typeof vi.fn>
}

describe('API /api/tickets/types/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // -----------------------------------------------------------------
  //                        G E T   /[id]
  // -----------------------------------------------------------------
  describe('GET /api/tickets/types/[id]', () => {
    it('ska returnera 401 om användaren inte är inloggad eller inte är ADMIN', async () => {
      // ======= Oinloggad =======
      (getServerSession as vi.Mock).mockResolvedValueOnce(null)
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      const { req, res } = createMocks({
        method: 'GET',
        query: { id: 1 },
      })

      await handler(req, res)

      // Koden returnerar res.status(401).json({ error: 'Unauthorized' })
      expect(res._getStatusCode()).toBe(401)
      expect(res._getJSONData()).toEqual({ error: 'Unauthorized' });

      // ======= Fel roll (USER) =======
      (getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { role: 'USER', storeId: 10 },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      const { req: req2, res: res2 } = createMocks({
        method: 'GET',
        query: { id: 1 },
      })

      await handler(req2, res2)
      expect(res2._getStatusCode()).toBe(401)
      expect(res2._getJSONData()).toEqual({ error: 'Unauthorized' })
    })

    it('ska returnera 400 om id inte är ett giltigt nummer', async () => {
      (getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { role: 'ADMIN', storeId: 10 },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      const { req, res } = createMocks({
        method: 'GET',
        query: { id: 'abc' }, // Ogiltigt ID
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(400)
      expect(res._getJSONData()).toEqual({ error: 'Ogiltigt TicketType-ID' })
    })

    it('ska returnera 404 om TicketType inte finns eller inte hör till sessionens storeId', async () => {
      (getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { role: 'ADMIN', storeId: 10 },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      // findUnique → null => TicketType saknas
      prismaMock.ticketType.findUnique.mockResolvedValueOnce(null)

      const { req, res } = createMocks({
        method: 'GET',
        query: { id: 999 },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(404)
      expect(res._getJSONData()).toEqual({ error: 'TicketType not found' })
    })

    it('ska returnera 200 och TicketType om allt stämmer', async () => {
      (getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { role: 'ADMIN', storeId: 10 },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      const fakeTicketType = {
        id: 999,
        name: 'Min TicketType',
        storeId: 10,
        fields: [],
      }

      // Här hittar vi TicketType med rätt storeId => 200
      prismaMock.ticketType.findUnique.mockResolvedValueOnce(fakeTicketType)

      const { req, res } = createMocks({
        method: 'GET',
        query: { id: 999 },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(200)
      expect(res._getJSONData()).toEqual(fakeTicketType)
    })
  })

  // -----------------------------------------------------------------
  //                        P U T   /[id]
  // -----------------------------------------------------------------
  describe('PUT /api/tickets/types/[id]', () => {
    it('ska returnera 401 om användaren inte är inloggad eller inte ADMIN', async () => {
      (getServerSession as vi.Mock).mockResolvedValueOnce(null) // Inget session => 401
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      const { req, res } = createMocks({
        method: 'PUT',
        query: { id: 1 },
        body: { name: 'Ny TicketType' },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(401)
      expect(res._getJSONData()).toEqual({ error: 'Unauthorized' })
    })

    it('ska returnera 400 om id inte är giltigt', async () => {
      (getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { role: 'ADMIN', storeId: 10 },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      const { req, res } = createMocks({
        method: 'PUT',
        query: { id: 'notanumber' },
        body: { name: 'Något' },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(400)
      expect(res._getJSONData()).toEqual({ error: 'Ogiltigt TicketType-ID' })
    })

    it('ska returnera 400 vid valideringsfel (t.ex. ogiltiga fields)', async () => {
      (getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { role: 'ADMIN', storeId: 10 },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      // Rätt ticketType hittas => men valideringen faller pga "WRONGTYPE"
      prismaMock.ticketType.findUnique.mockResolvedValueOnce({
        id: 5,
        name: 'Gammal TicketType',
        storeId: 10,
        fields: [],
      })

      const { req, res } = createMocks({
        method: 'PUT',
        query: { id: 5 },
        body: {
          name: 'Uppdaterad TicketType',
          fields: [{ name: 'Fält1', fieldType: 'WRONGTYPE' }],
        },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(400)
      expect(res._getJSONData()).toHaveProperty('message', 'Valideringsfel')
    })

    it('ska returnera 404 om TicketType inte finns eller fel storeId', async () => {
      (getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { role: 'ADMIN', storeId: 10 },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      // findUnique => null => TicketType saknas => 404
      prismaMock.ticketType.findUnique.mockResolvedValueOnce(null)

      const { req, res } = createMocks({
        method: 'PUT',
        query: { id: 999 },
        body: { name: 'Nytt namn' },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(404)
      expect(res._getJSONData()).toEqual({ error: 'TicketType not found' });
    })

    it('ska returnera 200 när TicketType uppdateras korrekt', async () => {
      (getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { role: 'ADMIN', storeId: 10 },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      // Hittar en befintlig ticketType med storeId=10 => OK
      prismaMock.ticketType.findUnique.mockResolvedValueOnce({
        id: 5,
        name: 'Gammal TicketType',
        storeId: 10,
        fields: [],
      })

      // update => returnerar det nya
      prismaMock.ticketType.update.mockResolvedValueOnce({
        id: 5,
        name: 'Uppdaterad TicketType',
        storeId: 10,
        fields: [
          { id: 101, name: 'Fält1', fieldType: 'TEXT', isRequired: false },
        ],
      })

      const { req, res } = createMocks({
        method: 'PUT',
        query: { id: 5 },
        body: {
          name: 'Uppdaterad TicketType',
          fields: [{ name: 'Fält1', fieldType: 'TEXT' }],
        },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(200)
      expect(res._getJSONData()).toEqual({
        id: 5,
        name: 'Uppdaterad TicketType',
        storeId: 10,
        fields: [
          { id: 101, name: 'Fält1', fieldType: 'TEXT', isRequired: false },
        ],
      })
    })
  })

  // -----------------------------------------------------------------
  //                      D E L E T E   /[id]
  // -----------------------------------------------------------------
  describe('DELETE /api/tickets/types/[id]', () => {
    it('ska returnera 401 om användaren inte är inloggad eller inte ADMIN', async () => {
      (getServerSession as vi.Mock).mockResolvedValueOnce(null)
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      const { req, res } = createMocks({
        method: 'DELETE',
        query: { id: 1 },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(401)
      expect(res._getJSONData()).toEqual({ error: 'Unauthorized' })
    })

    it('ska returnera 400 om id inte är giltigt', async () => {
      (getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { role: 'ADMIN', storeId: 10 },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      const { req, res } = createMocks({
        method: 'DELETE',
        query: { id: 'hejhej' }, // ogiltigt
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(400)
      expect(res._getJSONData()).toEqual({ error: 'Ogiltigt TicketType-ID' })
    })

    it('ska returnera 404 om TicketType inte finns', async () => {
      (getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { role: 'ADMIN', storeId: 10 },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      // => null => inte hittad
      prismaMock.ticketType.findUnique.mockResolvedValueOnce(null)

      const { req, res } = createMocks({
        method: 'DELETE',
        query: { id: 999 },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(404)
      expect(res._getJSONData()).toEqual({ error: 'TicketType not found' })
    })

    it('ska returnera 204 vid lyckad radering', async () => {
      (getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { role: 'ADMIN', storeId: 10 },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      // findUnique => TicketType hittas med storeId=10
      prismaMock.ticketType.findUnique.mockResolvedValueOnce({
        id: 20,
        name: 'TicketTypeToDelete',
        storeId: 10,
      })

      // delete => tar bort och returnerar objekt (dock ignoreras i koden, men vi vill bekräfta)
      prismaMock.ticketType.delete.mockResolvedValueOnce({
        id: 20,
        name: 'TicketTypeToDelete',
        storeId: 10,
        fields: [],
      })

      const { req, res } = createMocks({
        method: 'DELETE',
        query: { id: 20 },
      })

      await handler(req, res)

      // Routen gör res.status(204).end()
      expect(res._getStatusCode()).toBe(204)
      expect(res._getData()).toBe('') // 204 -> inget innehåll
    })
  })
})

