import { createHash, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

type VerifyApiKeyResult =
  | { ok: true }
  | { ok: false; error: NextResponse }

export function verifyExcelApiKey(request: Request): VerifyApiKeyResult {
  const configuredKey = process.env.EXCEL_API_KEY
  if (!configuredKey) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: 'Excel API is not configured. Missing EXCEL_API_KEY.' },
        { status: 503 }
      ),
    }
  }

  const providedKey = request.headers.get('x-excel-api-key')
  if (!providedKey) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const configuredHash = createHash('sha256').update(configuredKey).digest()
  const providedHash = createHash('sha256').update(providedKey).digest()
  if (!timingSafeEqual(configuredHash, providedHash)) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return { ok: true }
}
