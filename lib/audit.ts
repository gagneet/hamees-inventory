/**
 * FEATURETRACE: Audit log
 * Records security-relevant changes (users, roles, settings, tailor assignments).
 * Never throws — auditing must not break the action being audited.
 */

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export async function audit(entry: {
  userId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  details?: Prisma.InputJsonValue
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        details: entry.details,
      },
    })
  } catch (error) {
    console.error('Failed to write audit log:', error)
  }
}
