/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Suitable for this single-instance (PM2 fork mode) deployment — one shop per instance.
 * If the app is ever scaled horizontally, replace with a shared store (Redis/Postgres).
 */

type Window = { count: number; resetAt: number }

const STORE_KEY = Symbol.for('hamees.rateLimitStore')
type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: Map<string, Window> }

function store(): Map<string, Window> {
  const g = globalThis as GlobalWithStore
  if (!g[STORE_KEY]) g[STORE_KEY] = new Map()
  return g[STORE_KEY]!
}

function prune(map: Map<string, Window>, now: number) {
  if (map.size < 5000) return
  for (const [key, win] of map) {
    if (win.resetAt <= now) map.delete(key)
  }
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  retryAfterMs: number
}

/** Count one hit against `key`; returns ok=false once more than `limit` hits occur in the window. */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const map = store()
  prune(map, now)

  let win = map.get(key)
  if (!win || win.resetAt <= now) {
    win = { count: 0, resetAt: now + windowMs }
    map.set(key, win)
  }
  win.count++
  return {
    ok: win.count <= limit,
    remaining: Math.max(0, limit - win.count),
    retryAfterMs: Math.max(0, win.resetAt - now),
  }
}

/** Check a key without counting a hit. */
export function isRateLimited(key: string, limit: number): boolean {
  const win = store().get(key)
  return !!win && win.resetAt > Date.now() && win.count >= limit
}

export function resetRateLimit(key: string): void {
  store().delete(key)
}

/** Best-effort client IP behind Cloudflare / nginx. */
export function clientIp(headers: Headers | undefined | null): string {
  if (!headers) return 'unknown'
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-real-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}
