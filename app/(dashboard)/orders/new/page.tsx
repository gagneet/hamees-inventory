'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Home, ArrowLeft, Plus, Trash2, AlertCircle, User, Package, Calendar, DollarSign } from 'lucide-react'

type Customer = {
  id: string
  name: string
  phone: string
  email?: string
}

type GarmentPattern = {
  id: string
  name: string
  description?: string
  baseMeters: number
  slimAdjustment: number
  regularAdjustment: number
  largeAdjustment: number
  xlAdjustment: number
  accessories?: Array<{
    id: string
    quantity: number
    accessory: {
      id: string
      name: string
      type: string
      color?: string
      pricePerUnit: number
    }
  }>
}

type ClothInventory = {
  id: string
  name: string
  sku: string
  type: string
  color: string
  colorHex: string
  brand: string
  currentStock: number
  reserved: number
  pricePerMeter: number
}

type Accessory = {
  id: string
  name: string
  type: string
  color?: string
  pricePerUnit: number
  currentStock: number
}

type OrderItemAccessory = {
  accessoryId: string
  quantity: number
}

type OrderItem = {
  garmentPatternId: string
  clothInventoryId: string
  quantity: number
  bodyType: 'SLIM' | 'REGULAR' | 'LARGE' | 'XL'
  accessories: OrderItemAccessory[]
}

function NewOrderForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedCustomerId = searchParams.get('customerId')

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form data
  const [customerId, setCustomerId] = useState(preselectedCustomerId || '')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [advancePaid, setAdvancePaid] = useState(0)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<OrderItem[]>([])

  // Available data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [garmentPatterns, setGarmentPatterns] = useState<GarmentPattern[]>([])
  const [clothInventory, setClothInventory] = useState<ClothInventory[]>([])
  const [accessories, setAccessories] = useState<Accessory[]>([])

  // Load initial data
  useEffect(() => {
    loadCustomers()
    loadGarmentPatterns()
    loadClothInventory()
    loadAccessories()
  }, [])

  const loadCustomers = async () => {
    try {
      const res = await fetch('/api/customers', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setCustomers(data.customers || [])
      } else {
        console.error('Failed to load customers:', await res.text())
        setCustomers([])
      }
    } catch (err) {
      console.error('Failed to load customers:', err)
      setCustomers([])
    }
  }

  const loadGarmentPatterns = async () => {
    try {
      const res = await fetch('/api/garment-patterns', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setGarmentPatterns(data.patterns || [])
      } else {
        console.error('Failed to load garment patterns:', await res.text())
        setGarmentPatterns([])
      }
    } catch (err) {
      console.error('Failed to load garment patterns:', err)
      setGarmentPatterns([])
    }
  }

  const loadClothInventory = async () => {
    try {
      const res = await fetch('/api/inventory/cloth', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setClothInventory(data.clothInventory || [])
      } else {
        console.error('Failed to load cloth inventory:', await res.text())
        setClothInventory([])
      }
    } catch (err) {
      console.error('Failed to load cloth inventory:', err)
      setClothInventory([])
    }
  }

  const loadAccessories = async () => {
    try {
      const res = await fetch('/api/inventory/accessories', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setAccessories(data.accessories || [])
      } else {
        console.error('Failed to load accessories:', await res.text())
        setAccessories([])
      }
    } catch (err) {
      console.error('Failed to load accessories:', err)
      setAccessories([])
    }
  }

  const addItem = () => {
    setItems([...items, {
      garmentPatternId: '',
      clothInventoryId: '',
      quantity: 1,
      bodyType: 'REGULAR',
      accessories: [],
    }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...items]
    if (field === 'garmentPatternId' && value !== newItems[index].garmentPatternId) {
      // When garment pattern changes, initialize accessories from pattern
      const pattern = garmentPatterns.find(p => p.id === value)
      const defaultAccessories = pattern?.accessories?.map(ga => ({
        accessoryId: ga.accessory.id,
        quantity: ga.quantity,
      })) || []
      newItems[index] = { ...newItems[index], [field]: value, accessories: defaultAccessories }
    } else {
      newItems[index] = { ...newItems[index], [field]: value }
    }
    setItems(newItems)
  }

  const addAccessoryToItem = (itemIndex: number, accessoryId: string) => {
    const newItems = [...items]
    const existingAcc = newItems[itemIndex].accessories.find(a => a.accessoryId === accessoryId)
    if (!existingAcc) {
      newItems[itemIndex].accessories = [
        ...newItems[itemIndex].accessories,
        { accessoryId, quantity: 1 }
      ]
      setItems(newItems)
    }
  }

  const removeAccessoryFromItem = (itemIndex: number, accessoryId: string) => {
    const newItems = [...items]
    newItems[itemIndex].accessories = newItems[itemIndex].accessories.filter(
      a => a.accessoryId !== accessoryId
    )
    setItems(newItems)
  }

  const updateAccessoryQuantity = (itemIndex: number, accessoryId: string, quantity: number) => {
    const newItems = [...items]
    const acc = newItems[itemIndex].accessories.find(a => a.accessoryId === accessoryId)
    if (acc) {
      acc.quantity = Math.max(1, quantity)
      setItems(newItems)
    }
  }

  const calculateEstimate = () => {
    if (!garmentPatterns || !clothInventory || !items || !accessories) {
      return 0
    }

    let total = 0
    for (const item of items) {
      const pattern = garmentPatterns.find(p => p.id === item.garmentPatternId)
      const cloth = clothInventory.find(c => c.id === item.clothInventoryId)

      if (pattern && cloth) {
        let adjustment = pattern.regularAdjustment
        if (item.bodyType === 'SLIM') adjustment = pattern.slimAdjustment
        if (item.bodyType === 'LARGE') adjustment = pattern.largeAdjustment
        if (item.bodyType === 'XL') adjustment = pattern.xlAdjustment

        const meters = (pattern.baseMeters + adjustment) * item.quantity
        total += meters * cloth.pricePerMeter

        // Add accessory costs from item's accessories
        if (item.accessories && item.accessories.length > 0) {
          for (const itemAcc of item.accessories) {
            const accessory = accessories.find(a => a.id === itemAcc.accessoryId)
            if (accessory) {
              const accessoryTotal = itemAcc.quantity * item.quantity * accessory.pricePerUnit
              total += accessoryTotal
            }
          }
        }
      }
    }
    // Add stitching charges
    const stitchingCharges = items.length * 1500
    return total + stitchingCharges
  }

  const handleSubmit = async () => {
    setError('')
    setLoading(true)

    try {
      // Minimal validation - only check for customer
      if (!customerId) {
        setError('Please select a customer')
        setLoading(false)
        return
      }

      if (items.length === 0) {
        setError('Please add at least one item')
        setLoading(false)
        return
      }

      // Set default delivery date if not provided (7 days from now)
      const finalDeliveryDate = deliveryDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      // Filter out incomplete items
      const validItems = items.filter(item => item.garmentPatternId && item.clothInventoryId)

      if (validItems.length === 0) {
        setError('Please complete at least one order item with both garment type and fabric selected')
        setLoading(false)
        return
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          deliveryDate: finalDeliveryDate,
          advancePaid: advancePaid || 0,
          notes: notes || '',
          items: validItems,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create order')
        setLoading(false)
        return
      }

      // Success - redirect to order detail
      router.push(`/orders/${data.order.id}`)
    } catch (err) {
      setError('An error occurred while creating the order')
      setLoading(false)
    }
  }

  const selectedCustomer = customers?.find(c => c.id === customerId)
  const estimatedTotal = calculateEstimate()
  const balanceAmount = estimatedTotal - advancePaid

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
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
              <BreadcrumbPage>New Order</BreadcrumbPage>
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
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">Create New Order</h1>
              <p className="text-xs md:text-sm text-slate-600">Add customer details and order items</p>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`flex items-center justify-center h-8 w-8 rounded-full ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                <User className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">Customer</span>
            </div>
            <div className={`flex-1 h-1 mx-2 ${step >= 2 ? 'bg-blue-600' : 'bg-slate-300'}`}></div>
            <div className="flex items-center gap-2">
              <div className={`flex items-center justify-center h-8 w-8 rounded-full ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                <Package className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">Items</span>
            </div>
            <div className={`flex-1 h-1 mx-2 ${step >= 3 ? 'bg-blue-600' : 'bg-slate-300'}`}></div>
            <div className="flex items-center gap-2">
              <div className={`flex items-center justify-center h-8 w-8 rounded-full ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                <DollarSign className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">Details</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Step 1: Customer Selection */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Select Customer</CardTitle>
              <CardDescription>Choose the customer for this order</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Customer
                  </label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} - {customer.phone}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCustomer && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="font-semibold text-slate-900">{selectedCustomer.name}</p>
                    <p className="text-sm text-slate-600">{selectedCustomer.phone}</p>
                    {selectedCustomer.email && (
                      <p className="text-sm text-slate-600">{selectedCustomer.email}</p>
                    )}
                  </div>
                )}

                <div className="flex justify-between pt-4">
                  <Link href="/customers/new">
                    <Button variant="outline" type="button">
                      Add New Customer
                    </Button>
                  </Link>
                  <Button
                    onClick={() => setStep(2)}
                    disabled={!customerId}
                  >
                    Next: Add Items
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Order Items */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
              <CardDescription>Add garments and fabric for this order</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="p-4 border border-slate-300 rounded-lg">
                    <div className="flex items-start justify-between mb-4">
                      <h4 className="font-semibold text-slate-900">Item {index + 1}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Garment Type
                        </label>
                        <select
                          value={item.garmentPatternId}
                          onChange={(e) => updateItem(index, 'garmentPatternId', e.target.value)}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select garment</option>
                          {garmentPatterns.map((pattern) => (
                            <option key={pattern.id} value={pattern.id}>
                              {pattern.name} ({pattern.baseMeters}m base)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Fabric
                        </label>
                        <select
                          value={item.clothInventoryId}
                          onChange={(e) => updateItem(index, 'clothInventoryId', e.target.value)}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select fabric</option>
                          {clothInventory.map((cloth) => (
                            <option key={cloth.id} value={cloth.id}>
                              {cloth.name} - {cloth.color} (₹{cloth.pricePerMeter.toFixed(2)}/m, Available: {cloth.currentStock - cloth.reserved}m)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Accessories Section */}
                      {item.garmentPatternId && (
                        <div className="md:col-span-2">
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-slate-700">
                              Accessories
                            </label>
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  addAccessoryToItem(index, e.target.value)
                                  e.target.value = ''
                                }
                              }}
                              className="text-xs px-3 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">+ Add Accessory</option>
                              {accessories
                                .filter(acc => !item.accessories.find(ia => ia.accessoryId === acc.id))
                                .map((acc) => (
                                  <option key={acc.id} value={acc.id}>
                                    {acc.name} ({acc.type}) - ₹{acc.pricePerUnit.toFixed(2)}/unit
                                  </option>
                                ))}
                            </select>
                          </div>

                          {item.accessories.length > 0 ? (
                            <div className="space-y-2">
                              {item.accessories.map((itemAcc) => {
                                const accessory = accessories.find(a => a.id === itemAcc.accessoryId)
                                if (!accessory) return null
                                return (
                                  <div
                                    key={itemAcc.accessoryId}
                                    className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg"
                                  >
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-slate-900">
                                        {accessory.name}
                                        {accessory.color && ` - ${accessory.color}`}
                                      </p>
                                      <p className="text-xs text-slate-600">
                                        {accessory.type} • ₹{accessory.pricePerUnit.toFixed(2)}/unit • Stock: {accessory.currentStock}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="tel"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        min="1"
                                        value={itemAcc.quantity}
                                        onChange={(e) => {
                                          const val = e.target.value.replace(/[^0-9]/g, '')
                                          updateAccessoryQuantity(index, itemAcc.accessoryId, parseInt(val) || 1)
                                        }}
                                        className="w-16 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                      <span className="text-xs text-slate-600">
                                        × {item.quantity} = {itemAcc.quantity * item.quantity}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeAccessoryFromItem(index, itemAcc.accessoryId)}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Trash2 className="h-4 w-4 text-red-600" />
                                      </Button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center text-sm text-slate-500">
                              No accessories added. Use the dropdown above to add accessories.
                            </div>
                          )}
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Body Type
                        </label>
                        <select
                          value={item.bodyType}
                          onChange={(e) => updateItem(index, 'bodyType', e.target.value as any)}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="SLIM">Slim</option>
                          <option value="REGULAR">Regular</option>
                          <option value="LARGE">Large</option>
                          <option value="XL">XL</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Quantity
                        </label>
                        <input
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '')
                            updateItem(index, 'quantity', parseInt(val) || 1)
                          }}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  variant="outline"
                  onClick={addItem}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>

                <div className="flex justify-between pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    disabled={items.length === 0}
                  >
                    Next: Order Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Order Details */}
        {step === 3 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Details</CardTitle>
                <CardDescription>Set delivery date and payment information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Delivery Date
                    </label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Advance Payment
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={advancePaid}
                      onChange={(e) => setAdvancePaid(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Any special instructions or notes..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Customer:</span>
                    <span className="font-semibold text-slate-900">{selectedCustomer?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Items:</span>
                    <span className="font-semibold text-slate-900">{items.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Estimated Total:</span>
                    <span className="font-semibold text-slate-900">₹{estimatedTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Advance Paid:</span>
                    <span className="font-semibold text-green-600">₹{advancePaid.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between pt-3 border-t">
                    <span className="text-slate-600">Balance Amount:</span>
                    <span className="font-semibold text-lg text-orange-600">
                      ₹{balanceAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between pt-6">
                  <Button
                    variant="outline"
                    onClick={() => setStep(2)}
                    disabled={loading}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={loading}
                  >
                    {loading ? 'Creating Order...' : 'Create Order'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    }>
      <NewOrderForm />
    </Suspense>
  )
}
