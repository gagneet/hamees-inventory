/**
 * FEATURETRACE: Configurable sales tax
 *
 * Replaces the hard-coded "12% GST split into CGST/SGST" logic. Behaviour is driven by
 * BusinessSettings (see lib/settings.ts):
 *   - SPLIT  : dual tax (India GST). Intra-region → two equal halves (CGST + SGST).
 *              Inter-region (customer region set and different from the shop's) → one
 *              integrated line (IGST).
 *   - SINGLE : one tax line (VAT / Sales Tax / GST in other countries). Stored in
 *              gstAmount only; cgst/sgst/igst stay 0.
 *   - NONE   : no tax is charged.
 *
 * Order rows keep their historical columns (gstRate, cgst, sgst, igst, gstAmount) so
 * existing reports continue to work regardless of mode.
 */

export type TaxMode = 'SPLIT' | 'SINGLE' | 'NONE'

export const TAX_MODES: TaxMode[] = ['SPLIT', 'SINGLE', 'NONE']

export interface TaxConfig {
  mode: TaxMode
  /** Default rate (percent) applied to orders */
  rate: number
  /** Display name for the tax, e.g. GST, VAT, Sales Tax */
  name: string
  /** Shop's state/region; used to decide intra- vs inter-region for SPLIT mode */
  businessRegion?: string | null
}

export interface TaxBreakdown {
  gstRate: number
  cgst: number
  sgst: number
  igst: number
  gstAmount: number
  totalAmount: number
}

export interface TaxLine {
  label: string
  amount: number
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

function isInterRegion(cfg: TaxConfig, customerRegion?: string | null): boolean {
  if (!cfg.businessRegion || !customerRegion) return false
  return cfg.businessRegion.trim().toLowerCase() !== customerRegion.trim().toLowerCase()
}

/**
 * Compute tax for a pre-tax subtotal.
 * @param customerRegion customer's state/region; only affects SPLIT mode
 * @param rateOverride use a specific rate (e.g. when recalculating a historical order)
 */
export function computeTax(
  subTotal: number,
  cfg: TaxConfig,
  opts: { customerRegion?: string | null; rateOverride?: number } = {}
): TaxBreakdown {
  const base = Number.isFinite(subTotal) ? subTotal : 0
  if (cfg.mode === 'NONE') {
    return { gstRate: 0, cgst: 0, sgst: 0, igst: 0, gstAmount: 0, totalAmount: round2(base) }
  }

  const rate = Math.max(0, opts.rateOverride ?? cfg.rate)
  const tax = round2((base * rate) / 100)

  if (cfg.mode === 'SINGLE') {
    return { gstRate: rate, cgst: 0, sgst: 0, igst: 0, gstAmount: tax, totalAmount: round2(base + tax) }
  }

  if (isInterRegion(cfg, opts.customerRegion)) {
    return { gstRate: rate, cgst: 0, sgst: 0, igst: tax, gstAmount: tax, totalAmount: round2(base + tax) }
  }

  // Split the total into two halves; put any rounding cent on the second half so the parts sum exactly.
  const cgst = round2(tax / 2)
  const sgst = round2(tax - cgst)
  return { gstRate: rate, cgst, sgst, igst: 0, gstAmount: tax, totalAmount: round2(base + tax) }
}

/** Tax columns stored on an existing order. */
export interface StoredTax {
  gstRate: number
  cgst?: number | null
  sgst?: number | null
  igst?: number | null
  gstAmount?: number | null
}

/**
 * Re-tax an EXISTING order (fabric change, split) with the structure it was created with — its
 * rate and whether it was split (CGST+SGST), integrated (IGST), a single line or untaxed — so a
 * later change to the shop's tax mode, rate or region never rewrites historical orders.
 * `fallback` (current settings) is used only when the stored columns show no structure
 * (a positive rate but no tax recorded, e.g. the subtotal was 0).
 */
export function recomputeOrderTax(
  subTotal: number,
  stored: StoredTax,
  fallback: TaxConfig,
  opts: { customerRegion?: string | null } = {}
): TaxBreakdown {
  const base = Number.isFinite(subTotal) ? subTotal : 0
  const rate = Math.max(0, stored.gstRate || 0)
  if (rate === 0) {
    return { gstRate: 0, cgst: 0, sgst: 0, igst: 0, gstAmount: 0, totalAmount: round2(base) }
  }

  const tax = round2((base * rate) / 100)
  const totalAmount = round2(base + tax)
  if ((stored.igst ?? 0) > 0) {
    return { gstRate: rate, cgst: 0, sgst: 0, igst: tax, gstAmount: tax, totalAmount }
  }
  if ((stored.cgst ?? 0) > 0 || (stored.sgst ?? 0) > 0) {
    const cgst = round2(tax / 2)
    return { gstRate: rate, cgst, sgst: round2(tax - cgst), igst: 0, gstAmount: tax, totalAmount }
  }
  if ((stored.gstAmount ?? 0) > 0) {
    return { gstRate: rate, cgst: 0, sgst: 0, igst: 0, gstAmount: tax, totalAmount }
  }
  return computeTax(base, fallback, { customerRegion: opts.customerRegion, rateOverride: rate })
}

/** Human-readable tax lines for invoices and summaries. */
export function taxLines(
  amounts: { gstRate: number; cgst?: number | null; sgst?: number | null; igst?: number | null; gstAmount: number },
  cfg: Pick<TaxConfig, 'mode' | 'name'>
): TaxLine[] {
  const rate = amounts.gstRate || 0
  if (cfg.mode === 'NONE' && !amounts.gstAmount) return []

  const cgst = amounts.cgst ?? 0
  const sgst = amounts.sgst ?? 0
  const igst = amounts.igst ?? 0
  const fmtRate = (r: number) => `${Number(r.toFixed(2))}%`

  // Historical orders may carry split values even if the shop later switched mode; show what was charged.
  if (cgst > 0 || sgst > 0) {
    return [
      { label: `C${cfg.name} (${fmtRate(rate / 2)})`, amount: cgst },
      { label: `S${cfg.name} (${fmtRate(rate / 2)})`, amount: sgst },
    ]
  }
  if (igst > 0) {
    return [{ label: `I${cfg.name} (${fmtRate(rate)})`, amount: igst }]
  }
  if (amounts.gstAmount > 0) {
    return [{ label: `${cfg.name} (${fmtRate(rate)})`, amount: amounts.gstAmount }]
  }
  return []
}

/** Short label for a single total-tax line, e.g. "GST (12%)" or "VAT (20%)". */
export function taxTotalLabel(cfg: Pick<TaxConfig, 'name'>, rate: number): string {
  return `${cfg.name} (${Number(rate.toFixed(2))}%)`
}
