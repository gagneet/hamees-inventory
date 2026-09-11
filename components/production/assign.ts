/**
 * Client helper for POST /api/production/assign (bulk tailor assignment).
 */

export async function assignItems(orderItemIds: string[], tailorId: string | null): Promise<{ updated: number }> {
  const res = await fetch('/api/production/assign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ orderItemIds, tailorId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Failed to assign tailor')
  return data
}
