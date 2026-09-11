/**
 * Server-side phone lookups. Numbers are stored in E.164 (see lib/phone.ts), but rows written
 * before normalisation may still hold formatted values ("+91 98765 43210"), so matches are
 * decided by normalising each candidate rather than by exact SQL equality.
 */

import { prisma } from '@/lib/db'
import { parsePhone } from '@/lib/phone'

/** Narrow SQL filter for rows whose phone may equal `e164` (the last four digits). */
export function phoneCandidateWhere(e164: string) {
  return { phone: { contains: e164.replace(/\D/g, '').slice(-4) } }
}

/** True when a stored number is the same phone number as `e164`. */
export function samePhone(stored: string | null | undefined, e164: string, defaultRegion?: string | null): boolean {
  if (!stored) return false
  if (stored === e164) return true
  return parsePhone(stored, defaultRegion)?.e164 === e164
}

export const DUPLICATE_PHONE = 'DUPLICATE_PHONE'

/** 409 body when a customer with the same number exists; the client may resend with allowDuplicatePhone. */
export function duplicatePhoneBody(existing: { id: string; name: string }) {
  return {
    code: DUPLICATE_PHONE,
    error: `${existing.name} already has this phone number.`,
    existingCustomer: { id: existing.id, name: existing.name },
  }
}

/** Customers whose phone number is `e164` (oldest first). */
export async function findCustomersByPhone(
  e164: string,
  defaultRegion: string | null | undefined,
  options: { excludeId?: string } = {}
): Promise<Array<{ id: string; name: string; phone: string }>> {
  const candidates = await prisma.customer.findMany({
    where: { ...phoneCandidateWhere(e164), ...(options.excludeId ? { id: { not: options.excludeId } } : {}) },
    select: { id: true, name: true, phone: true },
    orderBy: { createdAt: 'asc' },
    take: 200,
  })
  return (candidates ?? []).filter((c) => samePhone(c.phone, e164, defaultRegion))
}
