import type { Metadata } from 'next'
import nextDynamic from 'next/dynamic'
import Link from 'next/link'
import { Scissors, Package, Users, TrendingUp } from 'lucide-react'
import { getAppSettings } from '@/lib/settings'

const LoginForm = nextDynamic(() => import('@/components/login-form').then(mod => mod.LoginForm), {
  loading: () => <div className="w-full max-w-md animate-pulse rounded-lg bg-slate-200 h-96" />
})

// Branding is read from BusinessSettings at request time (not baked in at build)
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Staff login',
  robots: { index: false, follow: false },
}

export default async function LoginPage() {
  const { businessName, tagline } = await getAppSettings()

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Left Side - Branding & Features */}
      <div className="hidden lg:flex lg:flex-1 flex-col justify-center px-12 bg-gradient-to-br from-primary to-primary/80 text-white">
        <div className="max-w-lg">
          <div className="flex items-center gap-3 mb-8">
            <Scissors className="h-12 w-12" />
            <h1 className="text-4xl font-bold">{businessName}</h1>
          </div>
          <p className="text-xl mb-12 text-white/90">
            {tagline || 'Inventory, orders and production management for your tailoring business'}
          </p>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <Package className="h-6 w-6 mt-1 text-accent" />
              <div>
                <h3 className="font-semibold text-lg mb-1">Smart Inventory Management</h3>
                <p className="text-white/80">Track fabrics, accessories, and supplies with automatic stock reservation and low-stock alerts</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Users className="h-6 w-6 mt-1 text-accent" />
              <div>
                <h3 className="font-semibold text-lg mb-1">Customer & Orders</h3>
                <p className="text-white/80">Manage customer measurements, track orders from cutting to delivery with complete audit trail</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <TrendingUp className="h-6 w-6 mt-1 text-accent" />
              <div>
                <h3 className="font-semibold text-lg mb-1">Business Insights</h3>
                <p className="text-white/80">Real-time analytics, supplier management, and automated reorder reminders</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile Header */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <Scissors className="h-10 w-10 text-primary" />
            <h1 className="text-3xl font-bold text-primary">{businessName}</h1>
          </div>

          <LoginForm businessName={businessName} tagline={tagline} />

          <p className="mt-6 text-center text-sm">
            <Link href="/" className="text-slate-500 hover:text-primary">
              ← Back to the public site
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
