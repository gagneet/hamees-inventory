'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
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
  TrendingUp,
  CheckCircle2,
  History,
  ClipboardList,
  ChevronRight,
  Info,
  Zap,
  Loader2,
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
      id: string
      orderNumber: string
      deliveryDate: string
      createdAt: string
      status: string
      notes?: string
      tailorNotes?: string
      customer: {
        id: string
        name: string
      }
      history?: Array<{
        id: string
        changeType: string
        oldValue?: string
        newValue?: string
        description: string
        createdAt: string
        user: {
          name: string
        }
      }>
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

// Punjabi translations for measurements
const measurementLabels: Record<string, { en: string; pa: string }> = {
  neck: { en: 'Neck', pa: 'ਗਰਦਨ' },
  chest: { en: 'Chest', pa: 'ਛਾਤੀ' },
  waist: { en: 'Waist', pa: 'ਕਮਰ' },
  hip: { en: 'Hip', pa: 'ਕੁੱਲ੍ਹੇ' },
  shoulder: { en: 'Shoulder', pa: 'ਮੋਢਾ' },
  sleeveLength: { en: 'Sleeve', pa: 'ਆਸਤੀਨ' },
  shirtLength: { en: 'Shirt Length', pa: 'ਕਮੀਜ਼ ਲੰਬਾਈ' },
  inseam: { en: 'Inseam', pa: 'ਅੰਦਰਲੀ ਸੀਵਨ' },
  outseam: { en: 'Outseam', pa: 'ਬਾਹਰੀ ਸੀਵਨ' },
  thigh: { en: 'Thigh', pa: 'ਪੱਟ' },
  knee: { en: 'Knee', pa: 'ਗੋਡਾ' },
  bottomOpening: { en: 'Bottom', pa: 'ਹੇਠਾਂ' },
  jacketLength: { en: 'Jacket Length', pa: 'ਜੈਕਟ ਲੰਬਾਈ' },
  lapelWidth: { en: 'Lapel Width', pa: 'ਲੈਪਲ ਚੌੜਾਈ' },
}

