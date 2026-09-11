import { requirePagePermission } from '@/lib/page-guard'

// Server-side guard: requires view_garment_types
export default async function GarmentTypesLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission('view_garment_types')
  return <>{children}</>
}
