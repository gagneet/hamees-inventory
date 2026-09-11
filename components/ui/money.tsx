/**
 * @featuretrace Money (dual-currency amount)
 * @component Money
 * @description Renders an amount in the shop's currency and, when Admin Settings define a
 *   secondary currency with an exchange rate, the indicative converted amount (muted, smaller)
 *   with a tooltip naming the rate and when it was set. Stored amounts are never converted —
 *   the secondary figure is display-only (lib/locale.ts#formatSecondaryCurrency).
 *
 * Hook-free and phrasing-content only (spans), so it can be used in server and client
 * components and inside <p>/<td>. Use plain formatCurrency() for chart axes/tooltips, form
 * inputs, messages sent to customers and exports.
 */

import { cn } from '@/lib/utils'
import { formatMoneyParts } from '@/lib/locale'

export type MoneySecondaryLayout = 'below' | 'inline' | 'none'

export interface MoneyProps {
  amount: number | null | undefined
  /** Compact notation (₹1.2L / ≈ £1.1K) for both the main and the secondary amount */
  compact?: boolean
  decimals?: number
  /** Where to show the secondary amount; 'none' shows the main amount only */
  secondary?: MoneySecondaryLayout
  /** Alignment of the two lines in the 'below' layout (use 'end' in right-aligned columns) */
  align?: 'start' | 'end'
  className?: string
  secondaryClassName?: string
}

export function Money({
  amount,
  compact,
  decimals,
  secondary = 'below',
  align = 'start',
  className,
  secondaryClassName,
}: MoneyProps) {
  const parts = formatMoneyParts(amount, { compact, decimals, withSecondary: secondary !== 'none' })

  if (!parts.secondary) return <span className={className}>{parts.primary}</span>

  const below = secondary === 'below'
  return (
    <span
      className={cn(
        below ? 'inline-flex flex-col leading-tight' : 'inline',
        below && align === 'end' && 'items-end text-right',
        className
      )}
      title={parts.note ?? undefined}
    >
      <span>{parts.primary}</span>
      <span
        className={cn(
          'text-xs font-normal text-slate-500 whitespace-nowrap',
          below ? 'mt-0.5' : 'ml-1',
          secondaryClassName
        )}
      >
        {parts.secondary}
      </span>
    </span>
  )
}
