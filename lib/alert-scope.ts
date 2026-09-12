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

/**
 * Which inventory table an alert's relatedId points at. Alerts written before 0.32.0 (and by the
 * older seeds) stored the Prisma model name, so both spellings resolve to the same kind.
 */
const ALERT_ITEM_KINDS: Record<string, 'cloth' | 'accessory'> = {
  cloth: 'cloth',
  INVENTORY: 'cloth',
  ClothInventory: 'cloth',
  accessory: 'accessory',
  AccessoryInventory: 'accessory',
}

export function alertItemKind(relatedType: string | null | undefined): 'cloth' | 'accessory' | null {
  return (relatedType && ALERT_ITEM_KINDS[relatedType]) || null
}
