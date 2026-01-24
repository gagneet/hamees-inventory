'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Package, Scan, Plus, AlertTriangle, ArrowUpDown, ShoppingCart, Eye, Home } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { InventoryType } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { Pagination } from "@/components/ui/pagination"
import { ItemEditDialog } from "@/components/inventory/item-edit-dialog"

// Dynamically import barcode scanner to reduce initial bundle size (html5-qrcode is ~100KB)
const BarcodeScannerImproved = dynamic(
  () => import("@/components/barcode-scanner-improved").then(mod => mod.BarcodeScannerImproved),
  { ssr: false, loading: () => <div className="p-4 text-center">Loading scanner...</div> }
)

interface InventoryLookupResult {
  found: boolean
  type?: string
  item?: Record<string, unknown>
}

interface ClothInventoryItem {
  id: string
  sku: string
  name: string
  type: string
  brand: string
  color: string
  colorHex: string
  pattern: string
  quality: string
  pricePerMeter: number
  currentStock: number
  reserved: number
  minimum: number
  supplier: string
  location?: string
  supplierRel?: { name: string; id: string }
}

interface AccessoryInventoryItem {
  id: string
  sku: string
  type: string
  name: string
  color?: string
  currentStock: number
  pricePerUnit: number
  minimum: number
  supplier: string
  supplierRel?: { name: string; id: string }
}

