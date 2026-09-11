/**
 * @featuretrace Order Detail
 * @page /orders/[id]
 * @permission view_orders (+ object-level scope: TAILOR sees only orders with an item assigned to them)
 * @description Server-rendered order detail page. Shows full order summary, status pipeline,
 *   payment installments, order items with inline measurements, tailor notes, activity log.
 *   Primary actions: Update Status | Record Payment | Print Invoice | Send WhatsApp.
 *
 * @reads Order (full) + items + customer + orderHistory + measurements
 * @renders OrderActions | PaymentInstallments | OrderHistory | OrderItemDetailDialog
 * @actions update_order_status | update_order | record_payment | assign_tailors | print | WhatsApp
 *
 * Security: out-of-scope orders return 404 (no existence leak). Financial values are only
 * serialized to the client for roles with financial visibility (lib/field-acl), so restricted
 * roles never receive prices in the RSC payload.
 */

import type { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { actorFromSession, canSeeAllOrders, orderScope, scopedWhere } from '@/lib/authz'
import { itemProgress } from '@/lib/item-status'
import { hasFinancialAccess, isFinancialField } from '@/lib/field-acl'
import { hasPermission, type UserRole } from '@/lib/permissions'
import { getAppSettings } from '@/lib/settings'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Home, ArrowLeft, ShoppingBag, User, Calendar, DollarSign, Phone, Mail, Ruler } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Money } from '@/components/ui/money'
import { currencySymbol, getActiveLocaleConfig } from '@/lib/locale'
import DashboardLayout from '@/components/DashboardLayout'
import { OrderActions } from '@/components/orders/order-actions'
import { OrderHistory } from '@/components/orders/order-history'
import { PaymentInstallments } from '@/components/payment-installments'
import { OrderItemEdit } from '@/components/orders/order-item-edit'
import { SplitOrderDialog } from '@/components/orders/split-order-dialog'
import { RecordPaymentDialog } from '@/components/orders/record-payment-dialog'
import { PrintInvoiceButton } from '@/components/orders/print-invoice-button'
import { EditMeasurementDialog } from '@/components/orders/edit-measurement-dialog'
import { AddOrderItemMeasurementDialog } from '@/components/orders/add-order-item-measurement-dialog'
import { OrderItemDetailDialog } from '@/components/orders/order-item-detail-dialog'
import { AssignTailorDialog } from '@/components/orders/assign-tailor-dialog'
import { SendWhatsAppButton } from '@/components/orders/send-whatsapp-button'
import { OrderItemMeasurements } from '@/components/orders/order-item-measurements'
import { ItemStatusControl } from '@/components/orders/item-status-control'
import { PhoneText } from '@/components/ui/phone-input'

async function getOrderDetails(id: string, scope: Prisma.OrderWhereInput) {
  try {
    const order = await prisma.order.findFirst({
      where: scopedWhere<Prisma.OrderWhereInput>({ id }, scope),
      select: {
        id: true,
        orderNumber: true,
        status: true,
        priority: true,
        deliveryDate: true,
        createdAt: true,
        completedDate: true,
        totalAmount: true,
        advancePaid: true,
        discount: true,
        discountReason: true,
        balanceAmount: true,
        notes: true,
        tailorNotes: true,
        subTotal: true,
        gstRate: true,
        cgst: true,
        sgst: true,
        igst: true,
        gstAmount: true,
        customerId: true,
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            city: true,
            address: true,
            customerType: true,
          },
        },
        items: {
          include: {
            clothInventory: {
              select: {
                id: true,
                name: true,
                sku: true,
                color: true,
                colorHex: true,
                type: true,
                brand: true,
                pricePerMeter: true,
                location: true,
                currentStock: true,
                reserved: true,
              },
            },
            garmentPattern: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            measurement: {
              include: {
                createdBy: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            assignedTailor: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        history: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc' as const,
          },
        },
        installments: {
          orderBy: {
            installmentNumber: 'asc' as const,
          },
          select: {
            id: true,
            installmentNumber: true,
            installmentAmount: true,
            paidDate: true,
            paidAmount: true,
            status: true,
            paymentMode: true,
            notes: true,
          },
        },
      },
    })

    return order
  } catch (error) {
    console.error('Error fetching order details:', error)
    return null
  }
}

