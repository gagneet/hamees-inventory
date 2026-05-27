import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  generateOrderNumber,
  generateSKU,
  calculateStockStatus,
  getStatusColor,
  formatDate,
  formatDateTime,
  cn,
} from '@/lib/utils'

describe('formatCurrency', () => {
  it('formats positive amounts with INR symbol', () => {
    const result = formatCurrency(1000)
    expect(result).toContain('1,000')
    expect(result).toContain('₹')
  })

  it('always shows exactly 2 decimal places', () => {
    expect(formatCurrency(100)).toMatch(/100\.00/)
    expect(formatCurrency(1234.5)).toMatch(/1,234\.50/)
    expect(formatCurrency(9999.99)).toMatch(/9,999\.99/)
  })

  it('formats zero correctly', () => {
    const result = formatCurrency(0)
    expect(result).toContain('0.00')
  })

  it('formats large amounts with Indian comma grouping', () => {
    // Indian system: 1,00,000 (lakh) not 100,000
    const result = formatCurrency(100000)
    expect(result).toContain('1,00,000') // Indian number format
  })

  it('formats amounts with two decimal precision', () => {
    // 12% GST on 1000 = 120.00
    expect(formatCurrency(120)).toMatch(/120\.00/)
  })
})

describe('generateOrderNumber', () => {
  it('returns a string matching ORD-{timestamp}-{random} pattern', () => {
    const orderNumber = generateOrderNumber()
    expect(orderNumber).toMatch(/^ORD-\d+-\d+$/)
  })

  it('always starts with ORD-', () => {
    expect(generateOrderNumber().startsWith('ORD-')).toBe(true)
  })

  it('generates unique order numbers on successive calls', () => {
    const numbers = new Set(Array.from({ length: 20 }, () => generateOrderNumber()))
    // With timestamp + random, collisions are extremely unlikely
    expect(numbers.size).toBeGreaterThan(1)
  })

  it('contains a numeric timestamp portion', () => {
    const orderNumber = generateOrderNumber()
    const parts = orderNumber.split('-')
    // ORD - <timestamp> - <random>
    expect(parts.length).toBe(3)
    expect(Number(parts[1])).toBeGreaterThan(0)
  })
})

describe('generateSKU', () => {
  it('returns a string with type and brand codes', () => {
    const sku = generateSKU('Cotton', 'ABC')
    expect(sku).toMatch(/^COT-ABC-\d+$/)
  })

  it('uppercases the type and brand codes', () => {
    const sku = generateSKU('silk', 'xyz')
    expect(sku.startsWith('SIL-XYZ-')).toBe(true)
  })

  it('truncates type to 3 characters', () => {
    const sku = generateSKU('Polyester', 'Brand')
    expect(sku.startsWith('POL-')).toBe(true)
  })

  it('truncates brand to 3 characters', () => {
    const sku = generateSKU('Linen', 'Premium')
    expect(sku.startsWith('LIN-PRE-')).toBe(true)
  })

  it('handles short type and brand gracefully', () => {
    // Less than 3 chars — substring just returns what's available
    const sku = generateSKU('AB', 'XY')
    expect(sku.startsWith('AB-XY-')).toBe(true)
  })

  it('appends a numeric random component', () => {
    const sku = generateSKU('Cotton', 'ABC')
    const randomPart = sku.split('-')[2]
    expect(Number(randomPart)).toBeGreaterThanOrEqual(0)
    expect(Number(randomPart)).toBeLessThan(10000)
  })
})

