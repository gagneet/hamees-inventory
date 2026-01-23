'use client';

import React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Home,
  Package,
  ShoppingBag,
  Users,
  AlertCircle,
  Menu,
  LayoutGrid,
  LogOut,
  TrendingUp,
  ShoppingCart,
  Shirt,
  Upload,
  Settings,
} from 'lucide-react';
import Image from 'next/image';
import { SignOutButton } from './dashboard/sign-out-button';
import { hasPermission, Permission, type UserRole } from '@/lib/permissions';

type NavItem = {
  href: string;
  icon: any;
  label: string;
  permission: Permission;
}

const allNavItems: NavItem[] = [
  { href: '/dashboard', icon: Home, label: 'Dashboard', permission: 'view_dashboard' },
  { href: '/inventory', icon: Package, label: 'Inventory', permission: 'view_inventory' },
  { href: '/orders', icon: ShoppingBag, label: 'Orders', permission: 'view_orders' },
  { href: '/customers', icon: Users, label: 'Customers', permission: 'view_customers' },
  { href: '/garment-types', icon: Shirt, label: 'Garment Types', permission: 'view_garment_types' },
  { href: '/purchase-orders', icon: ShoppingCart, label: 'Purchase Orders', permission: 'view_purchase_orders' },
  { href: '/expenses', icon: TrendingUp, label: 'Expenses', permission: 'view_expenses' },
  { href: '/alerts', icon: AlertCircle, label: 'Alerts', permission: 'view_alerts' },
  { href: '/bulk-upload', icon: Upload, label: 'Bulk Upload', permission: 'bulk_upload' },
  { href: '/admin/settings', icon: Settings, label: 'Admin Settings', permission: 'manage_settings' },
];

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole;

  // Filter navigation items based on user permissions
  const navItems = allNavItems.filter(item =>
    userRole && hasPermission(userRole, item.permission)
  );
  return (
    <div className="min-h-screen w-full">
      {/* Fixed Sidebar for Desktop */}
      <div className="hidden md:block fixed left-0 top-0 z-30 h-screen w-[180px] lg:w-[220px] border-r bg-neutral-100/40 dark:bg-neutral-800/40">
        <div className="flex h-full flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <Image src="/logo.svg" alt="Hamees Attire" width={32} height={32} />
              <span className="">Hamees Attire</span>
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-neutral-500 transition-all hover:text-primary-dark dark:text-neutral-400 dark:hover:text-primary"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="mt-auto p-4 border-t">
            <SignOutButton />
          </div>
        </div>
      </div>

      {/* Main Content Area with Left Margin for Desktop */}
      <div className="flex flex-col md:ml-[180px] lg:ml-[220px]">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b bg-neutral-100/40 px-4 lg:h-[60px] lg:px-6 dark:bg-neutral-800/40">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col">
              <nav className="grid gap-2 text-lg font-medium">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 text-lg font-semibold"
                >
                  <Image src="/logo.svg" alt="Hamees Attire" width={32} height={32} />
                  <span className="sr-only">Hamees Attire</span>
                </Link>
                {navItems.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-neutral-500 hover:text-foreground"
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-auto">
                <SignOutButton />
              </div>
            </SheetContent>
          </Sheet>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-neutral-50 dark:bg-neutral-900/40">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