type OrderDetails = NonNullable<Awaited<ReturnType<typeof getOrderDetails>>>
type OrderItem = OrderDetails['items'][number]
type OrderInstallment = OrderDetails['installments'][number]
type OrderHistoryEntry = OrderDetails['history'][number]

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Currency amounts embedded in free-text history descriptions: the shop currency's symbol and ISO code
 * (e.g. "AED 1,200", "1.200 €"), plus common symbols that older entries may contain. A token only matches
 * when a number follows or precedes it directly, so order numbers like "ORD-2026-0012" survive.
 */
function currencyAmountPattern(): RegExp {
  const config = getActiveLocaleConfig()
  const tokens = Array.from(new Set(['₹', '$', '€', '£', '¥', 'Rs.', 'Rs', currencySymbol(config), config.currency]))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|')
  const amount = '-?\\d[\\d.,]*'
  return new RegExp(`(?:${tokens})\\s?${amount}|${amount}\\s?(?:${tokens})`, 'g')
}

/** Remove payment entries and monetary values from the activity log for roles without order financials. */
function redactHistory(history: OrderHistoryEntry[], showFinancials: boolean): OrderHistoryEntry[] {
  if (showFinancials) return history
  const CURRENCY_AMOUNT = currencyAmountPattern()
  return history
    .filter((h) => h.changeType !== 'PAYMENT_RECORDED' && !(h.fieldName && isFinancialField(h.fieldName)))
    .map((h) => ({ ...h, description: h.description.replace(CURRENCY_AMOUNT, '•••') }))
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const actor = actorFromSession(session)
  if (!session?.user || !actor) redirect('/')

  const role = session.user.role as UserRole
  if (!hasPermission(role, 'view_orders')) redirect('/dashboard?denied=1')

  // Prime currency / locale / tax formatting for this render
  await getAppSettings()

  const showOrderFinancials = hasFinancialAccess(role, 'order')
  const showItemPricing = hasFinancialAccess(role, 'order_item')
  const showInventoryPricing = hasFinancialAccess(role, 'inventory')
  const showPayments = showOrderFinancials && hasFinancialAccess(role, 'payment')
  const canEditOrder = hasPermission(role, 'update_order')
  const canUpdateStatus = hasPermission(role, 'update_order_status')
  const canRecordPayment = hasPermission(role, 'record_payment')
  const canAssignTailors = hasPermission(role, 'assign_tailors')
  const canManageMeasurements = hasPermission(role, 'manage_measurements')
  // Customer messaging is a front-office action (sales / owner / admin)
  const canMessageCustomer = hasPermission(role, 'update_order')

  const { id } = await params
  const order = await getOrderDetails(id, orderScope(actor))

  // Out-of-scope and missing orders are indistinguishable to the caller
  if (!order) notFound()

  const isClosed = order.status === 'DELIVERED' || order.status === 'CANCELLED'
  const history = redactHistory(order.history, showOrderFinancials)

  // Garments move through production on their own; the order's stage is derived from them
  // (least advanced item — lib/item-status.ts)
  const seesAllOrders = canSeeAllOrders(actor)
  const progress = itemProgress(order.items)
  const canBulkMove = seesAllOrders || order.items.every((item: OrderItem) => item.assignedTailorId === actor.id)

  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    NEW: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    MATERIAL_SELECTED: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    CUTTING: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    STITCHING: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
    FINISHING: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
    READY: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    DELIVERED: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
    CANCELLED: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  }

  const statusLabels: Record<string, string> = {
    NEW: 'New',
    MATERIAL_SELECTED: 'Material Selected',
    CUTTING: 'Cutting',
    STITCHING: 'Stitching',
    FINISHING: 'Finishing',
    READY: 'Ready',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
  }

  const statusStyle = statusColors[order.status as keyof typeof statusColors]
  const deliveryDate = new Date(order.deliveryDate)
  const isOverdue = deliveryDate < new Date() && !isClosed
  // Use 0.01 threshold to avoid floating-point precision errors
  const isArrears = order.status === 'DELIVERED' && order.balanceAmount > 0.01

  // Calculate total paid from installments and verify consistency
  const totalPaidFromInstallments = order.installments
    .filter((i: OrderInstallment) => i.status === 'PAID')
    .reduce((sum: number, i: OrderInstallment) => sum + i.paidAmount, 0)

  const advanceFromInstallment = order.installments
    .find((i: OrderInstallment) => i.installmentNumber === 1)?.paidAmount || 0

  // Log warning if advance payment mismatch detected
  if (Math.abs(advanceFromInstallment - order.advancePaid) > 0.01) {
    console.warn(
      `⚠️ Order ${order.orderNumber}: Advance payment mismatch detected!\n` +
      `  Order.advancePaid: ${formatCurrency(order.advancePaid)}\n` +
      `  Installment #1 paidAmount: ${formatCurrency(advanceFromInstallment)}\n` +
      `  Difference: ${formatCurrency(Math.abs(advanceFromInstallment - order.advancePaid))}`
    )
  }

  // Calculate total balance payments (all installments except #1 which is advance)
  const balancePayments = order.installments
    .filter((i: OrderInstallment) => i.installmentNumber > 1 && i.status === 'PAID')
    .reduce((sum: number, i: OrderInstallment) => sum + i.paidAmount, 0)

  // Verify balance calculation matches expected formula
  const expectedBalance = order.totalAmount - order.discount - totalPaidFromInstallments
  if (Math.abs(expectedBalance - order.balanceAmount) > 0.01) {
    console.warn(
      `⚠️ Order ${order.orderNumber}: Balance calculation mismatch!\n` +
      `  Expected: ${formatCurrency(expectedBalance)}\n` +
      `  Actual: ${formatCurrency(order.balanceAmount)}\n` +
      `  Difference: ${formatCurrency(Math.abs(expectedBalance - order.balanceAmount))}`
    )
  }

  return (
    <DashboardLayout>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">
              <Home className="h-4 w-4" />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/orders">Orders</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{order.orderNumber}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/orders">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">{order.orderNumber}</h1>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300">
              Ordered on {formatDate(order.createdAt, 'medium')}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge
            className={`px-3 py-1 text-sm ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border} border`}
            title={isClosed ? undefined : 'Derived from the items: the least advanced garment'}
          >
            {statusLabels[order.status]}
          </Badge>
          {!isClosed && progress.total > 1 && (
            <p className="text-xs text-slate-500">
              {progress.ready} of {progress.total} items ready
            </p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Order Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Order Items ({order.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item: OrderItem) => (
                    <div key={item.id} className="p-4 border border-slate-200 rounded-lg bg-white">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                        <div className="flex items-start gap-3">
                          <div
                            className="w-10 h-10 rounded border border-slate-300"
                            style={{ backgroundColor: item.clothInventory.colorHex }}
                          />
                          <div>
                            <p className="font-semibold text-slate-900">
                              {item.garmentPattern.name}
                            </p>
                            <p className="text-sm text-slate-600">
                              {item.clothInventory.name} ({item.clothInventory.color})
                            </p>
                            <p className="text-xs text-slate-500 font-mono mt-1">
                              SKU: {item.clothInventory.sku}
                            </p>
                            <div className="mt-2">
                              <ItemStatusControl
                                orderId={order.id}
                                itemId={item.id}
                                status={item.status}
                                canMove={
                                  canUpdateStatus && !isClosed && (seesAllOrders || item.assignedTailorId === actor.id)
                                }
                                canMoveAnyStage={seesAllOrders}
                              />
                            </div>
                          </div>
                        </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {showItemPricing && (
                            <div className="text-right">
                              <p className="font-semibold text-slate-900">
                                {formatCurrency(item.totalPrice)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatCurrency(item.pricePerUnit)}/unit
                              </p>
                              <p className="text-xs text-slate-400 italic">
                                (Fabric + Accessories)
                              </p>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <OrderItemDetailDialog
                              orderItem={{
                                id: item.id,
                                quantity: item.quantityOrdered,
                                estimatedMeters: item.estimatedMeters,
                                actualMetersUsed: item.actualMetersUsed || undefined,
                                bodyType: item.bodyType,
                                garmentPattern: {
                                  id: item.garmentPattern.id,
                                  name: item.garmentPattern.name,
                                  description: item.garmentPattern.description || undefined,
                                },
                                clothInventory: {
                                  ...item.clothInventory,
                                  // Never serialize fabric cost to roles without inventory pricing
                                  pricePerMeter: showInventoryPricing ? item.clothInventory.pricePerMeter : 0,
                                  location: item.clothInventory.location || undefined,
                                },
                                measurement: item.measurement ? {
                                  id: item.measurement.id,
                                  garmentType: item.measurement.garmentType,
                                  bodyType: item.measurement.bodyType || undefined,
                                  neck: item.measurement.neck || undefined,
                                  chest: item.measurement.chest || undefined,
                                  waist: item.measurement.waist || undefined,
                                  hip: item.measurement.hip || undefined,
                                  shoulder: item.measurement.shoulder || undefined,
                                  sleeveLength: item.measurement.sleeveLength || undefined,
                                  shirtLength: item.measurement.shirtLength || undefined,
                                  inseam: item.measurement.inseam || undefined,
                                  outseam: item.measurement.outseam || undefined,
                                  thigh: item.measurement.thigh || undefined,
                                  knee: item.measurement.knee || undefined,
                                  bottomOpening: item.measurement.bottomOpening || undefined,
                                  jacketLength: item.measurement.jacketLength || undefined,
                                  lapelWidth: item.measurement.lapelWidth || undefined,
                                  createdBy: item.measurement.createdBy ? {
                                    name: item.measurement.createdBy.name,
                                  } : undefined,
                                } : undefined,
                                order: {
                                  id: order.id,
                                  orderNumber: order.orderNumber,
                                  deliveryDate: order.deliveryDate.toISOString(),
                                  createdAt: order.createdAt.toISOString(),
                                  status: order.status,
                                  notes: order.notes || undefined,
                                  customer: {
                                    id: order.customer.id,
                                    name: order.customer.name,
                                  },
                                  history: history.map((h: OrderHistoryEntry) => ({
                                    id: h.id,
                                    changeType: h.changeType,
                                    oldValue: h.oldValue || undefined,
                                    newValue: h.newValue || undefined,
                                    description: h.description,
                                    createdAt: h.createdAt.toISOString(),
                                    user: {
                                      name: h.user.name,
                                    },
                                  })),
                                },
                              }}
                            />
                            {canEditOrder && !isClosed && (
                              <OrderItemEdit
                                orderId={order.id}
                                itemId={item.id}
                                currentGarmentPatternId={item.garmentPattern.id}
                                currentClothInventoryId={item.clothInventory.id}
                                currentGarmentName={item.garmentPattern.name}
                                currentClothName={`${item.clothInventory.name} (${item.clothInventory.color})`}
                                currentPrice={showItemPricing ? item.totalPrice : 0}
                                currentPricePerUnit={showItemPricing ? item.pricePerUnit : 0}
                                showPricing={showItemPricing}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500">Quantity</p>
                          <p className="font-medium text-slate-900">{item.quantityOrdered}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Estimated Fabric</p>
                          <p className="font-medium text-slate-900">{item.estimatedMeters.toFixed(2)}m</p>
                        </div>
                        {item.actualMetersUsed && (
                          <div>
                            <p className="text-slate-500">Actual Used</p>
                            <p className="font-medium text-slate-900">{item.actualMetersUsed.toFixed(2)}m</p>
                          </div>
                        )}
                      </div>

                      {/* Assigned Tailor */}
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900 mb-1">Assigned Tailor</p>
                            {item.assignedTailor ? (
                              <div className="flex items-center gap-2 text-sm text-slate-700">
                                <User className="h-4 w-4 text-primary" />
                                <span>{item.assignedTailor.name}</span>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">Not assigned yet</p>
                            )}
                          </div>
                          {canAssignTailors && !isClosed && (
                            <AssignTailorDialog
                              orderId={order.id}
                              itemId={item.id}
                              currentTailorId={item.assignedTailor?.id}
                              currentTailorName={item.assignedTailor?.name}
                              garmentName={item.garmentPattern.name}
                            />
                          )}
                        </div>
                      </div>
                      {item.notes && (
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <p className="text-sm text-slate-600">{item.notes}</p>
                        </div>
                      )}

                      {/* Measurement Information — collapsible panel; always shown (warns if missing) */}
                      <OrderItemMeasurements
                        measurement={item.measurement}
                        garmentType={item.garmentPattern.name}
                        defaultExpanded={!canEditOrder}
                      />
                      {canManageMeasurements && (
                        <div className="mt-1 flex justify-end">
                          {item.measurement ? (
                            <EditMeasurementDialog
                              customerId={order.customer.id}
                              measurement={item.measurement}
                              triggerButton={
                                <Button variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-slate-700">
                                  <Ruler className="h-3 w-3 mr-1" />
                                  Edit measurements
                                </Button>
                              }
                            />
                          ) : (
                            <AddOrderItemMeasurementDialog
                              orderId={order.id}
                              orderItemId={item.id}
                              customerId={order.customer.id}
                              garmentType={item.garmentPattern.name}
                              triggerButton={
                                <Button variant="ghost" size="sm" className="text-xs text-red-600 hover:text-red-700">
                                  <Ruler className="h-3 w-3 mr-1" />
                                  Manage measurements
                                </Button>
                              }
                            />
                          )}
                        </div>
                      )}
                    </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-500">Name</p>
                  <p className="font-semibold text-slate-900 flex items-center gap-2">
                    {order.customer.name}
                    {order.customer.customerType === 'B2B' && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 bg-amber-50">B2B</Badge>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="h-4 w-4" />
                  <span><PhoneText value={order.customer.phone} /></span>
                </div>
                {order.customer.email && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Mail className="h-4 w-4" />
                    <span>{order.customer.email}</span>
                  </div>
                )}
                {order.customer.address && (
                  <div>
                    <p className="text-sm text-slate-500">Address</p>
                    <p className="text-slate-700">{order.customer.address}</p>
                    {order.customer.city && (
                      <p className="text-slate-700">{order.customer.city}</p>
                    )}
                  </div>
                )}
                <div className="pt-3 border-t space-y-2">
                  <Link href={`/customers/${order.customer.id}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      View Customer Profile
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Summary & Dates */}
        <div className="space-y-6">
          {/* Payment Summary - only for roles with order financial visibility */}
          {showOrderFinancials && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Payment Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Amount:</span>
                  <span className="font-semibold text-slate-900">
                    <Money amount={order.totalAmount} align="end" />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Advance Paid:</span>
                  <span className="font-semibold text-green-600">
                    <Money amount={order.advancePaid} align="end" />
                  </span>
                </div>
                {balancePayments > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Balance Paid:</span>
                    <span className="font-semibold text-green-600">
                      <Money amount={balancePayments} align="end" />
                    </span>
                  </div>
                )}
                {order.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Discount:</span>
                    <span className="font-semibold text-yellow-600">
                      <Money amount={order.discount} align="end" />
                    </span>
                  </div>
                )}
                {order.discountReason && (
                  <div className="bg-yellow-50 p-2 rounded text-xs">
                    <p className="text-yellow-800">
                      <strong>Discount Reason:</strong> {order.discountReason}
                    </p>
                  </div>
                )}
                <div className="flex justify-between pt-3 border-t">
                  <span className="text-slate-600">Balance Due:</span>
                  <span className={`font-semibold text-lg ${
                    isArrears ? 'text-red-600' : (order.balanceAmount > 0.01 ? 'text-orange-600' : 'text-green-600')
                  }`}>
                    <Money amount={Math.max(0, order.balanceAmount)} align="end" />
                    {isArrears && (
                      <span className="text-xs ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded">ARREARS</span>
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Important Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Important Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-slate-500">Order Date</p>
                <p className="font-medium text-slate-900">
                  {formatDate(order.createdAt, 'medium')}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Delivery Date</p>
                <p className={`font-medium ${isOverdue ? 'text-red-600' : 'text-slate-900'}`}>
                  {formatDate(deliveryDate, 'medium')}
                  {isOverdue && ' (Overdue)'}
                </p>
              </div>
              {order.completedDate && (
                <div>
                  <p className="text-sm text-slate-500">Completed On</p>
                  <p className="font-medium text-green-600">
                    {formatDate(order.completedDate, 'medium')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700">{order.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <OrderActions
                orderId={order.id}
                currentStatus={order.status}
                deliveryDate={order.deliveryDate.toISOString()}
                advancePaid={showOrderFinancials ? order.advancePaid : 0}
                discount={showOrderFinancials ? order.discount || 0 : 0}
                discountReason={showOrderFinancials ? order.discountReason : null}
                notes={order.notes}
                priority={order.priority}
                totalAmount={showOrderFinancials ? order.totalAmount : 0}
                balanceAmount={showOrderFinancials ? order.balanceAmount : 0}
                canUpdateStatus={canUpdateStatus}
                itemProgress={progress}
                canBulkMove={canBulkMove}
                canEditOrder={canEditOrder}
                canRecordPayment={canRecordPayment && showOrderFinancials}
                showFinancials={showOrderFinancials}
                isDelivered={isClosed}
              />
              {canEditOrder && order.items.length > 1 && !isClosed && (
                <SplitOrderDialog
                  orderId={order.id}
                  orderNumber={order.orderNumber}
                  items={order.items.map((item: OrderItem) => ({
                    id: item.id,
                    garmentPattern: {
                      name: item.garmentPattern.name
                    },
                    clothInventory: {
                      name: item.clothInventory.name,
                      color: item.clothInventory.color
                    },
                    quantityOrdered: item.quantityOrdered,
                    estimatedMeters: item.estimatedMeters,
                    totalPrice: showOrderFinancials ? item.totalPrice : 0
                  }))}
                  currentDeliveryDate={order.deliveryDate}
                  orderSubTotal={showOrderFinancials ? order.subTotal : 0}
                  taxRate={showOrderFinancials ? order.gstRate : 0}
                  showPricing={showOrderFinancials}
                />
              )}
              {canRecordPayment && showOrderFinancials && order.balanceAmount > 0.01 && order.status !== 'CANCELLED' && (
                <RecordPaymentDialog
                  orderId={order.id}
                  orderNumber={order.orderNumber}
                  balanceAmount={order.balanceAmount}
                />
              )}
              {showOrderFinancials && (
                <PrintInvoiceButton
                  order={{
                    orderNumber: order.orderNumber,
                    orderDate: order.createdAt,
                    deliveryDate: order.deliveryDate,
                    status: order.status,
                    customer: order.customer,
                    items: order.items,
                    paymentInstallments: order.installments,
                    subTotal: order.subTotal,
                    gstRate: order.gstRate,
                    cgst: order.cgst,
                    sgst: order.sgst,
                    igst: order.igst,
                    gstAmount: order.gstAmount,
                    totalAmount: order.totalAmount,
                    advancePaid: order.advancePaid,
                    discount: order.discount || 0,
                    balanceAmount: order.balanceAmount,
                    notes: order.notes,
                  }}
                />
              )}
              {canMessageCustomer && (
                <SendWhatsAppButton
                  orderId={order.id}
                  orderNumber={order.orderNumber}
                  customerPhone={order.customer.phone}
                  customerName={order.customer.name}
                  orderStatus={order.status}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Installments - financial roles only */}
      {showPayments && order.installments.length > 0 && (
        <div className="mt-6">
          <PaymentInstallments orderId={order.id} balanceAmount={order.balanceAmount} />
        </div>
      )}

      {/* Order History */}
      {history.length > 0 && (
        <div className="mt-6">
          <OrderHistory history={history} />
        </div>
      )}
    </DashboardLayout>
  )
}
