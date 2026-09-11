import { requirePagePermission } from '@/lib/page-guard'

// Server-side guard: requires view_inventory
export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission('view_inventory')
  return <>{children}</>
}
