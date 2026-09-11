import { requirePagePermission } from '@/lib/page-guard'

// Server-side guard: production supervision pages require view_production
export default async function ProductionLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission('view_production')
  return <>{children}</>
}
