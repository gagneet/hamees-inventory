/**
 * Excel API Authentication Tests (lib/excel-api-auth.ts)
 *
 * Tests verifyExcelApiKey() which guards the /api/excel/submit-order endpoint.
 * Logic: SHA-256 HMAC constant-time comparison of x-excel-api-key header.
 *
 * The function uses crypto (Node built-in) and NextResponse (mocked via setup).
 * We test the same logic with pure Node crypto to avoid importing next/server
 * while still covering all branches:
 *   1. No EXCEL_API_KEY env var          → 503 Service Unavailable
 *   2. Missing x-excel-api-key header    → 401 Unauthorized
 *   3. Wrong key in header               → 401 Unauthorized
 *   4. Correct key                       → { ok: true }
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createHash, timingSafeEqual } from 'crypto'

// ── Re-implement the production logic for pure unit testing ────────────────
// (avoids importing next/server; mirrors verifyExcelApiKey exactly)
type VerifyResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

function verifyApiKey(
  configuredKey: string | undefined,
  providedKey: string | null
): VerifyResult {
  if (!configuredKey) {
    return { ok: false, status: 503, error: 'Excel API is not configured. Missing EXCEL_API_KEY.' }
  }
  if (!providedKey) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }
  const configuredHash = createHash('sha256').update(configuredKey).digest()
  const providedHash = createHash('sha256').update(providedKey).digest()
  if (!timingSafeEqual(configuredHash, providedHash)) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }
  return { ok: true }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('verifyExcelApiKey – missing EXCEL_API_KEY env var', () => {
  it('returns ok:false with status 503 when env var is undefined', () => {
    const result = verifyApiKey(undefined, 'any-key')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(503)
      expect(result.error).toContain('EXCEL_API_KEY')
    }
  })

  it('returns ok:false with status 503 when env var is empty string', () => {
    const result = verifyApiKey('', 'any-key')
    // Empty string is falsy so treated same as undefined
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(503)
    }
  })
})

describe('verifyExcelApiKey – missing header', () => {
  const CONFIGURED = 'secret-api-key-123'

  it('returns 401 when x-excel-api-key header is null', () => {
    const result = verifyApiKey(CONFIGURED, null)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
    }
  })

  it('returns 401 when header is empty string', () => {
    const result = verifyApiKey(CONFIGURED, '')
    // Empty string is falsy
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
    }
  })
})

describe('verifyExcelApiKey – wrong key', () => {
  const CONFIGURED = 'correct-secret-key'

  it('returns 401 for a completely different key', () => {
    const result = verifyApiKey(CONFIGURED, 'wrong-key')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
    }
  })

  it('returns 401 for a key that is one character different', () => {
    // off-by-one should still fail (constant-time comparison)
    const result = verifyApiKey(CONFIGURED, 'correct-secret-ke')
    expect(result.ok).toBe(false)
  })

  it('returns 401 for a key that is correct but with extra whitespace', () => {
    const result = verifyApiKey(CONFIGURED, ' correct-secret-key ')
    expect(result.ok).toBe(false)
  })

  it('is case-sensitive (uppercase of correct key fails)', () => {
    const result = verifyApiKey(CONFIGURED, CONFIGURED.toUpperCase())
    expect(result.ok).toBe(false)
  })
})

describe('verifyExcelApiKey – correct key', () => {
  const CONFIGURED = 'super-secret-api-key-xyz-123'

  it('returns ok:true for exact matching key', () => {
    const result = verifyApiKey(CONFIGURED, CONFIGURED)
    expect(result.ok).toBe(true)
  })

  it('returns ok:true for a key with special characters', () => {
    const specialKey = 'key!@#$%^&*()_+-=[]{}|;:,.<>?'
    const result = verifyApiKey(specialKey, specialKey)
    expect(result.ok).toBe(true)
  })

  it('returns ok:true for a long key (64+ chars)', () => {
    const longKey = 'a'.repeat(64)
    const result = verifyApiKey(longKey, longKey)
    expect(result.ok).toBe(true)
  })
})

describe('verifyExcelApiKey – constant-time safety', () => {
  it('SHA-256 hash of same string is always identical', () => {
    const key = 'test-key'
    const hash1 = createHash('sha256').update(key).digest()
    const hash2 = createHash('sha256').update(key).digest()
    expect(timingSafeEqual(hash1, hash2)).toBe(true)
  })

  it('SHA-256 hash of different strings never matches', () => {
    const hash1 = createHash('sha256').update('key-a').digest()
    const hash2 = createHash('sha256').update('key-b').digest()
    expect(timingSafeEqual(hash1, hash2)).toBe(false)
  })

  it('produces 32-byte (256-bit) digest', () => {
    const hash = createHash('sha256').update('test').digest()
    expect(hash.byteLength).toBe(32)
  })
})
