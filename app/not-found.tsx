import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <SearchX className="h-10 w-10 text-slate-400" />
      <h1 className="text-2xl font-semibold text-slate-900">Not found</h1>
      <p className="max-w-md text-sm text-slate-600">
        The page or record you are looking for does not exist, or you do not have access to it.
      </p>
      <Button asChild>
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </div>
  )
}
