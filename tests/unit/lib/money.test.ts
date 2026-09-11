import { describe, expect, it } from 'vitest'
import {
  addMoney,
  allocateMoney,
  fromMinor,
  moneyEquals,
  multiplyMoney,
  percentOf,
  roundMoney,
  subtractMoney,
  sumFromMinor,
  sumMoney,
  toMinor,
  toMinorNumber,
} from '@/lib/money'

describe('minor-unit conversion', () => {
  it('converts decimals to whole minor units, rounding half away from zero', () => {
    expect(toMinorNumber(1234.56)).toBe(123456)
    expect(toMinorNumber(1.005)).toBe(101) // 1.005 * 100 is 100.49999999999999 in floating point
    expect(toMinorNumber(-1.005)).toBe(-101)
    expect(toMinorNumber(0.1 + 0.2)).toBe(30)
    expect(toMinorNumber(-0.001)).toBe(0)
    expect(Object.is(toMinorNumber(-0.001), -0)).toBe(false)
    expect(toMinor(19.99)).toBe(1999n)
  })

  it('rejects values that are not finite or not representable', () => {
    expect(() => toMinorNumber(Number.NaN)).toThrow(RangeError)
    expect(() => toMinorNumber(Number.POSITIVE_INFINITY)).toThrow(RangeError)
    expect(() => toMinorNumber(1e20)).toThrow(RangeError)
  })

  it('converts stored minor units back to decimals', () => {
    expect(fromMinor(123456n)).toBe(1234.56)
    expect(fromMinor(101)).toBe(1.01)
    expect(fromMinor(null)).toBeNull()
    expect(sumFromMinor(null)).toBe(0)
    expect(sumFromMinor(73412383n)).toBe(734123.83)
  })
})

describe('exact arithmetic', () => {
  it('adds and subtracts without floating-point residue', () => {
    expect(addMoney(0.1, 0.2)).toBe(0.3)
    expect(sumMoney([0.1, 0.2, 0.3, null, undefined])).toBe(0.6)
    expect(subtractMoney(100, 33.33, 33.33)).toBe(33.34)
    expect(subtractMoney(141775.02, 50000, 0, 91775.02)).toBe(0)
  })

  it('rounds, multiplies and takes percentages to the minor unit', () => {
    expect(roundMoney(2.675)).toBe(2.68)
    expect(multiplyMoney(12.34, 2.5)).toBe(30.85)
    expect(percentOf(1000.1, 12)).toBe(120.01)
    expect(percentOf(999.99, 18)).toBe(180)
    expect(percentOf(0, 12)).toBe(0)
  })

  it('compares to the minor unit', () => {
    expect(moneyEquals(0.1 + 0.2, 0.3)).toBe(true)
    expect(moneyEquals(10, 10.01)).toBe(false)
  })
})

describe('allocateMoney', () => {
  const total = (parts: number[]) => sumMoney(parts)

  it('splits so the parts add up to the total exactly', () => {
    const parts = allocateMoney(100, [1, 1, 1])
    expect(parts).toEqual([33.34, 33.33, 33.33])
    expect(total(parts)).toBe(100)
  })

  it('follows the weights', () => {
    expect(allocateMoney(1000, [300, 700])).toEqual([300, 700])
    const parts = allocateMoney(0.05, [1, 1, 1, 1])
    expect(total(parts)).toBe(0.05)
    expect(parts.filter((p) => p === 0.02)).toHaveLength(1)
  })

  it('shares equally when every weight is zero, and handles negatives', () => {
    expect(allocateMoney(10, [0, 0])).toEqual([5, 5])
    const parts = allocateMoney(-10, [1, 2])
    expect(total(parts)).toBe(-10)
    expect(parts).toEqual([-3.33, -6.67])
  })

  it('returns nothing for no weights', () => {
    expect(allocateMoney(10, [])).toEqual([])
  })
})
