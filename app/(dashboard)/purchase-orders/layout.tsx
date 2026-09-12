import { requirePagePermission } from '@/lib/page-guard'

// Server-side guard: requires view_purchase_orders
export default async function PurchaseOrdersLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission('view_purchase_orders')
  return <>{children}</>
}
