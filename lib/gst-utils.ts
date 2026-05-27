/**
 * GST Calculation Utilities for Indian Taxation
 *
 * This module provides utilities for calculating GST (Goods and Services Tax)
 * for orders, purchases, and expenses in compliance with Indian tax regulations.
 */

export interface GSTCalculation {
  subTotal: number
  gstRate: number
  cgst: number       // Central GST (intra-state)
  sgst: number       // State GST (intra-state)
  igst: number       // Integrated GST (inter-state)
  gstAmount: number  // Total GST
  totalAmount: number // subTotal + gstAmount
}

export interface GSTLiability {
  outputGST: number      // GST collected from customers
  inputTaxCredit: number // GST paid to suppliers (ITC)
  netGST: number         // outputGST - inputTaxCredit
  cgst: number
  sgst: number
  igst: number
}

/**
 * Calculate GST for sales (orders to customers)
 *
 * @param subTotal - Amount before GST
 * @param customerState - Customer's state code (e.g., "Maharashtra")
 * @param businessState - Business state code (e.g., "Maharashtra")
 * @param gstRate - GST rate percentage (5, 12, 18, or 28)
 * @returns GSTCalculation object with all GST components
 */
export function calculateSalesGST(
  subTotal: number,
  customerState: string,
  businessState: string,
  gstRate: number = 5
): GSTCalculation {
  const isSameState = customerState?.toLowerCase() === businessState?.toLowerCase()

  let cgst = 0
  let sgst = 0
  let igst = 0

  if (isSameState) {
    // Intra-state transaction: CGST + SGST
    // Each is half of the total GST rate
    cgst = (subTotal * gstRate) / 200
    sgst = (subTotal * gstRate) / 200
  } else {
    // Inter-state transaction: IGST
    igst = (subTotal * gstRate) / 100
  }

  const gstAmount = cgst + sgst + igst
  const totalAmount = subTotal + gstAmount

  return {
    subTotal,
    gstRate,
    cgst: parseFloat(cgst.toFixed(2)),
    sgst: parseFloat(sgst.toFixed(2)),
    igst: parseFloat(igst.toFixed(2)),
    gstAmount: parseFloat(gstAmount.toFixed(2)),
    totalAmount: parseFloat(totalAmount.toFixed(2)),
  }
}

/**
 * Calculate GST for purchases (from suppliers)
 * Uses the same logic as sales GST
 *
 * @param subTotal - Amount before GST
 * @param supplierState - Supplier's state code
 * @param businessState - Business state code
 * @param gstRate - GST rate percentage
 * @returns GSTCalculation object
 */
export function calculatePurchaseGST(
  subTotal: number,
  supplierState: string,
  businessState: string,
  gstRate: number
): GSTCalculation {
  return calculateSalesGST(subTotal, supplierState, businessState, gstRate)
}

/**
 * Calculate GST for expenses
 *
 * @param amount - Expense amount before GST
 * @param vendorState - Vendor's state (if applicable)
 * @param businessState - Business state
 * @param gstRate - GST rate (0 for exempt expenses like rent)
 * @returns GSTCalculation object
 */
export function calculateExpenseGST(
  amount: number,
  vendorState: string | null,
  businessState: string,
  gstRate: number = 0
): GSTCalculation {
  if (gstRate === 0 || !vendorState) {
    // No GST or GST-exempt expense
    return {
      subTotal: amount,
      gstRate: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      gstAmount: 0,
      totalAmount: amount,
    }
  }

  return calculateSalesGST(amount, vendorState, businessState, gstRate)
}

/**
 * Calculate net GST liability for a period
 *
 * @param orders - Array of orders with GST data
 * @param purchases - Array of purchases with GST data
 * @returns GSTLiability object
 */
export function calculateGSTLiability(
  orders: Array<{ cgst: number; sgst: number; igst: number; gstAmount: number }>,
  purchases: Array<{ cgst: number; sgst: number; igst: number; gstAmount: number; isInputTaxCredit?: boolean }>
): GSTLiability {
  // Calculate output GST (collected from customers)
  const outputGST = orders.reduce((sum, order) => sum + order.gstAmount, 0)
  const outputCGST = orders.reduce((sum, order) => sum + order.cgst, 0)
  const outputSGST = orders.reduce((sum, order) => sum + order.sgst, 0)
  const outputIGST = orders.reduce((sum, order) => sum + order.igst, 0)

  // Calculate input tax credit (GST paid to suppliers)
  // Only include purchases where ITC is eligible
  const itcEligiblePurchases = purchases.filter(p => p.isInputTaxCredit !== false)
  const inputTaxCredit = itcEligiblePurchases.reduce((sum, purchase) => sum + purchase.gstAmount, 0)
  const inputCGST = itcEligiblePurchases.reduce((sum, purchase) => sum + purchase.cgst, 0)
  const inputSGST = itcEligiblePurchases.reduce((sum, purchase) => sum + purchase.sgst, 0)
  const inputIGST = itcEligiblePurchases.reduce((sum, purchase) => sum + purchase.igst, 0)

  // Net GST liability = Output GST - Input Tax Credit
  const netGST = outputGST - inputTaxCredit

  return {
    outputGST: parseFloat(outputGST.toFixed(2)),
    inputTaxCredit: parseFloat(inputTaxCredit.toFixed(2)),
    netGST: parseFloat(netGST.toFixed(2)),
    cgst: parseFloat((outputCGST - inputCGST).toFixed(2)),
    sgst: parseFloat((outputSGST - inputSGST).toFixed(2)),
    igst: parseFloat((outputIGST - inputIGST).toFixed(2)),
  }
}

