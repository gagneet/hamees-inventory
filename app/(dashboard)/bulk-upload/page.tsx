'use client'

import { useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react'

interface PreviewResult {
  filename: string
  totalRecords: number
  validRecords: number
  invalidRecords: number
  duplicateCount: number
  relationErrorCount: number
  validationErrors: Array<{ table: string; row: number; error: string; data: Record<string, unknown> }>
  duplicates: Array<{ table: string; row: number; existing: Record<string, unknown>; new: Record<string, unknown>; conflicts: string[] }>
  relationErrors: Array<{ table: string; row: number; error: string }>
  sheets: Array<{ name: string; table: string; rowCount: number; errorCount: number }>
}

interface UploadResult {
  uploadId: string
  totalRecords: number
  successCount: number
  failureCount: number
  duplicateCount: number
  skippedCount: number
  summary: string
  successDetails: Array<{ table: string; id: string; row: number }>
  failureDetails: Array<{ table: string; row: number; error: string; data: Record<string, unknown> }>
}

export default function BulkUploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [duplicateActions, setDuplicateActions] = useState<Record<string, 'skip' | 'overwrite'>>({})
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'upload' | 'preview' | 'confirm' | 'result'>('upload')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setPreview(null)
      setUploadResult(null)
      setError(null)
      setStep('upload')
    }
  }

  const handlePreview = async () => {
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/bulk-upload/preview', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Preview failed')
      }

      const data = await res.json()
      setPreview(data)
      setStep('preview')

      // Initialize duplicate actions to 'skip' by default
      const actions: Record<string, 'skip' | 'overwrite'> = {}
       data.duplicates.forEach((dup: PreviewResult['duplicates'][number]) => {
         actions[`${dup.table}:${dup.row}`] = 'skip'
       })
      setDuplicateActions(actions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview upload')
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('duplicateActions', JSON.stringify(duplicateActions))

      const res = await fetch('/api/bulk-upload/process', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const result = await res.json()
      setUploadResult(result)
      setStep('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process upload')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch('/api/bulk-upload/download-template')
      if (!res.ok) throw new Error('Download failed')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hamees-inventory-export-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to download template:', error)
      setError('Failed to download template')
    }
  }

  const toggleDuplicateAction = (key: string) => {
    setDuplicateActions(prev => ({
      ...prev,
      [key]: prev[key] === 'skip' ? 'overwrite' : 'skip'
    }))
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bulk Data Upload</h1>
          <p className="text-muted-foreground mt-1">
            Upload Excel file to import multiple records at once
          </p>
        </div>
        <Button onClick={handleDownloadTemplate} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Download Template
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step 1: File Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Excel File
            </CardTitle>
            <CardDescription>
              Select an Excel file to upload. The system will validate the data and check for duplicates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button asChild>
                  <span>Choose File</span>
                </Button>
              </label>
              {file && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            {file && (
              <Button onClick={handlePreview} disabled={loading} className="w-full">
                {loading ? 'Analyzing...' : 'Preview Upload'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview Results */}
      {step === 'preview' && preview && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                Upload Preview
              </CardTitle>
              <CardDescription>Review the validation results before uploading</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{preview.totalRecords}</div>
                  <div className="text-sm text-muted-foreground">Total Records</div>
                </div>
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{preview.validRecords}</div>
                  <div className="text-sm text-muted-foreground">Valid Records</div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{preview.duplicateCount}</div>
                  <div className="text-sm text-muted-foreground">Duplicates</div>
                </div>
                <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {preview.invalidRecords + preview.relationErrorCount}
                  </div>
                  <div className="text-sm text-muted-foreground">Errors</div>
                </div>
              </div>

              {/* Sheet Summary */}
              <div>
                <h3 className="font-semibold mb-2">Sheets Detected</h3>
                <div className="space-y-2">
                  {preview.sheets.map((sheet, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-muted rounded">
                      <span className="font-medium">{sheet.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {sheet.rowCount} rows, {sheet.errorCount} errors
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Errors */}
              {(preview.validationErrors.length > 0 || preview.relationErrors.length > 0) && (
                <div>
                  <h3 className="font-semibold mb-2 text-red-600 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    Validation Errors ({preview.validationErrors.length + preview.relationErrors.length})
                  </h3>
                  <div className="max-h-60 overflow-y-auto space-y-2 border rounded p-2">
                    {[...preview.validationErrors, ...preview.relationErrors].slice(0, 10).map((err, i) => (
                      <div key={i} className="text-sm bg-red-50 dark:bg-red-950 p-2 rounded">
                        <span className="font-medium">{err.table} Row {err.row}:</span> {err.error}
                      </div>
                    ))}
                    {preview.validationErrors.length + preview.relationErrors.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center">
                        ... and {preview.validationErrors.length + preview.relationErrors.length - 10} more errors
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Duplicates */}
              {preview.duplicates.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 text-yellow-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Duplicates Found ({preview.duplicates.length})
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Choose action for each duplicate: Skip (keep existing) or Overwrite (replace with new)
                  </p>
                  <div className="max-h-80 overflow-y-auto space-y-2 border rounded p-2">
                    {preview.duplicates.map((dup, i) => {
                      const key = `${dup.table}:${dup.row}`
                      return (
                        <div key={i} className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium">{dup.table} Row {dup.row}</span>
                            <Button
                              size="sm"
                              variant={duplicateActions[key] === 'overwrite' ? 'destructive' : 'secondary'}
                              onClick={() => toggleDuplicateAction(key)}
                            >
                              {duplicateActions[key] === 'skip' ? 'Skip' : 'Overwrite'}
                            </Button>
                          </div>
                          <div className="text-xs space-y-1">
                            <div>
                              <strong>Conflicts:</strong> {dup.conflicts.join(', ')}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => setStep('upload')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={loading || (preview.validRecords === 0)}
                  className="flex-1"
                >
                  {loading ? 'Uploading...' : 'Proceed with Upload'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Upload Result */}
      {step === 'result' && uploadResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Upload Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{uploadResult.totalRecords}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{uploadResult.successCount}</div>
                <div className="text-sm text-muted-foreground">Success</div>
              </div>
              <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{uploadResult.failureCount}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{uploadResult.duplicateCount}</div>
                <div className="text-sm text-muted-foreground">Duplicates</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-950 p-4 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{uploadResult.skippedCount}</div>
                <div className="text-sm text-muted-foreground">Skipped</div>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <pre className="text-sm whitespace-pre-wrap">{uploadResult.summary}</pre>
            </div>

            {uploadResult.failureDetails.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 text-red-600">Failed Records</h3>
                <div className="max-h-60 overflow-y-auto space-y-2 border rounded p-2">
                  {uploadResult.failureDetails.slice(0, 20).map((fail, i) => (
                    <div key={i} className="text-sm bg-red-50 dark:bg-red-950 p-2 rounded">
                      <span className="font-medium">{fail.table} Row {fail.row}:</span> {fail.error}
                    </div>
                  ))}
                  {uploadResult.failureDetails.length > 20 && (
                    <p className="text-xs text-muted-foreground text-center">
                      ... and {uploadResult.failureDetails.length - 20} more failures
                    </p>
                  )}
                </div>
              </div>
            )}

            <Button onClick={() => {
              setStep('upload')
              setFile(null)
              setPreview(null)
              setUploadResult(null)
            }} className="w-full">
              Upload Another File
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <ol className="text-sm space-y-2">
            <li>Download the Excel template using the button above</li>
            <li>Fill in your data following the format and notes in each sheet</li>
            <li>Maintain the dependency order (Users → Suppliers → Inventory → Customers → Orders)</li>
            <li>Do not modify ID columns unless you know the exact IDs to reference</li>
            <li>Upload the completed Excel file</li>
            <li>Review validation results and handle duplicates</li>
            <li>Confirm and process the upload</li>
          </ol>
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  )
}
