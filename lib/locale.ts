/**
 * FEATURETRACE: Locale & currency formatting (settings-driven)
 *
 * Isomorphic (server + client) formatting helpers. The active shop configuration
 * (currency, locale, time zone) is held on globalThis so every Next.js module layer
 * (RSC, SSR, route handlers, browser) reads the same values:
 *   - Server: lib/settings.ts#getAppSettings() calls setActiveLocaleConfig() whenever
 *     settings are loaded, so route handlers and server components format correctly.
 *   - Client: components/providers/settings-provider.tsx calls setActiveLocaleConfig()
 *     during render with the settings passed down from the dashboard layout.
 *
 * Each deployment serves exactly one shop, so a process-wide configuration is safe.
 */

export interface LocaleConfig {
  /** ISO 4217 currency code, e.g. INR, USD, GBP, AED */
  currency: string
  /** BCP 47 locale tag, e.g. en-IN, en-US, en-GB, ar-AE */
  locale: string
  /** IANA time zone, e.g. Asia/Kolkata, Europe/London */
  timeZone: string
}

export const DEFAULT_LOCALE_CONFIG: LocaleConfig = {
  currency: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || 'INR',
  locale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE || 'en-IN',
  timeZone: process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE || 'Asia/Kolkata',
}

const ACTIVE_KEY = Symbol.for('hamees.activeLocaleConfig')
type GlobalWithLocale = typeof globalThis & { [ACTIVE_KEY]?: LocaleConfig }

// Intl.NumberFormat accepts any well-formed 3-letter code (e.g. "XYZ"), so validate against the
// runtime's list of real ISO 4217 currencies when available (Node 18+, modern browsers).
const SUPPORTED_CURRENCIES: ReadonlySet<string> | null = (() => {
  try {
    const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
    return typeof intl.supportedValuesOf === 'function' ? new Set(intl.supportedValuesOf('currency')) : null
  } catch {
    return null
  }
})()

export function isValidCurrency(code: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) return false
  if (SUPPORTED_CURRENCIES) return SUPPORTED_CURRENCIES.has(code)
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: code })
    return true
  } catch {
    return false
  }
}

export function isValidLocale(tag: string): boolean {
  try {
    return Intl.NumberFormat.supportedLocalesOf([tag]).length > 0
  } catch {
    return false
  }
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Sanitise a partial config, falling back to defaults for anything invalid. */
export function normalizeLocaleConfig(cfg?: Partial<LocaleConfig> | null): LocaleConfig {
  const currency = cfg?.currency?.toUpperCase()
  return {
    currency: currency && isValidCurrency(currency) ? currency : DEFAULT_LOCALE_CONFIG.currency,
    locale: cfg?.locale && isValidLocale(cfg.locale) ? cfg.locale : DEFAULT_LOCALE_CONFIG.locale,
    timeZone: cfg?.timeZone && isValidTimeZone(cfg.timeZone) ? cfg.timeZone : DEFAULT_LOCALE_CONFIG.timeZone,
  }
}

export function setActiveLocaleConfig(cfg: Partial<LocaleConfig> | null | undefined): void {
  ;(globalThis as GlobalWithLocale)[ACTIVE_KEY] = normalizeLocaleConfig(cfg)
}

export function getActiveLocaleConfig(): LocaleConfig {
  return (globalThis as GlobalWithLocale)[ACTIVE_KEY] ?? DEFAULT_LOCALE_CONFIG
}

// Intl formatter construction is comparatively expensive; cache by options.
const formatterCache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>()

function numberFormatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `n|${locale}|${JSON.stringify(options)}`
  let fmt = formatterCache.get(key) as Intl.NumberFormat | undefined
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, options)
    formatterCache.set(key, fmt)
  }
  return fmt
}

function dateFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `d|${locale}|${JSON.stringify(options)}`
  let fmt = formatterCache.get(key) as Intl.DateTimeFormat | undefined
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, options)
    formatterCache.set(key, fmt)
  }
  return fmt
}

export interface CurrencyFormatOptions {
  /** Fixed number of fraction digits; defaults to the currency's standard (INR/USD 2, JPY 0) */
  decimals?: number
  /** Compact notation for charts and KPI tiles, e.g. ₹12K, $1.2M */
  compact?: boolean
  config?: LocaleConfig
}

/** Number of minor-unit digits for the active (or given) currency. */
export function currencyDecimals(config: LocaleConfig = getActiveLocaleConfig()): number {
  return numberFormatter(config.locale, { style: 'currency', currency: config.currency })
    .resolvedOptions().maximumFractionDigits ?? 2
}

