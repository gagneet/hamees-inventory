import { describe, it, expect } from 'vitest'
import { computeTax, taxLines, taxTotalLabel, type TaxConfig } from '@/lib/tax'

const gst: TaxConfig = { mode: 'SPLIT', rate: 12, name: 'GST', businessRegion: 'Punjab' }
const vat: TaxConfig = { mode: 'SINGLE', rate: 20, name: 'VAT' }
const none: TaxConfig = { mode: 'NONE', rate: 12, name: 'Tax' }

describe('computeTax – SPLIT (India GST)', () => {
  it('splits intra-region tax into equal CGST and SGST halves', () => {
    expect(computeTax(10000, gst, { customerRegion: 'punjab' })).toEqual({
      gstRate: 12, cgst: 600, sgst: 600, igst: 0, gstAmount: 1200, totalAmount: 11200,
    })
  })

  it('treats a missing customer region as intra-region', () => {
    expect(computeTax(10000, gst).igst).toBe(0)
  })

  it('charges IGST when the customer is in another region', () => {
    expect(computeTax(10000, gst, { customerRegion: 'Delhi' })).toEqual({
      gstRate: 12, cgst: 0, sgst: 0, igst: 1200, gstAmount: 1200, totalAmount: 11200,
    })
  })

  it('keeps CGST + SGST equal to the total when rounding', () => {
    const t = computeTax(0.25, { ...gst, rate: 18 })
    expect(Math.round((t.cgst + t.sgst) * 100)).toBe(Math.round(t.gstAmount * 100))
  })

  it('honours a rate override', () => {
    expect(computeTax(1000, gst, { rateOverride: 5 }).gstAmount).toBe(50)
  })
})

describe('computeTax – SINGLE and NONE', () => {
  it('charges one tax line in SINGLE mode', () => {
    expect(computeTax(100, vat)).toEqual({ gstRate: 20, cgst: 0, sgst: 0, igst: 0, gstAmount: 20, totalAmount: 120 })
  })

  it('charges nothing in NONE mode', () => {
    expect(computeTax(100, none)).toEqual({ gstRate: 0, cgst: 0, sgst: 0, igst: 0, gstAmount: 0, totalAmount: 100 })
  })
})

describe('taxLines', () => {
  it('renders CGST/SGST lines for split tax', () => {
    expect(taxLines({ gstRate: 12, cgst: 600, sgst: 600, igst: 0, gstAmount: 1200 }, gst)).toEqual([
      { label: 'CGST (6%)', amount: 600 },
      { label: 'SGST (6%)', amount: 600 },
    ])
  })

  it('renders a single IGST line for inter-region tax', () => {
    expect(taxLines({ gstRate: 12, igst: 1200, gstAmount: 1200 }, gst)).toEqual([{ label: 'IGST (12%)', amount: 1200 }])
  })

  it('renders the configured tax name in SINGLE mode', () => {
    expect(taxLines({ gstRate: 20, gstAmount: 20 }, vat)).toEqual([{ label: 'VAT (20%)', amount: 20 }])
  })

  it('renders nothing when no tax was charged', () => {
    expect(taxLines({ gstRate: 0, gstAmount: 0 }, none)).toEqual([])
  })

  it('builds a total label', () => {
    expect(taxTotalLabel(vat, 20)).toBe('VAT (20%)')
    expect(taxTotalLabel(gst, 12.5)).toBe('GST (12.5%)')
  })
})
