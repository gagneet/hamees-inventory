import { UserRole } from '@prisma/client'

/**
 * FEATURETRACE: Field-Level Access Control Lists (ACL)
 * 
 * Purpose: Enforce field-level visibility based on user roles.
 * Only OWNER/ADMIN can see financial fields; other roles have restricted access.
 * 
 * Entity types: 'order', 'purchase_order', 'inventory', 'expense', 'payment', 'customer'
 * 
 * Implementation:
 * - Backend: filterObjectByRole() removes unauthorized fields from API responses
 * - Frontend: canViewField() hook conditionally renders field labels/values
 * - No breaking API changes; unauthorized fields simply absent from response
 * 
 * Risk: If filtering is incomplete, sensitive financial data may leak to unauthorized roles.
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

/**
 * Field visibility rules by role and entity type
 * Returns true if role can view this field, false otherwise
 */
const fieldVisibilityRules: Record<EntityType, Record<UserRole, string[]>> = {
  // Order: Only OWNER/ADMIN can see financial fields
  order: {
    OWNER: ['totalAmount', 'advancePaid', 'discount', 'paymentMode', 'balanceAmount', 'gstAmount', 'cgst', 'sgst', 'igst', 'stitchingTier', 'workmanshipCost', 'designerFee', 'fabricWastage'],
    ADMIN: ['totalAmount', 'advancePaid', 'discount', 'paymentMode', 'balanceAmount', 'gstAmount', 'cgst', 'sgst', 'igst', 'stitchingTier', 'workmanshipCost', 'designerFee', 'fabricWastage'],
    INVENTORY_MANAGER: [], // No order financial fields for inventory manager
    SALES_MANAGER: [], // No financial fields, but see garment/customer details
    TAILOR: [], // No financial fields for tailor
    VIEWER: [], // No financial fields for viewer
  },

  // Order Item: only OWNER/ADMIN can see pricing/cost fields
  order_item: {
    OWNER: ['totalPrice', 'fabricCost', 'accessoriesCost', 'stitchingCost'],
    ADMIN: ['totalPrice', 'fabricCost', 'accessoriesCost', 'stitchingCost'],
    INVENTORY_MANAGER: [],
    SALES_MANAGER: [],
    TAILOR: [],
    VIEWER: [],
  },

  // Purchase Order: Only OWNER/ADMIN/INVENTORY_MANAGER can see financial fields
  purchase_order: {
    OWNER: ['totalAmount', 'balanceAmount', 'paidAmount', 'paymentMode', 'dueDate'],
    ADMIN: ['totalAmount', 'balanceAmount', 'paidAmount', 'paymentMode', 'dueDate'],
    INVENTORY_MANAGER: ['totalAmount', 'balanceAmount', 'paidAmount'], // Can see PO amounts (their responsibility)
    SALES_MANAGER: [], // Sales manager doesn't deal with POs
    TAILOR: [], // TAILOR cannot see PO amounts - only cloth/item details. Can create but not see financials
    VIEWER: [], // Viewer cannot see financial data
  },

  // Inventory: OWNER/ADMIN/INVENTORY_MANAGER can see cost
  inventory: {
    OWNER: ['costPerUnit', 'totalCost', 'unitPrice'],
    ADMIN: ['costPerUnit', 'totalCost', 'unitPrice'],
    INVENTORY_MANAGER: ['costPerUnit', 'totalCost', 'unitPrice'],
    SALES_MANAGER: [], // Sales manager doesn't see inventory costs
    TAILOR: [], // Tailor doesn't see costs
    VIEWER: [], // Viewer doesn't see costs
  },

  // Expense: Only OWNER/ADMIN can see
  expense: {
    OWNER: ['totalAmount', 'category', 'paymentMode', 'notes'],
    ADMIN: ['totalAmount', 'category', 'paymentMode', 'notes'],
    INVENTORY_MANAGER: [], // Inventory manager cannot see expenses
    SALES_MANAGER: [], // Sales manager cannot see expenses
    TAILOR: [], // Tailor cannot see expenses
    VIEWER: [], // Viewer cannot see expenses
  },

  // Payment: Only OWNER/ADMIN can see
  payment: {
    OWNER: ['amount', 'paidAmount', 'balanceAmount', 'paymentMode', 'paidDate'],
    ADMIN: ['amount', 'paidAmount', 'balanceAmount', 'paymentMode', 'paidDate'],
    INVENTORY_MANAGER: [], // No payment details for inventory manager
    SALES_MANAGER: [], // No payment details for sales manager
    TAILOR: [], // No payment details for tailor
    VIEWER: [], // No payment details for viewer
  },

  // Customer: Only OWNER/ADMIN can see financial summary fields
  customer: {
    OWNER: ['totalRevenue', 'outstandingAmount', 'totalOrders', 'averageOrderValue'],
    ADMIN: ['totalRevenue', 'outstandingAmount', 'totalOrders', 'averageOrderValue'],
    INVENTORY_MANAGER: [], // Inventory manager doesn't see customer financial summary
    SALES_MANAGER: [], // Sales manager sees customer details, not financial amounts
    TAILOR: [], // Tailor doesn't see customer financial summary
    VIEWER: [], // Viewer doesn't see financial summary
  },

  // Financial Reports: Only OWNER/ADMIN can see
  report_financial: {
    OWNER: [
      'summary',
      'financialData',
      'yearToDate',
      'topCustomers',
      'customerSegments',
      'expensesByMonth',
      'expensesByCategory',
      'topExpenses',
    ],
    ADMIN: [
      'summary',
      'financialData',
      'yearToDate',
      'topCustomers',
      'customerSegments',
      'expensesByMonth',
      'expensesByCategory',
      'topExpenses',
    ],
    INVENTORY_MANAGER: [], // No financial reports for inventory manager
    SALES_MANAGER: [], // No financial reports for sales manager
    TAILOR: [], // No financial reports for tailor
    VIEWER: [], // No financial reports for viewer
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
 * Get all viewable fields for a role and entity type
 */
export function getViewableFields(role: UserRole, entityType: EntityType): string[] {
  return fieldVisibilityRules[entityType]?.[role] ?? []
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
  
  // If no restrictions (empty allowedFields array means hide all financial fields),
  // return only non-financial fields from the object
  // This is done by reconstructing the object with only allowed keys
  
  const filtered: Record<string, any> = {}
  
  // Copy only allowed fields from original object
  for (const [key, value] of Object.entries(obj)) {
    // Report payloads are inherently financial; enforce strict allow-listing.
    if (entityType === 'report_financial') {
      if (allowedFields.includes(key)) {
        filtered[key] = value
      }
      continue
    }

    // Always include non-financial fields (presence in allowedFields list)
    // For unrestricted access (empty allowedFields), we filter OUT the financial fields
    
    if (allowedFields.length === 0) {
      // Role has no financial field access - exclude known financial fields
      if (isFinancialField(key)) {
        continue
      }
    } else {
      // Role has some financial access - only include explicitly allowed fields
      // OR non-financial fields if they're basic properties
      if (isFinancialField(key) && !allowedFields.includes(key)) {
        continue
      }
    }
    
    filtered[key] = value
  }

  return filtered as Partial<T>
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
function isFinancialField(fieldName: string): boolean {
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
    'category', // Expense category is financial data
    'paymentmode', // Payment mode is financial data
  ]

  const lowerField = fieldName.toLowerCase()
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
