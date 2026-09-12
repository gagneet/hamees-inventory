import { requirePagePermission } from '@/lib/page-guard'

// Server-side guard: requires manage_garment_types
export default async function EditGarmentTypeLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission('manage_garment_types')
  return <>{children}</>
}
