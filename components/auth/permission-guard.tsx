'use client'

import { useSession } from 'next-auth/react'
import { UserRole } from '@prisma/client'
import { hasPermission, hasAnyPermission, type Permission } from '@/lib/permissions'
import { ReactNode } from 'react'

interface PermissionGuardProps {
  children: ReactNode
  permission?: Permission
  anyPermission?: Permission[]
  fallback?: ReactNode
  role?: UserRole
}

/**
 * Component that conditionally renders children based on user permissions
 * Usage:
 * <PermissionGuard permission="manage_inventory">
 *   <Button>Delete Item</Button>
 * </PermissionGuard>
 */
export function PermissionGuard({
  children,
  permission,
  anyPermission,
  fallback = null,
  role,
}: PermissionGuardProps) {
  const { data: session } = useSession()

  if (!session?.user) {
    return <>{fallback}</>
  }

  const userRole = (role || session.user.role) as UserRole

  // Check single permission
  if (permission && !hasPermission(userRole, permission)) {
    return <>{fallback}</>
  }

  // Check any of multiple permissions
  if (anyPermission && !hasAnyPermission(userRole, anyPermission)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Hook to check permissions in components
 */
export function usePermissions() {
  const { data: session } = useSession()
  const userRole = session?.user?.role as UserRole | undefined

  return {
    can: (permission: Permission) =>
      userRole ? hasPermission(userRole, permission) : false,
    canAny: (permissions: Permission[]) =>
      userRole ? hasAnyPermission(userRole, permissions) : false,
    role: userRole,
    isOwner: userRole === 'OWNER',
    isAdmin: userRole === 'ADMIN' || userRole === 'OWNER',
  }
}
