/**
 * Server-side page guards for app/(dashboard) route segments.
 *
 * Each protected section has a layout.tsx that calls requirePagePermission(), so pages
 * (including 'use client' pages such as /expenses) cannot be opened by URL without the
 * matching permission. API routes enforce the same permissions independently.
 */

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { hasAnyPermission, type Permission, type UserRole } from '@/lib/permissions'

export async function requirePagePermission(permission: Permission | Permission[]) {
  const session = await auth()
  if (!session?.user) redirect('/')

  const required = Array.isArray(permission) ? permission : [permission]
  if (!hasAnyPermission(session.user.role as UserRole, required)) {
    redirect('/dashboard?denied=1')
  }
  return session
}
