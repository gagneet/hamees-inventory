/**
 * @featuretrace Users lookup API
 * GET /api/users?role=TAILOR[,MASTER_TAILOR]
 *   Assignable production staff for tailor-assignment pickers → [{ id, name, role }] of ACTIVE
 *   users. `role` must list only TAILOR / MASTER_TAILOR.
 *   Permission: assign_tailors, view_production or manage_users.
 * GET /api/users
 *   Full active-user listing (id, name, email, role) — manage_users only.
 * Passwords are never selected.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission, requirePermission } from '@/lib/api-permissions'
import { ASSIGNABLE_TAILOR_ROLES, type UserRole } from '@/lib/permissions'

/** Parse and validate the comma-separated `role` filter. Returns null when invalid. */
export function parseAssignableRoles(param: string): UserRole[] | null {
  const roles = [...new Set(param.split(',').map((r) => r.trim()).filter(Boolean))]
  if (roles.length === 0) return null
  if (roles.some((r) => !(ASSIGNABLE_TAILOR_ROLES as string[]).includes(r))) return null
  return roles as UserRole[]
}

export async function GET(request: Request) {
  const roleParam = new URL(request.url).searchParams.get('role')

  try {
    if (roleParam !== null) {
      const { error } = await requireAnyPermission(['assign_tailors', 'view_production', 'manage_users'])
      if (error) return error

      const roles = parseAssignableRoles(roleParam)
      if (!roles) {
        return NextResponse.json(
          { error: `role must be one or more of: ${ASSIGNABLE_TAILOR_ROLES.join(', ')}` },
          { status: 400 }
        )
      }

      const users = await prisma.user.findMany({
        where: { active: true, role: { in: roles } },
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
      })
      return NextResponse.json({ users: users ?? [] })
    }

    const { error } = await requirePermission('manage_users')
    if (error) return error

    const users = await prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({ users: users ?? [] })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
