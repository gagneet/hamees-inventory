/**
 * GET /api/users — assignable-staff lookup must not become a user directory.
 */
import { describe, it, expect, vi } from 'vitest'

// Explicit model mocks: the global Proxy-based mock doesn't expose models outside $transaction
vi.mock('@/lib/db', () => ({
  prisma: { user: { findMany: vi.fn().mockResolvedValue([]) } },
}))

import { auth } from '@/lib/auth'
import { GET, parseAssignableRoles } from '@/app/api/users/route'

const mockedAuth = vi.mocked(auth as unknown as () => Promise<unknown>)
const asRole = (role: string) =>
  mockedAuth.mockResolvedValueOnce({ user: { id: 'user-1', name: 'U', email: 'u@example.com', role } })
const get = (query = '') => GET(new Request(`http://localhost/api/users${query}`))

describe('parseAssignableRoles', () => {
  it('accepts TAILOR and MASTER_TAILOR (comma separated, de-duplicated)', () => {
    expect(parseAssignableRoles('TAILOR')).toEqual(['TAILOR'])
    expect(parseAssignableRoles('TAILOR, MASTER_TAILOR,TAILOR')).toEqual(['TAILOR', 'MASTER_TAILOR'])
  })
  it('rejects any other role or an empty value', () => {
    expect(parseAssignableRoles('ADMIN')).toBeNull()
    expect(parseAssignableRoles('TAILOR,OWNER')).toBeNull()
    expect(parseAssignableRoles('')).toBeNull()
  })
})

describe('GET /api/users', () => {
  it('rejects non-tailor role filters with 400', async () => {
    const res = await get('?role=OWNER') // default mocked session is OWNER (has assign_tailors)
    expect(res.status).toBe(400)
  })

  it('forbids the tailor lookup for roles that cannot assign or supervise', async () => {
    for (const role of ['TAILOR', 'VIEWER', 'INVENTORY_MANAGER']) {
      asRole(role)
      const res = await get('?role=TAILOR')
      expect(res.status, role).toBe(403)
    }
  })

  it('allows the tailor lookup for MASTER_TAILOR', async () => {
    asRole('MASTER_TAILOR')
    const res = await get('?role=TAILOR,MASTER_TAILOR')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ users: [] })
  })

  it('restricts the full user listing to manage_users', async () => {
    asRole('SALES_MANAGER')
    expect((await get()).status).toBe(403)
    asRole('ADMIN')
    expect((await get()).status).toBe(200)
  })
})