/**
 * Get the appropriate GST rate for textile products based on price
 *
 * Reference: Indian GST rates for textiles
 * - Cotton fabric ≤ ₹1000/meter: 5%
 * - Cotton fabric > ₹1000/meter: 12%
 * - Readymade garments: 12%
 * - Accessories: 12%
 *
 * @param itemType - Type of item ('fabric' or 'garment' or 'accessory')
 * @param pricePerUnit - Price per unit (meter for fabric)
 * @returns GST rate percentage
 */
export function getTextileGSTRate(
  itemType: 'fabric' | 'garment' | 'accessory',
  pricePerUnit: number
): number {
  switch (itemType) {
    case 'fabric':
      // Cotton fabric GST rate depends on price
      return pricePerUnit <= 1000 ? 5 : 12
    case 'garment':
      // Readymade garments and tailoring services
      return 12
    case 'accessory':
      // Buttons, threads, zippers, etc.
      return 12
    default:
      return 5 // Default rate
  }
}

/**
 * Validate GSTIN (GST Identification Number)
 * Format: 99AAAAA9999A9Z9
 *
 * @param gstin - GSTIN to validate
 * @returns true if valid, false otherwise
 */
export function validateGSTIN(gstin: string): boolean {
  if (!gstin) return false

  // GSTIN format: 99AAAAA9999A9Z9
  // 2 digits (state code) + 10 alphanumeric (PAN) + 1 digit (entity number) + 1 letter (Z) + 1 alphanumeric (checksum)
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

  return gstinRegex.test(gstin.toUpperCase())
}

/**
 * Format GST amount for display
 *
 * @param amount - GST amount
 * @returns Formatted string with currency symbol
 */
export function formatGSTAmount(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Get GST breakdown for display
 *
 * @param gst - GSTCalculation object
 * @returns Array of GST components with labels and amounts
 */
export function getGSTBreakdown(gst: GSTCalculation): Array<{ label: string; amount: number }> {
  const breakdown: Array<{ label: string; amount: number }> = []

  breakdown.push({
    label: 'Subtotal',
    amount: gst.subTotal,
  })

  if (gst.cgst > 0) {
    breakdown.push({
      label: `CGST (${gst.gstRate / 2}%)`,
      amount: gst.cgst,
    })
  }

  if (gst.sgst > 0) {
    breakdown.push({
      label: `SGST (${gst.gstRate / 2}%)`,
      amount: gst.sgst,
    })
  }

  if (gst.igst > 0) {
    breakdown.push({
      label: `IGST (${gst.gstRate}%)`,
      amount: gst.igst,
    })
  }

  breakdown.push({
    label: 'Total',
    amount: gst.totalAmount,
  })

  return breakdown
}

/**
 * Calculate reverse GST (when total amount is given including GST)
 *
 * @param totalAmount - Total amount including GST
 * @param gstRate - GST rate percentage
 * @returns GSTCalculation with reversed calculation
 */
export function reverseGSTCalculation(
  totalAmount: number,
  gstRate: number,
  isSameState: boolean
): GSTCalculation {
  // Formula: subTotal = totalAmount / (1 + gstRate/100)
  const subTotal = totalAmount / (1 + gstRate / 100)
  const gstAmount = totalAmount - subTotal

  let cgst = 0
  let sgst = 0
  let igst = 0

  if (isSameState) {
    cgst = gstAmount / 2
    sgst = gstAmount / 2
  } else {
    igst = gstAmount
  }

  return {
    subTotal: parseFloat(subTotal.toFixed(2)),
    gstRate,
    cgst: parseFloat(cgst.toFixed(2)),
    sgst: parseFloat(sgst.toFixed(2)),
    igst: parseFloat(igst.toFixed(2)),
    gstAmount: parseFloat(gstAmount.toFixed(2)),
    totalAmount: parseFloat(totalAmount.toFixed(2)),
  }
}
