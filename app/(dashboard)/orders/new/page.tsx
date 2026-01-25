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
  basicStitchingCharge: number
  premiumStitchingCharge: number
  luxuryStitchingCharge: number
  accessories?: Array<{
    id: string
    quantityPerGarment: number
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
  quantityOrdered: number
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

  // Premium Pricing Configuration
  const [stitchingTier, setStitchingTier] = useState<'BASIC' | 'PREMIUM' | 'LUXURY'>('BASIC')
  const [fabricWastagePercent, setFabricWastagePercent] = useState(0)
  const [designerConsultationFee, setDesignerConsultationFee] = useState(0)

  // Workmanship Premiums
  const [isHandStitched, setIsHandStitched] = useState(false)
  const [isFullCanvas, setIsFullCanvas] = useState(false)
  const [isRushOrder, setIsRushOrder] = useState(false)
  const [hasComplexDesign, setHasComplexDesign] = useState(false)
  const [additionalFittings, setAdditionalFittings] = useState(0)
  const [hasPremiumLining, setHasPremiumLining] = useState(false)

  // Manual Overrides
  const [isFabricCostOverridden, setIsFabricCostOverridden] = useState(false)
  const [fabricCostOverride, setFabricCostOverride] = useState<number | null>(null)
  const [fabricCostOverrideReason, setFabricCostOverrideReason] = useState('')

  const [isStitchingCostOverridden, setIsStitchingCostOverridden] = useState(false)
  const [stitchingCostOverride, setStitchingCostOverride] = useState<number | null>(null)
  const [stitchingCostOverrideReason, setStitchingCostOverrideReason] = useState('')

  const [isAccessoriesCostOverridden, setIsAccessoriesCostOverridden] = useState(false)
  const [accessoriesCostOverride, setAccessoriesCostOverride] = useState<number | null>(null)
  const [accessoriesCostOverrideReason, setAccessoriesCostOverrideReason] = useState('')

  const [pricingNotes, setPricingNotes] = useState('')

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
      quantityOrdered: 1, // Always 1 - use duplicate button for multiple identical items
      bodyType: 'REGULAR',
      accessories: [],
    }])
  }

  const duplicateItem = (index: number) => {
    const itemToDuplicate = items[index]
    // Create a deep copy of the item
    const duplicatedItem = {
      ...itemToDuplicate,
      accessories: itemToDuplicate.accessories.map(acc => ({ ...acc })),
    }
    // Insert the duplicate right after the original
    const newItems = [...items]
    newItems.splice(index + 1, 0, duplicatedItem)
    setItems(newItems)
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
        quantity: ga.quantityPerGarment,
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
      return {
        fabricCost: 0,
        fabricWastageAmount: 0,
        accessoriesCost: 0,
        stitchingCost: 0,
        workmanshipPremiums: 0,
        subTotal: 0,
        gstAmount: 0,
        total: 0,
        cgst: 0,
        sgst: 0,
        gstRate: 0
      }
    }

    // Calculate itemized costs
    let fabricCost = 0
    let accessoriesCost = 0
    let stitchingCost = 0

    for (const item of items) {
      const pattern = garmentPatterns.find(p => p.id === item.garmentPatternId)
      const cloth = clothInventory.find(c => c.id === item.clothInventoryId)

      if (pattern && cloth) {
        // Fabric cost
        let adjustment = pattern.regularAdjustment
        if (item.bodyType === 'SLIM') adjustment = pattern.slimAdjustment
        if (item.bodyType === 'LARGE') adjustment = pattern.largeAdjustment
        if (item.bodyType === 'XL') adjustment = pattern.xlAdjustment

        const meters = (pattern.baseMeters + adjustment) * item.quantityOrdered
        fabricCost += parseFloat((meters * cloth.pricePerMeter).toFixed(2))

        // Accessories cost (quantityOrdered is always 1, so just multiply by accessory quantity)
        if (item.accessories && item.accessories.length > 0) {
          for (const itemAcc of item.accessories) {
            const accessory = accessories.find(a => a.id === itemAcc.accessoryId)
            if (accessory) {
              const accessoryTotal = itemAcc.quantity * accessory.pricePerUnit
              accessoriesCost += parseFloat(accessoryTotal.toFixed(2))
            }
          }
        }

        // Stitching cost based on tier
        let tierCharge = pattern.basicStitchingCharge
        if (stitchingTier === 'PREMIUM') {
          tierCharge = pattern.premiumStitchingCharge
        } else if (stitchingTier === 'LUXURY') {
          tierCharge = pattern.luxuryStitchingCharge
        }
        stitchingCost += tierCharge * item.quantityOrdered
      }
    }

    // Apply manual overrides BEFORE calculating wastage
    const finalFabricCost = isFabricCostOverridden && fabricCostOverride != null ? fabricCostOverride : fabricCost
    const finalAccessoriesCost = isAccessoriesCostOverridden && accessoriesCostOverride != null ? accessoriesCostOverride : accessoriesCost
    let finalStitchingCost = isStitchingCostOverridden && stitchingCostOverride != null ? stitchingCostOverride : stitchingCost

    // Apply fabric wastage (on final fabric cost, whether calculated or overridden)
    const fabricWastageAmount = parseFloat((finalFabricCost * (fabricWastagePercent / 100)).toFixed(2))

    // Calculate workmanship premiums (based on final stitching cost)
    let workmanshipPremiums = 0
    let handStitchingCost = 0
    let fullCanvasCost = 0
    let rushOrderCost = 0
    let complexDesignCost = 0
    let additionalFittingsCost = 0
    let premiumLiningCost = 0

    if (isHandStitched) {
      handStitchingCost = parseFloat((finalStitchingCost * 0.40).toFixed(2)) // +40%
      workmanshipPremiums += handStitchingCost
    }

    if (isFullCanvas) {
      fullCanvasCost = 5000 // Fixed premium
      workmanshipPremiums += fullCanvasCost
    }

    if (isRushOrder) {
      rushOrderCost = parseFloat((finalStitchingCost * 0.50).toFixed(2)) // +50%
      workmanshipPremiums += rushOrderCost
    }

    if (hasComplexDesign) {
      complexDesignCost = parseFloat((finalStitchingCost * 0.30).toFixed(2)) // +30%
      workmanshipPremiums += complexDesignCost
    }

    if (additionalFittings > 0) {
      additionalFittingsCost = additionalFittings * 1500
      workmanshipPremiums += additionalFittingsCost
    }

    if (hasPremiumLining) {
      premiumLiningCost = 5000
      workmanshipPremiums += premiumLiningCost
    }

    // Calculate subtotal using final (possibly overridden) values
    const subTotal = parseFloat((
      finalFabricCost +
      fabricWastageAmount +
      finalAccessoriesCost +
      finalStitchingCost +
      workmanshipPremiums +
      designerConsultationFee
    ).toFixed(2))

    // Calculate GST (12% for garments - split into CGST 6% + SGST 6%)
    const gstRate = 12
    const gstAmount = parseFloat(((subTotal * gstRate) / 100).toFixed(2))
    const cgst = parseFloat((gstAmount / 2).toFixed(2))
    const sgst = parseFloat((gstAmount / 2).toFixed(2))
    const total = parseFloat((subTotal + gstAmount).toFixed(2))

    return {
      // Calculated values (for reference/display)
      calculatedFabricCost: fabricCost,
      calculatedAccessoriesCost: accessoriesCost,
      calculatedStitchingCost: stitchingCost,

      // Final values (possibly overridden)
      fabricCost: finalFabricCost,
      fabricWastageAmount,
      accessoriesCost: finalAccessoriesCost,
      stitchingCost: finalStitchingCost,
      workmanshipPremiums,
      designerFee: designerConsultationFee,
      subTotal,
      gstAmount,
      total,
      cgst,
      sgst,
      gstRate
    }
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

      // Validate override reasons
      if (isFabricCostOverridden && (!fabricCostOverride || !fabricCostOverrideReason.trim())) {
        setError('Please provide both override amount and reason for Fabric Cost override')
        setLoading(false)
        return
      }

      if (isStitchingCostOverridden && (!stitchingCostOverride || !stitchingCostOverrideReason.trim())) {
        setError('Please provide both override amount and reason for Stitching Cost override')
        setLoading(false)
        return
      }

      if (isAccessoriesCostOverridden && (!accessoriesCostOverride || !accessoriesCostOverrideReason.trim())) {
        setError('Please provide both override amount and reason for Accessories Cost override')
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
          // Premium Pricing Configuration
          stitchingTier,
          fabricWastagePercent,
          designerConsultationFee,
          // Workmanship Premiums
          isHandStitched,
          isFullCanvas,
          isRushOrder,
          hasComplexDesign,
          additionalFittings,
          hasPremiumLining,
          // Manual Overrides
          isFabricCostOverridden,
          fabricCostOverride,
          fabricCostOverrideReason,
          isStitchingCostOverridden,
          stitchingCostOverride,
          stitchingCostOverrideReason,
          isAccessoriesCostOverridden,
          accessoriesCostOverride,
          accessoriesCostOverrideReason,
          pricingNotes,
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
  const {
    calculatedFabricCost,
    calculatedAccessoriesCost,
    calculatedStitchingCost,
    fabricCost,
    fabricWastageAmount,
    accessoriesCost,
    stitchingCost,
    workmanshipPremiums,
    designerFee,
    subTotal,
    gstAmount,
    total,
    cgst,
    sgst,
    gstRate
  } = calculateEstimate()
  const balanceAmount = total - advancePaid

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
                                        units
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
                        <div className="flex items-center gap-3">
                          <div className="px-4 py-2 border-2 border-slate-300 rounded-lg bg-slate-50 text-slate-600 font-semibold">
                            1 unit
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => duplicateItem(index)}
                            className="flex items-center gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            Duplicate Item
                          </Button>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Need multiple identical items? Click "Duplicate Item" to create separate entries.
                        </p>
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
                      max={total}
                      step="0.01"
                      value={advancePaid}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0
                        if (value > total) {
                          alert(`Advance payment cannot exceed total order amount of ₹${total.toFixed(2)}`)
                          setAdvancePaid(total)
                        } else {
                          setAdvancePaid(value)
                        }
                      }}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Maximum: ₹{total.toFixed(2)}
                    </p>
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

            {/* Premium Pricing Configuration */}
            <Card className="border-2 border-orange-200 bg-orange-50/30">
              <CardHeader>
                <CardTitle className="text-orange-900">Premium Pricing Configuration</CardTitle>
                <CardDescription>Select stitching quality tier and workmanship premiums</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Stitching Tier Selector */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Stitching Quality Tier
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div
                      onClick={() => setStitchingTier('BASIC')}
                      className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                        stitchingTier === 'BASIC'
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-slate-300 bg-white hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-slate-900">BASIC</span>
                        <input
                          type="radio"
                          checked={stitchingTier === 'BASIC'}
                          onChange={() => setStitchingTier('BASIC')}
                          className="h-4 w-4"
                        />
                      </div>
                      <p className="text-sm text-slate-600">Entry-level bespoke quality</p>
                      <p className="text-xs text-slate-500 mt-2">₹2K-₹12K per garment</p>
                    </div>

                    <div
                      onClick={() => setStitchingTier('PREMIUM')}
                      className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                        stitchingTier === 'PREMIUM'
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-slate-300 bg-white hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-slate-900">PREMIUM</span>
                        <input
                          type="radio"
                          checked={stitchingTier === 'PREMIUM'}
                          onChange={() => setStitchingTier('PREMIUM')}
                          className="h-4 w-4"
                        />
                      </div>
                      <p className="text-sm text-slate-600">Mid-range quality</p>
                      <p className="text-xs text-slate-500 mt-2">₹3K-₹18K per garment</p>
                    </div>

                    <div
                      onClick={() => setStitchingTier('LUXURY')}
                      className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                        stitchingTier === 'LUXURY'
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-slate-300 bg-white hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-slate-900">LUXURY</span>
                        <input
                          type="radio"
                          checked={stitchingTier === 'LUXURY'}
                          onChange={() => setStitchingTier('LUXURY')}
                          className="h-4 w-4"
                        />
                      </div>
                      <p className="text-sm text-slate-600">High-end bespoke quality</p>
                      <p className="text-xs text-slate-500 mt-2">₹4K-₹25K per garment</p>
                    </div>
                  </div>
                </div>

                {/* Workmanship Premiums */}
                <div className="border-t pt-6">
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Workmanship Premiums
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-start space-x-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={isHandStitched}
                        onChange={(e) => setIsHandStitched(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-slate-900 group-hover:text-blue-600">Hand Stitching</span>
                        <p className="text-sm text-slate-600">20-50 hours artisan work (+40% of stitching cost)</p>
                      </div>
                    </label>

                    <label className="flex items-start space-x-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={isFullCanvas}
                        onChange={(e) => setIsFullCanvas(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-slate-900 group-hover:text-blue-600">Full Canvas Construction</span>
                        <p className="text-sm text-slate-600">Superior drape, 6 weeks crafting (+₹5,000)</p>
                      </div>
                    </label>

                    <label className="flex items-start space-x-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={isRushOrder}
                        onChange={(e) => setIsRushOrder(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-slate-900 group-hover:text-blue-600">Rush Order</span>
                        <p className="text-sm text-slate-600">&lt;7 days delivery, priority scheduling (+50% of stitching cost)</p>
                      </div>
                    </label>

                    <label className="flex items-start space-x-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={hasComplexDesign}
                        onChange={(e) => setHasComplexDesign(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-slate-900 group-hover:text-blue-600">Complex Design</span>
                        <p className="text-sm text-slate-600">Peak lapels, working buttonholes, special vents (+30% of stitching cost)</p>
                      </div>
                    </label>

                    <div className="flex items-start space-x-3">
                      <div className="flex-1">
                        <label className="block font-medium text-slate-900 mb-2">Additional Fittings</label>
                        <p className="text-sm text-slate-600 mb-2">Beyond standard 2 fittings (+₹1,500 per fitting)</p>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={additionalFittings}
                          onChange={(e) => setAdditionalFittings(parseInt(e.target.value) || 0)}
                          className="w-32 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <label className="flex items-start space-x-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={hasPremiumLining}
                        onChange={(e) => setHasPremiumLining(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-slate-900 group-hover:text-blue-600">Premium Lining</span>
                        <p className="text-sm text-slate-600">Silk lining, custom monograms (+₹5,000)</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Fabric Wastage */}
                <div className="border-t pt-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Fabric Wastage: {fabricWastagePercent}% {fabricWastageAmount > 0 && `(+₹${fabricWastageAmount.toLocaleString('en-IN', {minimumFractionDigits: 2})})`}
                  </label>
                  <p className="text-sm text-slate-600 mb-3">Industry standard: 10-15% for bespoke work</p>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    step="1"
                    value={fabricWastagePercent}
                    onChange={(e) => setFabricWastagePercent(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>0%</span>
                    <span>15%</span>
                  </div>
                </div>

                {/* Designer Consultation Fee */}
                <div className="border-t pt-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Designer Consultation Fee (Optional)
                  </label>
                  <p className="text-sm text-slate-600 mb-3">Style guidance, fabric selection, fitting adjustments</p>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={designerConsultationFee}
                    onChange={(e) => setDesignerConsultationFee(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Manual Price Overrides */}
            <Card className="border-2 border-amber-200 bg-amber-50/30">
              <CardHeader>
                <CardTitle className="text-amber-900 flex items-center gap-2">
                  Manual Price Overrides
                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">Optional</Badge>
                </CardTitle>
                <CardDescription>Override calculated prices when needed (requires reason)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Fabric Cost Override */}
                <div className="p-4 bg-white rounded-lg border-2 border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center space-x-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={isFabricCostOverridden}
                          onChange={(e) => {
                            setIsFabricCostOverridden(e.target.checked)
                            if (!e.target.checked) {
                              setFabricCostOverride(null)
                              setFabricCostOverrideReason('')
                            }
                          }}
                          className="h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="font-semibold text-slate-900 group-hover:text-amber-700">Override Fabric Cost</span>
                      </label>
                      {isFabricCostOverridden && (
                        <Badge className="bg-amber-500 text-white">OVERRIDDEN</Badge>
                      )}
                    </div>
                    <div className="text-sm text-slate-600">
                      Calculated: <span className="font-semibold text-slate-900">₹{(calculatedFabricCost || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                    </div>
                  </div>

                  {isFabricCostOverridden && (
                    <div className="space-y-3 mt-3 pt-3 border-t border-amber-200">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Override Amount <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={fabricCostOverride ?? ''}
                          onChange={(e) => setFabricCostOverride(parseFloat(e.target.value) || null)}
                          className="w-full px-4 py-2 border-2 border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50"
                          placeholder="Enter override amount"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Reason for Override <span className="text-red-600">*</span>
                        </label>
                        <textarea
                          value={fabricCostOverrideReason}
                          onChange={(e) => setFabricCostOverrideReason(e.target.value)}
                          rows={2}
                          className="w-full px-4 py-2 border-2 border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50"
                          placeholder="E.g., Special discount for bulk order, negotiated price, etc."
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Stitching Cost Override */}
                <div className="p-4 bg-white rounded-lg border-2 border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center space-x-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={isStitchingCostOverridden}
                          onChange={(e) => {
                            setIsStitchingCostOverridden(e.target.checked)
                            if (!e.target.checked) {
                              setStitchingCostOverride(null)
                              setStitchingCostOverrideReason('')
                            }
                          }}
                          className="h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="font-semibold text-slate-900 group-hover:text-amber-700">Override Stitching Cost</span>
                      </label>
                      {isStitchingCostOverridden && (
                        <Badge className="bg-amber-500 text-white">OVERRIDDEN</Badge>
                      )}
                    </div>
                    <div className="text-sm text-slate-600">
                      Calculated: <span className="font-semibold text-slate-900">₹{(calculatedStitchingCost || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                    </div>
                  </div>

                  {isStitchingCostOverridden && (
                    <div className="space-y-3 mt-3 pt-3 border-t border-amber-200">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Override Amount <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={stitchingCostOverride ?? ''}
                          onChange={(e) => setStitchingCostOverride(parseFloat(e.target.value) || null)}
                          className="w-full px-4 py-2 border-2 border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50"
                          placeholder="Enter override amount"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Reason for Override <span className="text-red-600">*</span>
                        </label>
                        <textarea
                          value={stitchingCostOverrideReason}
                          onChange={(e) => setStitchingCostOverrideReason(e.target.value)}
                          rows={2}
                          className="w-full px-4 py-2 border-2 border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50"
                          placeholder="E.g., Experienced tailor discount, training order, etc."
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Accessories Cost Override */}
                <div className="p-4 bg-white rounded-lg border-2 border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center space-x-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={isAccessoriesCostOverridden}
                          onChange={(e) => {
                            setIsAccessoriesCostOverridden(e.target.checked)
                            if (!e.target.checked) {
                              setAccessoriesCostOverride(null)
                              setAccessoriesCostOverrideReason('')
                            }
                          }}
                          className="h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="font-semibold text-slate-900 group-hover:text-amber-700">Override Accessories Cost</span>
                      </label>
                      {isAccessoriesCostOverridden && (
                        <Badge className="bg-amber-500 text-white">OVERRIDDEN</Badge>
                      )}
                    </div>
                    <div className="text-sm text-slate-600">
                      Calculated: <span className="font-semibold text-slate-900">₹{(calculatedAccessoriesCost || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                    </div>
                  </div>

                  {isAccessoriesCostOverridden && (
                    <div className="space-y-3 mt-3 pt-3 border-t border-amber-200">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Override Amount <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={accessoriesCostOverride ?? ''}
                          onChange={(e) => setAccessoriesCostOverride(parseFloat(e.target.value) || null)}
                          className="w-full px-4 py-2 border-2 border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50"
                          placeholder="Enter override amount"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Reason for Override <span className="text-red-600">*</span>
                        </label>
                        <textarea
                          value={accessoriesCostOverrideReason}
                          onChange={(e) => setAccessoriesCostOverrideReason(e.target.value)}
                          rows={2}
                          className="w-full px-4 py-2 border-2 border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50"
                          placeholder="E.g., Bulk accessory purchase discount, customer-supplied items, etc."
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* General Pricing Notes */}
                <div className="border-t pt-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    General Pricing Notes (Optional)
                  </label>
                  <p className="text-sm text-slate-600 mb-3">Additional notes about pricing, negotiations, or special considerations</p>
                  <textarea
                    value={pricingNotes}
                    onChange={(e) => setPricingNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="E.g., VIP customer pricing, seasonal discount applied, etc."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Customer and Items Info */}
                  <div className="flex justify-between">
                    <span className="text-slate-600">Customer:</span>
                    <span className="font-semibold text-slate-900">{selectedCustomer?.name}</span>
                  </div>
                  <div className="flex justify-between pb-3 border-b">
                    <span className="text-slate-600">Items:</span>
                    <span className="font-semibold text-slate-900">{items.length}</span>
                  </div>

                  {/* Itemized Cost Breakdown */}
                  <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-semibold text-blue-900 mb-2">Cost Breakdown</p>

                    {fabricCost > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-700">Fabric Cost:</span>
                        <span className="font-medium text-slate-900">₹{fabricCost.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                      </div>
                    )}

                    {fabricWastageAmount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-700">Fabric Wastage ({fabricWastagePercent}%):</span>
                        <span className="font-medium text-orange-600">₹{fabricWastageAmount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                      </div>
                    )}

                    {accessoriesCost > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-700">Accessories:</span>
                        <span className="font-medium text-slate-900">₹{accessoriesCost.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                      </div>
                    )}

                    {stitchingCost > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-700">Stitching ({stitchingTier}):</span>
                        <span className="font-medium text-slate-900">₹{stitchingCost.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                      </div>
                    )}

                    {workmanshipPremiums > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-700">Workmanship Premiums:</span>
                        <span className="font-medium text-orange-600">₹{workmanshipPremiums.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                      </div>
                    )}

                    {designerFee && designerFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-700">Designer Consultation:</span>
                        <span className="font-medium text-slate-900">₹{designerFee.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                      </div>
                    )}
                  </div>

                  {/* Subtotal and GST */}
                  <div className="flex justify-between pt-3 border-t">
                    <span className="text-slate-700 font-medium">Subtotal (before GST):</span>
                    <span className="font-semibold text-slate-900">₹{subTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">CGST ({(gstRate / 2).toFixed(2)}%):</span>
                    <span className="text-slate-700">₹{cgst.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">SGST ({(gstRate / 2).toFixed(2)}%):</span>
                    <span className="text-slate-700">₹{sgst.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between pb-3 border-b">
                    <span className="text-slate-600">Total GST ({gstRate.toFixed(2)}%):</span>
                    <span className="font-semibold text-slate-900">₹{gstAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>

                  {/* Total, Advance, Balance */}
                  <div className="flex justify-between">
                    <span className="text-slate-700 font-medium">Total Amount:</span>
                    <span className="font-bold text-lg text-blue-600">₹{total.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
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
