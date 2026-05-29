'use client';

/**
 * @featuretrace Global Cmd+K Command Palette
 * @component CommandPalette
 * @renders Dialog with cmdk Command — search customers, orders, inventory; quick nav actions
 * @permission-gated Quick action items filtered by user role
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  ShoppingBag,
  Users,
  Package,
  PlusCircle,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { hasPermission, type UserRole } from '@/lib/permissions';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  type: 'order' | 'customer' | 'inventory';
}

interface QuickAction {
  label: string;
  href: string;
  icon: React.ElementType;
  permission?: Parameters<typeof hasPermission>[1];
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'New Order', href: '/orders/new', icon: PlusCircle, permission: 'create_order' },
  { label: 'New Customer', href: '/customers/new', icon: PlusCircle, permission: 'manage_customers' },
  { label: 'New Purchase Order', href: '/purchase-orders/new', icon: PlusCircle, permission: 'manage_inventory' },
  { label: 'View Dashboard', href: '/dashboard', icon: ExternalLink },
  { label: 'View Orders', href: '/orders', icon: ShoppingBag },
  { label: 'View Customers', href: '/customers', icon: Users },
  { label: 'View Inventory', href: '/inventory', icon: Package },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole?: UserRole;
}

export function CommandPalette({ open, onOpenChange, userRole }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const visibleActions = QUICK_ACTIONS.filter(
    (a) => !a.permission || (userRole && hasPermission(userRole, a.permission))
  );

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsSearching(true);

    try {
      const [cusRes, ordRes] = await Promise.all([
        fetch(`/api/customers?search=${encodeURIComponent(q)}&limit=5`, { signal: controller.signal }),
        fetch(`/api/orders?search=${encodeURIComponent(q)}&limit=5`, { signal: controller.signal }),
      ]);

      const combined: SearchResult[] = [];

      if (cusRes.ok) {
        const { customers } = await cusRes.json();
        (customers ?? []).forEach((c: { id: string; name: string; phone?: string }) => {
          combined.push({ id: c.id, label: c.name, sublabel: c.phone, href: `/customers/${c.id}`, type: 'customer' });
        });
      }

      if (ordRes.ok) {
        const { orders } = await ordRes.json();
        (orders ?? []).forEach((o: { id: string; orderNumber: string; customer?: { name: string } }) => {
          combined.push({
            id: o.id,
            label: o.orderNumber,
            sublabel: o.customer?.name,
            href: `/orders/${o.id}`,
            type: 'order',
          });
        });
      }

      setResults(combined);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setResults([]);
    } finally {
      // Only clear spinner if this is still the active request (not superseded by a newer one)
      if (abortRef.current === controller) setIsSearching(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  function navigate(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  const typeIcon = { order: ShoppingBag, customer: Users, inventory: Package };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-xl overflow-hidden" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command className="rounded-lg border-0" shouldFilter={false}>
          <div className="flex items-center border-b px-3 gap-2">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search orders, customers… or type a command"
              className="flex h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-slate-400"
            />
            {isSearching && <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />}
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-slate-100 px-1.5 text-[10px] font-mono text-slate-500 shrink-0">
              Esc
            </kbd>
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-slate-500">
              {query ? 'No results found.' : 'Start typing to search…'}
            </Command.Empty>

            {results.length > 0 && (
              <Command.Group heading="Results" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-slate-500">
                {results.map((r) => {
                  const Icon = typeIcon[r.type];
                  return (
                    <Command.Item
                      key={r.id}
                      value={r.id}
                      onSelect={() => navigate(r.href)}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm cursor-pointer',
                        'aria-selected:bg-slate-100 data-[selected=true]:bg-slate-100'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="flex-1 font-medium">{r.label}</span>
                      {r.sublabel && <span className="text-slate-400 text-xs truncate max-w-[120px]">{r.sublabel}</span>}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {!query && (
              <Command.Group heading="Quick Actions" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-slate-500">
                {visibleActions.map((a) => (
                  <Command.Item
                    key={a.href}
                    value={a.label}
                    onSelect={() => navigate(a.href)}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm cursor-pointer',
                      'aria-selected:bg-slate-100 data-[selected=true]:bg-slate-100'
                    )}
                  >
                    <a.icon className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="font-medium">{a.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
