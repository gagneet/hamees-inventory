import { requirePagePermission } from '@/lib/page-guard'

// Server-side guard: requires manage_customers
export default async function NewCustomerLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission('manage_customers')
  return <>{children}</>
}
