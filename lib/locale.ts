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
  /**
   * Optional second currency shown next to amounts (display only — stored amounts are never
   * converted). Present only together with a positive exchangeRate; see normalizeLocaleConfig().
   */
  secondaryCurrency?: string
  /** Units of `currency` per 1 unit of `secondaryCurrency`, e.g. 112.5 (INR per GBP) */
  exchangeRate?: number
  /** When the shop last set the rate (ISO timestamp), for "rate set …" notes */
  exchangeRateUpdatedAt?: string | null
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

/** Input shape for configs: the secondary fields may arrive as null from settings. */
export type LocaleConfigInput = Partial<
  Omit<LocaleConfig, 'secondaryCurrency' | 'exchangeRate'> & {
    secondaryCurrency: string | null
    exchangeRate: number | null
  }
>

/** Sanitise a partial config, falling back to defaults for anything invalid. */
export function normalizeLocaleConfig(cfg?: LocaleConfigInput | null): LocaleConfig {
  const currency = cfg?.currency?.toUpperCase()
  const base: LocaleConfig = {
    currency: currency && isValidCurrency(currency) ? currency : DEFAULT_LOCALE_CONFIG.currency,
    locale: cfg?.locale && isValidLocale(cfg.locale) ? cfg.locale : DEFAULT_LOCALE_CONFIG.locale,
    timeZone: cfg?.timeZone && isValidTimeZone(cfg.timeZone) ? cfg.timeZone : DEFAULT_LOCALE_CONFIG.timeZone,
  }
  // The secondary currency is kept only when it is a real code, differs from the main currency
  // and has a usable rate; otherwise the keys are left out entirely.
  const secondary = cfg?.secondaryCurrency?.toUpperCase()
  const rate = cfg?.exchangeRate
  if (
    secondary &&
    secondary !== base.currency &&
    isValidCurrency(secondary) &&
    typeof rate === 'number' &&
    Number.isFinite(rate) &&
    rate > 0
  ) {
    const stamp = cfg?.exchangeRateUpdatedAt
    base.secondaryCurrency = secondary
    base.exchangeRate = rate
    base.exchangeRateUpdatedAt = stamp && !Number.isNaN(new Date(stamp).getTime()) ? stamp : null
  }
  return base
}

