import { UserRole } from '@prisma/client'

/**
 * FEATURETRACE: Field-Level Access Control Lists (ACL)
 *
 * Purpose: Enforce field-level visibility based on user roles.
 * Only OWNER/ADMIN can see sales financials; INVENTORY_MANAGER additionally sees
 * inventory and purchase-order costs. Every other role gets non-financial data only.
 *
 * Entity types: 'order', 'order_item', 'purchase_order', 'inventory', 'expense', 'payment',
 * 'customer', 'report_financial'
 *
 * Implementation:
 * - Backend: filterObjectByRole() removes unauthorized fields from API responses. For roles
 *   without financial access the filter is DEEP: nested relations (order.items[].totalPrice,
 *   items[].clothInventory.pricePerMeter, …) are stripped too.
 * - Frontend: canViewField() / useFieldVisibility() conditionally render labels and values.
 * - No breaking API changes; unauthorized fields are simply absent from the response.
 *
 * Risk: If filtering is incomplete, sensitive financial data may leak to unauthorized roles.
 * Prefer not selecting financial columns at all for restricted roles where practical.
 */

export type EntityType =
  | 'order'
  | 'order_item'
  | 'purchase_order'
  | 'inventory'
  | 'expense'
  | 'payment'
  | 'customer'
  | 'report_financial'

const ORDER_FIELDS = ['totalAmount', 'advancePaid', 'discount', 'paymentMode', 'balanceAmount', 'gstAmount', 'cgst', 'sgst', 'igst', 'subTotal', 'stitchingTier', 'workmanshipCost', 'designerFee', 'fabricWastage']
const ORDER_ITEM_FIELDS = ['totalPrice', 'pricePerUnit', 'fabricCost', 'accessoriesCost', 'stitchingCost']
const PO_FIELDS = ['totalAmount', 'balanceAmount', 'paidAmount', 'paymentMode', 'dueDate', 'subTotal', 'gstAmount', 'pricePerUnit', 'totalPrice']
const INVENTORY_FIELDS = ['costPerUnit', 'totalCost', 'unitPrice', 'pricePerMeter', 'pricePerUnit', 'totalValue']
const EXPENSE_FIELDS = ['totalAmount', 'amount', 'gstAmount', 'category', 'paymentMode', 'notes']
const PAYMENT_FIELDS = ['amount', 'paidAmount', 'installmentAmount', 'balanceAmount', 'paymentMode', 'paidDate']
const CUSTOMER_FIELDS = ['totalRevenue', 'outstandingAmount', 'totalOrders', 'averageOrderValue', 'totalSpent']
const REPORT_FIELDS = [
  'summary',
  'financialData',
  'yearToDate',
  'topCustomers',
  'customerSegments',
  'expensesByMonth',
  'expensesByCategory',
  'topExpenses',
]

const none = (): string[] => []

/**
 * Field visibility rules by role and entity type.
 * A non-empty list means the role has financial visibility for that entity.
 */
const fieldVisibilityRules: Record<EntityType, Record<UserRole, string[]>> = {
  // Order: Only OWNER/ADMIN can see financial fields
  order: {
    OWNER: ORDER_FIELDS,
    ADMIN: ORDER_FIELDS,
    INVENTORY_MANAGER: none(),
    SALES_MANAGER: none(),
    MASTER_TAILOR: none(),
    TAILOR: none(),
    VIEWER: none(),
  },

  // Order Item: only OWNER/ADMIN can see pricing/cost fields
  order_item: {
    OWNER: ORDER_ITEM_FIELDS,
    ADMIN: ORDER_ITEM_FIELDS,
    INVENTORY_MANAGER: none(),
    SALES_MANAGER: none(),
    MASTER_TAILOR: none(),
    TAILOR: none(),
    VIEWER: none(),
  },

  // Purchase Order: OWNER/ADMIN/INVENTORY_MANAGER (who raise and pay POs) see amounts.
  // TAILOR/MASTER_TAILOR can raise material requests but never see amounts.
  purchase_order: {
    OWNER: PO_FIELDS,
    ADMIN: PO_FIELDS,
    INVENTORY_MANAGER: PO_FIELDS,
    SALES_MANAGER: none(),
    MASTER_TAILOR: none(),
    TAILOR: none(),
    VIEWER: none(),
  },

  // Inventory: OWNER/ADMIN/INVENTORY_MANAGER can see cost
  inventory: {
    OWNER: INVENTORY_FIELDS,
    ADMIN: INVENTORY_FIELDS,
    INVENTORY_MANAGER: INVENTORY_FIELDS,
    SALES_MANAGER: none(),
    MASTER_TAILOR: none(),
    TAILOR: none(),
    VIEWER: none(),
  },

  // Expense: Only OWNER/ADMIN can see
  expense: {
    OWNER: EXPENSE_FIELDS,
    ADMIN: EXPENSE_FIELDS,
    INVENTORY_MANAGER: none(),
    SALES_MANAGER: none(),
    MASTER_TAILOR: none(),
    TAILOR: none(),
    VIEWER: none(),
  },

  // Payment: Only OWNER/ADMIN can see
  payment: {
    OWNER: PAYMENT_FIELDS,
    ADMIN: PAYMENT_FIELDS,
    INVENTORY_MANAGER: none(),
    SALES_MANAGER: none(),
    MASTER_TAILOR: none(),
    TAILOR: none(),
    VIEWER: none(),
  },

  // Customer: Only OWNER/ADMIN can see financial summary fields
  customer: {
    OWNER: CUSTOMER_FIELDS,
    ADMIN: CUSTOMER_FIELDS,
    INVENTORY_MANAGER: none(),
    SALES_MANAGER: none(),
    MASTER_TAILOR: none(),
    TAILOR: none(),
    VIEWER: none(),
  },

  // Financial Reports: Only OWNER/ADMIN can see
  report_financial: {
    OWNER: REPORT_FIELDS,
    ADMIN: REPORT_FIELDS,
    INVENTORY_MANAGER: none(),
    SALES_MANAGER: none(),
    MASTER_TAILOR: none(),
    TAILOR: none(),
    VIEWER: none(),
  },
}

