'use client';

/**
 * @featuretrace Navigation Layout
 * @component DashboardLayout
 * @renders Sidebar (desktop) + Sheet nav (mobile, grouped) + sticky header + main content area
 * @reads session.user.role via useSession()
 * @calls lib/permissions.ts:hasPermission — filters nav items by role
 * @activestate usePathname() highlights the current route in both sidebar and mobile sheet
 * @groups nav items into Operations / Production / Procurement / Finance / System sections
 * @mobile Sheet nav mirrors desktop grouping with section headers for discoverability
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Home,
  Package,
  ShoppingBag,
  Users,
  AlertCircle,
  Menu,
  TrendingUp,
  ShoppingCart,
  Shirt,
  Upload,
  Settings,
  BarChart2,
  Scissors,
  Search,
} from 'lucide-react';
import Image from 'next/image';
import { SignOutButton } from './dashboard/sign-out-button';
import { hasPermission, Permission, type UserRole, getRoleName } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { CommandPalette } from './command-palette';

type NavItem = {
  href: string;
  icon: React.ElementType;
  label: string;
  permission: Permission;
}

/**
 * Navigation sections — groups visually separate the sidebar into logical domains.
 * Items are filtered by role permission before rendering.
 */
const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: 'Operations',
    items: [
      { href: '/dashboard',      icon: Home,         label: 'Dashboard',       permission: 'view_dashboard' },
      { href: '/orders',         icon: ShoppingBag,  label: 'Orders',          permission: 'view_orders' },
      { href: '/customers',      icon: Users,        label: 'Customers',       permission: 'view_customers' },
    ],
  },
  {
    label: 'Production',
    items: [
      { href: '/orders/production', icon: Scissors,   label: 'Production Board',permission: 'view_orders' },
      { href: '/garment-types',  icon: Shirt,        label: 'Garment Types',   permission: 'view_garment_types' },
      { href: '/inventory',      icon: Package,      label: 'Inventory',       permission: 'view_inventory' },
      { href: '/alerts',         icon: AlertCircle,  label: 'Alerts',          permission: 'view_alerts' },
    ],
  },
  {
    label: 'Procurement',
    items: [
      { href: '/purchase-orders',icon: ShoppingCart, label: 'Purchase Orders', permission: 'view_purchase_orders' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/expenses',       icon: TrendingUp,   label: 'Expenses',        permission: 'view_expenses' },
      { href: '/reports',        icon: BarChart2,    label: 'Reports',         permission: 'view_reports' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/bulk-upload',    icon: Upload,       label: 'Bulk Upload',     permission: 'bulk_upload' },
      { href: '/admin/settings', icon: Settings,     label: 'Admin Settings',  permission: 'manage_settings' },
    ],
  },
];

/**
 * Returns true if the current pathname matches this nav item's href.
 * - Exact match for /dashboard (avoids matching /dashboard/* as dashboard)
 * - /orders/production requires exact prefix match (does NOT fall through to /orders)
 * - All other items use startsWith prefix matching
 */
function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  // Sub-routes under /orders that have their own nav entry must match exactly
  if (href === '/orders' && pathname.startsWith('/orders/production')) return false;
  return pathname.startsWith(href);
}

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { data: session } = useSession();
  const pathname = usePathname();
  const userRole = session?.user?.role as UserRole;
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  /**
   * Filter each section's items by the user's role permissions.
   * Sections with no visible items are hidden entirely.
   */
  const visibleSections = navSections
    .map(section => ({
      ...section,
      items: section.items.filter(item =>
        userRole && hasPermission(userRole, item.permission)
      ),
    }))
    .filter(section => section.items.length > 0);

  return (
    <div className="min-h-screen w-full">
      {/* ── Fixed Sidebar — Desktop ─────────────────────────────────── */}
      <div className="hidden md:block fixed left-0 top-0 z-30 h-screen w-[180px] lg:w-[220px] border-r bg-white dark:bg-neutral-900 shadow-sm">
        <div className="flex h-full flex-col">
          {/* Logo / Brand */}
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <Image src="/logo.svg" alt="Hamees Attire" width={32} height={32} />
              <span className="text-slate-800 dark:text-slate-100 font-display font-semibold tracking-wide">Hamees Attire</span>
            </Link>
          </div>

          {/* Grouped Navigation */}
          <div className="flex-1 overflow-y-auto py-2">
            <nav className="px-2 lg:px-3 space-y-4">
              {visibleSections.map((section) => (
                <div key={section.label}>
                  {/* Section label — hidden for single-section sidebar */}
                  <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    {section.label}
                  </p>
                  {section.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                          active
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                        )}
                        aria-current={active ? 'page' : undefined}
                      >
                        <item.icon className={cn('h-4 w-4 shrink-0', active ? 'text-white dark:text-slate-900' : '')} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
          </div>

          {/* User identity + Sign out */}
          <div className="border-t p-4 space-y-2">
            {session?.user && (
              <div className="px-1">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{session.user.name}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                  {userRole ? getRoleName(userRole) : ''}
                </p>
              </div>
            )}
            <SignOutButton />
          </div>
        </div>
      </div>

      {/* ── Main Content Area ───────────────────────────────────────── */}
      <div className="flex flex-col md:ml-[180px] lg:ml-[220px]">
        {/* Sticky header — mobile hamburger + identity */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b bg-white/80 backdrop-blur px-4 lg:h-[60px] lg:px-6 dark:bg-neutral-900/80">
          {/* Mobile hamburger */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col w-[260px]">
              {/* Mobile nav header */}
              <div className="flex items-center gap-2 font-semibold pb-4 border-b">
                <Image src="/logo.svg" alt="Hamees Attire" width={28} height={28} />
                <span className="text-slate-800 font-display font-semibold tracking-wide">Hamees Attire</span>
              </div>

              {/* User identity in mobile nav */}
              {session?.user && (
                <div className="py-3 border-b mb-2">
                  <p className="text-sm font-semibold text-slate-800">{session.user.name}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold uppercase tracking-wide">
                    {userRole ? getRoleName(userRole) : ''}
                  </span>
                </div>
              )}

              {/* Mobile nav items — grouped sections matching the desktop sidebar */}
              <nav className="flex-1 overflow-y-auto py-2">
                <div className="space-y-4">
                  {visibleSections.map((section) => (
                    <div key={section.label}>
                      <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                        {section.label}
                      </p>
                      {section.items.map((item) => {
                        const active = isActive(pathname, item.href);
                        return (
                          <Link
                            key={item.label}
                            href={item.href}
                            className={cn(
                              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                              active
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            )}
                            aria-current={active ? 'page' : undefined}
                          >
                            <item.icon className="h-5 w-5 shrink-0" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </nav>

              <div className="mt-auto pt-4 border-t">
                <SignOutButton />
              </div>
            </SheetContent>
          </Sheet>

          {/* Header right — search trigger + user badge on desktop */}
          {session?.user && (
            <div className="hidden md:flex ml-auto items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-slate-500 border-slate-200 hover:border-slate-300 w-48 justify-start"
                onClick={() => setCmdOpen(true)}
              >
                <Search className="h-3.5 w-3.5" />
                <span className="text-xs flex-1 text-left">Search…</span>
                <kbd className="ml-auto hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-slate-100 px-1.5 font-mono text-[10px] text-slate-400">
                  ⌘K
                </kbd>
              </Button>
              <span className="text-xs text-slate-500">{session.user.name}</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold uppercase tracking-wide">
                {userRole ? getRoleName(userRole) : ''}
              </span>
            </div>
          )}
        </header>

        <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} userRole={userRole} />

        {/* Page content */}
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-neutral-50 dark:bg-neutral-900/40">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