export function setActiveLocaleConfig(cfg: LocaleConfigInput | null | undefined): void {
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
    // Set both bounds: ICU versions differ on the default minimum ("$12K" vs "$12.0K")
    intlOptions.minimumFractionDigits = 0
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

// ── Secondary (display-only) currency ───────────────────────────────────────
// Stored amounts are in the main currency and are never converted. When the shop sets a second
// currency with an exchange rate, amounts can also be shown converted at that rate. The result is
// indicative only: one rate, entered by hand, applied to every amount (past and present).

/** Round half away from zero to `digits` places (toPrecision drops binary noise, as in lib/money). */
function roundToDigits(value: number, digits: number): number {
  const factor = 10 ** digits
  const scaled = Number((Math.abs(value) * factor).toPrecision(15))
  const rounded = (Math.round(scaled) * Math.sign(value)) / factor
  return rounded === 0 ? 0 : rounded
}

/** The secondary currency's own config (same locale / time zone), or null when none is set. */
function secondaryConfig(config: LocaleConfig): LocaleConfig | null {
  if (!config.secondaryCurrency || !config.exchangeRate) return null
  return { currency: config.secondaryCurrency, locale: config.locale, timeZone: config.timeZone }
}

/** Whether a secondary currency is configured (active config unless one is given). */
export function hasSecondaryCurrency(config: LocaleConfig = getActiveLocaleConfig()): boolean {
  return secondaryConfig(config) !== null
}

/**
 * Amount in the secondary currency at the shop's rate, rounded to that currency's minor units
 * (GBP 2, JPY 0); null when no secondary currency is configured or the amount isn't a number.
 */
export function convertToSecondary(
  amount: number | null | undefined,
  config: LocaleConfig = getActiveLocaleConfig()
): number | null {
  const secondary = secondaryConfig(config)
  if (!secondary || typeof amount !== 'number' || !Number.isFinite(amount)) return null
  return roundToDigits(amount / config.exchangeRate!, currencyDecimals(secondary))
}

export interface SecondaryFormatOptions {
  compact?: boolean
  config?: LocaleConfig
}

/** "≈ £44.44" for an amount in the main currency; null when no secondary currency is set. */
export function formatSecondaryCurrency(
  amount: number | null | undefined,
  options: SecondaryFormatOptions = {}
): string | null {
  const config = options.config ?? getActiveLocaleConfig()
  const converted = convertToSecondary(amount, config)
  if (converted === null) return null
  return `≈ ${formatCurrency(converted, { compact: options.compact, config: secondaryConfig(config)! })}`
}

/** Plain-text dual amount: "₹5,000.00 (≈ £44.44)", or just the main amount without a secondary. */
export function formatCurrencyWithSecondary(
  amount: number | null | undefined,
  options: SecondaryFormatOptions = {}
): string {
  const config = options.config ?? getActiveLocaleConfig()
  const primary = formatCurrency(amount, { compact: options.compact, config })
  const secondary = formatSecondaryCurrency(amount, { compact: options.compact, config })
  return secondary ? `${primary} (${secondary})` : primary
}

/**
 * "1 GBP = 112.50 INR" in the shop locale, or the inverse "1 INR = 0.008889 GBP";
 * null without a secondary currency.
 */
export function formatExchangeRate(
  config: LocaleConfig = getActiveLocaleConfig(),
  { inverse = false }: { inverse?: boolean } = {}
): string | null {
  if (!secondaryConfig(config)) return null
  const rate = inverse ? 1 / config.exchangeRate! : config.exchangeRate!
  const formatted = numberFormatter(config.locale, { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(rate)
  return inverse
    ? `1 ${config.currency} = ${formatted} ${config.secondaryCurrency}`
    : `1 ${config.secondaryCurrency} = ${formatted} ${config.currency}`
}

/** Date the rate was set, formatted in the shop locale / time zone; null when unknown. */
function formatRateDate(config: LocaleConfig): string | null {
  if (!config.exchangeRateUpdatedAt) return null
  const d = new Date(config.exchangeRateUpdatedAt)
  if (Number.isNaN(d.getTime())) return null
  return dateFormatter(config.locale, { dateStyle: 'medium', timeZone: config.timeZone }).format(d)
}

/** Tooltip text: "Indicative: 1 GBP = 112.50 INR (rate set 11 Sept 2026)". */
export function exchangeRateNote(config: LocaleConfig = getActiveLocaleConfig()): string | null {
  const rate = formatExchangeRate(config)
  if (!rate) return null
  const date = formatRateDate(config)
  return `Indicative: ${rate}${date ? ` (rate set ${date})` : ''}`
}

/**
 * Invoice line under the grand total:
 * "Indicative total ≈ £44.44 at 1 GBP = 112.50 INR (rate as of 11 Sept 2026); amounts payable in INR".
 */
export function indicativeTotalNote(
  amount: number | null | undefined,
  config: LocaleConfig = getActiveLocaleConfig(),
  label = 'Indicative total'
): string | null {
  const converted = formatSecondaryCurrency(amount, { config })
  const rate = formatExchangeRate(config)
  if (!converted || !rate) return null
  const date = formatRateDate(config)
  return `${label} ${converted} at ${rate}${date ? ` (rate as of ${date})` : ''}; amounts payable in ${config.currency}`
}

export interface MoneyParts {
  primary: string
  secondary: string | null
  note: string | null
}

/** The pieces <Money> renders: main amount, secondary amount (or null) and the rate tooltip. */
export function formatMoneyParts(
  amount: number | null | undefined,
  options: { compact?: boolean; decimals?: number; withSecondary?: boolean; config?: LocaleConfig } = {}
): MoneyParts {
  const config = options.config ?? getActiveLocaleConfig()
  const primary = formatCurrency(amount, { compact: options.compact, decimals: options.decimals, config })
  const secondary =
    options.withSecondary === false
      ? null
      : formatSecondaryCurrency(amount, { compact: options.compact, config })
  return { primary, secondary, note: secondary ? exchangeRateNote(config) : null }
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
