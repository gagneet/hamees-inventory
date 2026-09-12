/**
 * FEATURETRACE: User administration guards
 * Shared validation and privilege-escalation rules for app/api/admin/users routes.
 */

import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { ALL_ROLES, type UserRole } from '@/lib/permissions'

type Db = typeof prisma | Prisma.TransactionClient

export const roleSchema = z.enum(ALL_ROLES as [UserRole, ...UserRole[]])

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(200, 'Password is too long')

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email address')
  .max(254)

export const USER_PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const

type TargetUser = { id: string; role: UserRole; active: boolean }

/**
 * Returns an error message if the change would lock the shop out or let an admin
 * escalate/remove themselves; null when the change is allowed.
 * Run it with the same serializable transaction client that applies the change, so two admins
 * demoting each other at once can't both pass the last-admin check.
 */
export async function checkUserChange(
  actorId: string,
  target: TargetUser,
  change: { role?: UserRole; active?: boolean },
  db: Db = prisma
): Promise<string | null> {
  const roleChanges = change.role !== undefined && change.role !== target.role
  const deactivates = change.active === false && target.active

  if (target.id === actorId && (roleChanges || change.active === false)) {
    return 'You cannot change your own role or deactivate your own account'
  }

  // Never remove the last active account holding a role that keeps the shop manageable
  for (const protectedRole of ['ADMIN', 'OWNER'] as const) {
    if (target.role !== protectedRole || !target.active) continue
    if (!roleChanges && !deactivates) continue
    const others = await db.user.count({
      where: { role: protectedRole, active: true, id: { not: target.id } },
    })
    if (others === 0) {
      return `At least one active ${protectedRole === 'ADMIN' ? 'Administrator' : 'Owner'} account must remain`
    }
  }

  return null
}
