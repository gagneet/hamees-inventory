'use client'

/**
 * @featuretrace Enquiries (staff)
 * @route GET /enquiries
 * @permission view_enquiries (layout.tsx); actions need manage_enquiries
 * @calls GET /api/enquiries · PATCH /api/enquiries/[id] · POST /api/enquiries/[id]/convert
 * @renders List of public order enquiries with status filter and one-click conversion
 *
 * An enquiry carries no money, so there is nothing here to hide from a role that can see the
 * page. Converting one creates (or finds) the customer and opens the new-order form, where
 * pricing and stock reservation happen under the usual order permissions.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Home, Inbox, Phone, Search } from 'lucide-react'
import { PhoneText } from '@/components/ui/phone-input'
import { formatDate } from '@/lib/utils'
import { hasPermission, type UserRole } from '@/lib/permissions'

type EnquiryStatus = 'NEW' | 'CONTACTED' | 'CONVERTED' | 'CLOSED'
type EnquiryKind = 'ORDER_ENQUIRY' | 'FITTING'

interface Enquiry {
  id: string
  createdAt: string
  name: string
  phone: string
  email: string | null
  city: string | null
  kind: EnquiryKind
  garmentType: string
  fabricNotes: string | null
  quantity: number
  preferredDate: string | null
  notes: string | null
  status: EnquiryStatus
  staffNotes: string | null
  customerId: string | null
  orderId: string | null
  order: { orderNumber: string } | null
  handledBy: { name: string } | null
}

const STATUS_STYLES: Record<EnquiryStatus, string> = {
  NEW: 'bg-blue-100 text-blue-800 border-blue-200',
  CONTACTED: 'bg-amber-100 text-amber-800 border-amber-200',
  CONVERTED: 'bg-green-100 text-green-800 border-green-200',
  CLOSED: 'bg-slate-100 text-slate-700 border-slate-200',
}

/** A fitting is the same record with no garment decided yet — worth telling apart at a glance. */
const KIND_LABELS: Record<EnquiryKind, string> = {
  ORDER_ENQUIRY: 'Order enquiry',
  FITTING: 'Fitting',
}

const KIND_STYLES: Record<EnquiryKind, string> = {
  ORDER_ENQUIRY: 'bg-slate-100 text-slate-700 border-slate-200',
  FITTING: 'bg-violet-100 text-violet-800 border-violet-200',
}

const FILTERS: Array<{ value: EnquiryStatus | 'ALL'; label: string }> = [
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'CONVERTED', label: 'Converted' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'ALL', label: 'All' },
]

