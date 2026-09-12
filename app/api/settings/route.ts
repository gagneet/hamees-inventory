/**
 * @featuretrace Business Settings API
 * GET  /api/settings — shop identity, localization, tax & production settings (any signed-in user)
 * PUT  /api/settings — update settings (manage_settings; audited). Changing the currency once
 *      amounts exist returns 409 unless the body includes `acknowledgeNoConversion: true`.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth, requirePermission } from '@/lib/api-permissions'
import { DEFAULT_APP_SETTINGS, getAppSettings, invalidateAppSettings, SETTINGS_ROW_ID, type AppSettings } from '@/lib/settings'
import { isValidCurrency, isValidLocale, isValidTimeZone } from '@/lib/locale'
import { TAX_MODES } from '@/lib/tax'
import { audit } from '@/lib/audit'

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null))

const settingsSchema = z
  .object({
    businessName: z.string().trim().min(1).max(120),
    tagline: optionalText(160),
    taxId: optionalText(30),
    region: optionalText(80),
    address: optionalText(300),
    city: optionalText(80),
    postalCode: optionalText(20),
    country: z.string().trim().min(1).max(80),
    phone: optionalText(30),
    email: z
      .string()
      .trim()
      .max(254)
      .nullish()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || z.string().email().safeParse(v).success, 'Invalid email'),
    website: z
      .string()
      .trim()
      .max(200)
      .nullish()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || /^https?:\/\/\S+$/i.test(v), 'Website must start with http:// or https://'),

    currency: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine(isValidCurrency, 'Unknown ISO 4217 currency code'),
    locale: z.string().trim().refine(isValidLocale, 'Unsupported locale'),
    timeZone: z.string().trim().refine(isValidTimeZone, 'Unknown IANA time zone'),
    phoneCountryCode: z.string().trim().regex(/^\d{1,4}$/, 'Country code must be 1-4 digits'),
    postalCodeLabel: z.string().trim().min(1).max(30),

    taxMode: z.enum(TAX_MODES as [string, ...string[]]),
    taxName: z.string().trim().min(1).max(20),
    taxIdLabel: z.string().trim().min(1).max(30),
    taxRate: z.number().min(0).max(100),

    invoiceFooter: optionalText(500),

    maxActiveItemsPerTailor: z.number().int().min(1).max(100),
    tailorDailyTarget: z.number().int().min(0).max(100),
  })
  .partial()

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error
  return NextResponse.json({ settings: await getAppSettings() })
}

/**
 * Stored amounts (orders, POs, expenses, inventory prices) are plain numbers with no currency
 * attached and are never converted. Changing the currency therefore relabels every existing
 * amount (₹5,000 would display as £5,000.00), so it needs explicit confirmation once any exist.
 */
async function countRecordsWithAmounts(): Promise<number> {
  const counts = await Promise.all([
    prisma.order.count(),
    prisma.purchaseOrder.count(),
    prisma.expense.count(),
    prisma.clothInventory.count(),
    prisma.accessoryInventory.count(),
  ])
  return counts.reduce((sum, n) => sum + (n ?? 0), 0)
}

export async function PUT(request: Request) {
  const { session, error } = await requirePermission('manage_settings')
  if (error) return error

  try {
    const body = await request.json()
    const acknowledgeNoConversion = body?.acknowledgeNoConversion === true
    const input = settingsSchema.parse(body)

    const existing = await prisma.businessSettings.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true, currencyCode: true },
    })
    // Fresh copy of the current settings, used to audit only the fields that actually change
    invalidateAppSettings()
    const before = await getAppSettings()
    const currentCurrency = existing?.currencyCode ?? DEFAULT_APP_SETTINGS.currency
    const currencyChanges = input.currency !== undefined && input.currency !== currentCurrency

    if (currencyChanges && !acknowledgeNoConversion) {
      const recordCount = await countRecordsWithAmounts()
      if (recordCount > 0) {
        return NextResponse.json(
          {
            code: 'CURRENCY_CHANGE_NEEDS_CONFIRMATION',
            error:
              `Existing amounts are not converted. ${recordCount} records with amounts would be relabelled ` +
              `from ${currentCurrency} to ${input.currency}. Confirm only if those amounts were entered in ${input.currency}.`,
            recordCount,
            from: currentCurrency,
            to: input.currency,
          },
          { status: 409 }
        )
      }
    }

    // Map API field names onto BusinessSettings columns
    const data = {
      ...(input.businessName !== undefined && { businessName: input.businessName }),
      ...(input.tagline !== undefined && { tagline: input.tagline }),
      ...(input.taxId !== undefined && { gstin: input.taxId }),
      ...(input.region !== undefined && { state: input.region }),
      ...(input.address !== undefined && { address: input.address }),
      ...(input.city !== undefined && { city: input.city }),
      ...(input.postalCode !== undefined && { pincode: input.postalCode }),
      ...(input.country !== undefined && { country: input.country }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.website !== undefined && { website: input.website }),
      ...(input.currency !== undefined && { currencyCode: input.currency }),
      ...(input.locale !== undefined && { locale: input.locale }),
      ...(input.timeZone !== undefined && { timeZone: input.timeZone }),
      ...(input.phoneCountryCode !== undefined && { phoneCountryCode: input.phoneCountryCode }),
      ...(input.postalCodeLabel !== undefined && { postalCodeLabel: input.postalCodeLabel }),
      ...(input.taxMode !== undefined && { taxMode: input.taxMode }),
      ...(input.taxName !== undefined && { taxName: input.taxName }),
      ...(input.taxIdLabel !== undefined && { taxIdLabel: input.taxIdLabel }),
      ...(input.taxRate !== undefined && { garmentGstRate: input.taxRate }),
      ...(input.invoiceFooter !== undefined && { invoiceFooter: input.invoiceFooter }),
      ...(input.maxActiveItemsPerTailor !== undefined && { maxActiveItemsPerTailor: input.maxActiveItemsPerTailor }),
      ...(input.tailorDailyTarget !== undefined && { tailorDailyTarget: input.tailorDailyTarget }),
    }

    if (existing) {
      await prisma.businessSettings.update({ where: { id: existing.id }, data })
    } else {
      await prisma.businessSettings.create({ data: { id: SETTINGS_ROW_ID, ...data } })
    }

    invalidateAppSettings()
    const settings = await getAppSettings()

    const changed = (Object.keys(input) as (keyof typeof input & keyof AppSettings)[]).filter(
      (key) => JSON.stringify(before[key] ?? null) !== JSON.stringify(input[key] ?? null)
    )
    if (changed.length > 0) {
      await audit({
        userId: session.user.id,
        action: 'SETTINGS_UPDATED',
        entityType: 'BusinessSettings',
        entityId: existing?.id ?? SETTINGS_ROW_ID,
        details: {
          changes: Object.fromEntries(changed.map((key) => [key, { from: before[key] ?? null, to: input[key] ?? null }])),
          ...(currencyChanges ? { currencyFrom: currentCurrency, currencyTo: input.currency, amountsRelabelled: true } : {}),
        },
      })
    }

    return NextResponse.json({ settings })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.issues }, { status: 400 })
    }
    if (err instanceof Error && 'code' in err && (err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'That tax registration number is already in use' }, { status: 400 })
    }
    console.error('Error updating settings:', err)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
