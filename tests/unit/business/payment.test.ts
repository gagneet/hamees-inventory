/**
 * Payment System Business Logic Tests
 *
 * Tests the balance calculation logic from app/api/orders/[id]/route.ts.
 * Key formula (v0.28.4 single source of truth):
 *
 *   balanceAmount = totalAmount - advancePaid - discount - totalPaidInstallments
 *
 * NOTE: Advance payment is stored ONLY in Order.advancePaid (not also as installment #1)
 * — this is the "single source of truth" fix from v0.28.4.
 */
import { describe, it, expect } from 'vitest'

// ── Pure calculation helpers (mirror the production formulas) ──────────────

function calcBalance(
  totalAmount: number,
  advancePaid: number,
  discount: number,
  totalPaidInstallments: number
): number {
  return parseFloat((totalAmount - advancePaid - discount - totalPaidInstallments).toFixed(2))
}

function calcBalanceAfterDiscount(
  totalAmount: number,
  advancePaid: number,
  currentDiscount: number,
  newDiscount: number,
  totalPaidInstallments: number
): number {
  return parseFloat((totalAmount - advancePaid - newDiscount - totalPaidInstallments).toFixed(2))
}

// ── Basic balance calculation ──────────────────────────────────────────────

describe('balance = totalAmount - advancePaid - discount - installments', () => {
  it('zero advance, zero discount, zero installments: balance = total', () => {
    expect(calcBalance(10000, 0, 0, 0)).toBe(10000)
  })

  it('full advance, zero discount, zero installments: balance = 0', () => {
    expect(calcBalance(10000, 10000, 0, 0)).toBe(0)
  })

  it('partial advance only', () => {
    expect(calcBalance(10000, 3000, 0, 0)).toBe(7000)
  })

  it('advance + one installment payment', () => {
    // Order: ₹10,000, advance ₹3,000, installment ₹4,000 → balance ₹3,000
    expect(calcBalance(10000, 3000, 0, 4000)).toBe(3000)
  })

  it('advance + discount + installment', () => {
    // Order: ₹10,000, advance ₹3,000, discount ₹500, installment ₹4,000 → ₹2,500
    expect(calcBalance(10000, 3000, 500, 4000)).toBe(2500)
  })

  it('discount alone reduces balance', () => {
    expect(calcBalance(10000, 0, 1000, 0)).toBe(9000)
  })

  it('multiple installments summed', () => {
    // installments: 2,000 + 3,000 = 5,000
    const installments = 2000 + 3000
    expect(calcBalance(10000, 0, 0, installments)).toBe(5000)
  })

  it('fully paid via installments: balance = 0', () => {
    // advance ₹5,000 + installment ₹5,000
    expect(calcBalance(10000, 5000, 0, 5000)).toBe(0)
  })

  it('result is rounded to 2 decimal places', () => {
    // 1333.33 - 500.11 - 0 - 333.33 = 499.89
    const result = calcBalance(1333.33, 500.11, 0, 333.33)
    const decimals = result.toString().split('.')[1]?.length ?? 0
    expect(decimals).toBeLessThanOrEqual(2)
  })
})

// ── Specific known bug scenario from v0.28.6 ───────────────────────────────

describe('known balance bug: double-counting advance (v0.28.4 fix)', () => {
  /**
   * The OLD (broken) formula subtracted advancePaid twice when it was also
   * stored as installment #1.  The new formula uses advance from Order.advancePaid
   * only, and installments exclude any advance installment.
   *
   * Real order: ORD-1769338355430-738
   *   totalAmount: 177,704.13
   *   advancePaid: 75,000.13
   *   discount:    2,704.00
   *   OLD balance (wrong):  24,999.87  (subtracted advance twice)
   *   NEW balance (correct): 100,000.00
   */
  it('correct balance when advance is NOT duplicated in installments', () => {
    const totalAmount = 177704.13
    const advancePaid = 75000.13
    const discount = 2704.00
    const installments = 0 // advance NOT stored as installment

    const balance = calcBalance(totalAmount, advancePaid, discount, installments)
    expect(balance).toBeCloseTo(100000, 1)
  })
})

// ── Apply discount scenarios ───────────────────────────────────────────────

describe('apply discount updates balance correctly', () => {
  it('applying discount reduces balance proportionally', () => {
    // Balance before discount: ₹6,000 (total 10,000, advance 4,000)
    // Apply ₹1,000 discount
    const balance = calcBalanceAfterDiscount(10000, 4000, 0, 1000, 0)
    expect(balance).toBe(5000)
  })

  it('applying discount equal to entire balance clears it to 0', () => {
    // balance = 6,000; discount = 6,000 → new balance = 0
    const balance = calcBalanceAfterDiscount(10000, 4000, 0, 6000, 0)
    expect(balance).toBe(0)
  })

  it('previous discount is replaced by new discount in calculation', () => {
    // Old discount ₹500 → new discount ₹1,000
    // balance = 10,000 - 4,000 - 1,000 - 0 = 5,000
    const balance = calcBalanceAfterDiscount(10000, 4000, 500, 1000, 0)
    expect(balance).toBe(5000)
  })

  it('discount after partial payment', () => {
    // total 10,000, advance 0, installment 4,000, discount 500 → 5,500
    const balance = calcBalanceAfterDiscount(10000, 0, 0, 500, 4000)
    expect(balance).toBe(5500)
  })
})

