import { requirePagePermission } from '@/lib/page-guard'

// Server-side guard: requires view_enquiries (matches GET /api/enquiries)
export default async function EnquiriesLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission('view_enquiries')
  return <>{children}</>
}
