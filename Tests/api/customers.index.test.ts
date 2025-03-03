// src/tests/api/customers.index.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMocks } from 'node-mocks-http'
import handler from '../../pages/api/customers/index' // Justera sökvägen om det behövs

// 1) Mocka next-auth (getServerSession) och authOptions
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('../../pages/api/auth/authOptions', () => ({
  authOptions: {},
}))

// 2) Mocka PrismaClient
vi.mock('@prisma/client', () => {
  const prismaMock = {
    customer: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    $disconnect: vi.fn(),
  }
  return {
    PrismaClient: vi.fn().mockImplementation(() => prismaMock),
  }
})

// 3) Mocka rateLimiter
vi.mock('../../../lib/rateLimiterApi', () => ({
  __esModule: true,
  default: {
    consume: vi.fn(),
  },
}))

// Dra in de mockade modulerna för att använda deras mocks
import { getServerSession } from 'next-auth/next'
import { PrismaClient } from '@prisma/client'
import rateLimiter from '../../lib/rateLimiterApi'
import { authOptions } from '../../pages/api/auth/authOptions'

// Skapa en intern referens till Prisma-mockens metoder
// (så vi slipper göra (PrismaClient as any).mock...)
const prismaMock = new PrismaClient() as unknown as {
  customer: {
    findMany: ReturnType<typeof vi.fn>
    findFirst: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
  $disconnect: ReturnType<typeof vi.fn>
}

describe('API /api/customers', () => {
  // Nollställ alla mocks inför varje test
  beforeEach(() => {
    vi.clearAllMocks()
  })

  //
  // TESTER FÖR GET /api/customers
  //
  describe('GET /api/customers', () => {
    it('ska returnera 401 (Unauthorized) om användaren inte är inloggad', async () => {
      (getServerSession as vi.Mock).mockResolvedValueOnce(null)

      const { req, res } = createMocks({ method: 'GET' })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(401)
      expect(res._getJSONData()).toEqual({ error: 'Unauthorized' })
      expect(prismaMock.customer.findMany).not.toHaveBeenCalled()
    })

    it('ska returnera 200 med en lista av kunder när användaren är inloggad', async () => {
      // Mocka en session (inloggad användare)
      (getServerSession as vi.Mock).mockResolvedValueOnce({
        user: {
          storeId: '15',
        },
      })

      // Mocka rateLimiter
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      // Mocka prisma-anropet
      const fakeCustomers = [
        { id: 1, name: 'Kalle', storeId: '15' },
        { id: 2, name: 'Lisa', storeId: '15' },
      ]
      prismaMock.customer.findMany.mockResolvedValueOnce(fakeCustomers)

      const { req, res } = createMocks({ method: 'GET' })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(200)
      expect(res._getJSONData()).toEqual(fakeCustomers)
      expect(prismaMock.customer.findMany).toHaveBeenCalledWith({
        where: { storeId: '15' },
      })
    })
  })

  //
  // TESTER FÖR POST /api/customers
  //
  describe('POST /api/customers', () => {
    it('ska returnera 401 (Unauthorized) om användaren inte är inloggad', async () => {
      (getServerSession as vi.Mock).mockResolvedValueOnce(null)

      const { req, res } = createMocks({
        method: 'POST',
        body: { name: 'Simon Blide', email: 'blidesimon@gmail.com', phoneNumber: '0733240457' },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(401)
      expect(res._getJSONData()).toEqual({ error: 'Unauthorized' })
      expect(prismaMock.customer.create).not.toHaveBeenCalled()
    })

    it('ska returnera 400 vid valideringsfel (t.ex. saknas email)', async () => {
      (getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { storeId: '15' },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      const { req, res } = createMocks({
        method: 'POST',
        body: { name: 'SaknarEmail', phoneNumber: '0733240457' },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      expect(res._getJSONData()).toHaveProperty('message', 'Valideringsfel')
      expect(prismaMock.customer.create).not.toHaveBeenCalled()
    })

    it('ska returnera 400 om kunden redan finns', async () => {
      (getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { storeId: '15' },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      prismaMock.customer.findFirst.mockResolvedValueOnce({
        id: 1,
        name: 'Simon Blide',
        email: 'blidesimon@gmail.com',
        storeId: '15',
      })

      const { req, res } = createMocks({
        method: 'POST',
        body: { name: 'Simon Blide', email: 'blidesimon@gmail.com', phoneNumber: '0733240457' },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
      expect(res._getJSONData()).toEqual({
        message: 'Kund med denna email finns redan.',
      })
      expect(prismaMock.customer.create).not.toHaveBeenCalled()
    })

    it('ska returnera 201 när en ny kund skapas', async () => {
      (getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { storeId: '15' },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      prismaMock.customer.findFirst.mockResolvedValueOnce(null)
      prismaMock.customer.create.mockResolvedValueOnce({
        id: 99,
        name: 'Simon Blide',
        email: 'blidesimon@gmail.com',
        phoneNumber: '0733240457',
        storeId: '15',
      })

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'Simon Blide',
          email: 'blidesimon@gmail.com',
          phoneNumber: '0733240457',
        },
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(201)
      expect(res._getJSONData()).toEqual({
        id: 99,
        name: 'Simon Blide',
        email: 'blidesimon@gmail.com',
        phoneNumber: '0733240457',
        storeId: '15',
      })

      expect(prismaMock.customer.create).toHaveBeenCalledWith({
        data: {
          name: 'Simon Blide',
          email: 'blidesimon@gmail.com',
          phoneNumber: '0733240457',
          storeId: '15',
        },
      })
    })
  })
})
