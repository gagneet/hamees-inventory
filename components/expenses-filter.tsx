'use client'

import * as React from 'react'
import { Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

export interface ExpenseFilters {
  customerName?: string
  category?: string
  minAmount?: string
  maxAmount?: string
  paymentMode?: string
}

interface ExpensesFilterProps {
  filters: ExpenseFilters
  onChange: (filters: ExpenseFilters) => void
  onReset: () => void
}

const expenseCategories = [
  'RENT',
  'UTILITIES',
  'SALARIES',
  'TRANSPORT',
  'MARKETING',
  'MAINTENANCE',
  'OFFICE_SUPPLIES',
  'PROFESSIONAL_FEES',
  'INSURANCE',
  'DEPRECIATION',
  'BANK_CHARGES',
  'MISCELLANEOUS',
]

const paymentModes = [
  'CASH',
  'UPI',
  'CARD',
  'BANK_TRANSFER',
  'CHEQUE',
  'NET_BANKING',
]

export function ExpensesFilter({ filters, onChange, onReset }: ExpensesFilterProps) {
  const [localFilters, setLocalFilters] = React.useState<ExpenseFilters>(filters)
  const [isOpen, setIsOpen] = React.useState(false)

  const handleApply = () => {
    onChange(localFilters)
    setIsOpen(false)
  }

  const handleReset = () => {
    setLocalFilters({})
    onReset()
    setIsOpen(false)
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-600 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filter Expenses</SheetTitle>
          <SheetDescription>
            Apply filters to narrow down your expenses, orders, and purchases
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Customer Name Filter */}
          <div className="space-y-2">
            <Label htmlFor="customerName">Customer Name</Label>
            <Input
              id="customerName"
              placeholder="Search by customer name"
              value={localFilters.customerName || ''}
              onChange={(e) =>
                setLocalFilters({ ...localFilters, customerName: e.target.value })
              }
            />
          </div>

          {/* Expense Category Filter */}
          <div className="space-y-2">
            <Label htmlFor="category">Expense Category</Label>
            <Select
              value={localFilters.category || ''}
              onValueChange={(value) =>
                setLocalFilters({ ...localFilters, category: value })
              }
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                {expenseCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Mode Filter */}
          <div className="space-y-2">
            <Label htmlFor="paymentMode">Payment Mode</Label>
            <Select
              value={localFilters.paymentMode || ''}
              onValueChange={(value) =>
                setLocalFilters({ ...localFilters, paymentMode: value })
              }
            >
              <SelectTrigger id="paymentMode">
                <SelectValue placeholder="All payment modes" />
              </SelectTrigger>
              <SelectContent>
                {paymentModes.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {mode.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount Range Filter */}
          <div className="space-y-2">
            <Label>Amount Range</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Input
                  type="number"
                  placeholder="Min amount"
                  value={localFilters.minAmount || ''}
                  onChange={(e) =>
                    setLocalFilters({ ...localFilters, minAmount: e.target.value })
                  }
                />
              </div>
              <div>
                <Input
                  type="number"
                  placeholder="Max amount"
                  value={localFilters.maxAmount || ''}
                  onChange={(e) =>
                    setLocalFilters({ ...localFilters, maxAmount: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button onClick={handleApply} className="flex-1">
              Apply Filters
            </Button>
            <Button onClick={handleReset} variant="outline">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
