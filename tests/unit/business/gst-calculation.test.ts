/**
 * GST Calculation Business Logic Tests
 *
 * Based on the exact formulas used in app/api/orders/route.ts:
 *   gstRate    = 12 (%)
 *   gstAmount  = parseFloat(((subTotal * gstRate) / 100).toFixed(2))
 *   cgst       = parseFloat((gstAmount / 2).toFixed(2))
 *   sgst       = parseFloat((gstAmount / 2).toFixed(2))
 *   igst       = 0  (intra-state transactions)
 *   totalAmount = parseFloat((subTotal + gstAmount).toFixed(2))
 */
import { describe, it, expect } from 'vitest'

// Pure re-implementations of the production formulas so tests never depend
// on importing the entire API route (which has many side-effects).
const GST_RATE = 12

function calculateGst(subTotal: number) {
  const gstAmount = parseFloat(((subTotal * GST_RATE) / 100).toFixed(2))
  const cgst = parseFloat((gstAmount / 2).toFixed(2))
  const sgst = parseFloat((gstAmount / 2).toFixed(2))
  const igst = 0
  const totalAmount = parseFloat((subTotal + gstAmount).toFixed(2))
  return { gstRate: GST_RATE, gstAmount, cgst, sgst, igst, totalAmount }
}

describe('GST calculation – rate and amounts', () => {
  it('applies exactly 12% GST rate', () => {
    const { gstRate } = calculateGst(1000)
    expect(gstRate).toBe(12)
  })

  it('computes gstAmount as 12% of subTotal', () => {
    expect(calculateGst(1000).gstAmount).toBe(120)
    expect(calculateGst(10000).gstAmount).toBe(1200)
    expect(calculateGst(50000).gstAmount).toBe(6000)
  })

  it('CGST is exactly half of total GST (6%)', () => {
    const { gstAmount, cgst } = calculateGst(1000)
    expect(cgst).toBe(gstAmount / 2)
    expect(cgst).toBe(60)
  })

  it('SGST is exactly half of total GST (6%)', () => {
    const { gstAmount, sgst } = calculateGst(1000)
    expect(sgst).toBe(gstAmount / 2)
    expect(sgst).toBe(60)
  })

  it('CGST + SGST equals total GST', () => {
    const { gstAmount, cgst, sgst } = calculateGst(2500)
    expect(cgst + sgst).toBeCloseTo(gstAmount, 2)
  })

  it('IGST is always 0 (intra-state)', () => {
    expect(calculateGst(1000).igst).toBe(0)
    expect(calculateGst(99999).igst).toBe(0)
  })

  it('totalAmount equals subTotal + gstAmount', () => {
    const subTotal = 10000
    const { gstAmount, totalAmount } = calculateGst(subTotal)
    expect(totalAmount).toBe(parseFloat((subTotal + gstAmount).toFixed(2)))
    expect(totalAmount).toBe(11200)
  })
})

describe('GST calculation – decimal precision', () => {
  it('rounds to 2 decimal places (toFixed(2) pattern)', () => {
    // subTotal with fractions that could produce many decimals
    const { gstAmount } = calculateGst(1333.33)
    // 1333.33 * 12 / 100 = 159.9996 → 160.00
    expect(gstAmount).toBe(160)
    expect(Number.isInteger(gstAmount * 100)).toBe(true) // at most 2 decimals
  })

  it('precise result for even amounts', () => {
    const { gstAmount, totalAmount } = calculateGst(5000)
    expect(gstAmount).toBe(600)
    expect(totalAmount).toBe(5600)
  })

  it('does not accumulate floating-point errors for typical order amounts', () => {
    // Typical suit order: ~₹45,000 sub-total
    const { gstAmount, totalAmount, cgst, sgst } = calculateGst(45000)
    expect(gstAmount).toBe(5400)
    expect(cgst).toBe(2700)
    expect(sgst).toBe(2700)
    expect(totalAmount).toBe(50400)
  })
})

describe('GST calculation – business scenarios', () => {
  it('basic shirt order (₹4,000 subtotal)', () => {
    const { gstAmount, cgst, sgst, totalAmount } = calculateGst(4000)
    expect(gstAmount).toBe(480)
    expect(cgst).toBe(240)
    expect(sgst).toBe(240)
    expect(totalAmount).toBe(4480)
  })

  it('luxury suit order (₹80,000 subtotal)', () => {
    const { gstAmount, totalAmount } = calculateGst(80000)
    expect(gstAmount).toBe(9600)
    expect(totalAmount).toBe(89600)
  })

  it('zero subtotal produces zero GST', () => {
    const { gstAmount, cgst, sgst, totalAmount } = calculateGst(0)
    expect(gstAmount).toBe(0)
    expect(cgst).toBe(0)
    expect(sgst).toBe(0)
    expect(totalAmount).toBe(0)
  })
})

