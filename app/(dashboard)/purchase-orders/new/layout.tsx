import { requirePagePermission } from '@/lib/page-guard'

// Server-side guard: requires manage_purchase_orders
export default async function NewPurchaseOrderLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission('manage_purchase_orders')
  return <>{children}</>
}
