'use client'

import { useRouter } from 'next/navigation'

interface GarmentTypeSelectorProps {
  customerId: string
  currentType: string
}

export function GarmentTypeSelector({ customerId, currentType }: GarmentTypeSelectorProps) {
  const router = useRouter()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(`/customers/${customerId}/measurements/new?garmentType=${e.target.value}`)
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-2">Garment Type</label>
      <select
        className="w-full md:w-auto px-4 py-2 border border-slate-300 rounded-lg"
        value={currentType}
        onChange={handleChange}
      >
        <option value="Men's Shirt">Men&apos;s Shirt</option>
        <option value="Men's Trouser">Men&apos;s Trouser</option>
        <option value="Men's Suit">Men&apos;s Suit</option>
        <option value="Men's Sherwani">Men&apos;s Sherwani</option>
      </select>
    </div>
  )
}
