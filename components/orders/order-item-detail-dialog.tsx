'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import {
  Eye,
  Package,
  Ruler,
  MapPin,
  FileImage,
  Upload,
  Download,
  Trash2,
  Calendar,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'

interface OrderItemDetailDialogProps {
  orderItem: {
    id: string
    quantity: number
    estimatedMeters: number
    actualMetersUsed?: number
    bodyType: string
    garmentPattern: {
      id: string
      name: string
      description?: string
    }
    clothInventory: {
      id: string
      name: string
      color: string
      colorHex: string
      type: string
      brand: string
      location?: string
      currentStock: number
      reserved: number
      pricePerMeter: number
    }
    measurement?: {
      id: string
      garmentType: string
      bodyType?: string
      neck?: number
      chest?: number
      waist?: number
      hip?: number
      shoulder?: number
      sleeveLength?: number
      shirtLength?: number
      inseam?: number
      outseam?: number
      thigh?: number
      knee?: number
      bottomOpening?: number
      jacketLength?: number
      lapelWidth?: number
      createdBy?: {
        name: string
      }
    }
    order: {
      deliveryDate: string
      status: string
      notes?: string
    }
  }
}

interface DesignUpload {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  category: string
  description?: string
  uploadedAt: string
  user: {
    name: string
  }
}

interface GarmentAccessory {
  id: string
  quantity: number
  accessory: {
    id: string
    name: string
    type: string
    color?: string
    currentStock: number
  }
}

