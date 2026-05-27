/**
 * GST Utility Library Tests (lib/gst-utils.ts)
 *
 * Covers all exported functions:
 *   - calculateSalesGST   (intra-state → CGST+SGST, inter-state → IGST)
 *   - calculatePurchaseGST (delegates to calculateSalesGST)
 *   - calculateExpenseGST  (null vendor, zero rate, non-zero rate)
 *   - calculateGSTLiability (ITC eligible / ineligible)
 *   - getTextileGSTRate    (fabric price threshold, garment, accessory)
 *   - validateGSTIN        (format validation)
 *   - formatGSTAmount      (INR Intl.NumberFormat)
 *   - getGSTBreakdown      (label array for intra/inter-state)
 *   - reverseGSTCalculation (back-calculate subTotal from total+gstRate)
 */
import { describe, it, expect } from 'vitest'
import {
  calculateSalesGST,
  calculatePurchaseGST,
  calculateExpenseGST,
  calculateGSTLiability,
  getTextileGSTRate,
  validateGSTIN,
  formatGSTAmount,
  getGSTBreakdown,
  reverseGSTCalculation,
} from '@/lib/gst-utils'

// ── calculateSalesGST ──────────────────────────────────────────────────────

describe('calculateSalesGST – intra-state (same state)', () => {
  const BUSINESS_STATE = 'Punjab'

  it('CGST and SGST are each half of total GST for same-state customer', () => {
    const result = calculateSalesGST(10000, 'Punjab', BUSINESS_STATE, 12)
    expect(result.cgst).toBe(600)
    expect(result.sgst).toBe(600)
    expect(result.igst).toBe(0)
  })

  it('gstAmount equals cgst + sgst for intra-state', () => {
    const result = calculateSalesGST(10000, 'Punjab', BUSINESS_STATE, 12)
    expect(result.gstAmount).toBeCloseTo(result.cgst + result.sgst, 2)
  })

  it('totalAmount equals subTotal + gstAmount', () => {
    const result = calculateSalesGST(10000, 'Punjab', BUSINESS_STATE, 12)
    expect(result.totalAmount).toBe(11200)
  })

  it('case-insensitive state comparison', () => {
    const lowerResult = calculateSalesGST(10000, 'punjab', 'PUNJAB', 12)
    expect(lowerResult.igst).toBe(0)
    expect(lowerResult.cgst).toBeGreaterThan(0)
  })

  it('5% GST rate for affordable fabric', () => {
    const result = calculateSalesGST(1000, 'Punjab', BUSINESS_STATE, 5)
    expect(result.gstRate).toBe(5)
    expect(result.gstAmount).toBe(50)
    expect(result.cgst).toBe(25)
    expect(result.sgst).toBe(25)
    expect(result.igst).toBe(0)
  })

  it('default GST rate is 5% when not provided', () => {
    const result = calculateSalesGST(1000, 'Punjab', BUSINESS_STATE)
    expect(result.gstRate).toBe(5)
  })

  it('returns correct subTotal in result', () => {
    const result = calculateSalesGST(25000, 'Punjab', BUSINESS_STATE, 12)
    expect(result.subTotal).toBe(25000)
  })
})

describe('calculateSalesGST – inter-state (different states)', () => {
  it('IGST is the full GST amount for different-state customer', () => {
    const result = calculateSalesGST(10000, 'Maharashtra', 'Punjab', 12)
    expect(result.igst).toBe(1200)
    expect(result.cgst).toBe(0)
    expect(result.sgst).toBe(0)
  })

  it('totalAmount equals subTotal + IGST', () => {
    const result = calculateSalesGST(10000, 'Maharashtra', 'Punjab', 12)
    expect(result.totalAmount).toBe(11200)
  })

  it('18% GST inter-state', () => {
    const result = calculateSalesGST(5000, 'Delhi', 'Punjab', 18)
    expect(result.igst).toBe(900)
    expect(result.gstAmount).toBe(900)
  })
})

