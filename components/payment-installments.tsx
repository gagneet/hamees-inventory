'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Calendar, CreditCard, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'

interface PaymentInstallment {
  id: string
  installmentNumber: number
  amount: number
  dueDate: string
  paidDate: string | null
  paidAmount: number
  paymentMode: string | null
  transactionRef: string | null
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  notes: string | null
}

interface PaymentInstallmentsProps {
  orderId: string
  balanceAmount: number
}

export function PaymentInstallments({ orderId, balanceAmount }: PaymentInstallmentsProps) {
  const [installments, setInstallments] = useState<PaymentInstallment[]>([])
  const [loading, setLoading] = useState(true)
  const [recordingPayment, setRecordingPayment] = useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMode, setPaymentMode] = useState('')
  const [transactionRef, setTransactionRef] = useState('')

  useEffect(() => {
    fetchInstallments()
  }, [orderId])

  const fetchInstallments = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}/installments`)
      if (response.ok) {
        const data = await response.json()
        setInstallments(data.installments || [])
      }
    } catch (error) {
      console.error('Error fetching installments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRecordPayment = async (installmentId: string) => {
    try {
      const response = await fetch(`/api/installments/${installmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paidAmount: parseFloat(paymentAmount),
          paidDate: new Date().toISOString(),
          paymentMode,
          transactionRef,
        }),
      })

      if (response.ok) {
        await fetchInstallments()
        setRecordingPayment(null)
        setPaymentAmount('')
        setPaymentMode('')
        setTransactionRef('')
      }
    } catch (error) {
      console.error('Error recording payment:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>
      case 'PARTIAL':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Partial</Badge>
      case 'OVERDUE':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="h-3 w-3 mr-1" />Overdue</Badge>
      case 'CANCELLED':
        return <Badge className="bg-gray-100 text-gray-800"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>
      default:
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
    }
  }

  if (loading) {
    return <div className="text-center py-4">Loading installments...</div>
  }

  if (installments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Installments
          </CardTitle>
          <CardDescription>No installment plan configured for this order</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 mb-4">
            Balance Amount: <span className="font-bold text-lg">{formatCurrency(balanceAmount)}</span>
          </p>
          <p className="text-xs text-slate-500">
            Create an installment plan to track partial payments from the customer.
          </p>
        </CardContent>
      </Card>
    )
  }

  const totalPaid = installments.reduce((sum, inst) => sum + inst.paidAmount, 0)
  const totalDue = installments.reduce((sum, inst) => sum + inst.amount, 0)
  const overdueCount = installments.filter(inst => inst.status === 'OVERDUE').length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Installments
        </CardTitle>
        <CardDescription>
          {installments.length} installments | Paid: {formatCurrency(totalPaid)} of {formatCurrency(totalDue)}
          {overdueCount > 0 && (
            <span className="ml-2 text-red-600 font-semibold">
              ({overdueCount} overdue)
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {installments.map((installment) => (
                <TableRow key={installment.id}>
                  <TableCell className="font-medium">{installment.installmentNumber}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      {format(new Date(installment.dueDate), 'MMM dd, yyyy')}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(installment.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {installment.paidAmount > 0 ? (
                      <span className="text-green-600 font-semibold">
                        {formatCurrency(installment.paidAmount)}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(installment.status)}</TableCell>
                  <TableCell>
                    {installment.status !== 'PAID' && (
                      <Dialog open={recordingPayment === installment.id} onOpenChange={(open) => {
                        if (!open) {
                          setRecordingPayment(null)
                          setPaymentAmount('')
                          setPaymentMode('')
                          setTransactionRef('')
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRecordingPayment(installment.id)
                              setPaymentAmount((installment.amount - installment.paidAmount).toString())
                            }}
                          >
                            Record Payment
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Record Payment - Installment #{installment.installmentNumber}</DialogTitle>
                            <DialogDescription>
                              Due: {formatCurrency(installment.amount)} | Already Paid: {formatCurrency(installment.paidAmount)}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="amount">Payment Amount</Label>
                              <Input
                                id="amount"
                                type="number"
                                step="0.01"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                placeholder="Enter amount"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="paymentMode">Payment Mode</Label>
                              <Select value={paymentMode} onValueChange={setPaymentMode}>
                                <SelectTrigger id="paymentMode">
                                  <SelectValue placeholder="Select payment mode" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="CASH">Cash</SelectItem>
                                  <SelectItem value="UPI">UPI</SelectItem>
                                  <SelectItem value="CARD">Card</SelectItem>
                                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                                  <SelectItem value="NET_BANKING">Net Banking</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="transactionRef">Transaction Reference (Optional)</Label>
                              <Input
                                id="transactionRef"
                                value={transactionRef}
                                onChange={(e) => setTransactionRef(e.target.value)}
                                placeholder="Transaction ID or cheque number"
                              />
                            </div>
                            <Button
                              className="w-full"
                              onClick={() => handleRecordPayment(installment.id)}
                              disabled={!paymentAmount || !paymentMode}
                            >
                              Record Payment
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
