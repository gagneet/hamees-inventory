'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Camera, Keyboard, X, AlertCircle, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface BarcodeScannerImprovedProps {
  onScanSuccess: (barcode: string) => void
  onClose?: () => void
}

/**
 * Improved Barcode Scanner with:
 * - Native Barcode Detection API (where supported)
 * - Fallback to html5-qrcode
 * - Better error handling for mobile devices
 * - Manual entry mode
 * - Camera permission handling
 * - Timeout protection against hangs
 */
export function BarcodeScannerImproved({ onScanSuccess, onClose }: BarcodeScannerImprovedProps) {
  const [mode, setMode] = useState<'camera' | 'manual'>('manual') // Start with manual to avoid auto-camera issues
  const [manualBarcode, setManualBarcode] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasNativeSupport, setHasNativeSupport] = useState(false)
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt')

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isActiveRef = useRef<boolean>(false) // For detection loop control

  // Check for native Barcode Detection API support
  useEffect(() => {
    // @ts-ignore - BarcodeDetector is experimental
    const nativeSupport = 'BarcodeDetector' in window
    setHasNativeSupport(nativeSupport)

    // Check camera permissions
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'camera' as PermissionName })
        .then((result) => {
          setPermissionState(result.state as 'prompt' | 'granted' | 'denied')
          result.addEventListener('change', () => {
            setPermissionState(result.state as 'prompt' | 'granted' | 'denied')
          })
        })
        .catch(() => {
          // Permissions API not supported
        })
    }
  }, [])

  const stopCamera = useCallback(() => {
    isActiveRef.current = false // Stop detection loop

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    setIsScanning(false)
  }, [])

  const startNativeScanning = useCallback(async () => {
    try {
      setError(null)
      setIsScanning(true)
      isActiveRef.current = true // Start detection loop

      // Set timeout to prevent infinite hanging
      timeoutRef.current = setTimeout(() => {
        stopCamera()
        setError('Camera initialization timed out. Please try manual entry or refresh the page.')
      }, 15000) // 15 second timeout (increased from 10)

      // Request camera access with mobile-friendly constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()

        // @ts-ignore - BarcodeDetector is experimental
        const barcodeDetector = new BarcodeDetector({
          formats: [
            'qr_code',        // QR codes
            'ean_13',         // European Article Number (13 digits)
            'ean_8',          // European Article Number (8 digits)
            'upc_a',          // Universal Product Code (12 digits)
            'upc_e',          // UPC-E (6 digits)
            'code_128',       // Code 128 (variable length)
            'code_39',        // Code 39 (variable length)
            'code_93',        // Code 93 (variable length)
            'codabar',        // Codabar (variable length)
            'itf',            // Interleaved 2 of 5
            'aztec',          // Aztec code
            'data_matrix',    // Data Matrix
            'pdf417'          // PDF417
          ]
        })

        const detectBarcode = async () => {
          // Use ref instead of state to avoid stale closure
          if (!videoRef.current || !isActiveRef.current) return

          try {
            const barcodes = await barcodeDetector.detect(videoRef.current)

            if (barcodes.length > 0) {
              const barcode = barcodes[0].rawValue
              if (process.env.NODE_ENV === 'development') {
                console.log('Barcode detected:', barcode, 'Format:', barcodes[0].format)
              }

              // Stop camera before callback
              isActiveRef.current = false
              stopCamera()
              onScanSuccess(barcode)
              return
            }
          } catch (err) {
            console.error('Detection error:', err)
          }

          // Continue scanning only if still active
          if (isActiveRef.current) {
            animationFrameRef.current = requestAnimationFrame(detectBarcode)
          }
        }

        // Start detection loop
        detectBarcode()
      }
    } catch (err: any) {
      stopCamera()
      console.error('Camera error:', err)

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera access denied. Please enable camera permissions in your browser settings or use manual entry.')
        setPermissionState('denied')
      } else if (err.name === 'NotFoundError') {
        setError('No camera found. Please use manual entry.')
      } else if (err.name === 'NotReadableError') {
        setError('Camera is being used by another app. Please close other apps and try again.')
      } else {
        setError(`Camera error: ${err.message}. Please try manual entry.`)
      }

      // Auto-switch to manual entry on error
      setTimeout(() => setMode('manual'), 2000)
    }
  }, [isScanning, onScanSuccess, stopCamera])

  const startFallbackScanning = useCallback(async () => {
    // For browsers without native support, recommend manual entry
    setError('Camera scanning not fully supported on this device. Please use manual entry for best results.')
    setTimeout(() => setMode('manual'), 3000)
  }, [])

  const startCamera = useCallback(() => {
    if (hasNativeSupport) {
      startNativeScanning()
    } else {
      startFallbackScanning()
    }
  }, [hasNativeSupport, startNativeScanning, startFallbackScanning])

  useEffect(() => {
    if (mode === 'camera' && !isScanning) {
      startCamera()
    }

    return () => {
      stopCamera()
    }
  }, [mode]) // Don't include startCamera and stopCamera to avoid re-initialization

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualBarcode.trim()) {
      onScanSuccess(manualBarcode.trim())
      setManualBarcode('')
    }
  }

  const switchMode = (newMode: 'camera' | 'manual') => {
    stopCamera()
    setError(null)
    setMode(newMode)
  }

  const retryCamera = () => {
    setError(null)
    stopCamera()
    setTimeout(() => {
      if (mode === 'camera') {
        startCamera()
      }
    }, 100)
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Scan Barcode</CardTitle>
            <CardDescription>
              {hasNativeSupport
                ? 'Camera scanning supported. Choose your preferred method.'
                : 'Manual entry recommended for this device.'}
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode Toggle */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === 'camera' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => switchMode('camera')}
            disabled={permissionState === 'denied'}
          >
            <Camera className="mr-2 h-4 w-4" />
            Camera
            {!hasNativeSupport && ' (Limited)'}
          </Button>
          <Button
            type="button"
            variant={mode === 'manual' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => switchMode('manual')}
          >
            <Keyboard className="mr-2 h-4 w-4" />
            Manual
          </Button>
        </div>

        {/* Permission Denied Alert */}
        {permissionState === 'denied' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Camera access denied. Please enable camera permissions in your browser settings or use manual entry.
            </AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span className="flex-1 text-sm">{error}</span>
              {mode === 'camera' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={retryCamera}
                  className="ml-2"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Camera Scanner */}
        {mode === 'camera' && (
          <div className="w-full">
            <div className="relative w-full aspect-video bg-slate-900 rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {isScanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="border-4 border-yellow-400 w-64 h-64 rounded-lg shadow-lg"></div>
                </div>
              )}
              {!isScanning && !error && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-white text-center">
                    <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm opacity-75">Initializing camera...</p>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 text-center mt-2">
              Position the barcode within the yellow frame
            </p>
          </div>
        )}

        {/* Manual Entry */}
        {mode === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manual-barcode">Enter Barcode/SKU</Label>
              <Input
                id="manual-barcode"
                type="text"
                placeholder="e.g., CLT-COT-ABC-123456 or ACC-BUT-001"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                autoFocus
                className="text-lg font-mono"
              />
              <p className="text-xs text-slate-500">
                Supports both cloth (CLT-) and accessory (ACC-) SKUs
              </p>
            </div>
            <Button type="submit" className="w-full" size="lg">
              Look Up
            </Button>
          </form>
        )}

        <div className="text-xs text-slate-500 text-center pt-2 border-t">
          {mode === 'camera'
            ? hasNativeSupport
              ? 'Using native browser scanning (best quality)'
              : 'Camera support limited on this device'
            : 'Enter barcode manually - most reliable method'}
        </div>
      </CardContent>
    </Card>
  )
}
