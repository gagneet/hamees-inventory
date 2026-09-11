import { requirePagePermission } from '@/lib/page-guard'

// Server-side guard: requires view_orders (object-level scope enforced per page/API)
export default async function OrdersLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission('view_orders')
  return <>{children}</>
}
