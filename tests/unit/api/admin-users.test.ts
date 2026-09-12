/**
 * PATCH /api/admin/users/[id] — last-admin protection inside a serializable transaction,
 * password hashing cost and conflict handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PATCH } from '@/app/api/admin/users/[id]/route'
import { BCRYPT_COST } from '@/lib/password'

type Mocked = ReturnType<typeof vi.fn>
const m = (fn: unknown) => fn as Mocked

function patch(id: string, body: unknown) {
  return PATCH(
    new Request(`http://localhost/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  m(auth).mockResolvedValue({ user: { id: 'admin-1', name: 'Admin', email: 'a@x.test', role: 'ADMIN' } })
  m(prisma.$transaction).mockImplementation(async (fn: unknown) =>
    typeof fn === 'function' ? (fn as (tx: typeof prisma) => unknown)(prisma) : Promise.all(fn as unknown[])
  )
  m(prisma.user.findUnique).mockResolvedValue({ id: 'admin-2', email: 'b@x.test', role: 'ADMIN', active: true })
  m(prisma.user.findFirst).mockResolvedValue(null)
  m(prisma.user.count).mockResolvedValue(1)
  m(prisma.user.update).mockResolvedValue({ id: 'admin-2', role: 'VIEWER' })
  m(prisma.auditLog.create).mockResolvedValue({})
})

describe('PATCH /api/admin/users/[id]', () => {
  it('runs the last-admin check and the update in one serializable transaction', async () => {
    const res = await patch('admin-2', { role: 'VIEWER' })
    expect(res.status).toBe(200)
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' })
  })

  it('refuses to demote the last active administrator', async () => {
    m(prisma.user.count).mockResolvedValue(0)
    const res = await patch('admin-2', { role: 'VIEWER' })
    expect(res.status).toBe(403)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('refuses self role change', async () => {
    m(prisma.user.findUnique).mockResolvedValue({ id: 'admin-1', email: 'a@x.test', role: 'ADMIN', active: true })
    const res = await patch('admin-1', { role: 'VIEWER' })
    expect(res.status).toBe(403)
  })

  it('hashes a new password with the shared bcrypt cost', async () => {
    const res = await patch('admin-2', { password: 'a-new-password' })
    expect(res.status).toBe(200)
    const stored = m(prisma.user.update).mock.calls[0][0].data.password as string
    expect(bcrypt.getRounds(stored)).toBe(BCRYPT_COST)
  })

  it('returns 409 when a concurrent change causes a serialization failure', async () => {
    m(prisma.$transaction).mockRejectedValue(Object.assign(new Error('write conflict'), { code: 'P2034' }))
    const res = await patch('admin-2', { role: 'VIEWER' })
    expect(res.status).toBe(409)
  })

  it('returns 409 for an email that is already used', async () => {
    m(prisma.user.findFirst).mockResolvedValue({ id: 'someone-else' })
    const res = await patch('admin-2', { email: 'taken@x.test' })
    expect(res.status).toBe(409)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('is refused for roles without manage_users', async () => {
    m(auth).mockResolvedValue({ user: { id: 'owner-1', role: 'OWNER' } })
    const res = await patch('admin-2', { role: 'VIEWER' })
    expect(res.status).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