describe('calculateSalesGST – edge cases', () => {
  it('zero subTotal produces all-zero GST fields', () => {
    const result = calculateSalesGST(0, 'Punjab', 'Punjab', 12)
    expect(result.gstAmount).toBe(0)
    expect(result.cgst).toBe(0)
    expect(result.sgst).toBe(0)
    expect(result.totalAmount).toBe(0)
  })

  it('amounts are rounded to 2 decimal places', () => {
    // 1333.33 * 12% = 159.9996 → rounds to 160.00
    const result = calculateSalesGST(1333.33, 'Punjab', 'Punjab', 12)
    const decimals = (result.gstAmount.toString().split('.')[1] || '').length
    expect(decimals).toBeLessThanOrEqual(2)
  })
})

// ── calculatePurchaseGST ───────────────────────────────────────────────────

describe('calculatePurchaseGST', () => {
  it('delegates to calculateSalesGST: intra-state CGST+SGST', () => {
    const result = calculatePurchaseGST(10000, 'Punjab', 'Punjab', 12)
    expect(result.cgst).toBe(600)
    expect(result.sgst).toBe(600)
    expect(result.igst).toBe(0)
  })

  it('delegates to calculateSalesGST: inter-state IGST', () => {
    const result = calculatePurchaseGST(10000, 'Maharashtra', 'Punjab', 12)
    expect(result.igst).toBe(1200)
    expect(result.cgst).toBe(0)
  })

  it('returns same result as calculateSalesGST for same inputs', () => {
    const sales = calculateSalesGST(20000, 'Punjab', 'Punjab', 5)
    const purchase = calculatePurchaseGST(20000, 'Punjab', 'Punjab', 5)
    expect(purchase).toEqual(sales)
  })
})

// ── calculateExpenseGST ───────────────────────────────────────────────────

describe('calculateExpenseGST – GST-exempt (zero rate or null vendor)', () => {
  it('returns zero GST when rate is 0', () => {
    const result = calculateExpenseGST(5000, 'Punjab', 'Punjab', 0)
    expect(result.gstAmount).toBe(0)
    expect(result.totalAmount).toBe(5000)
  })

  it('returns zero GST when vendorState is null', () => {
    const result = calculateExpenseGST(5000, null, 'Punjab', 12)
    expect(result.gstAmount).toBe(0)
    expect(result.gstRate).toBe(0)
  })

  it('preserves subTotal amount when exempt', () => {
    const result = calculateExpenseGST(3750, null, 'Punjab', 18)
    expect(result.subTotal).toBe(3750)
    expect(result.totalAmount).toBe(3750)
  })
})

describe('calculateExpenseGST – taxable expenses', () => {
  it('applies GST when vendor state is provided and rate > 0', () => {
    const result = calculateExpenseGST(10000, 'Punjab', 'Punjab', 18)
    expect(result.gstAmount).toBe(1800)
    expect(result.totalAmount).toBe(11800)
  })

  it('uses IGST for inter-state expenses', () => {
    const result = calculateExpenseGST(10000, 'Maharashtra', 'Punjab', 18)
    expect(result.igst).toBe(1800)
    expect(result.cgst).toBe(0)
  })
})

// ── calculateGSTLiability ─────────────────────────────────────────────────

describe('calculateGSTLiability', () => {
  const orders = [
    { cgst: 600, sgst: 600, igst: 0, gstAmount: 1200 },
    { cgst: 300, sgst: 300, igst: 0, gstAmount: 600 },
  ]
  const purchases = [
    { cgst: 200, sgst: 200, igst: 0, gstAmount: 400 },
  ]

  it('outputGST is sum of all order gstAmounts', () => {
    const result = calculateGSTLiability(orders, purchases)
    expect(result.outputGST).toBe(1800)
  })

  it('inputTaxCredit is sum of eligible purchase gstAmounts', () => {
    const result = calculateGSTLiability(orders, purchases)
    expect(result.inputTaxCredit).toBe(400)
  })

  it('netGST = outputGST - inputTaxCredit', () => {
    const result = calculateGSTLiability(orders, purchases)
    expect(result.netGST).toBe(1400)
  })

  it('excludes purchases with isInputTaxCredit = false', () => {
    const purchasesWithIneligible = [
      { cgst: 200, sgst: 200, igst: 0, gstAmount: 400 },
      { cgst: 100, sgst: 100, igst: 0, gstAmount: 200, isInputTaxCredit: false },
    ]
    const result = calculateGSTLiability(orders, purchasesWithIneligible)
    expect(result.inputTaxCredit).toBe(400) // only first purchase
  })

  it('empty arrays produce zero liability', () => {
    const result = calculateGSTLiability([], [])
    expect(result.outputGST).toBe(0)
    expect(result.inputTaxCredit).toBe(0)
    expect(result.netGST).toBe(0)
  })

  it('net CGST and SGST are correctly computed', () => {
    const result = calculateGSTLiability(orders, purchases)
    // outputCGST(900) - inputCGST(200) = 700
    expect(result.cgst).toBe(700)
    expect(result.sgst).toBe(700)
  })
})

