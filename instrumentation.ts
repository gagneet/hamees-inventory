/**
 * Runs once when the Next.js server starts, before it handles requests.
 * Loads the shop settings so the isomorphic formatters in lib/locale.ts use the shop's currency,
 * locale and time zone from the very first request — including routes and helpers that format
 * amounts or compute "today" without calling getAppSettings() themselves.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { getAppSettings } = await import('@/lib/settings')
  await getAppSettings() // never throws; falls back to defaults if the DB is unreachable
}
