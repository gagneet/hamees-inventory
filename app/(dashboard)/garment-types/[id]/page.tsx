'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Home, Shirt, ArrowLeft } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import DashboardLayout from '@/components/DashboardLayout'

interface GarmentPattern {
  id: string
  name: string
  description: string | null
  baseMeters: number
  slimAdjustment: number
  regularAdjustment: number
  largeAdjustment: number
  xlAdjustment: number
  createdAt: string
  updatedAt: string
  accessories: Array<{
    id: string
    quantity: number
    accessory: {
      id: string
      name: string
      type: string
      color: string | null
    }
  }>
}

export default function GarmentTypeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)
  const [pattern, setPattern] = useState<GarmentPattern | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    params.then((p) => setResolvedParams(p))
  }, [params])

  useEffect(() => {
    if (resolvedParams) {
      fetchPattern()
    }
  }, [resolvedParams])

  const fetchPattern = async () => {
    if (!resolvedParams) return

    setLoading(true)
    try {
      const response = await fetch(`/api/garment-patterns/${resolvedParams.id}`)
      const data = await response.json()
      setPattern(data.pattern)
    } catch (error) {
      console.error('Error fetching garment pattern:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !pattern) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-slate-500">Loading garment type...</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">
              <Home className="h-4 w-4" />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/garment-types">Garment Types</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{pattern.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shirt className="h-8 w-8 text-slate-600" />
          <div>
            <h1 className="text-lg font-semibold md:text-2xl">{pattern.name}</h1>
            {pattern.description && (
              <p className="text-sm text-slate-600">{pattern.description}</p>
            )}
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href="/garment-types">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to List
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        {/* Fabric Requirements */}
        <Card>
          <CardHeader>
            <CardTitle>Fabric Requirements</CardTitle>
            <CardDescription>
              Meters of fabric needed based on body type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-slate-600">Base Requirement</span>
                <span className="text-xl font-bold text-primary">
                  {pattern.baseMeters}m
                </span>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-700 mb-3">
                  Body Type Adjustments
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm text-slate-600">Slim</span>
                    <span className="font-semibold">
                      +{pattern.slimAdjustment}m
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm text-slate-600">Regular</span>
                    <span className="font-semibold">
                      +{pattern.regularAdjustment}m
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm text-slate-600">Large</span>
                    <span className="font-semibold">
                      +{pattern.largeAdjustment}m
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm text-slate-600">XL</span>
                    <span className="font-semibold">+{pattern.xlAdjustment}m</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t">
                <p className="text-sm text-slate-500 mb-2">Example Calculations:</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Slim fit:</span>
                    <span className="font-medium">
                      {pattern.baseMeters + pattern.slimAdjustment}m total
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Regular fit:</span>
                    <span className="font-medium">
                      {pattern.baseMeters + pattern.regularAdjustment}m total
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Large fit:</span>
                    <span className="font-medium">
                      {pattern.baseMeters + pattern.largeAdjustment}m total
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">XL fit:</span>
                    <span className="font-medium">
                      {pattern.baseMeters + pattern.xlAdjustment}m total
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Default Accessories */}
        <Card>
          <CardHeader>
            <CardTitle>Default Accessories</CardTitle>
            <CardDescription>
              Accessories typically used with this garment
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pattern.accessories.length === 0 ? (
              <p className="text-slate-500 text-sm">No default accessories defined</p>
            ) : (
              <div className="space-y-3">
                {pattern.accessories.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{acc.accessory.name}</p>
                      <p className="text-sm text-slate-500">
                        {acc.accessory.type}
                        {acc.accessory.color && ` • ${acc.accessory.color}`}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-base">
                      ×{acc.quantity}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Created</p>
              <p className="font-medium">
                {new Date(pattern.createdAt).toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Last Updated</p>
              <p className="font-medium">
                {new Date(pattern.updatedAt).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
