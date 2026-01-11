'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Camera, Keyboard, X } from 'lucide-react'

interface BarcodeScannerProps {
  onScanSuccess: (barcode: string) => void
  onClose?: () => void
}

export function BarcodeScanner({ onScanSuccess, onClose }: BarcodeScannerProps) {
  const [mode, setMode] = useState<'camera' | 'manual'>('camera')
  const [manualBarcode, setManualBarcode] = useState('')
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  useEffect(() => {
    if (mode === 'camera' && !isScanning) {
      const scanner = new Html5QrcodeScanner(
        'barcode-reader',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          rememberLastUsedCamera: true,
        },
        false
      )

      scanner.render(
        (decodedText) => {
          onScanSuccess(decodedText)
          scanner.clear()
          setIsScanning(false)
        },
        (error) => {
          // Ignore scan errors (happens frequently during scanning)
        }
      )

      scannerRef.current = scanner
      setIsScanning(true)

      return () => {
        if (scannerRef.current) {
          scannerRef.current.clear().catch(console.error)
          scannerRef.current = null
          setIsScanning(false)
        }
      }
    }
  }, [mode, onScanSuccess, isScanning])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualBarcode.trim()) {
      onScanSuccess(manualBarcode.trim())
      setManualBarcode('')
    }
  }

  const switchMode = (newMode: 'camera' | 'manual') => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error)
      scannerRef.current = null
      setIsScanning(false)
    }
    setMode(newMode)
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Scan Barcode</CardTitle>
            <CardDescription>
              Scan or enter barcode to add/update inventory
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
          >
            <Camera className="mr-2 h-4 w-4" />
            Camera
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

        {/* Camera Scanner */}
        {mode === 'camera' && (
          <div className="w-full">
            <div id="barcode-reader" className="w-full" />
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
                placeholder="e.g., CLT-COT-ABC-123456"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full">
              Look Up
            </Button>
          </form>
        )}

        <div className="text-xs text-slate-500 text-center">
          {mode === 'camera'
            ? 'Position the barcode within the frame to scan'
            : 'Enter the barcode manually if scanning is not available'}
        </div>
      </CardContent>
    </Card>
  )
}
