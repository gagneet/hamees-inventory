import { requirePagePermission } from '@/lib/page-guard'

// Server-side guard: requires create_order
export default async function NewOrderLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission('create_order')
  return <>{children}</>
}
