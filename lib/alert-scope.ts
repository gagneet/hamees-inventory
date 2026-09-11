import type { Prisma } from '@prisma/client'
import { hasFinancialAccess } from '@/lib/field-acl'
import type { UserRole } from '@/lib/permissions'

/**
 * Payment-reminder alerts (type PAYMENT_REMINDER) quote outstanding balances, so roles without
 * order financial access only see inventory / operational alerts. REORDER_REMINDER alerts are stock
 * reorders (quantities and suppliers, no amounts) and stay visible.
 */
export function alertVisibilityScope(role: UserRole): Prisma.AlertWhereInput {
  if (hasFinancialAccess(role, 'order')) return {}
  return { NOT: { type: 'PAYMENT_REMINDER' } }
}