export function OrderItemDetailDialog({ orderItem }: OrderItemDetailDialogProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [designs, setDesigns] = useState<DesignUpload[]>([])
  const [accessories, setAccessories] = useState<GarmentAccessory[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadCategory, setUploadCategory] = useState('SKETCH')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [designToDelete, setDesignToDelete] = useState<string | null>(null)
  const [statusUpdateDialogOpen, setStatusUpdateDialogOpen] = useState(false)

  const userRole = session?.user?.role as any
  const canUpload = userRole && hasPermission(userRole, 'update_order')
  const canDelete = userRole && hasPermission(userRole, 'delete_order')
  const canUpdateStatus = userRole && hasPermission(userRole, 'update_order_status')

  // State for Phase 2 features
  const [customerOrders, setCustomerOrders] = useState<any[]>([])
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [accessoryChecklist, setAccessoryChecklist] = useState<Record<string, boolean>>({})
  const [tailorNotes, setTailorNotes] = useState(orderItem.order.tailorNotes || '')
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Calculate cloth remaining (available stock after reservation)
  const clothRemaining = orderItem.clothInventory.currentStock - orderItem.clothInventory.reserved

  // Calculate days until delivery
  const daysUntilDelivery = Math.ceil(
    (new Date(orderItem.order.deliveryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  )

  // Calculate time in current phase
  const getTimeInCurrentPhase = () => {
    if (!orderItem.order.history || orderItem.order.history.length === 0) {
      const orderAge = Math.ceil(
        (new Date().getTime() - new Date(orderItem.order.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      )
      return `${orderAge} days since order created`
    }

    const statusChanges = orderItem.order.history.filter(h => h.changeType === 'STATUS_UPDATE')
    if (statusChanges.length === 0) {
      const orderAge = Math.ceil(
        (new Date().getTime() - new Date(orderItem.order.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      )
      return `${orderAge} days in current phase`
    }

    const lastStatusChange = statusChanges[0] // Already sorted desc
    const daysSinceChange = Math.ceil(
      (new Date().getTime() - new Date(lastStatusChange.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    )
    return `${daysSinceChange} days in ${orderItem.order.status}`
  }

  // Calculate wastage and efficiency
  const getWastageInfo = () => {
    if (!orderItem.actualMetersUsed) {
      return null
    }
    const wastage = orderItem.actualMetersUsed - orderItem.estimatedMeters
    const efficiency = ((orderItem.estimatedMeters / orderItem.actualMetersUsed) * 100).toFixed(1)
    return { wastage: wastage.toFixed(2), efficiency }
  }

  // Get next status in workflow
  const getNextStatus = () => {
    const statusFlow = ['NEW', 'MATERIAL_SELECTED', 'CUTTING', 'STITCHING', 'FINISHING', 'READY', 'DELIVERED']
    const currentIndex = statusFlow.indexOf(orderItem.order.status)
    if (currentIndex < statusFlow.length - 1) {
      return statusFlow[currentIndex + 1]
    }
    return null
  }

  // Helper to extract error message from API response
  const getErrorMessage = async (response: Response, fallbackMessage: string): Promise<string> => {
    try {
      const data = await response.json()
      return data.error || fallbackMessage
    } catch {
      return fallbackMessage
    }
  }

  // Fetch designs, accessories, and customer history when dialog opens
useEffect(() => {
  if (isOpen) {
    fetchDesigns()
    fetchAccessories()
    fetchCustomerOrders()
  }
}, [isOpen, orderItem.id])

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

  const fetchCustomerOrders = async () => {
    try {
      const response = await fetch(`/api/orders?customerId=${orderItem.order.customer.id}&limit=5`)
      if (response.ok) {
        const data = await response.json()
        // Filter out current order
        const otherOrders = data.orders?.filter((o: any) => o.id !== orderItem.order.id) || []
        setCustomerOrders(otherOrders.slice(0, 3)) // Show max 3 previous orders
      }
    } catch (error) {
      console.error('Error fetching customer orders:', error)
    }
  }

  const handleStatusUpdate = async () => {
    const nextStatus = getNextStatus()
    if (!nextStatus) return

    setStatusUpdateDialogOpen(false)
    setIsUpdatingStatus(true)
    try {
      const response = await fetch(`/api/orders/${orderItem.order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Order status updated successfully',
        })
        // Refresh the page data without full reload to preserve user state
        window.location.href = window.location.href
      } else {
        const error = await response.json()
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.error || 'Failed to update status',
        })
      }
    } catch (error) {
      console.error('Error updating status:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update status. Please check your connection and try again.',
      })
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleSaveTailorNotes = async () => {
    setIsSavingNotes(true)
    try {
      // For now, we'll use the order notes field
      // In future, could add a separate tailor_notes field to OrderItem
      // Append tailor notes to existing notes instead of overwriting
      const existingNotes = orderItem.order.notes || ''
      const separator = existingNotes ? '\n\n--- Tailor Notes ---\n' : ''
      const updatedNotes = existingNotes + separator + tailorNotes

      const response = await fetch(`/api/orders/${orderItem.order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: updatedNotes }),
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Tailor notes saved successfully',
        })
      } else {
        const errorMessage = await getErrorMessage(response, 'Failed to save notes')
        toast({
          variant: 'destructive',
          title: 'Error',
          description: errorMessage,
        })
      }
    } catch (error) {
      console.error('Error saving notes:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save notes. Please check your connection and try again.',
      })
    } finally {
      setIsSavingNotes(false)
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
        toast({
          title: 'Success',
          description: 'Design file uploaded successfully',
        })
      } else {
        const errorMessage = await getErrorMessage(response, 'Failed to upload file')
        toast({
          variant: 'destructive',
          title: 'Upload Failed',
          description: errorMessage,
        })
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      toast({
        variant: 'destructive',
        title: 'Upload Error',
        description: error instanceof Error ? error.message : 'Failed to upload file. Please check your connection and try again.',
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteDesign = async (designId: string) => {
    setDesignToDelete(designId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!designToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/design-uploads/${designToDelete}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchDesigns()
        setDeleteDialogOpen(false)
        setDesignToDelete(null)
        toast({
          title: 'Success',
          description: 'Design file deleted successfully',
        })
      } else {
        const errorMessage = await getErrorMessage(response, 'Failed to delete file')
        toast({
          variant: 'destructive',
          title: 'Delete Failed',
          description: errorMessage,
        })
      }
    } catch (error) {
      console.error('Error deleting file:', error)
      toast({
        variant: 'destructive',
        title: 'Delete Error',
        description: error instanceof Error ? error.message : 'Failed to delete file. Please check your connection and try again.',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDownloadDesign = (designId: string, fileName: string) => {
    window.open(`/api/design-uploads/${designId}`, '_blank')
  }

  return (
    <>
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

          {/* MEASUREMENTS SECTION - PROMINENT FOR TAILORS */}
          {orderItem.measurement && (
            <Card className="p-6 bg-gradient-to-r from-yellow-50 to-orange-50 border-4 border-orange-300 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <Ruler className="h-8 w-8 text-orange-600" />
                <div className="flex-1">
                  <h3 className="font-bold text-2xl text-orange-900">Measurements / ਮਾਪ</h3>
                  <p className="text-sm text-orange-700">Garment: {orderItem.measurement.garmentType}</p>
                </div>
                {orderItem.measurement.bodyType && (
                  <Badge className="bg-orange-600 text-white text-lg px-4 py-2">
                    {orderItem.measurement.bodyType}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {orderItem.measurement.neck && (
                  <div className="bg-white p-4 rounded-lg border-2 border-orange-200 shadow">
                    <p className="text-sm text-slate-600 mb-1">
                      {measurementLabels.neck.en} / <span className="font-semibold text-orange-600">{measurementLabels.neck.pa}</span>
                    </p>
                    <p className="text-4xl font-bold text-orange-900">{orderItem.measurement.neck} <span className="text-2xl text-slate-600">cm</span></p>
                  </div>
                )}
                {orderItem.measurement.chest && (
                  <div className="bg-white p-4 rounded-lg border-2 border-orange-200 shadow">
                    <p className="text-sm text-slate-600 mb-1">
                      {measurementLabels.chest.en} / <span className="font-semibold text-orange-600">{measurementLabels.chest.pa}</span>
                    </p>
                    <p className="text-4xl font-bold text-orange-900">{orderItem.measurement.chest} <span className="text-2xl text-slate-600">cm</span></p>
                  </div>
                )}
                {orderItem.measurement.waist && (
                  <div className="bg-white p-4 rounded-lg border-2 border-orange-200 shadow">
                    <p className="text-sm text-slate-600 mb-1">
                      {measurementLabels.waist.en} / <span className="font-semibold text-orange-600">{measurementLabels.waist.pa}</span>
                    </p>
                    <p className="text-4xl font-bold text-orange-900">{orderItem.measurement.waist} <span className="text-2xl text-slate-600">cm</span></p>
                  </div>
                )}
                {orderItem.measurement.hip && (
                  <div className="bg-white p-4 rounded-lg border-2 border-orange-200 shadow">
                    <p className="text-sm text-slate-600 mb-1">
                      {measurementLabels.hip.en} / <span className="font-semibold text-orange-600">{measurementLabels.hip.pa}</span>
                    </p>
                    <p className="text-4xl font-bold text-orange-900">{orderItem.measurement.hip} <span className="text-2xl text-slate-600">cm</span></p>
                  </div>
                )}
                {orderItem.measurement.shoulder && (
                  <div className="bg-white p-4 rounded-lg border-2 border-orange-200 shadow">
                    <p className="text-sm text-slate-600 mb-1">
                      {measurementLabels.shoulder.en} / <span className="font-semibold text-orange-600">{measurementLabels.shoulder.pa}</span>
                    </p>
                    <p className="text-4xl font-bold text-orange-900">{orderItem.measurement.shoulder} <span className="text-2xl text-slate-600">cm</span></p>
                  </div>
                )}
                {orderItem.measurement.sleeveLength && (
                  <div className="bg-white p-4 rounded-lg border-2 border-orange-200 shadow">
                    <p className="text-sm text-slate-600 mb-1">
                      {measurementLabels.sleeveLength.en} / <span className="font-semibold text-orange-600">{measurementLabels.sleeveLength.pa}</span>
                    </p>
                    <p className="text-4xl font-bold text-orange-900">{orderItem.measurement.sleeveLength} <span className="text-2xl text-slate-600">cm</span></p>
                  </div>
                )}
                {orderItem.measurement.shirtLength && (
                  <div className="bg-white p-4 rounded-lg border-2 border-orange-200 shadow">
                    <p className="text-sm text-slate-600 mb-1">
                      {measurementLabels.shirtLength.en} / <span className="font-semibold text-orange-600">{measurementLabels.shirtLength.pa}</span>
                    </p>
                    <p className="text-4xl font-bold text-orange-900">{orderItem.measurement.shirtLength} <span className="text-2xl text-slate-600">cm</span></p>
                  </div>
                )}
                {orderItem.measurement.inseam && (
                  <div className="bg-white p-4 rounded-lg border-2 border-orange-200 shadow">
                    <p className="text-sm text-slate-600 mb-1">
                      {measurementLabels.inseam.en} / <span className="font-semibold text-orange-600">{measurementLabels.inseam.pa}</span>
                    </p>
                    <p className="text-4xl font-bold text-orange-900">{orderItem.measurement.inseam} <span className="text-2xl text-slate-600">cm</span></p>
                  </div>
                )}
                {orderItem.measurement.outseam && (
                  <div className="bg-white p-4 rounded-lg border-2 border-orange-200 shadow">
                    <p className="text-sm text-slate-600 mb-1">
                      {measurementLabels.outseam.en} / <span className="font-semibold text-orange-600">{measurementLabels.outseam.pa}</span>
                    </p>
                    <p className="text-4xl font-bold text-orange-900">{orderItem.measurement.outseam} <span className="text-2xl text-slate-600">cm</span></p>
                  </div>
                )}
                {orderItem.measurement.thigh && (
                  <div className="bg-white p-4 rounded-lg border-2 border-orange-200 shadow">
                    <p className="text-sm text-slate-600 mb-1">
                      {measurementLabels.thigh.en} / <span className="font-semibold text-orange-600">{measurementLabels.thigh.pa}</span>
                    </p>
                    <p className="text-4xl font-bold text-orange-900">{orderItem.measurement.thigh} <span className="text-2xl text-slate-600">cm</span></p>
                  </div>
                )}
                {orderItem.measurement.knee && (
                  <div className="bg-white p-4 rounded-lg border-2 border-orange-200 shadow">
                    <p className="text-sm text-slate-600 mb-1">
                      {measurementLabels.knee.en} / <span className="font-semibold text-orange-600">{measurementLabels.knee.pa}</span>
                    </p>
                    <p className="text-4xl font-bold text-orange-900">{orderItem.measurement.knee} <span className="text-2xl text-slate-600">cm</span></p>
                  </div>
                )}
                {orderItem.measurement.bottomOpening && (
                  <div className="bg-white p-4 rounded-lg border-2 border-orange-200 shadow">
                    <p className="text-sm text-slate-600 mb-1">
                      {measurementLabels.bottomOpening.en} / <span className="font-semibold text-orange-600">{measurementLabels.bottomOpening.pa}</span>
                    </p>
                    <p className="text-4xl font-bold text-orange-900">{orderItem.measurement.bottomOpening} <span className="text-2xl text-slate-600">cm</span></p>
                  </div>
                )}
                {orderItem.measurement.jacketLength && (
                  <div className="bg-white p-4 rounded-lg border-2 border-orange-200 shadow">
                    <p className="text-sm text-slate-600 mb-1">
                      {measurementLabels.jacketLength.en} / <span className="font-semibold text-orange-600">{measurementLabels.jacketLength.pa}</span>
                    </p>
                    <p className="text-4xl font-bold text-orange-900">{orderItem.measurement.jacketLength} <span className="text-2xl text-slate-600">cm</span></p>
                  </div>
                )}
                {orderItem.measurement.lapelWidth && (
                  <div className="bg-white p-4 rounded-lg border-2 border-orange-200 shadow">
                    <p className="text-sm text-slate-600 mb-1">
                      {measurementLabels.lapelWidth.en} / <span className="font-semibold text-orange-600">{measurementLabels.lapelWidth.pa}</span>
                    </p>
                    <p className="text-4xl font-bold text-orange-900">{orderItem.measurement.lapelWidth} <span className="text-2xl text-slate-600">cm</span></p>
                  </div>
                )}
              </div>

              {orderItem.measurement.createdBy && (
                <div className="mt-6 pt-4 border-t-2 border-orange-200">
                  <p className="text-sm text-orange-700">
                    <span className="font-semibold">Measured by / ਮਾਪਿਆ ਗਿਆ:</span> {orderItem.measurement.createdBy.name}
                  </p>
                </div>
              )}
            </Card>
          )}

          {/* Timeline & Phase Tracking */}
          <Card className="p-4 bg-gradient-to-r from-purple-50 to-blue-50">
            <div className="flex items-center gap-2 mb-3">
              <History className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold text-lg">Timeline & Progress</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm mb-3">
              <div>
                <p className="text-slate-500">Current Phase</p>
                <p className="font-semibold text-lg">{orderItem.order.status}</p>
              </div>
              <div>
                <p className="text-slate-500">Time in Phase</p>
                <p className="font-semibold">{getTimeInCurrentPhase()}</p>
              </div>
              <div>
                <p className="text-slate-500">Order Number</p>
                <p className="font-semibold font-mono">{orderItem.order.orderNumber}</p>
              </div>
              <div>
                <p className="text-slate-500">Order Created</p>
                <p className="font-semibold">{new Date(orderItem.order.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Quick Status Update Button */}
            {canUpdateStatus && getNextStatus() && orderItem.order.status !== 'DELIVERED' && (
              <div className="pt-3 border-t border-purple-200">
                <Button
                  onClick={() => setStatusUpdateDialogOpen(true)}
                  disabled={isUpdatingStatus}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  size="sm"
                >
                  <ChevronRight className="h-4 w-4 mr-2" />
                  {isUpdatingStatus ? 'Updating...' : `Advance to ${getNextStatus()}`}
                </Button>
              </div>
            )}

            {/* Order History */}
            {orderItem.order.history && orderItem.order.history.length > 0 && (
              <div className="mt-3 pt-3 border-t border-purple-200">
                <p className="text-xs font-semibold text-purple-900 mb-2">Recent History</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {orderItem.order.history.slice(0, 5).map((h) => (
                    <div key={h.id} className="flex items-start gap-2 text-xs">
                      <Badge variant="outline" className="text-[10px] py-0">
                        {h.changeType}
                      </Badge>
                      <p className="flex-1 text-slate-700">{h.description}</p>
                      <p className="text-slate-500">{new Date(h.createdAt).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Work Instructions & Special Requests */}
          {orderItem.order.notes && (
            <Card className="p-4 bg-amber-50 border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardList className="h-5 w-5 text-amber-700" />
                <h3 className="font-semibold">Customer Instructions</h3>
              </div>
              <p className="text-sm text-amber-900 bg-white p-3 rounded border border-amber-200">
                {orderItem.order.notes}
              </p>
            </Card>
          )}

          {/* Tailor's Notes (Editable) */}
          {canUpload && (
            <Card className="p-4 bg-green-50 border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-5 w-5 text-green-700" />
                <h3 className="font-semibold">Tailor's Observations</h3>
              </div>
              <textarea
                className="w-full p-3 rounded border border-green-300 text-sm min-h-[80px]"
                placeholder="Add your notes, observations, or modifications made..."
                value={tailorNotes}
                onChange={(e) => setTailorNotes(e.target.value)}
              />
              <Button
                onClick={handleSaveTailorNotes}
                disabled={isSavingNotes || !tailorNotes.trim()}
                size="sm"
                className="mt-2 bg-green-600 hover:bg-green-700"
              >
                {isSavingNotes ? 'Saving...' : 'Save Notes'}
              </Button>
            </Card>
          )}

          {/* Actual vs Estimated Tracking */}
          {getWastageInfo() && (
            <Card className="p-4 bg-gradient-to-r from-cyan-50 to-teal-50">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-5 w-5 text-cyan-700" />
                <h3 className="font-semibold text-lg">Efficiency Metrics</h3>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Estimated</p>
                  <p className="font-semibold text-lg">{orderItem.estimatedMeters}m</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Actual Used</p>
                  <p className="font-semibold text-lg">{orderItem.actualMetersUsed}m</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Wastage</p>
                  <p className={`font-semibold text-lg ${
                    getWastageInfo() && parseFloat(getWastageInfo()!.wastage) > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {getWastageInfo()?.wastage}m
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-cyan-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">Efficiency</p>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-slate-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          getWastageInfo() && parseFloat(getWastageInfo()!.efficiency) >= 95
                            ? 'bg-green-600'
                            : getWastageInfo() && parseFloat(getWastageInfo()!.efficiency) >= 85
                            ? 'bg-yellow-600'
                            : 'bg-red-600'
                        }`}
                        style={{ width: `${Math.min(100, parseFloat(getWastageInfo()?.efficiency || '0'))}%` }}
                      />
                    </div>
                    <span className="font-semibold text-lg">{getWastageInfo()?.efficiency}%</span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Customer History Reference */}
          {customerOrders.length > 0 && (
            <Card className="p-4 bg-indigo-50 border-indigo-200">
              <div className="flex items-center gap-2 mb-3">
                <History className="h-5 w-5 text-indigo-700" />
                <h3 className="font-semibold">Customer's Previous Orders</h3>
              </div>
              <div className="space-y-2">
                {customerOrders.map((prevOrder: any) => (
                  <div key={prevOrder.id} className="flex items-center justify-between p-2 bg-white rounded border border-indigo-200">
                    <div>
                      <p className="font-medium font-mono text-sm">{prevOrder.orderNumber}</p>
                      <p className="text-xs text-slate-600">
                        {new Date(prevOrder.createdAt).toLocaleDateString()} • {prevOrder.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{formatCurrency(prevOrder.totalAmount)}</p>
                      <p className="text-xs text-slate-500">{prevOrder.items?.length || 0} items</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-indigo-700 mt-2 text-center">
                <Zap className="h-3 w-3 inline mr-1" />
                Review previous orders for sizing consistency
              </p>
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

          {/* Accessories Required - Interactive Checklist */}
          {accessories.length > 0 && (
            <Card className="p-4 bg-orange-50 border-orange-200">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-orange-600" />
                <h3 className="font-semibold text-lg">Accessories Checklist</h3>
                <Badge variant="outline" className="ml-auto">
                  {Object.values(accessoryChecklist).filter(Boolean).length}/{accessories.length} Collected
                </Badge>
              </div>
              <div className="space-y-2">
                {accessories.map((acc) => (
                  <div
                    key={acc.id}
                    className={`flex items-center gap-3 p-3 rounded border-2 transition-all ${
                      accessoryChecklist[acc.id]
                        ? 'bg-green-100 border-green-300'
                        : 'bg-white border-orange-200 hover:border-orange-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={accessoryChecklist[acc.id] || false}
                      onChange={(e) =>
                        setAccessoryChecklist({ ...accessoryChecklist, [acc.id]: e.target.checked })
                      }
                      className="w-5 h-5 rounded border-2 border-orange-400 text-orange-600 focus:ring-orange-500"
                    />
                    <div className="flex-1">
                      <p className={`font-medium ${accessoryChecklist[acc.id] ? 'line-through text-green-700' : ''}`}>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Design File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this design file? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDesignToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Update Confirmation Dialog */}
      <AlertDialog open={statusUpdateDialogOpen} onOpenChange={setStatusUpdateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Order Status</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to advance this order to <strong>{getNextStatus()}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleStatusUpdate} className="bg-purple-600 hover:bg-purple-700">
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Design File?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this design file? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleDeleteConfirm()
            }}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