// ── getTextileGSTRate ─────────────────────────────────────────────────────

describe('getTextileGSTRate', () => {
  it('fabric at ₹1,000/m or less → 5%', () => {
    expect(getTextileGSTRate('fabric', 1000)).toBe(5)
    expect(getTextileGSTRate('fabric', 500)).toBe(5)
    expect(getTextileGSTRate('fabric', 1)).toBe(5)
  })

  it('fabric above ₹1,000/m → 12%', () => {
    expect(getTextileGSTRate('fabric', 1001)).toBe(12)
    expect(getTextileGSTRate('fabric', 5000)).toBe(12)
  })

  it('garment always → 12%', () => {
    expect(getTextileGSTRate('garment', 500)).toBe(12)
    expect(getTextileGSTRate('garment', 10000)).toBe(12)
  })

  it('accessory always → 12%', () => {
    expect(getTextileGSTRate('accessory', 50)).toBe(12)
    expect(getTextileGSTRate('accessory', 999)).toBe(12)
  })
})

// ── validateGSTIN ─────────────────────────────────────────────────────────

describe('validateGSTIN', () => {
  // Format: 99AAAAA9999A9Z9 (15 chars)
  const VALID_GSTIN = '27AAPFU0939F1ZV' // Example valid GSTIN

  it('accepts a correctly formatted GSTIN', () => {
    expect(validateGSTIN(VALID_GSTIN)).toBe(true)
  })

  it('is case-insensitive (lowercase input works)', () => {
    expect(validateGSTIN(VALID_GSTIN.toLowerCase())).toBe(true)
  })

  it('rejects empty string', () => {
    expect(validateGSTIN('')).toBe(false)
  })

  it('rejects too-short GSTIN', () => {
    expect(validateGSTIN('27AAPFU0939F1Z')).toBe(false)
  })

  it('rejects too-long GSTIN', () => {
    expect(validateGSTIN('27AAPFU0939F1ZV1')).toBe(false)
  })

  it('rejects GSTIN without Z at position 13', () => {
    // Replace Z at pos 13 with A — should fail
    expect(validateGSTIN('27AAPFU0939F1AV')).toBe(false)
  })

  it('rejects GSTIN with letters in state code', () => {
    expect(validateGSTIN('AVAAPFU0939F1ZV')).toBe(false)
  })

  it('another valid format: Punjab state code (03)', () => {
    expect(validateGSTIN('03AABCU9603R1ZM')).toBe(true)
  })
})

// ── formatGSTAmount ───────────────────────────────────────────────────────

describe('formatGSTAmount', () => {
  it('formats zero as ₹0.00', () => {
    const result = formatGSTAmount(0)
    expect(result).toContain('0.00')
  })

  it('includes rupee symbol', () => {
    const result = formatGSTAmount(1200)
    expect(result).toContain('₹')
  })

  it('shows exactly 2 decimal places for round amounts', () => {
    const result = formatGSTAmount(1200)
    expect(result).toMatch(/1,200\.00/)
  })

  it('shows 2 decimal places for fractional amounts', () => {
    const result = formatGSTAmount(159.50)
    expect(result).toMatch(/159\.50/)
  })
})

// ── getGSTBreakdown ───────────────────────────────────────────────────────

