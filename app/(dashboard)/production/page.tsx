import { redirect } from 'next/navigation'

// /production has no content of its own — the tailor workload view is the section's landing page
export default function ProductionIndexPage() {
  redirect('/production/tailors')
}
