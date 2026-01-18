'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wallet, CreditCard, Smartphone, Banknote, Building2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/utils'

interface RecordPaymentDialogProps {
  orderId: string
  orderNumber: string
  balanceAmount: number
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash', icon: Wallet },
  { value: 'UPI', label: 'UPI', icon: Smartphone },
  { value: 'CARD', label: 'Card', icon: CreditCard },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: Building2 },
  { value: 'CHEQUE', label: 'Cheque', icon: Banknote },
]

export function RecordPaymentDialog({
  orderId,
  orderNumber,
  balanceAmount,
}: RecordPaymentDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState(balanceAmount.toString())
  const [paymentMode, setPaymentMode] = useState('CASH')
  const [transactionRef, setTransactionRef] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const paymentAmount = parseFloat(amount)
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      alert('Please enter a valid amount')
      return
    }

    if (paymentAmount > balanceAmount) {
      alert(`Payment amount cannot exceed balance of ${formatCurrency(balanceAmount)}`)
      return
    }

    setLoading(true)

    try {
      // Record payment using the payments endpoint
      const response = await fetch(`/api/orders/${orderId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: paymentAmount,
          paymentMode,
          transactionRef: transactionRef || undefined,
          notes: notes || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to record payment')
      }

      setOpen(false)
      router.refresh()
      alert(`Payment of ${formatCurrency(paymentAmount)} recorded successfully!`)
    } catch (error: any) {
      console.error('Error recording payment:', error)
      alert(error.message || 'Failed to record payment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="default" size="sm">
          <Wallet className="mr-2 h-4 w-4" />
          Record Payment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment for order {orderNumber}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Balance Summary */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <p className="text-sm text-slate-600">Balance Due</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(balanceAmount)}
            </p>
          </div>

          {/* Payment Amount */}
          <div>
            <Label htmlFor="amount" className="text-slate-700">Payment Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              max={balanceAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 text-lg font-semibold"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              Maximum: {formatCurrency(balanceAmount)}
            </p>
          </div>

          {/* Payment Mode */}
          <div>
            <Label className="text-slate-700">Payment Mode *</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setPaymentMode(method.value)}
                  className={`p-3 border-2 rounded-lg flex flex-col items-center gap-1 transition-colors ${
                    paymentMode === method.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <method.icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{method.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Transaction Reference */}
          {paymentMode !== 'CASH' && (
            <div>
              <Label htmlFor="transactionRef" className="text-slate-700">
                Transaction Reference
              </Label>
              <Input
                id="transactionRef"
                type="text"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="Transaction ID, Cheque No., etc."
                className="mt-1"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="text-slate-700">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              className="mt-1"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={loading}
            >
              {loading ? 'Recording...' : 'Record Payment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