/**
 * Check if a user role can view a specific field on an entity
 * @param role User role
 * @param entityType Type of entity (order, purchase_order, etc.)
 * @param fieldName Field name to check
 * @returns true if user can view this field
 */
export function canViewField(role: UserRole, entityType: EntityType, fieldName: string): boolean {
  const allowedFields = fieldVisibilityRules[entityType]?.[role] ?? []
  return allowedFields.includes(fieldName)
}

/**
 * Whether the role may see financial data for this entity at all.
 */
export function hasFinancialAccess(role: UserRole, entityType: EntityType): boolean {
  return (fieldVisibilityRules[entityType]?.[role] ?? []).length > 0
}

/**
 * Get all viewable fields for a role and entity type
 */
export function getViewableFields(role: UserRole, entityType: EntityType): string[] {
  return fieldVisibilityRules[entityType]?.[role] ?? []
}

function isPlainObject(value: unknown): value is Record<string, any> {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** Recursively drop financial keys from plain objects/arrays (Dates and other instances are kept). */
function stripFinancialDeep(value: any, depth = 0): any {
  if (depth > 8) return value
  if (Array.isArray(value)) return value.map((v) => stripFinancialDeep(v, depth + 1))
  if (!isPlainObject(value)) return value
  const out: Record<string, any> = {}
  for (const [key, v] of Object.entries(value)) {
    if (isFinancialField(key)) continue
    out[key] = stripFinancialDeep(v, depth + 1)
  }
  return out
}

/**
 * Filter an object by removing fields the user cannot view
 * Used in API responses to strip sensitive data before sending to client
 *
 * @param obj Object to filter (e.g., order, purchase order)
 * @param role User role
 * @param entityType Type of entity
 * @returns Filtered object with only viewable fields
 */
export function filterObjectByRole<T extends Record<string, any>>(
  obj: T | null | undefined,
  role: UserRole,
  entityType: EntityType
): Partial<T> {
  if (!obj) return {}

  const allowedFields = getViewableFields(role, entityType)

  // Report payloads are inherently financial; enforce strict allow-listing.
  if (entityType === 'report_financial') {
    const filtered: Record<string, any> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (allowedFields.includes(key)) filtered[key] = value
    }
    return filtered as Partial<T>
  }

  // Roles with financial visibility for this entity see the full record.
  if (allowedFields.length > 0) {
    return { ...obj }
  }

  // Everyone else: remove financial fields at every depth (including nested relations).
  return stripFinancialDeep(obj) as Partial<T>
}

/**
 * Filter an array of objects
 */
export function filterArrayByRole<T extends Record<string, any>>(
  arr: T[] | null | undefined,
  role: UserRole,
  entityType: EntityType
): Partial<T>[] {
  if (!arr) return []
  return arr.map((item) => filterObjectByRole(item, role, entityType))
}

/**
 * Check if a field name is typically a financial field
 * Used to filter out unauthorized fields when role has no explicit access
 */
export function isFinancialField(fieldName: string): boolean {
  const financialPatterns = [
    'amount',
    'cost',
    'price',
    'paid',
    'advance',
    'discount',
    'gst',
    'cgst',
    'sgst',
    'igst',
    'tax',
    'total',
    'balance',
    'revenue',
    'profit',
    'margin',
    'expense',
    'workmanship',
    'designer',
    'wastage',
    'stitching',
    'charge',
    'value',
    'spent',
    'category', // Expense category is financial data
    'paymentmode', // Payment mode is financial data
  ]

  const lowerField = fieldName.toLowerCase()
  // Quantities and counts are operational, not financial
  // ("discount" ends in "count" but is financial)
  const isCount = lowerField.endsWith('count') && !lowerField.endsWith('discount')
  if (lowerField === 'totalitems' || lowerField === 'quantity' || isCount) return false
  return financialPatterns.some((pattern) => lowerField.includes(pattern))
}

/**
 * Utility to check if multiple fields are visible to a role
 */
export function canViewAnyField(role: UserRole, entityType: EntityType, fieldNames: string[]): boolean {
  return fieldNames.some((fieldName) => canViewField(role, entityType, fieldName))
}

/**
 * Utility to check if all fields are visible to a role
 */
export function canViewAllFields(role: UserRole, entityType: EntityType, fieldNames: string[]): boolean {
  return fieldNames.every((fieldName) => canViewField(role, entityType, fieldName))
}
