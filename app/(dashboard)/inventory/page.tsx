import DashboardLayout from "@/components/DashboardLayout"
import InventoryPageClient from "@/components/InventoryPageClient"

export default async function InventoryPage() {
  return (
    <DashboardLayout>
      <InventoryPageClient />
    </DashboardLayout>
  )
}