export default function InventoryPageClient() {
  const router = useRouter()
  const { toast } = useToast()
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<InventoryType>("cloth")
  const [isLoading, setIsLoading] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [lookupResult, setLookupResult] = useState<InventoryLookupResult | null>(null)
  const [clothInventory, setClothInventory] = useState<ClothInventoryItem[]>([])
  const [accessoryInventory, setAccessoryInventory] = useState<AccessoryInventoryItem[]>([])
  const [isFetchingInventory, setIsFetchingInventory] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editItem, setEditItem] = useState<{ type: 'cloth' | 'accessory'; item: ClothInventoryItem | AccessoryInventoryItem } | null>(null)

  // Check if user is a Tailor (hide pricing information)
  const isTailor = session?.user?.role === 'TAILOR'

  // Pagination states
  const [clothPage, setClothPage] = useState(1)
  const [clothPageSize, setClothPageSize] = useState(25)
  const [clothTotal, setClothTotal] = useState(0)
  const [clothTotalPages, setClothTotalPages] = useState(0)

  const [accessoryPage, setAccessoryPage] = useState(1)
  const [accessoryPageSize, setAccessoryPageSize] = useState(25)
  const [accessoryTotal, setAccessoryTotal] = useState(0)
  const [accessoryTotalPages, setAccessoryTotalPages] = useState(0)

  // Sorting states
  const [clothSortField, setClothSortField] = useState<string>('name')
  const [clothSortDirection, setClothSortDirection] = useState<'asc' | 'desc'>('asc')
  const [accessorySortField, setAccessorySortField] = useState<string>('name')
  const [accessorySortDirection, setAccessorySortDirection] = useState<'asc' | 'desc'>('asc')

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Sorting function
  const handleSort = (field: string, type: 'cloth' | 'accessory') => {
    if (type === 'cloth') {
      if (clothSortField === field) {
        // Toggle direction
        setClothSortDirection(clothSortDirection === 'asc' ? 'desc' : 'asc')
      } else {
        // New field, default to ascending
        setClothSortField(field)
        setClothSortDirection('asc')
      }
    } else {
      if (accessorySortField === field) {
        // Toggle direction
        setAccessorySortDirection(accessorySortDirection === 'asc' ? 'desc' : 'asc')
      } else {
        // New field, default to ascending
        setAccessorySortField(field)
        setAccessorySortDirection('asc')
      }
    }
  }

  // Client-side sorting function
  const sortData = <T extends ClothInventoryItem | AccessoryInventoryItem>(
    data: T[],
    field: string,
    direction: 'asc' | 'desc',
    type: 'cloth' | 'accessory'
  ): T[] => {
    return [...data].sort((a, b) => {
      let aValue: unknown
      let bValue: unknown

      // Special handling for calculated fields
      if (field === 'available' && type === 'cloth') {
        aValue = (a as ClothInventoryItem).currentStock - (a as ClothInventoryItem).reserved
        bValue = (b as ClothInventoryItem).currentStock - (b as ClothInventoryItem).reserved
      } else if (field === 'status') {
        // Sort by status priority: Out of Stock > Critical > Low Stock > In Stock
        const getStatusPriority = (item: T) => {
          if (type === 'cloth') {
            const clothItem = item as ClothInventoryItem
            const available = clothItem.currentStock - clothItem.reserved
            if (available <= 0) return 0 // Out of Stock
            if (available <= clothItem.minimum) return 1 // Critical
            if (available > clothItem.minimum && available <= clothItem.minimum * 1.25) return 2 // Low Stock
            return 3 // In Stock
          } else {
            const accItem = item as AccessoryInventoryItem
            if (accItem.currentStock <= 0) return 0
            if (accItem.currentStock <= accItem.minimum) return 1
            if (accItem.currentStock > accItem.minimum && accItem.currentStock <= accItem.minimum * 1.25) return 2
            return 3
          }
        }
        aValue = getStatusPriority(a)
        bValue = getStatusPriority(b)
      } else {
        aValue = (a as unknown as Record<string, unknown>)[field]
        bValue = (b as unknown as Record<string, unknown>)[field]
      }

      // Handle null/undefined
      if (aValue === null || aValue === undefined) return 1
      if (bValue === null || bValue === undefined) return -1

      // Compare values
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase())
        return direction === 'asc' ? comparison : -comparison
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue
      }

      return 0
    })
  }

  // Fetch inventory on mount, tab change, search change, and pagination change
  useEffect(() => {
    fetchInventory()
  }, [activeTab, debouncedSearch, clothPage, clothPageSize, accessoryPage, accessoryPageSize])

  const fetchInventory = async () => {
    setIsFetchingInventory(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) {
        params.append('search', debouncedSearch)
      }

      if (activeTab === "cloth") {
        params.append('page', clothPage.toString())
        params.append('limit', clothPageSize.toString())
        const response = await fetch(`/api/inventory/cloth?${params.toString()}`)
        if (response.ok) {
          const data = await response.json()
          setClothInventory(data.items || [])
          if (data.pagination) {
            setClothTotal(data.pagination.totalItems)
            setClothTotalPages(data.pagination.totalPages)
          }
        }
      } else {
        params.append('page', accessoryPage.toString())
        params.append('limit', accessoryPageSize.toString())
        const response = await fetch(`/api/inventory/accessories?${params.toString()}`)
        if (response.ok) {
          const data = await response.json()
          setAccessoryInventory(data.items || [])
          if (data.pagination) {
            setAccessoryTotal(data.pagination.totalItems)
            setAccessoryTotalPages(data.pagination.totalPages)
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch inventory:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load inventory. Please try again.",
      })
    } finally {
      setIsFetchingInventory(false)
    }
  }

  // Stock status calculation matching dashboard and alerts logic
  // Critical: Available <= minimum (at or below threshold)
  // Low Stock: Available > minimum AND <= minimum × 1.25 (25% buffer zone)
  // Healthy: Available > minimum × 1.25
  const getStockStatus = (current: number, reserved: number, minimum: number) => {
    const available = current - (reserved || 0)
    if (available <= 0) return { label: "Out of Stock", variant: "destructive" as const }
    if (available <= minimum) return { label: "Critical", variant: "destructive" as const }
    if (available > minimum && available <= minimum * 1.25) return { label: "Low Stock", variant: "default" as const }
    return { label: "In Stock", variant: "default" as const }
  }

  // Pagination handlers
  const handleClothPageChange = (page: number) => {
    setClothPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleClothPageSizeChange = (size: number) => {
    setClothPageSize(size)
    setClothPage(1)
  }

  const handleAccessoryPageChange = (page: number) => {
    setAccessoryPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleAccessoryPageSizeChange = (size: number) => {
    setAccessoryPageSize(size)
    setAccessoryPage(1)
  }

  const handleScanSuccess = async (barcode: string) => {
    setScannedBarcode(barcode)
    setShowScanner(false)
    setIsLoading(true)

    try {
      const response = await fetch(`/api/inventory/barcode?barcode=${encodeURIComponent(barcode)}`)

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`)
      }

      const result = await response.json()
      setLookupResult(result)

      if (result.found) {
        // Item found - Open edit dialog with item data
        toast({
          title: "Item Found",
          description: `Found ${result.type} item: ${result.item?.name || barcode}. Opening editor...`,
        })

        setEditItem({
          type: result.type as 'cloth' | 'accessory',
          item: result.item as ClothInventoryItem | AccessoryInventoryItem
        })
        setShowEditDialog(true)
      } else {
        // Item not found - Open add form with barcode pre-filled
        toast({
          title: "Item Not Found",
          description: `No item found with barcode: ${barcode}. Opening form to create new item...`,
        })

        // Set the active tab based on barcode prefix
        if (barcode.startsWith('CLT-')) {
          setActiveTab('cloth')
        } else if (barcode.startsWith('ACC-')) {
          setActiveTab('accessory')
        }

        setShowAddForm(true)
      }
    } catch (error) {
      console.error("Lookup failed:", error)
      setLookupResult({ found: false })

      toast({
        title: "Lookup Failed",
        description: error instanceof Error
          ? `Network error: ${error.message}. Please check your connection and try again.`
          : "Unable to lookup barcode. Please check your connection and try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmitCloth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    const formData = new FormData(e.currentTarget)
    const data = Object.fromEntries(formData.entries())

    try {
      const response = await fetch('/api/inventory/cloth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: scannedBarcode,
          name: data.name,
          type: data.type,
          brand: data.brand,
          color: data.color,
          colorHex: data.colorHex,
          pattern: data.pattern,
          quality: data.quality,
          pricePerMeter: parseFloat(data.pricePerMeter as string),
          currentStock: parseFloat(data.currentStock as string),
          minimum: parseFloat(data.minimum as string),
          supplier: data.supplier,
          location: data.location || null,
        }),
      })
      if (!response.ok) throw new Error('Failed to create cloth item')
      await response.json()
      toast({
        title: "Success",
        description: "Cloth item created successfully",
      })
      setShowAddForm(false)
      setScannedBarcode(null)
      setLookupResult(null)
      fetchInventory() // Refresh the inventory list
      e.currentTarget.reset()
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create cloth item. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmitAccessory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    const formData = new FormData(e.currentTarget)
    const data = Object.fromEntries(formData.entries())

    try {
      const response = await fetch('/api/inventory/accessories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: data.type,
          name: data.name,
          color: data.color || null,
          currentStock: parseInt(data.currentStock as string),
          pricePerUnit: parseFloat(data.pricePerUnit as string),
          minimum: parseInt(data.minimum as string),
        }),
      })
      if (!response.ok) throw new Error('Failed to create accessory item')
      await response.json()
      toast({
        title: "Success",
        description: "Accessory item created successfully",
      })
      setShowAddForm(false)
      setScannedBarcode(null)
      setLookupResult(null)
      fetchInventory() // Refresh the inventory list
      e.currentTarget.reset()
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create accessory item. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReorder = (itemId: string, itemName: string) => {
    toast({
      title: "Reorder Request",
      description: `Reorder request for "${itemName}" - Purchase Order feature coming soon!`,
    })
    // TODO: Implement purchase order creation
  }

  return (
    <>
      {/* Breadcrumbs */}
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">
              <Home className="h-4 w-4" />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Inventory</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Inventory Management</h1>
          <p className="text-slate-600">Manage your fabric and accessory inventory</p>
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          <Button onClick={() => setShowScanner(true)} variant="outline">
            <Scan className="mr-2 h-4 w-4" />
            Scan Barcode
          </Button>
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <BarcodeScannerImproved
              onScanSuccess={handleScanSuccess}
              onClose={() => setShowScanner(false)}
            />
          </div>
        </div>
      )}

      {/* Edit Item Dialog */}
      {showEditDialog && editItem && (
        <ItemEditDialog
          isOpen={showEditDialog}
          onClose={() => {
            setShowEditDialog(false)
            setEditItem(null)
            setScannedBarcode(null)
            setLookupResult(null)
            fetchInventory() // Refresh inventory after edit
          }}
          itemType={editItem.type}
          item={editItem.item}
          userRole={session?.user?.role}
        />
      )}

      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-2xl w-full my-8">
            <Card className="border-0 shadow-none">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    <Package className="inline-block mr-2 h-5 w-5" />
                    Add New Item
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setShowAddForm(false)
                    setScannedBarcode(null)
                    setLookupResult(null)
                  }}>
                    ✕
                  </Button>
                </div>
                {scannedBarcode && (
                  <CardDescription className="font-mono text-sm">
                    SKU: {scannedBarcode}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="max-h-[70vh] overflow-y-auto">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as InventoryType)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="cloth">Cloth</TabsTrigger>
                    <TabsTrigger value="accessory">Accessories</TabsTrigger>
                  </TabsList>

                  <TabsContent value="cloth">
                    <form onSubmit={handleSubmitCloth} className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input id="name" name="name" placeholder="e.g., Premium Cotton Fabric" required />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="type">Type *</Label>
                          <Input id="type" name="type" placeholder="Cotton, Silk, Wool" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="brand">Brand *</Label>
                          <Input id="brand" name="brand" required />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="color">Color *</Label>
                          <Input id="color" name="color" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="colorHex">Color Code</Label>
                          <Input id="colorHex" name="colorHex" type="color" defaultValue="#000000" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="pattern">Pattern *</Label>
                          <Input id="pattern" name="pattern" placeholder="Plain, Striped" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="quality">Quality *</Label>
                          <select name="quality" id="quality" required className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                            <option value="Premium">Premium</option>
                            <option value="Standard">Standard</option>
                            <option value="Economy">Economy</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="currentStock">Stock (meters) *</Label>
                          <Input id="currentStock" name="currentStock" type="number" step="0.01" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="minimum">Min Stock *</Label>
                          <Input id="minimum" name="minimum" type="number" step="0.01" required />
                        </div>
                      </div>

                      {/* Hide pricing fields for Tailor */}
                      {!isTailor && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="pricePerMeter">Price/Meter (₹) *</Label>
                            <Input id="pricePerMeter" name="pricePerMeter" type="number" step="0.01" required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="supplier">Supplier *</Label>
                            <Input id="supplier" name="supplier" required />
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="location">Location</Label>
                        <Input id="location" name="location" placeholder="Shelf A1" />
                      </div>

                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? 'Creating...' : 'Create Cloth Item'}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="accessory">
                    <form onSubmit={handleSubmitAccessory} className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="acc-type">Type *</Label>
                          <select name="type" id="acc-type" required className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                            <option value="Button">Button</option>
                            <option value="Thread">Thread</option>
                            <option value="Zipper">Zipper</option>
                            <option value="Lining">Lining</option>
                            <option value="Elastic">Elastic</option>
                            <option value="Hook">Hook</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="acc-name">Name *</Label>
                          <Input id="acc-name" name="name" required />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="acc-color">Color</Label>
                        <Input id="acc-color" name="color" />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="acc-currentStock">Stock *</Label>
                          <Input id="acc-currentStock" name="currentStock" type="number" step="1" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="acc-minimum">Min Stock *</Label>
                          <Input id="acc-minimum" name="minimum" type="number" step="1" required />
                        </div>
                      </div>

                      {/* Hide pricing for Tailor */}
                      {!isTailor && (
                        <div className="space-y-2">
                          <Label htmlFor="acc-pricePerUnit">Price/Unit (₹) *</Label>
                          <Input id="acc-pricePerUnit" name="pricePerUnit" type="number" step="0.01" required />
                        </div>
                      )}

                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? 'Creating...' : 'Create Accessory'}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Input
              type="text"
              placeholder={`Search ${activeTab === 'cloth' ? 'cloth inventory by name, SKU, type, brand, or color' : 'accessories by name, type, or color'}...`}
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Package className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          </div>
        </CardContent>
      </Card>

      {/* Main Inventory Display */}
      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v as InventoryType)
        setSearchTerm('') // Clear search when switching tabs
      }} className="space-y-4">
        <TabsList>
          <TabsTrigger value="cloth">Cloth Inventory</TabsTrigger>
          <TabsTrigger value="accessory">Accessories</TabsTrigger>
        </TabsList>

        <TabsContent value="cloth" className="space-y-4">
          {isFetchingInventory ? (
            <div className="text-center py-12">
              <p className="text-slate-500">Loading inventory...</p>
            </div>
          ) : clothInventory.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                <p className="text-slate-500 mb-4">
                  {searchTerm ? 'No cloth items found matching your search' : 'No cloth items in inventory'}
                </p>
                {!searchTerm && (
                  <Button onClick={() => setShowAddForm(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Item
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Cloth Inventory ({clothInventory.length} items)</CardTitle>
                <CardDescription>Manage your fabric stock</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className="cursor-pointer hover:bg-slate-100 select-none"
                          onClick={() => handleSort('sku', 'cloth')}
                        >
                          <div className="flex items-center gap-1">
                            SKU
                            <ArrowUpDown className={`h-3 w-3 ${clothSortField === 'sku' ? 'text-blue-600' : 'text-slate-400'}`} />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-slate-100 select-none"
                          onClick={() => handleSort('name', 'cloth')}
                        >
                          <div className="flex items-center gap-1">
                            Name
                            <ArrowUpDown className={`h-3 w-3 ${clothSortField === 'name' ? 'text-blue-600' : 'text-slate-400'}`} />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-slate-100 select-none"
                          onClick={() => handleSort('type', 'cloth')}
                        >
                          <div className="flex items-center gap-1">
                            Type
                            <ArrowUpDown className={`h-3 w-3 ${clothSortField === 'type' ? 'text-blue-600' : 'text-slate-400'}`} />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-slate-100 select-none"
                          onClick={() => handleSort('color', 'cloth')}
                        >
                          <div className="flex items-center gap-1">
                            Color
                            <ArrowUpDown className={`h-3 w-3 ${clothSortField === 'color' ? 'text-blue-600' : 'text-slate-400'}`} />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-slate-100 select-none"
                          onClick={() => handleSort('currentStock', 'cloth')}
                        >
                          <div className="flex items-center gap-1">
                            Stock
                            <ArrowUpDown className={`h-3 w-3 ${clothSortField === 'currentStock' ? 'text-blue-600' : 'text-slate-400'}`} />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-slate-100 select-none"
                          onClick={() => handleSort('available', 'cloth')}
                        >
                          <div className="flex items-center gap-1">
                            Available
                            <ArrowUpDown className={`h-3 w-3 ${clothSortField === 'available' ? 'text-blue-600' : 'text-slate-400'}`} />
                          </div>
                        </TableHead>
                        {!isTailor && (
                          <TableHead
                            className="cursor-pointer hover:bg-slate-100 select-none"
                            onClick={() => handleSort('pricePerMeter', 'cloth')}
                          >
                            <div className="flex items-center gap-1">
                              Price
                              <ArrowUpDown className={`h-3 w-3 ${clothSortField === 'pricePerMeter' ? 'text-blue-600' : 'text-slate-400'}`} />
                            </div>
                          </TableHead>
                        )}
                        <TableHead
                          className="cursor-pointer hover:bg-slate-100 select-none"
                          onClick={() => handleSort('status', 'cloth')}
                        >
                          <div className="flex items-center gap-1">
                            Status
                            <ArrowUpDown className={`h-3 w-3 ${clothSortField === 'status' ? 'text-blue-600' : 'text-slate-400'}`} />
                          </div>
                        </TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortData(clothInventory, clothSortField, clothSortDirection, 'cloth').map((item) => {
                        const available = item.currentStock - item.reserved
                        const status = getStockStatus(item.currentStock, item.reserved, item.minimum)
                        return (
                          <TableRow
                            key={item.id}
                            className="cursor-pointer hover:bg-slate-50"
                            onClick={() => router.push(`/inventory/cloth/${item.id}`)}
                          >
                            <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.type}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-4 h-4 rounded border border-slate-300"
                                  style={{ backgroundColor: item.colorHex }}
                                />
                                {item.color}
                              </div>
                            </TableCell>
                            <TableCell>{item.currentStock.toFixed(2)}m</TableCell>
                            <TableCell>
                              {available.toFixed(2)}m
                              {item.reserved > 0 && (
                                <span className="text-xs text-slate-500"> ({item.reserved.toFixed(2)}m reserved)</span>
                              )}
                            </TableCell>
                            {!isTailor && <TableCell>{formatCurrency(item.pricePerMeter)}/m</TableCell>}
                            <TableCell>
                              <Badge variant={status.variant}>{status.label}</Badge>
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleReorder(item.id, item.name)}
                                  disabled={available > item.minimum}
                                  title={available > item.minimum ? "Stock is sufficient" : "Reorder this item"}
                                >
                                  <ShoppingCart className="h-4 w-4" />
                                </Button>
                                <Link href={`/inventory/cloth/${item.id}`}>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    title="View details"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </Link>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
              {clothInventory.length > 0 && (
                <div className="px-6 pb-6">
                  <Pagination
                    currentPage={clothPage}
                    totalPages={clothTotalPages}
                    pageSize={clothPageSize}
                    totalItems={clothTotal}
                    onPageChange={handleClothPageChange}
                    onPageSizeChange={handleClothPageSizeChange}
                  />
                </div>
              )}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="accessory" className="space-y-4">
          {isFetchingInventory ? (
            <div className="text-center py-12">
              <p className="text-slate-500">Loading inventory...</p>
            </div>
          ) : accessoryInventory.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                <p className="text-slate-500 mb-4">
                  {searchTerm ? 'No accessories found matching your search' : 'No accessories in inventory'}
                </p>
                {!searchTerm && (
                  <Button onClick={() => setShowAddForm(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Item
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Accessory Inventory ({accessoryInventory.length} items)</CardTitle>
                <CardDescription>Manage your buttons, threads, and other accessories</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className="cursor-pointer hover:bg-slate-100 select-none"
                          onClick={() => handleSort('type', 'accessory')}
                        >
                          <div className="flex items-center gap-1">
                            Type
                            <ArrowUpDown className={`h-3 w-3 ${accessorySortField === 'type' ? 'text-blue-600' : 'text-slate-400'}`} />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-slate-100 select-none"
                          onClick={() => handleSort('name', 'accessory')}
                        >
                          <div className="flex items-center gap-1">
                            Name
                            <ArrowUpDown className={`h-3 w-3 ${accessorySortField === 'name' ? 'text-blue-600' : 'text-slate-400'}`} />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-slate-100 select-none"
                          onClick={() => handleSort('color', 'accessory')}
                        >
                          <div className="flex items-center gap-1">
                            Color
                            <ArrowUpDown className={`h-3 w-3 ${accessorySortField === 'color' ? 'text-blue-600' : 'text-slate-400'}`} />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-slate-100 select-none"
                          onClick={() => handleSort('currentStock', 'accessory')}
                        >
                          <div className="flex items-center gap-1">
                            Available
                            <ArrowUpDown className={`h-3 w-3 ${accessorySortField === 'currentStock' ? 'text-blue-600' : 'text-slate-400'}`} />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-slate-100 select-none"
                          onClick={() => handleSort('minimum', 'accessory')}
                        >
                          <div className="flex items-center gap-1">
                            Minimum
                            <ArrowUpDown className={`h-3 w-3 ${accessorySortField === 'minimum' ? 'text-blue-600' : 'text-slate-400'}`} />
                          </div>
                        </TableHead>
                        {!isTailor && (
                          <TableHead
                            className="cursor-pointer hover:bg-slate-100 select-none"
                            onClick={() => handleSort('pricePerUnit', 'accessory')}
                          >
                            <div className="flex items-center gap-1">
                              Price/Unit
                              <ArrowUpDown className={`h-3 w-3 ${accessorySortField === 'pricePerUnit' ? 'text-blue-600' : 'text-slate-400'}`} />
                            </div>
                          </TableHead>
                        )}
                        <TableHead
                          className="cursor-pointer hover:bg-slate-100 select-none"
                          onClick={() => handleSort('status', 'accessory')}
                        >
                          <div className="flex items-center gap-1">
                            Status
                            <ArrowUpDown className={`h-3 w-3 ${accessorySortField === 'status' ? 'text-blue-600' : 'text-slate-400'}`} />
                          </div>
                        </TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortData(accessoryInventory, accessorySortField, accessorySortDirection, 'accessory').map((item) => {
                        const available = item.currentStock - (item.reserved || 0)
                        const status = getStockStatus(item.currentStock, item.reserved || 0, item.minimum)
                        return (
                          <TableRow
                            key={item.id}
                            className="cursor-pointer hover:bg-slate-50"
                            onClick={() => router.push(`/inventory/accessories/${item.id}`)}
                          >
                            <TableCell>
                              <Badge variant="outline">{item.type}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.color || '-'}</TableCell>
                            <TableCell>
                              {available}
                              {item.reserved && item.reserved > 0 && (
                                <span className="text-xs text-slate-500"> ({item.reserved} reserved)</span>
                              )}
                            </TableCell>
                            <TableCell>{item.minimum}</TableCell>
                            {!isTailor && <TableCell>{formatCurrency(item.pricePerUnit)}</TableCell>}
                            <TableCell>
                              <Badge variant={status.variant}>{status.label}</Badge>
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleReorder(item.id, item.name)}
                                  disabled={available > item.minimum}
                                  title={available > item.minimum ? "Stock is sufficient" : "Reorder this item"}
                                >
                                  <ShoppingCart className="h-4 w-4" />
                                </Button>
                                <Link href={`/inventory/accessories/${item.id}`}>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    title="View details"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </Link>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
              {accessoryInventory.length > 0 && (
                <div className="px-6 pb-6">
                  <Pagination
                    currentPage={accessoryPage}
                    totalPages={accessoryTotalPages}
                    pageSize={accessoryPageSize}
                    totalItems={accessoryTotal}
                    onPageChange={handleAccessoryPageChange}
                    onPageSizeChange={handleAccessoryPageSizeChange}
                  />
                </div>
              )}
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}