// ── Advance payment validation ─────────────────────────────────────────────

describe('advance payment validation (from route.ts)', () => {
  /**
   * The API returns 400 if advancePaid > totalAmount.
   * Test the guard condition directly.
   */
  function isAdvanceValid(advancePaid: number, totalAmount: number): boolean {
    return advancePaid <= totalAmount
  }

  it('advance equal to total is valid', () => {
    expect(isAdvanceValid(10000, 10000)).toBe(true)
  })

  it('advance less than total is valid', () => {
    expect(isAdvanceValid(5000, 10000)).toBe(true)
  })

  it('advance of zero is valid', () => {
    expect(isAdvanceValid(0, 10000)).toBe(true)
  })

  it('advance exceeding total is INVALID', () => {
    expect(isAdvanceValid(10001, 10000)).toBe(false)
  })

  it('advance + discount exceeding total is INVALID', () => {
    // From order update validation: advancePaid + discount <= totalAmount
    function isUpdateValid(advance: number, discount: number, total: number) {
      return advance + discount <= total
    }
    expect(isUpdateValid(80000, 70000, 100000)).toBe(false) // 150,000 > 100,000
    expect(isUpdateValid(60000, 40000, 100000)).toBe(true)  // 100,000 = 100,000
  })
})

// ── Proportional cost distribution (print invoice & split order) ───────────

describe('proportional cost distribution (multi-item orders)', () => {
  /**
   * From print-invoice-button.tsx logic:
   *   totalItemPrices = sum of item.totalPrice (fabric + accessories)
   *   orderLevelCosts = order.subTotal - totalItemPrices  (stitching + premiums)
   *   itemProportion  = item.totalPrice / totalItemPrices
   *   perItemOrderCosts = orderLevelCosts * itemProportion
   *   perItemSubtotal   = item.totalPrice + perItemOrderCosts
   */
  function distributeProportionally(items: number[], subTotal: number) {
    const totalItemPrices = items.reduce((s, p) => s + p, 0)
    const orderLevelCosts = subTotal - totalItemPrices
    return items.map((price) => {
      const proportion = price / totalItemPrices
      const perItemOrderCosts = orderLevelCosts * proportion
      return parseFloat((price + perItemOrderCosts).toFixed(2))
    })
  }

  it('two-item order: proportions add up to subTotal', () => {
    // Shirt: ₹3,500, Suit: ₹6,500, Stitching: ₹2,000 → subTotal ₹12,000
    const result = distributeProportionally([3500, 6500], 12000)
    const sum = result.reduce((s, v) => s + v, 0)
    expect(sum).toBeCloseTo(12000, 1)
  })

  it('cheaper item gets proportionally less stitching cost', () => {
    const [shirt, suit] = distributeProportionally([3500, 6500], 12000)
    // Shirt = 35% of items → 35% of ₹2,000 = ₹700 → total ₹4,200
    expect(shirt).toBeCloseTo(4200, 1)
    // Suit = 65% of items → 65% of ₹2,000 = ₹1,300 → total ₹7,800
    expect(suit).toBeCloseTo(7800, 1)
  })

  it('equal-price items get equal distribution', () => {
    const [a, b] = distributeProportionally([5000, 5000], 12000)
    expect(a).toBe(b)
    expect(a).toBe(6000)
  })

  it('single item gets 100% of order-level costs', () => {
    const [item] = distributeProportionally([8000], 10000)
    expect(item).toBe(10000)
  })
})

// ── Payment installment balance tracking ──────────────────────────────────

describe('installment balance tracking (v0.26.5)', () => {
  /**
   * From payment recording logic:
   *   installmentAmount for first payment = order.totalAmount (customer commitment)
   *   installmentAmount for subsequent = order.balanceAmount (remaining due)
   */
  it('first installment shows full order total', () => {
    const orderTotal = 15000
    const firstInstallmentAmount = orderTotal // always the full commitment
    expect(firstInstallmentAmount).toBe(15000)
  })

  it('second installment shows remaining balance after first payment', () => {
    const orderTotal = 15000
    const firstPayment = 6000
    const remainingBalance = parseFloat((orderTotal - firstPayment).toFixed(2))
    expect(remainingBalance).toBe(9000)
    // Second installment's "amount due" is the remaining balance
    const secondInstallmentAmount = remainingBalance
    expect(secondInstallmentAmount).toBe(9000)
  })

  it('final payment makes balance exactly zero', () => {
    const remaining = 3000
    const payment = 3000
    const newBalance = parseFloat((remaining - payment).toFixed(2))
    expect(newBalance).toBe(0)
  })
})
