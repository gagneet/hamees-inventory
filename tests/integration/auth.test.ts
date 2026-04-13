/**
 * Integration Tests – Authentication
 *
 * Tests NextAuth.js credentials provider logic against the REAL database.
 * Uses the seed user: owner@hameesattire.com / admin123
 *
 * IMPORTANT: This test does NOT create or delete any data.
 * It only reads the existing seeded users.
 *
 * Run with: pnpm test tests/integration/auth.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

// ── Real DB connection for integration tests ───────────────────────────────
// We bypass the global mock by creating our own client instance.
let pool: Pool
let prisma: PrismaClient

beforeAll(() => {
  const connectionString = process.env.DATABASE_URL!
  pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  prisma = new PrismaClient({ adapter })
})

afterAll(async () => {
  await prisma.$disconnect()
  await pool.end()
})

// ── Helpers ────────────────────────────────────────────────────────────────
async function findUser(email: string) {
  return prisma.user.findUnique({ where: { email } })
}

async function verifyCredentials(email: string, password: string): Promise<boolean> {
  const user = await findUser(email)
  if (!user) return false
  return bcrypt.compare(password, user.password)
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('authentication – real database', () => {
  it('finds the seeded owner user', async () => {
    const user = await findUser('owner@hameesattire.com')
    expect(user).not.toBeNull()
    expect(user?.name).toBeTruthy()
    expect(user?.role).toBe('OWNER')
    expect(user?.active).toBe(true)
  })

  it('owner has a hashed password (not plaintext)', async () => {
    const user = await findUser('owner@hameesattire.com')
    expect(user?.password).not.toBe('admin123') // must not be stored as plaintext
    expect(user?.password.startsWith('$2')).toBe(true) // bcrypt hash prefix
  })

  it('valid credentials return true', async () => {
    const valid = await verifyCredentials('owner@hameesattire.com', 'admin123')
    expect(valid).toBe(true)
  })

  it('wrong password returns false', async () => {
    const valid = await verifyCredentials('owner@hameesattire.com', 'wrongpassword')
    expect(valid).toBe(false)
  })

  it('non-existent user returns false (user not found)', async () => {
    const user = await findUser('nonexistent@hameesattire.com')
    expect(user).toBeNull()
  })

  it('all seeded roles are present in the database', async () => {
    const users = await prisma.user.findMany({ select: { role: true, email: true } })
    const roles = users.map((u) => u.role)
    expect(roles).toContain('OWNER')
    expect(roles).toContain('ADMIN')
    expect(roles).toContain('INVENTORY_MANAGER')
    expect(roles).toContain('SALES_MANAGER')
    expect(roles).toContain('TAILOR')
    expect(roles).toContain('VIEWER')
  })

  it('admin user can be authenticated', async () => {
    const valid = await verifyCredentials('admin@hameesattire.com', 'admin123')
    expect(valid).toBe(true)
  })

  it('tailor user can be authenticated', async () => {
    const valid = await verifyCredentials('tailor@hameesattire.com', 'admin123')
    expect(valid).toBe(true)
  })

  it('viewer user can be authenticated', async () => {
    const valid = await verifyCredentials('viewer@hameesattire.com', 'admin123')
    expect(valid).toBe(true)
  })

  it('all active users have bcrypt-hashed passwords', async () => {
    const users = await prisma.user.findMany({
      where: { active: true },
      select: { email: true, password: true },
    })
    expect(users.length).toBeGreaterThan(0)
    for (const user of users) {
      expect(user.password.startsWith('$2'), `${user.email} has non-bcrypt password`).toBe(true)
    }
  })

  it('returns user id after finding by email', async () => {
    const user = await findUser('owner@hameesattire.com')
    expect(user?.id).toBeTruthy()
    expect(typeof user?.id).toBe('string')
  })
})
