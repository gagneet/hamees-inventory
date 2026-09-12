/**
 * FEATURETRACE: Pure order pricing and balance arithmetic
 *
 * No Prisma, no settings, no I/O — safe to import from client components, scripts and tests.
 * The database-aware wrappers (computeOrderBalance, priceNewOrder, lockOrder …) live in
 * lib/order-finance.ts and re-export everything here.
 *
 * The model:
 *   taxableAmount = subTotal − discount     a discount reduces the TAXABLE value, it is not a payment
 *   totalAmount   = taxableAmount + tax     tax is charged on the discounted value
 *   balanceAmount = totalAmount − advancePaid − Σ installment payments
 *
 * The discount is therefore inside totalAmount and must never be subtracted from the balance as
 * well. Deducting it before tax is what India's CGST s.15, HMRC's VAT guidance and the ATO's
 * adjustment rules all require; deducting it after tax overstates the tax due.
 */

import { moneyEquals, roundMoney, subtractMoney, sumMoney } from '@/lib/money'
import { recomputeOrderTax, type StoredTax, type TaxBreakdown, type TaxConfig } from '@/lib/tax'

/** Note prefix carried by the legacy duplicate-advance installments. */
export const LEGACY_ADVANCE_NOTE_PREFIX = 'Advance payment'

type InstallmentLike = { installmentNumber: number; paidAmount: number | null; notes?: string | null }

/**
 * True for a pre-v0.28.4 installment #1 that duplicates Order.advancePaid.
 * Recognised by the note prefix AND the matching amount — never by amount alone, because a real
 * first payment can equal the advance.
 */
export function isLegacyAdvanceInstallment(installment: InstallmentLike, advancePaid: number): boolean {
  return (
    installment.installmentNumber === 1 &&
    advancePaid > 0 &&
    (installment.notes ?? '').trimStart().startsWith(LEGACY_ADVANCE_NOTE_PREFIX) &&
    moneyEquals(installment.paidAmount ?? 0, advancePaid)
  )
}

/** Keeps a user-entered installment note from ever looking like a legacy duplicate-advance row. */
export function safeInstallmentNote(note: string | null | undefined): string | null | undefined {
  if (!note) return note
  return note.trimStart().startsWith(LEGACY_ADVANCE_NOTE_PREFIX) ? `Note: ${note}` : note
}

/** Σ paidAmount of an order's installments, leaving out a legacy duplicate of the advance. */
export function sumInstallmentPayments(installments: InstallmentLike[], advancePaid: number): number {
  return sumMoney(
    installments
      .filter((installment) => !isLegacyAdvanceInstallment(installment, advancePaid))
      .map((installment) => installment.paidAmount ?? 0)
  )
}

/**
 * balance = totalAmount − advancePaid − payments received.
 * The discount already reduced totalAmount when the order was priced, so it is not deducted
 * a second time here (doing so would hand the customer the discount twice).
 */
export function orderBalance(totalAmount: number, advancePaid: number, paidViaInstallments: number): number {
  return subtractMoney(totalAmount, advancePaid, paidViaInstallments)
}

/** Every money column an order's pricing writes. */
export interface OrderPricing {
  subTotal: number
  discount: number
  taxableAmount: number
  gstRate: number
  cgst: number
  sgst: number
  igst: number
  gstAmount: number
  totalAmount: number
}

/** A discount can neither be negative nor exceed the value it reduces. */
export function clampDiscount(discount: number | null | undefined, subTotal: number): number {
  const requested = Number.isFinite(discount) ? (discount as number) : 0
  return roundMoney(Math.min(Math.max(requested, 0), Math.max(subTotal, 0)))
}

/** Assemble the stored columns from a subtotal, the discount applied and the tax charged. */
export function pricingFrom(subTotal: number, discount: number, tax: TaxBreakdown): OrderPricing {
  return {
    subTotal: roundMoney(subTotal),
    discount,
    taxableAmount: subtractMoney(subTotal, discount),
    gstRate: tax.gstRate,
    cgst: tax.cgst,
    sgst: tax.sgst,
    igst: tax.igst,
    gstAmount: tax.gstAmount,
    totalAmount: tax.totalAmount,
  }
}

/**
 * Re-price an EXISTING order (discount change, fabric change, split) keeping the rate and tax
 * structure it was created with, so a later change to the shop's tax settings never rewrites
 * historical orders.
 */
export function repriceOrder(
  subTotal: number,
  discount: number | null | undefined,
  stored: StoredTax,
  fallback: TaxConfig,
  opts: { customerRegion?: string | null } = {}
): OrderPricing {
  const applied = clampDiscount(discount, subTotal)
  const tax = recomputeOrderTax(subtractMoney(subTotal, applied), stored, fallback, opts)
  return pricingFrom(subTotal, applied, tax)
}