export default function EnquiriesPage() {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const role = session?.user?.role as UserRole | undefined
  const canManage = role ? hasPermission(role, 'manage_enquiries') : false
  const canConvert = role ? hasPermission(role, 'create_order') && hasPermission(role, 'manage_customers') : false

  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [counts, setCounts] = useState<Partial<Record<EnquiryStatus, number>>>({})
  const [filter, setFilter] = useState<EnquiryStatus | 'ALL'>('NEW')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filter !== 'ALL') params.set('status', filter)
      if (query.trim()) params.set('q', query.trim())
      const response = await fetch(`/api/enquiries?${params}`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Failed to load enquiries')
      setEnquiries(body.enquiries ?? [])
      setCounts(body.counts ?? {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load enquiries')
      setEnquiries([])
    } finally {
      setLoading(false)
    }
  }, [filter, query])

  useEffect(() => {
    load()
  }, [load])

  const setStatus = async (id: string, status: 'CONTACTED' | 'CLOSED') => {
    setBusyId(id)
    try {
      const response = await fetch(`/api/enquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Could not update the enquiry')
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the enquiry')
    } finally {
      setBusyId(null)
    }
  }

  const convert = async (id: string) => {
    setBusyId(id)
    setError(null)
    try {
      const response = await fetch(`/api/enquiries/${id}/convert`, { method: 'POST' })
      const body = await response.json().catch(() => ({}))
      if (response.status === 409 && body.code === 'MULTIPLE_CUSTOMERS') {
        setError(
          `More than one customer has that number (${(body.candidates ?? [])
            .map((c: { name: string }) => c.name)
            .join(', ')}). Open the customer you want and create the order from there.`
        )
        return
      }
      if (!response.ok) throw new Error(body.error || 'Could not convert the enquiry')
      router.push(`/orders/new?customerId=${body.customerId}&enquiryId=${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not convert the enquiry')
    } finally {
      setBusyId(null)
    }
  }

  if (sessionStatus === 'loading') {
    return <div className="p-8 text-slate-500">Loading…</div>
  }

  return (
    <>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">
              <Home className="h-4 w-4" />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Enquiries</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Inbox className="h-6 w-6 text-blue-600" />
            Enquiries
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Requests from the public order page. Nothing is priced or reserved until you create the
            order.
          </p>
        </div>
        <Link href="/order" target="_blank" className="text-sm text-blue-600 hover:underline">
          View the public page →
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={filter === option.value ? 'default' : 'outline'}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
            {option.value !== 'ALL' && counts[option.value] ? ` (${counts[option.value]})` : ''}
          </Button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, phone or garment"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      {loading ? (
        <div className="p-8 text-slate-500">Loading enquiries…</div>
      ) : enquiries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            No enquiries {filter === 'ALL' ? 'yet' : `with status ${filter.toLowerCase()}`}.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {enquiries.map((enquiry) => (
            <Card key={enquiry.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle className="text-base">
                    {enquiry.name}
                    <span className="ml-2 font-normal text-slate-500">
                      <PhoneText value={enquiry.phone} />
                    </span>
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={KIND_STYLES[enquiry.kind]}>
                      {KIND_LABELS[enquiry.kind]}
                    </Badge>
                    <Badge variant="outline" className={STATUS_STYLES[enquiry.status]}>
                      {enquiry.status}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  {formatDate(enquiry.createdAt, 'medium')}
                  {enquiry.city ? ` · ${enquiry.city}` : ''}
                  {enquiry.handledBy ? ` · handled by ${enquiry.handledBy.name}` : ''}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-slate-800">
                  <strong>
                    {enquiry.kind === 'FITTING'
                      ? 'Wants to come in and be measured'
                      : `${enquiry.quantity > 1 ? `${enquiry.quantity} × ` : ''}${enquiry.garmentType}`}
                  </strong>
                  {enquiry.fabricNotes ? ` — ${enquiry.fabricNotes}` : ''}
                  {enquiry.preferredDate ? ` · wanted by ${formatDate(enquiry.preferredDate, 'medium')}` : ''}
                </div>
                {enquiry.notes && <p className="text-sm text-slate-600">{enquiry.notes}</p>}
                {enquiry.email && <p className="text-xs text-slate-500">{enquiry.email}</p>}

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                  <Button asChild size="sm" variant="outline">
                    <a href={`tel:${enquiry.phone}`}>
                      <Phone className="mr-2 h-4 w-4" />
                      Call
                    </a>
                  </Button>
                  {enquiry.status === 'CONVERTED' && enquiry.orderId ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/orders/${enquiry.orderId}`}>
                        Order {enquiry.order?.orderNumber ?? ''}
                      </Link>
                    </Button>
                  ) : (
                    <>
                      {canManage && enquiry.status === 'NEW' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === enquiry.id}
                          onClick={() => setStatus(enquiry.id, 'CONTACTED')}
                        >
                          Mark contacted
                        </Button>
                      )}
                      {canManage && canConvert && (
                        <Button size="sm" disabled={busyId === enquiry.id} onClick={() => convert(enquiry.id)}>
                          {busyId === enquiry.id ? 'Working…' : 'Create order'}
                        </Button>
                      )}
                      {canManage && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === enquiry.id}
                          onClick={() => setStatus(enquiry.id, 'CLOSED')}
                        >
                          Close
                        </Button>
                      )}
                    </>
                  )}
                  {enquiry.customerId && (
                    <Link
                      href={`/customers/${enquiry.customerId}`}
                      className="ml-auto text-sm text-blue-600 hover:underline"
                    >
                      Customer profile →
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
