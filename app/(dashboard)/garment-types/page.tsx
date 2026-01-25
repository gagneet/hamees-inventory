'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Home, Plus, Shirt } from 'lucide-react'
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
  accessories: Array<{
    id: string
    quantityPerGarment: number
    accessory: {
      id: string
      name: string
      type: string
    }
  }>
}

export default function GarmentTypesPage() {
  const [patterns, setPatterns] = useState<GarmentPattern[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPatterns()
  }, [])

  const fetchPatterns = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/garment-patterns')
      const data = await response.json()
      setPatterns(data.patterns || [])
    } catch (error) {
      console.error('Error fetching garment patterns:', error)
    } finally {
      setLoading(false)
    }
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
            <BreadcrumbPage>Garment Types</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold md:text-2xl">Garment Types</h1>
          <p className="text-sm text-slate-600">
            Manage garment patterns with fabric requirements and default accessories
          </p>
        </div>
        <Button asChild>
          <Link href="/garment-types/new">
            <Plus className="mr-2 h-4 w-4" />
            New Garment Type
          </Link>
        </Button>
      </div>

      {/* Garment Types List */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500">Loading garment types...</p>
          </CardContent>
        </Card>
      ) : patterns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Shirt className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-slate-500 mb-4">No garment types found</p>
            <Button asChild>
              <Link href="/garment-types/new">Create your first garment type</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {patterns.map((pattern) => (
            <Link key={pattern.id} href={`/garment-types/${pattern.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shirt className="h-5 w-5" />
                    {pattern.name}
                  </CardTitle>
                  {pattern.description && (
                    <CardDescription>{pattern.description}</CardDescription>
                  )}
                </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">
                      Fabric Requirements (meters)
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-slate-500">Base:</span>{' '}
                        <span className="font-medium">{pattern.baseMeters}m</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Slim:</span>{' '}
                        <span className="font-medium">
                          +{pattern.slimAdjustment}m
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Regular:</span>{' '}
                        <span className="font-medium">
                          +{pattern.regularAdjustment}m
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Large:</span>{' '}
                        <span className="font-medium">
                          +{pattern.largeAdjustment}m
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">XL:</span>{' '}
                        <span className="font-medium">+{pattern.xlAdjustment}m</span>
                      </div>
                    </div>
                  </div>

                  {pattern.accessories.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2">
                        Default Accessories
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {pattern.accessories.map((acc) => (
                          <Badge key={acc.id} variant="outline">
                            {acc.accessory.name} (×{acc.quantityPerGarment})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            </Link>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
