/**
 * @featuretrace Reorder suggestions
 * FEATURETRACE:
 *   feature: automated_reorder
 *   entry_points: GET /api/inventory/reorder (view_inventory)
 *   upstream_callers: components/purchase-orders/reorder-suggestions.tsx, components/purchase-orders/inventory-item-picker.tsx
 *   downstream_dependencies: lib/reorder (computeReorderPositions), field ACL ('inventory' amounts)
 *   related_tests: tests/unit/lib/reorder.test.ts, tests/unit/api/reorder-routes.test.ts
 *
 * ?scope=needs (default) — items that need a reorder, with the suggested quantity and supplier
 * ?scope=all             — every active item's stock position (used by the PO item picker)
 * ?type=CLOTH|ACCESSORY  — one kind only
 * ?supplierId=…          — price fabric from this supplier (the PO's supplier) where it has a price
 * Prices and estimated costs are removed for roles without inventory financial access.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'
import { filterApiResponse } from '@/lib/api-filter-response'
import { hasPermission } from '@/lib/permissions'
import { getAppSettings } from '@/lib/settings'
import { multiplyMoney } from '@/lib/money'
import { computeReorderPositions, loadReorderInput } from '@/lib/reorder'

export async function GET(request: Request) {
  const { session, error } = await requirePermission('view_inventory')
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope') === 'all' ? 'all' : 'needs'
    const type = searchParams.get('type')
    const supplierId = searchParams.get('supplierId') || null

    const input = await loadReorderInput(prisma)
    let positions = computeReorderPositions(input, { priceSupplierId: supplierId })
    if (type === 'CLOTH' || type === 'ACCESSORY') positions = positions.filter((p) => p.itemType === type)
    if (scope === 'needs') positions = positions.filter((p) => p.needsReorder && p.suggestedQuantity > 0)

    const items = positions.map((p) => ({
      ...p,
      estimatedCost: multiplyMoney(p.unitPrice, p.suggestedQuantity),
    }))
    const settings = await getAppSettings()

    return NextResponse.json({
      items: filterApiResponse(items, session.user.role, 'inventory'),
      autoReorderEnabled: settings.autoReorderEnabled,
      canRunReorderCheck: hasPermission(session.user.role, 'manage_inventory'),
    })
  } catch (err) {
    console.error('Error computing reorder suggestions:', err)
    return NextResponse.json({ error: 'Failed to compute reorder suggestions' }, { status: 500 })
  }
}
