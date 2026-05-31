import { NextResponse } from 'next/server'
import { canViewField, filterObjectByRole, filterArrayByRole, type EntityType } from '@/lib/field-acl'
import type { UserRole } from '@prisma/client'

/**
 * Middleware to automatically filter API response objects based on user role
 * Removes unauthorized financial fields from the response
 *
 * Usage in API route:
 *   const data = await prisma.order.findMany(...)
 *   return filterApiResponse(data, session.user.role, 'order')
 */
export function filterApiResponse<T extends Record<string, any> | Record<string, any>[]>(
  data: T | null | undefined,
  userRole: UserRole,
  entityType: EntityType
): T | Partial<T> | Partial<T>[] | null | undefined {
  if (!data) return data

  if (Array.isArray(data)) {
    const filtered = filterArrayByRole(data, userRole, entityType)
    return filterPurchaseOrderItems(filtered, userRole, entityType) as Partial<T>[]
  }

  const filtered = filterObjectByRole(data, userRole, entityType)
  return filterPurchaseOrderItems(filtered, userRole, entityType) as Partial<T>
}

function filterPurchaseOrderItems<T>(
  data: T,
  userRole: UserRole,
  entityType: EntityType
): T {
  if (entityType !== 'purchase_order' || canViewField(userRole, 'purchase_order', 'totalAmount')) {
    return data
  }

  const stripItemPrices = (item: Record<string, any>) => {
    const { pricePerUnit, totalPrice, ...rest } = item
    return rest
  }

  const stripFromPO = (po: Record<string, any>) => ({
    ...po,
    items: Array.isArray(po.items) ? po.items.map(stripItemPrices) : po.items,
  })

  if (Array.isArray(data)) {
    return data.map((item) => stripFromPO(item as Record<string, any>)) as T
  }

  if (data && typeof data === 'object') {
    return stripFromPO(data as Record<string, any>) as T
  }

  return data
}

/**
 * Wrapper to return filtered JSON response
 * Automatically applies ACL filtering before returning to client
 */
export function jsonResponse<T extends Record<string, any> | Record<string, any>[]>(
  data: T | null | undefined,
  userRole: UserRole,
  entityType: EntityType,
  status: number = 200
): NextResponse {
  const filtered = filterApiResponse(data, userRole, entityType)
  return NextResponse.json(filtered, { status })
}

/**
 * Helper for paginated responses with multiple entities
 * Filters both data and includes additional fields
 */
export function paginatedJsonResponse<T extends Record<string, any>>(
  data: {
    items: T[]
    total: number
    page: number
    pageSize: number
    [key: string]: any
  },
  userRole: UserRole,
  entityType: EntityType,
  status: number = 200
): NextResponse {
  const filtered = {
    ...data,
    items: filterArrayByRole(data.items, userRole, entityType),
  }
  return NextResponse.json(filtered, { status })
}
