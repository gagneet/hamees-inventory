// @vitest-environment jsdom
/**
 * The alert detail page renders the stock item card for fabric and for accessories.
 * It used to read a `minimum` the API never sent, which crashed the card on every stock alert —
 * a type-checked but runtime-only break, so this renders the real component.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AlertDetailPage from '@/app/(dashboard)/alerts/[id]/page'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'u1', role: 'OWNER', name: 'T', email: 't@example.com' } }, status: 'authenticated' }),
}))
vi.mock('@/components/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/hooks/use-field-visibility', () => ({ useFieldVisibility: () => ({ canView: () => true }) }))
vi.mock('@/components/ui/phone-input', () => ({ PhoneText: ({ value }: { value: string | null }) => <span>{value}</span> }))

const alert = {
  id: 'al1',
  title: 'Reorder: Cotton',
  message: 'Reorder 16 meters',
  type: 'REORDER_REMINDER',
  severity: 'HIGH' as const,
  isRead: true,
  isDismissed: false,
  createdAt: new Date('2026-09-11T10:00:00Z').toISOString(),
  relatedType: 'cloth',
  relatedId: 'c1',
}

const cloth = {
  kind: 'cloth' as const,
  unit: 'm' as const,
  id: 'c1',
  sku: 'CLT-1',
  name: 'Cotton',
  type: 'Cotton',
  currentStock: 4.5,
  reserved: 1.5,
  minimum: 10,
  unitPrice: 450,
  supplierRel: { id: 's1', name: 'Sup One', phone: '+919876500000' },
}

const accessory = {
  ...cloth,
  kind: 'accessory' as const,
  unit: 'pcs' as const,
  id: 'a1',
  sku: 'ACC-1',
  name: 'Shell Buttons',
  type: 'Button',
  currentStock: 20,
  reserved: 5,
  minimum: 40,
  unitPrice: 4.5,
}

function mockAlertResponse(relatedItem: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ alert, relatedItem }) }) as unknown as Response)
  )
}

const renderPage = () => render(<AlertDetailPage params={Promise.resolve({ id: 'al1' })} />)

beforeEach(() => mockAlertResponse(cloth))
afterEach(() => vi.unstubAllGlobals())

describe('alert detail page – stock item card', () => {
  it('shows a fabric in meters and links to the fabric page', async () => {
    renderPage()

    expect(await screen.findByText('Inventory Item Details')).toBeTruthy()
    expect(screen.getByText('10.00m')).toBeTruthy() // minimum — used to crash as undefined.toFixed()
    expect(screen.getByText(/4\.50m/)).toBeTruthy() // current stock
    expect(screen.getByText(/1\.50m reserved/)).toBeTruthy()
    expect(screen.getByText('3.00m')).toBeTruthy() // available = 4.5 − 1.5
    expect(screen.getByRole('link', { name: /View Full Details/i }).getAttribute('href')).toBe('/inventory/cloth/c1')
    expect(screen.getByRole('link', { name: /Create Purchase Order/i }).getAttribute('href')).toContain('itemType=CLOTH')
  })

  it('shows an accessory in pieces and links to the accessories page', async () => {
    mockAlertResponse(accessory)

    renderPage()

    expect(await screen.findByText('Inventory Item Details')).toBeTruthy()
    expect(screen.getByText('40 pcs')).toBeTruthy()
    expect(screen.getByText(/20 pcs/)).toBeTruthy()
    expect(screen.getByText('15 pcs')).toBeTruthy() // available = 20 − 5
    expect(screen.getByRole('link', { name: /View Full Details/i }).getAttribute('href')).toBe('/inventory/accessories/a1')
    expect(screen.getByRole('link', { name: /Create Purchase Order/i }).getAttribute('href')).toContain('itemType=ACCESSORY')
  })

  it('renders without a price for roles that cannot see inventory costs', async () => {
    mockAlertResponse({ ...cloth, unitPrice: undefined })

    renderPage()

    expect(await screen.findByText('Inventory Item Details')).toBeTruthy()
    expect(screen.queryByText('Price per Meter')).toBeNull()
  })
})
