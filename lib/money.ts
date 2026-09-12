/**
 * FEATURETRACE: Exact money arithmetic (minor units)
 *
 * Amounts are stored as whole numbers of minor units (paise, cents): BigInt columns, see the
 * note in prisma/schema.prisma. lib/db.ts converts at the Prisma boundary, so application
 * code, API payloads and forms use ordinary decimal numbers (1234.56) while the database holds
 * 123456. The scale is fixed at 2 decimal places for every currency: it must never depend on
 * the configured currency, or relabelling the currency would rescale every stored amount.
 *
 * Use these helpers wherever amounts are combined (sums, tax, proportional splits) so results
 * are exact to the minor unit instead of accumulating floating-point error.
 *
 * Isomorphic: safe for client components (no Prisma imports).
 */

/** Minor units per major unit (paise per rupee, cents per dollar). Never change on a live database. */
export const MONEY_SCALE = 100

/**
 * Decimal amount → integer minor units, rounding half away from zero.
 * toPrecision(15) drops binary noise first, so 1.005 → 101 (not 100 from 100.49999999999999).
 */
export function toMinorNumber(amount: number): number {
  if (!Number.isFinite(amount)) throw new RangeError(`Invalid amount: ${amount}`)
  const scaled = Number((Math.abs(amount) * MONEY_SCALE).toPrecision(15))
  const minor = Math.round(scaled) * Math.sign(amount)
  if (!Number.isSafeInteger(minor)) throw new RangeError(`Amount out of range: ${amount}`)
  return minor === 0 ? 0 : minor // no -0
}

/** Decimal amount → BigInt minor units (the stored representation). */
export function toMinor(amount: number): bigint {
  return BigInt(toMinorNumber(amount))
}

/** Largest minor-unit magnitude that survives the trip through a JS number without losing units. */
const MAX_SAFE_MINOR = BigInt(Number.MAX_SAFE_INTEGER)

/**
 * Stored minor units → decimal amount.
 *
 * A BigInt column can hold far more than a double can represent exactly, so a value past
 * Number.MAX_SAFE_INTEGER (about 90 trillion paise / 900 billion rupees) would come back
 * silently rounded. Fail loudly instead — a wrong amount is worse than a failed request.
 * Non-integer `number` input is allowed: raw-SQL sums (quantity × minor-unit price) land here.
 */
export function fromMinor(minor: bigint | number): number
export function fromMinor(minor: bigint | number | null | undefined): number | null
export function fromMinor(minor: bigint | number | null | undefined): number | null {
  if (minor === null || minor === undefined) return null
  if (typeof minor === 'bigint') {
    if (minor > MAX_SAFE_MINOR || minor < -MAX_SAFE_MINOR) {
      throw new RangeError(`Amount out of safe range: ${minor}`)
    }
    return Number(minor) / MONEY_SCALE
  }
  if (!Number.isFinite(minor) || Math.abs(minor) > Number.MAX_SAFE_INTEGER) {
    throw new RangeError(`Amount out of safe range: ${minor}`)
  }
  return minor / MONEY_SCALE
}

/** Sum of a nullable minor-unit aggregate (Prisma `_sum` on a money column) as a decimal amount. */
export function sumFromMinor(minor: bigint | number | null | undefined): number {
  return fromMinor(minor ?? 0)
}

/** Round a decimal amount to the minor unit. */
export function roundMoney(amount: number): number {
  return toMinorNumber(amount) / MONEY_SCALE
}

/** Exact sum of decimal amounts. */
export function addMoney(...amounts: Array<number | null | undefined>): number {
  let minor = 0
  for (const amount of amounts) minor += toMinorNumber(amount ?? 0)
  return minor / MONEY_SCALE
}

/** Exact sum of a list of decimal amounts. */
export function sumMoney(amounts: Iterable<number | null | undefined>): number {
  return addMoney(...amounts)
}

/** Exact a − b − c … */
export function subtractMoney(from: number, ...amounts: Array<number | null | undefined>): number {
  let minor = toMinorNumber(from)
  for (const amount of amounts) minor -= toMinorNumber(amount ?? 0)
  return minor / MONEY_SCALE
}

/** amount × quantity (e.g. price per meter × meters), rounded to the minor unit. */
export function multiplyMoney(amount: number, quantity: number): number {
  return roundMoney(toMinorNumber(amount) * quantity / MONEY_SCALE)
}

/** `rate` percent of an amount, rounded to the minor unit (half away from zero). */
export function percentOf(amount: number, rate: number): number {
  return roundMoney((toMinorNumber(amount) * rate) / 100 / MONEY_SCALE)
}

/** True when two amounts are equal to the minor unit. */
export function moneyEquals(a: number, b: number): boolean {
  return toMinorNumber(a) === toMinorNumber(b)
}

/**
 * Split `total` across `weights` in proportion, so the parts add up to `total` exactly
 * (largest-remainder method on minor units). Zero or missing weights share equally.
 */
export function allocateMoney(total: number, weights: number[]): number[] {
  if (weights.length === 0) return []
  const totalMinor = toMinorNumber(total)
  const positive = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0))
  const weightSum = positive.reduce((s, w) => s + w, 0)
  const shares = weightSum > 0 ? positive.map((w) => w / weightSum) : weights.map(() => 1 / weights.length)

  const raw = shares.map((share) => totalMinor * share)
  const parts = raw.map((r) => Math.trunc(r))
  let remainder = totalMinor - parts.reduce((s, p) => s + p, 0)
  const step = remainder >= 0 ? 1 : -1
  // Hand out the leftover minor units to the largest fractional parts first
  const order = raw
    .map((r, i) => ({ i, frac: Math.abs(r - Math.trunc(r)) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (let k = 0; remainder !== 0; k = (k + 1) % order.length) {
    parts[order[k].i] += step
    remainder -= step
  }
  return parts.map((p) => p / MONEY_SCALE)
}
