'use client'

import { Button } from '@/components/ui/button'

interface BarcodeScannerProps {
  onScanSuccess: (barcode: string) => void
  onClose: () => void
}

export function BarcodeScanner({
  onScanSuccess,
  onClose,
}: BarcodeScannerProps) {
  const handleScan = () => {
    // Simulate a successful scan with a random barcode
    const randomBarcode = `SIM-${Date.now()}`
    onScanSuccess(randomBarcode)
  }

  return (
    <div className="p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-md">
      <p className="text-center text-gray-700 dark:text-gray-300 mb-4">
        Barcode scanner functionality is currently simulated.
      </p>
      <div className="flex flex-col gap-2">
        <Button onClick={handleScan}>Simulate Scan</Button>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
