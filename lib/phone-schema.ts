/**
 * Zod helpers that validate a phone number and store it in E.164 (see lib/phone.ts).
 * Build them per request with the shop's phone region: `phoneSchema(settings.phoneRegion)`.
 */

import { z } from 'zod'
import { normalizePhone } from '@/lib/phone'

const MAX_INPUT = 40

/** Required phone number → E.164. */
export function phoneSchema(defaultRegion: string | null | undefined) {
  return z
    .string()
    .trim()
    .max(MAX_INPUT, 'Phone number is too long')
    .transform((value, ctx) => {
      const result = normalizePhone(value, defaultRegion)
      if (!result.ok) {
        ctx.addIssue({ code: 'custom', message: result.error })
        return z.NEVER
      }
      return result.e164
    })
}

/** Optional phone number → E.164, or null when empty/omitted (undefined stays undefined for PATCH). */
export function optionalPhoneSchema(defaultRegion: string | null | undefined) {
  return z
    .string()
    .trim()
    .max(MAX_INPUT, 'Phone number is too long')
    .nullish()
    .transform((value, ctx) => {
      if (value === undefined) return undefined
      if (value === null || value === '') return null
      const result = normalizePhone(value, defaultRegion)
      if (!result.ok) {
        ctx.addIssue({ code: 'custom', message: result.error })
        return z.NEVER
      }
      return result.e164
    })
}

/** The user-facing message for a failed phone field, if any (for `{ error }` responses). */
export function phoneIssueMessage(error: z.ZodError, field = 'phone'): string | null {
  const issue = error.issues.find((i) => i.path[0] === field && i.code === 'custom')
  return issue?.message ?? null
}
