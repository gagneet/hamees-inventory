import { requirePagePermission } from '@/lib/page-guard'

// Server-side guard: requires view_customers (object-level scope enforced per page/API)
export default async function CustomersLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission('view_customers')
  return <>{children}</>
}
