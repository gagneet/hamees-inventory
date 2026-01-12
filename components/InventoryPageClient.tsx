'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Package, Scan, Plus } from "lucide-react"

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
import { BarcodeScanner } from "@/components/barcode-scanner"
import { InventoryType } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

interface InventoryLookupResult {
  found: boolean
  type?: string
  item?: Record<string, unknown>
}

export default function InventoryPageClient() {
  const router = useRouter()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<InventoryType>("cloth")
  const [isLoading, setIsLoading] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [lookupResult, setLookupResult] = useState<InventoryLookupResult | null>(null)

  const handleScanSuccess = async (barcode: string) => {
    setScannedBarcode(barcode)
    setShowScanner(false)
    setIsLoading(true)

    try {
      const response = await fetch(`/api/inventory/lookup?barcode=${barcode}`)
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`)
      }
      
      const result = await response.json()
      setLookupResult(result)
      
      if (result.found) {
        toast({
          title: "Item Found",
          description: `Found ${result.type} item: ${result.item?.name || barcode}`,
        })
      } else {
        toast({
          title: "Item Not Found",
          description: `No item found with barcode: ${barcode}. You can create a new item below.`,
          variant: "default",
        })
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
        body: JSON.stringify({ ...data, barcode: scannedBarcode }),
      })
      if (!response.ok) throw new Error('Failed to create cloth item')
      const newItem = await response.json()
      toast({
        title: "Success",
        description: "Cloth item created successfully",
      })
      router.push(`/inventory/cloth/${newItem.id}`)
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
      const response = await fetch('/api/inventory/accessory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, barcode: scannedBarcode }),
      })
      if (!response.ok) throw new Error('Failed to create accessory item')
      const newItem = await response.json()
      toast({
        title: "Success",
        description: "Accessory item created successfully",
      })
      router.push(`/inventory/accessory/${newItem.id}`)
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

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Inventory Management</h1>
        <p className="text-slate-600">Scan barcodes to add or update inventory items</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Scanner Section */}
        <div>
          {!showScanner ? (
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Scan or manually add items</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" size="lg" onClick={() => setShowScanner(true)}>
                  <Scan className="mr-2 h-5 w-5" />
                  Scan Barcode
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  size="lg"
                  onClick={() => {
                    setScannedBarcode(null)
                    setLookupResult({ found: false })
                  }}
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Add Manually
                </Button>
              </CardContent>
            </Card>
          ) : (
            <BarcodeScanner
              onScanSuccess={handleScanSuccess}
              onClose={() => setShowScanner(false)}
            />
          )}

          {scannedBarcode && lookupResult?.found && lookupResult.item && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Item Found</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-mono text-sm bg-slate-100 p-2 rounded">
                    SKU: {scannedBarcode}
                  </p>
                  <p><strong>Type:</strong> {lookupResult.type}</p>
                  <p><strong>Stock:</strong> {String(lookupResult.item.currentStock)} {String(lookupResult.item.unit || '')}</p>
                  <Button className="w-full mt-4" onClick={() => router.push(`/inventory/${lookupResult.type}/${lookupResult.item?.id}`)}>
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Form Section */}
        {(lookupResult?.found === false || !scannedBarcode) && (
          <Card>
            <CardHeader>
              <CardTitle>
                <Package className="inline-block mr-2 h-5 w-5" />
                Add New Item
              </CardTitle>
              {scannedBarcode && (
                <CardDescription className="font-mono text-sm">
                  SKU: {scannedBarcode}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as InventoryType)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="cloth">Cloth</TabsTrigger>
                  <TabsTrigger value="accessory">Accessories</TabsTrigger>
                </TabsList>

                <TabsContent value="cloth">
                  <form onSubmit={handleSubmitCloth} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input id="name" name="name" placeholder="e.g., Premium Cotton Fabric" required />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="type">Type *</Label>
                        <Input id="type" name="type" placeholder="Cotton, Silk, Wool, etc." required />
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
                        <Input id="pattern" name="pattern" placeholder="Plain, Striped, etc." required />
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
                        <Label htmlFor="currentStock">Current Stock (meters) *</Label>
                        <Input id="currentStock" name="currentStock" type="number" step="0.01" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="minimum">Minimum Stock *</Label>
                        <Input id="minimum" name="minimum" type="number" step="0.01" required />
                      </div>
                    </div>

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
                  <form onSubmit={handleSubmitAccessory} className="space-y-4">
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
                        <Label htmlFor="name">Name/Description *</Label>
                        <Input id="name" name="name" required />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="acc-color">Color</Label>
                      <Input id="acc-color" name="color" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="acc-currentStock">Current Stock *</Label>
                        <Input id="acc-currentStock" name="currentStock" type="number" step="1" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="acc-minimum">Minimum Stock *</Label>
                        <Input id="acc-minimum" name="minimum" type="number" step="1" required />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="acc-pricePerUnit">Price/Unit (₹) *</Label>
                      <Input id="acc-pricePerUnit" name="pricePerUnit" type="number" step="0.01" required />
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? 'Creating...' : 'Create Accessory Item'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
