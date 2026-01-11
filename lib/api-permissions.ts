import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { hasPermission, hasAnyPermission, type Permission } from '@/lib/permissions'

/**
 * Check if the current user has a specific permission
 * Returns user session if authorized, otherwise returns error response
 */
export async function requirePermission(permission: Permission) {
  const session = await auth()

  if (!session?.user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const userRole = session.user.role as UserRole

  if (!hasPermission(userRole, permission)) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { session, error: null }
}

/**
 * Check if the current user has any of the specified permissions
 */
export async function requireAnyPermission(permissions: Permission[]) {
  const session = await auth()

  if (!session?.user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const userRole = session.user.role as UserRole

  if (!hasAnyPermission(userRole, permissions)) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { session, error: null }
}

/**
 * Get current session or return error
 */
export async function requireAuth() {
  const session = await auth()

  if (!session?.user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return { session, error: null }
}
