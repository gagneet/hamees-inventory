'use client'

import React from 'react'
import { useSession } from 'next-auth/react'
import { canViewField, type EntityType } from '@/lib/field-acl'
import type { UserRole } from '@prisma/client'

/**
 * Hook to check if current user can view a specific field
 * Must be used in client components only (requires useSession)
 */
export function useFieldVisibility() {
  const { data: session, status } = useSession()

  const canView = (entityType: EntityType, fieldName: string): boolean => {
    if (status === 'loading' || !session?.user?.role) {
      return false
    }

    return canViewField(session.user.role as UserRole, entityType, fieldName)
  }

  return {
    canView,
    role: session?.user?.role as UserRole | undefined,
    isLoading: status === 'loading',
  }
}

/**
 * Hook to conditionally render field label and value
 * Handles alignment with user preference for showing $0/null values
 */
export function useFieldRenderer() {
  const { canView, isLoading } = useFieldVisibility()

  /**
   * Render field only if user can view it
   * Respects user preference: show even $0/null values instead of blank/hidden
   */
  const renderField = (
    entityType: EntityType,
    fieldName: string,
    value: any,
    label: string,
    format?: (val: any) => string
  ): React.ReactNode => {
    if (isLoading) {
      return <span className="text-slate-400">Loading...</span>
    }

    if (!canView(entityType, fieldName)) {
      return null
    }

    const displayValue = value === null ? '$0' : value === undefined ? '—' : format ? format(value) : value

    return (
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-600">{label}</label>
        <p className="text-base text-slate-900">{displayValue}</p>
      </div>
    )
  }

  return { renderField, canView, isLoading }
}
