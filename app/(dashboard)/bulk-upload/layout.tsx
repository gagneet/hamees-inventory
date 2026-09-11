import { requirePagePermission } from '@/lib/page-guard'

// Server-side guard: requires bulk_upload
export default async function BulkUploadLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission('bulk_upload')
  return <>{children}</>
}
