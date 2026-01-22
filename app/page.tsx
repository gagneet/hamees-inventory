import dynamic from 'next/dynamic'
import { Scissors, Package, Users, TrendingUp } from 'lucide-react'

// NOTE:
// The LoginForm uses client-side session/auth hooks and browser-only APIs,
// so we intentionally disable SSR here to avoid hydration and runtime errors.
// This may negatively impact SEO and initial page load performance for this
// above-the-fold component, but the trade-off is accepted to ensure correct
// authentication behavior.
const LoginForm = dynamic(() => import('@/components/login-form').then(mod => ({ default: mod.LoginForm })), {
  ssr: false,
  loading: () => <div className="w-full max-w-md animate-pulse rounded-lg bg-slate-200 h-96" />
})

export default function Home() {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Left Side - Branding & Features */}
      <div className="hidden lg:flex lg:flex-1 flex-col justify-center px-12 bg-gradient-to-br from-primary to-primary/80 text-white">
        <div className="max-w-lg">
          <div className="flex items-center gap-3 mb-8">
            <Scissors className="h-12 w-12" />
            <h1 className="text-4xl font-bold">Hamees Inventory</h1>
          </div>
          <p className="text-xl mb-12 text-white/90">
            Complete inventory and order management system for your tailor shop
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
            <h1 className="text-3xl font-bold text-primary">Hamees</h1>
          </div>

          <LoginForm />

          <p className="mt-8 text-center text-sm text-slate-500">
            Powered by Next.js 16 • Secure & Fast
          </p>
        </div>
      </div>
    </div>
  )
}
