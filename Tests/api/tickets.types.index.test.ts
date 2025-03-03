// src/Tests/api/tickets.types.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMocks } from 'node-mocks-http'
import handler from '../../pages/api/tickets/types/index'

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
      findMany: vi.fn(),
      create: vi.fn(),
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

// Importera de mockade modulerna
import { getServerSession } from 'next-auth/next'
import { PrismaClient } from '@prisma/client'
import rateLimiter from '../../lib/rateLimiterApi'
import { authOptions } from '../../pages/api/auth/authOptions'

// Skapa en referens till Prisma-mockens metoder
const prismaMock = new PrismaClient() as unknown as {
  ticketType: {
    findMany: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
  $disconnect: ReturnType<typeof vi.fn>
}

describe('API /api/tickets/types', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------
  //                G E T   /api/tickets/types
  // ---------------------------------------------------------
  describe('GET /api/tickets/types', () => {
    it('ska returnera 401 om användaren inte är inloggad eller inte är ADMIN', async () => {
      // 1) Ingen session (null) → oinloggad
      (getServerSession as vi.Mock).mockResolvedValueOnce(null)
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      const { req, res } = createMocks({ method: 'GET' })
      await handler(req, res)
      expect(res._getStatusCode()).toBe(401)
      expect(res._getJSONData()).toEqual({ error: 'Unauthorized' })

      // 2) Inloggad men fel roll → t.ex. 'USER'
      ;(getServerSession as vi.Mock).mockResolvedValueOnce({
        user: {
          role: 'USER',
          storeId: 15,
        },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      const { req: req2, res: res2 } = createMocks({ method: 'GET' })
      await handler(req2, res2)
      expect(res2._getStatusCode()).toBe(401)
      expect(res2._getJSONData()).toEqual({ error: 'Unauthorized' })
    })

    it('ska returnera 200 och en lista av ticketTypes (för ADMIN)', async () => {
      ;(getServerSession as vi.Mock).mockResolvedValueOnce({
        user: {
          role: 'ADMIN',
          storeId: 20,
        },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      const fakeTicketTypes = [
        { id: 1, name: 'Support', storeId: 20, fields: [] },
        { id: 2, name: 'Billing', storeId: 20, fields: [] },
      ]
      prismaMock.ticketType.findMany.mockResolvedValueOnce(fakeTicketTypes)

      const { req, res } = createMocks({ method: 'GET' })
      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      expect(res._getJSONData()).toEqual(fakeTicketTypes)

      // Kontrollera att findMany anropats med rätt storeId
      expect(prismaMock.ticketType.findMany).toHaveBeenCalledWith({
        where: { storeId: 20 },
        include: { fields: true },
      })
    })
  })

  // ---------------------------------------------------------
  //               P O S T   /api/tickets/types
  // ---------------------------------------------------------
  describe('POST /api/tickets/types', () => {
    it('ska returnera 401 om användaren inte är ADMIN', async () => {
      // rateLimiter
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      // session med "USER"-roll
      ;(getServerSession as vi.Mock).mockResolvedValueOnce({
        user: {
          role: 'USER',
          storeId: 15,
        },
      })

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'TestTicket',
          storeId: 15,
          fields: [{ name: 'Fält1', fieldType: 'TEXT' }],
        },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(401)
      expect(res._getJSONData()).toEqual({ error: 'Unauthorized' })
      expect(prismaMock.ticketType.create).not.toHaveBeenCalled()
    })

    it('ska returnera 400 vid valideringsfel', async () => {
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      // ADMIN-session
      ;(getServerSession as vi.Mock).mockResolvedValueOnce({
        user: {
          role: 'ADMIN',
          storeId: 15,
        },
      })

      // Skicka in helt fel body t.ex. saknar `name` eller `storeId`
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          fields: [{ name: 'SomeField', fieldType: 'TEXT' }],
          // name saknas → borde valideringskrascha
          // storeId saknas eller är fel → borde också orsaka fel om schema kräver
        },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(400)
      expect(res._getJSONData()).toHaveProperty('message', 'Valideringsfel')
      expect(prismaMock.ticketType.create).not.toHaveBeenCalled()
    })

    it('ska returnera 201 och skapa en ny ticketType', async () => {
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})
      ;(getServerSession as vi.Mock).mockResolvedValueOnce({
        user: {
          role: 'ADMIN',
          storeId: 15,
        },
      })

      // Exempel på en giltig body
      const mockBody = {
        name: 'Nytt TicketType',
        storeId: 15,
        fields: [
          { name: 'Fält1', fieldType: 'TEXT' },
          { name: 'Fält2', fieldType: 'NUMBER', isRequired: true },
        ],
      }

      // Mocka prisma create-svar
      prismaMock.ticketType.create.mockResolvedValueOnce({
        id: 10,
        name: 'Nytt TicketType',
        storeId: 15,
        fields: [
          { id: 101, name: 'Fält1', fieldType: 'TEXT', isRequired: false },
          { id: 102, name: 'Fält2', fieldType: 'NUMBER', isRequired: true },
        ],
      })

      const { req, res } = createMocks({
        method: 'POST',
        body: mockBody,
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(201)
      expect(res._getJSONData()).toEqual({
        id: 10,
        name: 'Nytt TicketType',
        storeId: 15,
        fields: [
          { id: 101, name: 'Fält1', fieldType: 'TEXT', isRequired: false },
          { id: 102, name: 'Fält2', fieldType: 'NUMBER', isRequired: true },
        ],
      })

      // Kolla att prisma.create anropats med rätt data
      expect(prismaMock.ticketType.create).toHaveBeenCalledWith({
        data: {
          name: 'Nytt TicketType',
          storeId: 15,
          fields: {
            create: [
              { name: 'Fält1', fieldType: 'TEXT', isRequired: false },
              { name: 'Fält2', fieldType: 'NUMBER', isRequired: true },
            ],
          },
        },
        include: { fields: true },
      })
    })
  })
})