export function formatCurrency(amount: number | null | undefined, options: CurrencyFormatOptions = {}): string {
  const config = options.config ?? getActiveLocaleConfig()
  const value = Number.isFinite(amount as number) ? (amount as number) : 0
  const intlOptions: Intl.NumberFormatOptions = { style: 'currency', currency: config.currency }
  if (options.compact) {
    intlOptions.notation = 'compact'
    intlOptions.maximumFractionDigits = 1
  } else if (options.decimals !== undefined) {
    intlOptions.minimumFractionDigits = options.decimals
    intlOptions.maximumFractionDigits = options.decimals
  } else {
    const digits = currencyDecimals(config)
    intlOptions.minimumFractionDigits = digits
    intlOptions.maximumFractionDigits = digits
  }
  return numberFormatter(config.locale, intlOptions).format(value)
}

/** Compact currency for chart axes / tiles, e.g. "₹12K". */
export function formatCompactCurrency(amount: number | null | undefined, config?: LocaleConfig): string {
  return formatCurrency(amount, { compact: true, config })
}

/** The currency symbol as rendered in the active locale, e.g. "₹", "$", "£", "AED". */
export function currencySymbol(config: LocaleConfig = getActiveLocaleConfig()): string {
  const parts = numberFormatter(config.locale, { style: 'currency', currency: config.currency }).formatToParts(0)
  return parts.find((p) => p.type === 'currency')?.value ?? config.currency
}

export function formatNumber(value: number | null | undefined, options: Intl.NumberFormatOptions = {}): string {
  const config = getActiveLocaleConfig()
  return numberFormatter(config.locale, options).format(Number.isFinite(value as number) ? (value as number) : 0)
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return formatNumber(value / 100, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  })
}

function toDate(date: Date | string | number): Date {
  return date instanceof Date ? date : new Date(date)
}

export function formatDate(
  date: Date | string | number | null | undefined,
  style: 'short' | 'medium' | 'long' = 'medium'
): string {
  if (date === null || date === undefined || date === '') return ''
  const d = toDate(date)
  if (Number.isNaN(d.getTime())) return ''
  const config = getActiveLocaleConfig()
  return dateFormatter(config.locale, { dateStyle: style, timeZone: config.timeZone }).format(d)
}

export function formatDateTime(date: Date | string | number | null | undefined): string {
  if (date === null || date === undefined || date === '') return ''
  const d = toDate(date)
  if (Number.isNaN(d.getTime())) return ''
  const config = getActiveLocaleConfig()
  return dateFormatter(config.locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: config.timeZone,
  }).format(d)
}

/** Arbitrary Intl date options with the shop's locale and time zone applied. */
export function formatDateWith(date: Date | string | number, options: Intl.DateTimeFormatOptions): string {
  const d = toDate(date)
  if (Number.isNaN(d.getTime())) return ''
  const config = getActiveLocaleConfig()
  return dateFormatter(config.locale, { timeZone: config.timeZone, ...options }).format(d)
}

// ── Shop-local day boundaries ───────────────────────────────────────────────
// The server may run in UTC while the shop is elsewhere (e.g. Asia/Kolkata), so "today"
// must be computed in the shop's time zone, not with date-fns startOfDay (server-local).

function zonedParts(date: Date, timeZone: string) {
  const parts = dateFormatter('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') }
}

/** Offset of `timeZone` from UTC (ms) at the given instant. */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone)
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return wallAsUtc - (date.getTime() - date.getMilliseconds())
}

/** Instant of local midnight (in the shop's time zone) for the day containing `date`. */
export function shopStartOfDay(
  date: Date | string | number = new Date(),
  timeZone: string = getActiveLocaleConfig().timeZone
): Date {
  const d = toDate(date)
  const { year, month, day } = zonedParts(d, timeZone)
  const midnightWall = Date.UTC(year, month - 1, day)
  const guess = midnightWall - timeZoneOffsetMs(d, timeZone)
  // Re-evaluate the offset at midnight itself (DST may change between midnight and `date`)
  return new Date(midnightWall - timeZoneOffsetMs(new Date(guess), timeZone))
}

/** Last millisecond of the shop-local day containing `date`. */
export function shopEndOfDay(
  date: Date | string | number = new Date(),
  timeZone: string = getActiveLocaleConfig().timeZone
): Date {
  const start = shopStartOfDay(date, timeZone)
  const nextStart = shopStartOfDay(new Date(start.getTime() + 36 * 60 * 60 * 1000), timeZone)
  return new Date(nextStart.getTime() - 1)
}