describe('getGSTBreakdown – intra-state (CGST + SGST)', () => {
  const intraGST = calculateSalesGST(10000, 'Punjab', 'Punjab', 12)

  it('returns Subtotal as first element', () => {
    const breakdown = getGSTBreakdown(intraGST)
    expect(breakdown[0].label).toBe('Subtotal')
    expect(breakdown[0].amount).toBe(10000)
  })

  it('includes CGST row with correct label and amount', () => {
    const breakdown = getGSTBreakdown(intraGST)
    const cgstRow = breakdown.find(b => b.label.startsWith('CGST'))
    expect(cgstRow).toBeDefined()
    expect(cgstRow!.amount).toBe(600)
    expect(cgstRow!.label).toContain('6%')
  })

  it('includes SGST row', () => {
    const breakdown = getGSTBreakdown(intraGST)
    const sgstRow = breakdown.find(b => b.label.startsWith('SGST'))
    expect(sgstRow).toBeDefined()
    expect(sgstRow!.amount).toBe(600)
  })

  it('does NOT include IGST row for intra-state', () => {
    const breakdown = getGSTBreakdown(intraGST)
    const igstRow = breakdown.find(b => b.label.startsWith('IGST'))
    expect(igstRow).toBeUndefined()
  })

  it('returns Total as last element', () => {
    const breakdown = getGSTBreakdown(intraGST)
    const last = breakdown[breakdown.length - 1]
    expect(last.label).toBe('Total')
    expect(last.amount).toBe(11200)
  })
})

describe('getGSTBreakdown – inter-state (IGST)', () => {
  const interGST = calculateSalesGST(10000, 'Maharashtra', 'Punjab', 12)

  it('includes IGST row with full GST amount', () => {
    const breakdown = getGSTBreakdown(interGST)
    const igstRow = breakdown.find(b => b.label.startsWith('IGST'))
    expect(igstRow).toBeDefined()
    expect(igstRow!.amount).toBe(1200)
    expect(igstRow!.label).toContain('12%')
  })

  it('does NOT include CGST or SGST rows for inter-state', () => {
    const breakdown = getGSTBreakdown(interGST)
    expect(breakdown.find(b => b.label.startsWith('CGST'))).toBeUndefined()
    expect(breakdown.find(b => b.label.startsWith('SGST'))).toBeUndefined()
  })
})

// ── reverseGSTCalculation ─────────────────────────────────────────────────

describe('reverseGSTCalculation', () => {
  it('back-calculates subTotal from total including 12% intra-state GST', () => {
    // total = 11200 (which is 10000 + 12% GST)
    const result = reverseGSTCalculation(11200, 12, true)
    expect(result.subTotal).toBeCloseTo(10000, 1)
    expect(result.totalAmount).toBe(11200)
  })

  it('subTotal + gstAmount approximately equals totalAmount', () => {
    const result = reverseGSTCalculation(11200, 12, true)
    expect(result.subTotal + result.gstAmount).toBeCloseTo(result.totalAmount, 1)
  })

  it('intra-state: CGST and SGST are each half of gstAmount', () => {
    const result = reverseGSTCalculation(11200, 12, true)
    expect(result.igst).toBe(0)
    expect(result.cgst).toBeCloseTo(result.sgst, 2)
    expect(result.cgst + result.sgst).toBeCloseTo(result.gstAmount, 2)
  })

  it('inter-state: IGST equals gstAmount', () => {
    const result = reverseGSTCalculation(11200, 12, false)
    expect(result.cgst).toBe(0)
    expect(result.sgst).toBe(0)
    expect(result.igst).toBeCloseTo(result.gstAmount, 2)
  })

  it('preserves gstRate in output', () => {
    const result = reverseGSTCalculation(5900, 18, true)
    expect(result.gstRate).toBe(18)
  })

  it('round-trips: reverse(forward(x)) ≈ x', () => {
    const forward = calculateSalesGST(10000, 'Punjab', 'Punjab', 12)
    const reversed = reverseGSTCalculation(forward.totalAmount, 12, true)
    expect(reversed.subTotal).toBeCloseTo(10000, 1)
  })
})
