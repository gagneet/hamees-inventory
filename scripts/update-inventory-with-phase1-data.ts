/**
 * Update Existing Inventory with Phase 1 Enhancement Data
 * Adds fabric specifications and accessory details to existing items
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Type definitions for Phase 1 enhancements
interface FabricSpecification {
  fabricComposition: string
  gsm: number
  threadCount: number
  weaveType: string
  fabricWidth: number
  shrinkagePercent: number
  colorFastness: string
  seasonSuitability: string[]
  occasionType: string[]
  careInstructions: string
}

interface AccessorySpecification {
  colorCode?: string
  buttonSize?: string
  holePunchSize?: number
  material?: string
  finish?: string
  threadWeight?: string
  recommendedFor: string[]
  styleCategory: string
}

// Comprehensive fabric specification data
const fabricSpecifications: Record<string, FabricSpecification> = {
  'Premium Cotton': {
    fabricComposition: '100% Cotton',
    gsm: 180,
    threadCount: 100,
    weaveType: 'Plain',
    fabricWidth: 58,
    shrinkagePercent: 3,
    colorFastness: 'Excellent',
    seasonSuitability: ['Summer', 'All-season'],
    occasionType: ['Casual', 'Formal', 'Business'],
    careInstructions: 'Machine wash cold, tumble dry low. Iron on medium heat.',
  },
  'Cotton Blend': {
    fabricComposition: '65% Cotton, 35% Polyester',
    gsm: 160,
    threadCount: 85,
    weaveType: 'Plain',
    fabricWidth: 58,
    shrinkagePercent: 2,
    colorFastness: 'Good',
    seasonSuitability: ['Summer', 'All-season'],
    occasionType: ['Casual', 'Semi-formal'],
    careInstructions: 'Machine wash cold. No bleach. Tumble dry low.',
  },
  'Pure Silk': {
    fabricComposition: '100% Silk',
    gsm: 90,
    threadCount: 150,
    weaveType: 'Plain',
    fabricWidth: 44,
    shrinkagePercent: 1.5,
    colorFastness: 'Excellent',
    seasonSuitability: ['Summer', 'All-season'],
    occasionType: ['Formal', 'Wedding', 'Party', 'Festival'],
    careInstructions: 'Dry clean only. Do not wring. Iron on silk setting.',
  },
  'Silk Blend': {
    fabricComposition: '60% Silk, 40% Cotton',
    gsm: 110,
    threadCount: 120,
    weaveType: 'Satin',
    fabricWidth: 44,
    shrinkagePercent: 2,
    colorFastness: 'Good',
    seasonSuitability: ['All-season'],
    occasionType: ['Formal', 'Wedding', 'Party'],
    careInstructions: 'Dry clean recommended. Hand wash in cold water if needed.',
  },
  'Linen Pure': {
    fabricComposition: '100% Linen',
    gsm: 200,
    threadCount: 70,
    weaveType: 'Plain',
    fabricWidth: 60,
    shrinkagePercent: 4,
    colorFastness: 'Good',
    seasonSuitability: ['Summer'],
    occasionType: ['Casual', 'Formal', 'Beachwear'],
    careInstructions: 'Machine wash warm. High shrinkage on first wash. Iron while damp.',
  },
  'Linen Blend': {
    fabricComposition: '55% Linen, 45% Cotton',
    gsm: 170,
    threadCount: 80,
    weaveType: 'Plain',
    fabricWidth: 58,
    shrinkagePercent: 3,
    colorFastness: 'Good',
    seasonSuitability: ['Summer', 'All-season'],
    occasionType: ['Casual', 'Semi-formal'],
    careInstructions: 'Machine wash warm. Medium iron.',
  },
  'Wool Premium': {
    fabricComposition: '100% Merino Wool',
    gsm: 280,
    threadCount: 60,
    weaveType: 'Twill',
    fabricWidth: 60,
    shrinkagePercent: 1,
    colorFastness: 'Excellent',
    seasonSuitability: ['Winter'],
    occasionType: ['Formal', 'Business', 'Wedding'],
    careInstructions: 'Dry clean only. Store with moth protection.',
  },
  'Wool Blend': {
    fabricComposition: '70% Wool, 30% Polyester',
    gsm: 240,
    threadCount: 65,
    weaveType: 'Twill',
    fabricWidth: 60,
    shrinkagePercent: 1.5,
    colorFastness: 'Good',
    seasonSuitability: ['Winter'],
    occasionType: ['Formal', 'Business'],
    careInstructions: 'Dry clean recommended. Can be hand washed gently in cold water.',
  },
  'Polyester Blend': {
    fabricComposition: '65% Polyester, 35% Viscose',
    gsm: 150,
    threadCount: 90,
    weaveType: 'Plain',
    fabricWidth: 58,
    shrinkagePercent: 1,
    colorFastness: 'Fair',
    seasonSuitability: ['All-season'],
    occasionType: ['Casual', 'Daily wear'],
    careInstructions: 'Machine wash cold. Low iron. Do not bleach.',
  },
  'Brocade Silk': {
    fabricComposition: '100% Silk',
    gsm: 200,
    threadCount: 140,
    weaveType: 'Jacquard',
    fabricWidth: 44,
    shrinkagePercent: 1,
    colorFastness: 'Excellent',
    seasonSuitability: ['All-season'],
    occasionType: ['Wedding', 'Festival', 'Traditional', 'Ceremonial'],
    careInstructions: 'Dry clean only. Store flat to prevent crushing pattern.',
  },
}

// Type definition for accessory specifications
interface AccessorySpecification {
  colorCode?: string
  buttonSize?: string
  holePunchSize?: number
  material?: string
  finish?: string
  threadWeight?: string
  recommendedFor: string[]
  styleCategory: string
}

// Accessory specifications
const accessorySpecifications: Record<string, AccessorySpecification> = {
  'Pearl Buttons': {
    colorCode: 'PANTONE 11-4001', // Bright White
    buttonSize: '18L', // 11.43mm
    holePunchSize: 4,
    material: 'Shell',
    finish: 'Polished',
    recommendedFor: ['Shirt', 'Kurta', 'Blazer'],
    styleCategory: 'Formal',
  },
  'Metal Buttons': {
    colorCode: 'PANTONE 16-1257', // Gold
    buttonSize: '20L', // 12.7mm
    holePunchSize: 2,
    material: 'Brass',
    finish: 'Polished',
    recommendedFor: ['Suit', 'Blazer', 'Coat'],
    styleCategory: 'Formal',
  },
  'Black Buttons': {
    colorCode: 'PANTONE 19-0303', // Jet Black
    buttonSize: '18L',
    holePunchSize: 4,
    material: 'Resin',
    finish: 'Matte',
    recommendedFor: ['Shirt', 'Trouser', 'Suit'],
    styleCategory: 'Formal',
  },
  'Polyester Thread': {
    colorCode: 'PANTONE 11-0601', // Bright White
    threadWeight: '40wt', // General purpose
    recommendedFor: ['Shirt', 'Trouser', 'Kurta', 'All'],
    styleCategory: 'All',
  },
  'Cotton Thread': {
    colorCode: 'PANTONE 19-0303', // Jet Black
    threadWeight: '50wt', // Fine detail
    recommendedFor: ['Suit', 'Formal-wear', 'Embroidery'],
    styleCategory: 'Formal',
  },
  'Metal Zipper': {
    material: 'Brass',
    finish: 'Polished',
    recommendedFor: ['Trouser', 'Jacket', 'Coat'],
    styleCategory: 'All',
  },
}

async function main() {
  console.log('🚀 Starting Phase 1 data update...\n')

  // Update Cloth Inventory
  console.log('📦 Updating cloth inventory with fabric specifications...')
  const clothItems = await prisma.clothInventory.findMany()

  let clothUpdated = 0
  
  // Batch update cloth items using transaction for better performance
  const clothUpdates = clothItems
    .map(item => {
      const specs = fabricSpecifications[item.name]
      if (specs) {
        return prisma.clothInventory.update({
          where: { id: item.id },
          data: specs,
        }).then(() => {
          console.log(`  ✅ Updated: ${item.name}`)
          return true
        })
      } else {
        console.log(`  ⚠️  No specs found for: ${item.name}`)
        return Promise.resolve(false)
      }
    })
  
  const results = await Promise.all(clothUpdates)
  clothUpdated = results.filter(Boolean).length

  console.log(`\n✅ Updated ${clothUpdated}/${clothItems.length} cloth items\n`)

  // Update Accessory Inventory
  console.log('🔘 Updating accessory inventory with specifications...')
  const accessoryItems = await prisma.accessoryInventory.findMany()

  let accessoriesUpdated = 0
  
  // Batch update accessory items using transaction for better performance
  const accessoryUpdates = accessoryItems
    .map(item => {
      const specs = accessorySpecifications[item.name]
      if (specs) {
        return prisma.accessoryInventory.update({
          where: { id: item.id },
          data: specs,
        }).then(() => {
          console.log(`  ✅ Updated: ${item.name}`)
          return true
        })
      } else {
        console.log(`  ⚠️  No specs found for: ${item.name}`)
        return Promise.resolve(false)
      }
    })
  
  const accessoryResults = await Promise.all(accessoryUpdates)
  accessoriesUpdated = accessoryResults.filter(Boolean).length

  console.log(`\n✅ Updated ${accessoriesUpdated}/${accessoryItems.length} accessory items\n`)

  // Summary
  console.log('📊 Update Summary:')
  console.log(`  - Cloth items updated: ${clothUpdated}/${clothItems.length}`)
  console.log(`  - Accessory items updated: ${accessoriesUpdated}/${accessoryItems.length}`)

  // Verify updates
  console.log('\n🔍 Verifying updates...')
  const sampleCloth = await prisma.clothInventory.findFirst({
    where: { name: 'Premium Cotton' },
  })

  if (sampleCloth && sampleCloth.fabricComposition) {
    console.log(`  ✅ Sample verification: ${sampleCloth.name}`)
    console.log(`     - Composition: ${sampleCloth.fabricComposition}`)
    console.log(`     - GSM: ${sampleCloth.gsm}`)
    console.log(`     - Weave: ${sampleCloth.weaveType}`)
    console.log(`     - Season: ${sampleCloth.seasonSuitability?.join(', ')}`)
    console.log(`     - Occasion: ${sampleCloth.occasionType?.join(', ')}`)
  }

  const sampleAccessory = await prisma.accessoryInventory.findFirst({
    where: { name: 'Pearl Buttons' },
  })

  if (sampleAccessory && sampleAccessory.buttonSize) {
    console.log(`  ✅ Sample verification: ${sampleAccessory.name}`)
    console.log(`     - Size: ${sampleAccessory.buttonSize}`)
    console.log(`     - Material: ${sampleAccessory.material}`)
    console.log(`     - Recommended for: ${sampleAccessory.recommendedFor?.join(', ')}`)
  }

  console.log('\n🎉 Phase 1 data update complete!\n')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
