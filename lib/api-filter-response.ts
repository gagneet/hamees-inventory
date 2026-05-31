import { NextResponse } from 'next/server'
import { filterObjectByRole, filterArrayByRole, type EntityType } from '@/lib/field-acl'
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
    return filterArrayByRole(data, userRole, entityType) as Partial<T>[]
  }

  return filterObjectByRole(data, userRole, entityType) as Partial<T>
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
