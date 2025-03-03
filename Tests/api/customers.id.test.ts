// src/Tests/api/customers.id.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMocks } from 'node-mocks-http'
import handler from '../../pages/api/customers/[id]' // Justera sökvägen om nödvändigt

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
    customer: {
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

// Importera in mockade moduler
import { getServerSession } from 'next-auth/next'
import { PrismaClient } from '@prisma/client'
import rateLimiter from '../../lib/rateLimiterApi'
import { authOptions } from '../../pages/api/auth/authOptions'

// Skapa en intern referens till Prisma-mockens metoder
const prismaMock = new PrismaClient() as unknown as {
  customer: {
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
  $disconnect: ReturnType<typeof vi.fn>
}

describe('API /api/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -----------------------------------------------------------------
  //                       G E T   /[id]
  // -----------------------------------------------------------------
  describe('GET /api/customers/[id]', () => {
    it('ska returnera 401 om användaren inte är inloggad', async () => {
      (getServerSession as vi.Mock).mockResolvedValueOnce(null)

      const { req, res } = createMocks({
        method: 'GET',
        query: { id: '1' },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(401)
      expect(res._getJSONData()).toEqual({ error: 'Unauthorized' })
    })

    it('ska returnera 400 om id inte är ett giltigt nummer', async () => {
      ;(getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { storeId: 'store_123' },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      const { req, res } = createMocks({
        method: 'GET',
        query: { id: 'abc' }, // ogiltigt nummer
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(400)
      expect(res._getJSONData()).toEqual({ error: 'Ogiltigt kund-ID' })
    })

    it('ska returnera 404 om kund inte finns', async () => {
      ;(getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { storeId: 'store_123' },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      // findUnique returnerar null ⇒ ingen kund
      prismaMock.customer.findUnique.mockResolvedValueOnce(null)

      const { req, res } = createMocks({
        method: 'GET',
        query: { id: '999' },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(404)
      expect(res._getJSONData()).toEqual({ error: 'Customer not found' })
    })

    it('ska returnera 403 om kunden inte tillhör sessionens butik', async () => {
      ;(getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { storeId: 'store_123' },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      // findUnique returnerar en kund men med fel storeId
      prismaMock.customer.findUnique.mockResolvedValueOnce({
        id: 1,
        name: 'FelButik',
        email: 'wrong@example.com',
        phoneNumber: '0733240457',
        storeId: 'store_999', // mismatch
      })

      const { req, res } = createMocks({
        method: 'GET',
        query: { id: '1' },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(403)
      expect(res._getJSONData()).toEqual({ error: 'Forbidden' })
    })

    it('ska returnera 200 och kundens data vid korrekt ID och storeId', async () => {
      ;(getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { storeId: 'store_123' },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      const fakeCustomer = {
        id: 1,
        name: 'Anna',
        email: 'anna@example.com',
        phoneNumber: '0733240457',
        storeId: 'store_123',
      }
      prismaMock.customer.findUnique.mockResolvedValueOnce(fakeCustomer)

      const { req, res } = createMocks({
        method: 'GET',
        query: { id: '1' },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(200)
      expect(res._getJSONData()).toEqual(fakeCustomer)
    })
  })

  // -----------------------------------------------------------------
  //                       P U T   /[id]
  // -----------------------------------------------------------------
  describe('PUT /api/customers/[id]', () => {
    it('ska returnera 401 om användaren inte är inloggad', async () => {
      (getServerSession as vi.Mock).mockResolvedValueOnce(null)

      const { req, res } = createMocks({
        method: 'PUT',
        query: { id: '1' },
        body: { name: 'Ny', email: 'ny@example.com', phoneNumber: '0733240457' },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(401)
      expect(res._getJSONData()).toEqual({ error: 'Unauthorized' })
    })

    it('ska returnera 400 om id inte är giltigt', async () => {
      ;(getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { storeId: 'store_123' },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      const { req, res } = createMocks({
        method: 'PUT',
        query: { id: 'notanumber' },
        body: { name: 'Ny', email: 'ny@example.com', phoneNumber: '0733240457' },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(400)
      expect(res._getJSONData()).toEqual({ error: 'Ogiltigt kund-ID' })
    })

    it('ska returnera 400 vid valideringsfel (t.ex. saknas email)', async () => {
      ;(getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { storeId: 'store_123' },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      // Exempel: saknar email → Zod schema fallerar
      const { req, res } = createMocks({
        method: 'PUT',
        query: { id: '1' },
        body: { email: 'inte-en-riktig-email' }, 
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(400)
      expect(res._getJSONData()).toHaveProperty('message', 'Valideringsfel')
    })

    it('ska returnera 404 om kunden inte finns', async () => {
      ;(getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { storeId: 'store_123' },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      prismaMock.customer.findUnique.mockResolvedValueOnce(null)

      const { req, res } = createMocks({
        method: 'PUT',
        query: { id: '999' },
        body: {
          name: 'Uppdaterad',
          email: 'uppdaterad@example.com',
          phoneNumber: '7654321',
        },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(404)
      expect(res._getJSONData()).toEqual({ error: 'Customer not found' })
    })

    it('ska returnera 403 om kunden inte tillhör sessionens butik', async () => {
      ;(getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { storeId: 'store_123' },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      prismaMock.customer.findUnique.mockResolvedValueOnce({
        id: 2,
        name: 'FelButik',
        email: 'wrong@example.com',
        phoneNumber: '0733240457',
        storeId: 'store_999', // mismatch
      })

      const { req, res } = createMocks({
        method: 'PUT',
        query: { id: '2' },
        body: {
          name: 'Uppdaterad',
          email: 'uppdaterad@example.com',
          phoneNumber: '7654321',
        },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(403)
      expect(res._getJSONData()).toEqual({ error: 'Forbidden' })
    })

    it('ska returnera 200 när kunden uppdateras korrekt', async () => {
      ;(getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { storeId: 'store_123' },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      // findUnique → vi hittar en kund med samma storeId
      prismaMock.customer.findUnique.mockResolvedValueOnce({
        id: 10,
        name: 'Gammalt namn',
        email: 'gammal@example.com',
        phoneNumber: '1111111',
        storeId: 'store_123',
      })

      // update → returerar den nya datan
      prismaMock.customer.update.mockResolvedValueOnce({
        id: 10,
        name: 'Nytt namn',
        email: 'ny@example.com',
        phoneNumber: '2222222',
        storeId: 'store_123',
      })

      const { req, res } = createMocks({
        method: 'PUT',
        query: { id: '10' },
        body: {
          name: 'Nytt namn',
          email: 'ny@example.com',
          phoneNumber: '2222222',
        },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(200)
      expect(res._getJSONData()).toEqual({
        id: 10,
        name: 'Nytt namn',
        email: 'ny@example.com',
        phoneNumber: '2222222',
        storeId: 'store_123',
      })
    })
  })

  // -----------------------------------------------------------------
  //                     D E L E T E   /[id]
  // -----------------------------------------------------------------
  describe('DELETE /api/customers/[id]', () => {
    it('ska returnera 401 om användaren inte är inloggad', async () => {
      (getServerSession as vi.Mock).mockResolvedValueOnce(null)

      const { req, res } = createMocks({
        method: 'DELETE',
        query: { id: '1' },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(401)
      expect(res._getJSONData()).toEqual({ error: 'Unauthorized' })
    })

    it('ska returnera 400 om id inte är giltigt', async () => {
      ;(getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { storeId: 'store_123' },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      const { req, res } = createMocks({
        method: 'DELETE',
        query: { id: 'hejhej' }, // ogiltigt
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(400)
      expect(res._getJSONData()).toEqual({ error: 'Ogiltigt kund-ID' })
    })

    it('ska returnera 404 om kunden inte finns', async () => {
      ;(getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { storeId: 'store_123' },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      // findUnique → null → kunden saknas
      prismaMock.customer.findUnique.mockResolvedValueOnce(null)

      const { req, res } = createMocks({
        method: 'DELETE',
        query: { id: '999' },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(404)
      expect(res._getJSONData()).toEqual({ error: 'Customer not found' })
    })

    it('ska returnera 403 om kunden inte tillhör sessionens butik', async () => {
      ;(getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { storeId: 'store_123' },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      prismaMock.customer.findUnique.mockResolvedValueOnce({
        id: 20,
        name: 'FelButik',
        email: 'wrong@example.com',
        phoneNumber: '0733240457',
        storeId: 'store_999',
      })

      const { req, res } = createMocks({
        method: 'DELETE',
        query: { id: '20' },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(403)
      expect(res._getJSONData()).toEqual({ error: 'Forbidden' })
    })

    it('ska returnera 204 vid lyckad radering', async () => {
      ;(getServerSession as vi.Mock).mockResolvedValueOnce({
        user: { storeId: 'store_123' },
      })
      ;(rateLimiter.consume as vi.Mock).mockResolvedValueOnce({})

      // findUnique → kund hittas
      prismaMock.customer.findUnique.mockResolvedValueOnce({
        id: 50,
        name: 'KundSomSkaRaderas',
        email: 'test@example.com',
        phoneNumber: '0733240457',
        storeId: 'store_123',
      })

      // delete anropet
      prismaMock.customer.delete.mockResolvedValueOnce({
        id: 50,
        name: 'KundSomSkaRaderas',
        email: 'test@example.com',
        phoneNumber: '0733240457',
        storeId: 'store_123',
      })

      const { req, res } = createMocks({
        method: 'DELETE',
        query: { id: '50' },
      })

      await handler(req, res)
      expect(res._getStatusCode()).toBe(204)
      expect(res._getData()).toBe('') // 204 → inget innehåll
    })
  })
})