describe('calculateStockStatus', () => {
  // Definitions from source:
  // healthy:  available >= minimum
  // low:      available >= minimum * 0.5  (AND < minimum, implied by order of checks)
  // critical: available < minimum * 0.5

  it('returns "healthy" when available equals minimum', () => {
    expect(calculateStockStatus(20, 20)).toBe('healthy')
  })

  it('returns "healthy" when available exceeds minimum', () => {
    expect(calculateStockStatus(100, 20)).toBe('healthy')
  })

  it('returns "low" when available is exactly 50% of minimum', () => {
    // 10 >= 20 * 0.5 (10) and 10 < 20 → low
    expect(calculateStockStatus(10, 20)).toBe('low')
  })

  it('returns "low" when available is between 50% and 100% of minimum', () => {
    expect(calculateStockStatus(15, 20)).toBe('low')
    expect(calculateStockStatus(11, 20)).toBe('low')
  })

  it('returns "critical" when available is below 50% of minimum', () => {
    expect(calculateStockStatus(9, 20)).toBe('critical')
    expect(calculateStockStatus(0, 20)).toBe('critical')
    expect(calculateStockStatus(5, 20)).toBe('critical')
  })

  it('returns "critical" for zero stock', () => {
    expect(calculateStockStatus(0, 100)).toBe('critical')
  })

  it('returns "critical" when available is just below the 50% boundary', () => {
    // 9.99 < 20 * 0.5 (10) → critical
    expect(calculateStockStatus(9.99, 20)).toBe('critical')
  })

  it('handles fractional meters correctly (real use case)', () => {
    // 5.65m available, 20m minimum → 5.65 < 10 → critical
    expect(calculateStockStatus(5.65, 20)).toBe('critical')
  })
})

describe('getStatusColor', () => {
  it('returns correct class for stock statuses', () => {
    expect(getStatusColor('healthy')).toBe('bg-success text-white')
    expect(getStatusColor('low')).toBe('bg-warning text-white')
    expect(getStatusColor('critical')).toBe('bg-error text-white')
  })

  it('returns correct class for order statuses', () => {
    expect(getStatusColor('NEW')).toBe('bg-info text-white')
    expect(getStatusColor('MATERIAL_SELECTED')).toBe('bg-primary text-white')
    expect(getStatusColor('CUTTING')).toBe('bg-accent text-white')
    expect(getStatusColor('STITCHING')).toBe('bg-secondary text-white')
    expect(getStatusColor('FINISHING')).toBe('bg-warning text-white')
    expect(getStatusColor('READY')).toBe('bg-success text-white')
    expect(getStatusColor('DELIVERED')).toBe('bg-neutral-600 text-white')
    expect(getStatusColor('CANCELLED')).toBe('bg-error text-white')
  })

  it('returns fallback class for unknown status', () => {
    expect(getStatusColor('UNKNOWN_STATUS')).toBe('bg-neutral-400 text-white')
    expect(getStatusColor('')).toBe('bg-neutral-400 text-white')
  })
})

describe('formatDate', () => {
  it('formats a Date object to a medium date string', () => {
    const date = new Date('2026-01-15T00:00:00.000Z')
    const result = formatDate(date)
    // Medium date style in en-IN locale — should contain the day, month, and year
    expect(result).toMatch(/15/)
    expect(result).toMatch(/2026/)
  })

  it('formats an ISO string', () => {
    const result = formatDate('2026-01-15')
    expect(result).toMatch(/2026/)
  })
})

describe('formatDateTime', () => {
  it('includes both date and time in output', () => {
    const date = new Date('2026-01-15T14:30:00.000Z')
    const result = formatDateTime(date)
    expect(result).toMatch(/2026/)
    // Time component should be present
    expect(result.length).toBeGreaterThan(10)
  })
})

describe('cn (className utility)', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toContain('foo')
    expect(cn('foo', 'bar')).toContain('bar')
  })

  it('handles conditional classes', () => {
    expect(cn('base', true && 'active', false && 'inactive')).not.toContain('inactive')
    expect(cn('base', true && 'active')).toContain('active')
  })

  it('deduplicates Tailwind conflicting classes (tailwind-merge)', () => {
    // tailwind-merge resolves conflicts; later class wins
    const result = cn('p-2', 'p-4')
    expect(result).toBe('p-4')
    expect(result).not.toContain('p-2')
  })
})