export function OrderItemDetailDialog({ orderItem }: OrderItemDetailDialogProps) {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [designs, setDesigns] = useState<DesignUpload[]>([])
  const [accessories, setAccessories] = useState<GarmentAccessory[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadCategory, setUploadCategory] = useState('SKETCH')

  const userRole = session?.user?.role as any
  const canUpload = userRole && hasPermission(userRole, 'update_order')
  const canDelete = userRole && hasPermission(userRole, 'delete_order')

  // Calculate cloth remaining (available stock after reservation)
  const clothRemaining = orderItem.clothInventory.currentStock - orderItem.clothInventory.reserved

  // Calculate days until delivery
  const daysUntilDelivery = Math.ceil(
    (new Date(orderItem.order.deliveryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  )

  // Fetch designs and accessories when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchDesigns()
      fetchAccessories()
    }
  }, [isOpen])

  const fetchDesigns = async () => {
    try {
      const response = await fetch(`/api/design-uploads?orderItemId=${orderItem.id}`)
      if (response.ok) {
        const data = await response.json()
        setDesigns(data)
      }
    } catch (error) {
      console.error('Error fetching designs:', error)
    }
  }

  const fetchAccessories = async () => {
    try {
      const response = await fetch(`/api/garment-patterns/${orderItem.garmentPattern.id}/accessories`)
      if (response.ok) {
        const data = await response.json()
        setAccessories(data)
      }
    } catch (error) {
      console.error('Error fetching accessories:', error)
    }
  }

  const handleFileUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('orderItemId', orderItem.id)
      formData.append('category', uploadCategory)

      const response = await fetch('/api/design-uploads', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        setSelectedFile(null)
        await fetchDesigns()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to upload file')
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Failed to upload file')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteDesign = async (designId: string) => {
    if (!confirm('Are you sure you want to delete this design file?')) return

    try {
      const response = await fetch(`/api/design-uploads/${designId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchDesigns()
      } else {
        alert('Failed to delete file')
      }
    } catch (error) {
      console.error('Error deleting file:', error)
      alert('Failed to delete file')
    }
  }

  const handleDownloadDesign = (designId: string, fileName: string) => {
    window.open(`/api/design-uploads/${designId}`, '_blank')
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="h-4 w-4 mr-1" />
          View Details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            {orderItem.garmentPattern.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Timeline Alert */}
          <Card className={`p-4 border-2 ${
            daysUntilDelivery < 0
              ? 'border-red-500 bg-red-50'
              : daysUntilDelivery <= 3
              ? 'border-amber-500 bg-amber-50'
              : 'border-blue-500 bg-blue-50'
          }`}>
            <div className="flex items-center gap-3">
              {daysUntilDelivery < 0 ? (
                <AlertCircle className="h-5 w-5 text-red-600" />
              ) : (
                <Clock className="h-5 w-5 text-blue-600" />
              )}
              <div className="flex-1">
                <p className="font-semibold text-sm">
                  {daysUntilDelivery < 0
                    ? `OVERDUE by ${Math.abs(daysUntilDelivery)} days`
                    : daysUntilDelivery === 0
                    ? 'Due TODAY'
                    : `${daysUntilDelivery} days remaining`}
                </p>
                <p className="text-xs text-slate-600">
                  Delivery: {new Date(orderItem.order.deliveryDate).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="outline" className="ml-auto">
                {orderItem.order.status}
              </Badge>
            </div>
          </Card>

          {/* Measurements Section */}
          {orderItem.measurement && (
            <Card className="p-4 bg-slate-50">
              <div className="flex items-center gap-2 mb-3">
                <Ruler className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Measurements</h3>
                {orderItem.measurement.bodyType && (
                  <Badge variant="outline" className="ml-auto">
                    {orderItem.measurement.bodyType}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-4 text-sm">
                {orderItem.measurement.neck && (
                  <div>
                    <p className="text-slate-500 text-xs">Neck</p>
                    <p className="font-semibold">{orderItem.measurement.neck} cm</p>
                  </div>
                )}
                {orderItem.measurement.chest && (
                  <div>
                    <p className="text-slate-500 text-xs">Chest</p>
                    <p className="font-semibold">{orderItem.measurement.chest} cm</p>
                  </div>
                )}
                {orderItem.measurement.waist && (
                  <div>
                    <p className="text-slate-500 text-xs">Waist</p>
                    <p className="font-semibold">{orderItem.measurement.waist} cm</p>
                  </div>
                )}
                {orderItem.measurement.hip && (
                  <div>
                    <p className="text-slate-500 text-xs">Hip</p>
                    <p className="font-semibold">{orderItem.measurement.hip} cm</p>
                  </div>
                )}
                {orderItem.measurement.shoulder && (
                  <div>
                    <p className="text-slate-500 text-xs">Shoulder</p>
                    <p className="font-semibold">{orderItem.measurement.shoulder} cm</p>
                  </div>
                )}
                {orderItem.measurement.sleeveLength && (
                  <div>
                    <p className="text-slate-500 text-xs">Sleeve</p>
                    <p className="font-semibold">{orderItem.measurement.sleeveLength} cm</p>
                  </div>
                )}
                {orderItem.measurement.shirtLength && (
                  <div>
                    <p className="text-slate-500 text-xs">Shirt Length</p>
                    <p className="font-semibold">{orderItem.measurement.shirtLength} cm</p>
                  </div>
                )}
                {orderItem.measurement.inseam && (
                  <div>
                    <p className="text-slate-500 text-xs">Inseam</p>
                    <p className="font-semibold">{orderItem.measurement.inseam} cm</p>
                  </div>
                )}
                {orderItem.measurement.outseam && (
                  <div>
                    <p className="text-slate-500 text-xs">Outseam</p>
                    <p className="font-semibold">{orderItem.measurement.outseam} cm</p>
                  </div>
                )}
                {orderItem.measurement.thigh && (
                  <div>
                    <p className="text-slate-500 text-xs">Thigh</p>
                    <p className="font-semibold">{orderItem.measurement.thigh} cm</p>
                  </div>
                )}
                {orderItem.measurement.knee && (
                  <div>
                    <p className="text-slate-500 text-xs">Knee</p>
                    <p className="font-semibold">{orderItem.measurement.knee} cm</p>
                  </div>
                )}
                {orderItem.measurement.bottomOpening && (
                  <div>
                    <p className="text-slate-500 text-xs">Bottom</p>
                    <p className="font-semibold">{orderItem.measurement.bottomOpening} cm</p>
                  </div>
                )}
                {orderItem.measurement.jacketLength && (
                  <div>
                    <p className="text-slate-500 text-xs">Jacket Length</p>
                    <p className="font-semibold">{orderItem.measurement.jacketLength} cm</p>
                  </div>
                )}
                {orderItem.measurement.lapelWidth && (
                  <div>
                    <p className="text-slate-500 text-xs">Lapel Width</p>
                    <p className="font-semibold">{orderItem.measurement.lapelWidth} cm</p>
                  </div>
                )}
              </div>
              {orderItem.measurement.createdBy && (
                <p className="text-xs text-slate-500 mt-3 border-t pt-2">
                  Measured by: {orderItem.measurement.createdBy.name}
                </p>
              )}
            </Card>
          )}

          {/* Fabric Details */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Fabric Details</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded border-2 border-slate-300"
                  style={{ backgroundColor: orderItem.clothInventory.colorHex }}
                />
                <div className="flex-1">
                  <p className="font-semibold">
                    {orderItem.clothInventory.name} ({orderItem.clothInventory.color})
                  </p>
                  <p className="text-sm text-slate-600">
                    {orderItem.clothInventory.type} • {orderItem.clothInventory.brand}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <p className="text-sm text-slate-500">Required</p>
                  <p className="font-semibold">{orderItem.estimatedMeters}m</p>
                </div>
                {orderItem.actualMetersUsed && (
                  <div>
                    <p className="text-sm text-slate-500">Actually Used</p>
                    <p className="font-semibold">{orderItem.actualMetersUsed}m</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="h-4 w-4 text-primary" />
                    <p className="text-sm text-slate-500">Storage Location</p>
                  </div>
                  <p className="font-semibold text-lg">
                    {orderItem.clothInventory.location || 'Not specified'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Cloth Remaining</p>
                  <p className={`font-semibold text-lg ${
                    clothRemaining < orderItem.estimatedMeters
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`}>
                    {clothRemaining.toFixed(2)}m
                  </p>
                  <p className="text-xs text-slate-500">
                    Total: {orderItem.clothInventory.currentStock}m | Reserved: {orderItem.clothInventory.reserved}m
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Accessories Required */}
          {accessories.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Accessories Required</h3>
              </div>
              <div className="space-y-2">
                {accessories.map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <div>
                      <p className="font-medium">
                        {acc.accessory.name} {acc.accessory.color && `(${acc.accessory.color})`}
                      </p>
                      <p className="text-xs text-slate-500">{acc.accessory.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {acc.quantity * orderItem.quantity} {acc.accessory.type === 'Button' ? 'pcs' : 'units'}
                      </p>
                      <p className={`text-xs ${
                        acc.accessory.currentStock >= acc.quantity * orderItem.quantity
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        Stock: {acc.accessory.currentStock}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Order Item Info */}
          <Card className="p-4 bg-blue-50">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Quantity</p>
                <p className="font-semibold text-lg">{orderItem.quantity} {orderItem.quantity > 1 ? 'pieces' : 'piece'}</p>
              </div>
              <div>
                <p className="text-slate-500">Body Type</p>
                <p className="font-semibold text-lg">{orderItem.bodyType}</p>
              </div>
            </div>
          </Card>

          {/* Design Uploads Section */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileImage className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Design Files</h3>
            </div>

            {/* Upload Form - Only for authorized users */}
            {canUpload && (
              <div className="mb-4 p-3 bg-slate-50 rounded border border-slate-200">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Upload File</label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-slate-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded file:border-0
                        file:text-sm file:font-semibold
                        file:bg-primary file:text-white
                        hover:file:bg-primary/90"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      className="block w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="SKETCH">Sketch / Design</option>
                      <option value="REFERENCE">Reference Image</option>
                      <option value="WORK_IN_PROGRESS">Work in Progress</option>
                      <option value="FINAL">Final Product</option>
                    </select>
                  </div>
                  <Button
                    onClick={handleFileUpload}
                    disabled={!selectedFile || isUploading}
                    size="sm"
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isUploading ? 'Uploading...' : 'Upload File'}
                  </Button>
                </div>
              </div>
            )}

            {/* Uploaded Files List */}
            {designs.length > 0 ? (
              <div className="space-y-2">
                {designs.map((design) => (
                  <div key={design.id} className="flex items-center justify-between p-3 border rounded hover:bg-slate-50">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{design.fileName}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {design.category}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {(design.fileSize / 1024).toFixed(0)} KB
                        </span>
                        <span className="text-xs text-slate-500">
                          by {design.user.name}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadDesign(design.id, design.fileName)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDesign(design.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">
                No design files uploaded yet
              </p>
            )}
          </Card>

          {/* Notes */}
          {orderItem.order.notes && (
            <Card className="p-4 bg-amber-50 border-amber-200">
              <p className="text-sm font-medium text-amber-900 mb-1">Order Notes</p>
              <p className="text-sm text-amber-800">{orderItem.order.notes}</p>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
