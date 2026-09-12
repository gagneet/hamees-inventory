import type { Prisma } from '@prisma/client'
import { hasFinancialAccess } from '@/lib/field-acl'
import type { UserRole } from '@/lib/permissions'

/**
 * Payment-reminder alerts (order alerts of type REORDER_REMINDER) quote outstanding balances,
 * so roles without order financial access only see inventory / operational alerts.
 */
export function alertVisibilityScope(role: UserRole): Prisma.AlertWhereInput {
  if (hasFinancialAccess(role, 'order')) return {}
  return { NOT: { relatedType: 'order', type: 'REORDER_REMINDER' } }
}