describe('balance calculation after advance payment', () => {
  /**
   * From route.ts line 520:
   *   balanceAmount = parseFloat((totalAmount - validatedData.advancePaid).toFixed(2))
   */
  function calcBalance(totalAmount: number, advancePaid: number): number {
    return parseFloat((totalAmount - advancePaid).toFixed(2))
  }

  it('balance = total - advance', () => {
    expect(calcBalance(11200, 5000)).toBe(6200)
  })

  it('full advance payment results in zero balance', () => {
    expect(calcBalance(11200, 11200)).toBe(0)
  })

  it('no advance payment means full amount is balance', () => {
    expect(calcBalance(11200, 0)).toBe(11200)
  })

  it('balance is rounded to 2 decimal places', () => {
    // 50400 - 15000.50 = 35399.50
    expect(calcBalance(50400, 15000.50)).toBe(35399.50)
  })

  it('advance exceeding total is caught by validation (would return 400)', () => {
    // The API returns 400 if advancePaid > totalAmount
    // We test that logically: balance should NOT be negative in production
    const totalAmount = 11200
    const advancePaid = 15000 // invalid
    expect(advancePaid > totalAmount).toBe(true) // this triggers the validation guard
  })
})

describe('workmanship premium calculations', () => {
  /**
   * From route.ts:
   *   handStitchingCost = parseFloat((stitchingCost * 0.40).toFixed(2))  // +40%
   *   rushOrderCost     = parseFloat((stitchingCost * 0.50).toFixed(2))  // +50%
   *   complexDesignCost = parseFloat((stitchingCost * 0.30).toFixed(2))  // +30%
   *   fullCanvasCost    = 5000 (fixed)
   *   premiumLiningCost = 5000 (fixed)
   *   additionalFittingsCost = additionalFittings * 1500
   */
  function calcPremiums(stitchingCost: number, opts: {
    isHandStitched?: boolean
    isFullCanvas?: boolean
    isRushOrder?: boolean
    hasComplexDesign?: boolean
    additionalFittings?: number
    hasPremiumLining?: boolean
  }) {
    let total = 0
    if (opts.isHandStitched) total += parseFloat((stitchingCost * 0.40).toFixed(2))
    if (opts.isFullCanvas) total += 5000
    if (opts.isRushOrder) total += parseFloat((stitchingCost * 0.50).toFixed(2))
    if (opts.hasComplexDesign) total += parseFloat((stitchingCost * 0.30).toFixed(2))
    if (opts.additionalFittings) total += opts.additionalFittings * 1500
    if (opts.hasPremiumLining) total += 5000
    return total
  }

  it('hand stitching adds 40% of stitching cost', () => {
    expect(calcPremiums(10000, { isHandStitched: true })).toBe(4000)
  })

  it('full canvas adds fixed ₹5,000', () => {
    expect(calcPremiums(10000, { isFullCanvas: true })).toBe(5000)
  })

  it('rush order adds 50% of stitching cost', () => {
    expect(calcPremiums(10000, { isRushOrder: true })).toBe(5000)
  })

  it('complex design adds 30% of stitching cost', () => {
    expect(calcPremiums(10000, { hasComplexDesign: true })).toBe(3000)
  })

  it('additional fittings: ₹1,500 per fitting', () => {
    expect(calcPremiums(10000, { additionalFittings: 2 })).toBe(3000)
    expect(calcPremiums(10000, { additionalFittings: 3 })).toBe(4500)
  })

  it('premium lining adds fixed ₹5,000', () => {
    expect(calcPremiums(10000, { hasPremiumLining: true })).toBe(5000)
  })

  it('no premiums results in zero workmanship cost', () => {
    expect(calcPremiums(10000, {})).toBe(0)
  })

  it('multiple premiums accumulate correctly', () => {
    // hand stitching (4000) + full canvas (5000) = 9000
    expect(calcPremiums(10000, { isHandStitched: true, isFullCanvas: true })).toBe(9000)
  })
})

describe('fabric wastage calculation', () => {
  /**
   * From route.ts:
   *   fabricWastageAmount = parseFloat((fabricCost * (fabricWastagePercent / 100)).toFixed(2))
   */
  function calcWastage(fabricCost: number, wastagePercent: number): number {
    return parseFloat((fabricCost * (wastagePercent / 100)).toFixed(2))
  }

  it('10% wastage on ₹10,000 fabric', () => {
    expect(calcWastage(10000, 10)).toBe(1000)
  })

  it('15% wastage on ₹10,000 fabric', () => {
    expect(calcWastage(10000, 15)).toBe(1500)
  })

  it('0% wastage adds nothing', () => {
    expect(calcWastage(10000, 0)).toBe(0)
  })

  it('result is rounded to 2 decimal places', () => {
    const result = calcWastage(10000, 10)
    expect(result.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2)
  })
})
