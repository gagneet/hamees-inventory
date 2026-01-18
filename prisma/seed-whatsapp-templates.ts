import { prisma } from '../lib/db'

async function main() {
  console.log('🌱 Seeding WhatsApp message templates...')

  // Order Confirmation Template
  await prisma.whatsAppTemplate.upsert({
    where: { name: 'order_confirmation' },
    update: {},
    create: {
      name: 'order_confirmation',
      category: 'TRANSACTIONAL',
      language: 'en',
      content: `🎉 Order Confirmed - HAMEES ATTIRE

Dear {{customer_name}},

Your order has been successfully placed!

Order Number: {{order_number}}
Expected Delivery: {{delivery_date}}

Items:
{{items}}

Total Amount: {{total_amount}}
Advance Paid: {{advance_paid}}
Balance Due: {{balance}}

We will keep you updated on your order status.

Thank you for choosing HAMEES ATTIRE!
📍 Visit us for any queries.`,
      variables: ['customer_name', 'order_number', 'delivery_date', 'items', 'total_amount', 'advance_paid', 'balance'],
    },
  })

  // Order Ready Template
  await prisma.whatsAppTemplate.upsert({
    where: { name: 'order_ready' },
    update: {},
    create: {
      name: 'order_ready',
      category: 'TRANSACTIONAL',
      language: 'en',
      content: `✅ Order Ready for Pickup - HAMEES ATTIRE

Dear {{customer_name}},

Great news! Your order is ready for pickup! 🎊

Order Number: {{order_number}}
Balance Due: {{balance}}

Please visit our shop to collect your order.

Store Hours: 10 AM - 8 PM
Location: [Your Address]

Thank you for choosing HAMEES ATTIRE!`,
      variables: ['customer_name', 'order_number', 'balance'],
    },
  })

  // Payment Reminder Template
  await prisma.whatsAppTemplate.upsert({
    where: { name: 'payment_reminder' },
    update: {},
    create: {
      name: 'payment_reminder',
      category: 'TRANSACTIONAL',
      language: 'en',
      content: `💰 Payment Reminder - HAMEES ATTIRE

Dear {{customer_name}},

This is a friendly reminder about the pending payment for your order.

Order Number: {{order_number}}
Delivery Date: {{delivery_date}}
Balance Due: {{balance}}

Please make the payment at your earliest convenience.

For any queries, feel free to contact us.

Thank you!
HAMEES ATTIRE`,
      variables: ['customer_name', 'order_number', 'delivery_date', 'balance'],
    },
  })

  // Low Stock Alert Template
  await prisma.whatsAppTemplate.upsert({
    where: { name: 'low_stock_alert' },
    update: {},
    create: {
      name: 'low_stock_alert',
      category: 'UTILITY',
      language: 'en',
      content: `⚠️ Low Stock Alert - HAMEES ATTIRE

Inventory Alert!

Item: {{item_name}}
Available Stock: {{available_stock}}
Minimum Required: {{minimum_stock}}

Action needed: Please reorder this item to maintain stock levels.

HAMEES ATTIRE Inventory System`,
      variables: ['item_name', 'available_stock', 'minimum_stock'],
    },
  })

  // Order Status Update Template
  await prisma.whatsAppTemplate.upsert({
    where: { name: 'order_status_update' },
    update: {},
    create: {
      name: 'order_status_update',
      category: 'TRANSACTIONAL',
      language: 'en',
      content: `📦 Order Status Update - HAMEES ATTIRE

Dear {{customer_name}},

Your order status has been updated!

Order Number: {{order_number}}
Current Status: {{new_status}}
{{status_message}}

Expected Delivery: {{delivery_date}}

Thank you for your patience!
HAMEES ATTIRE`,
      variables: ['customer_name', 'order_number', 'new_status', 'status_message', 'delivery_date'],
    },
  })

  // Order Delayed Template
  await prisma.whatsAppTemplate.upsert({
    where: { name: 'order_delayed' },
    update: {},
    create: {
      name: 'order_delayed',
      category: 'TRANSACTIONAL',
      language: 'en',
      content: `⏰ Order Delay Notice - HAMEES ATTIRE

Dear {{customer_name}},

We regret to inform you that your order is experiencing a slight delay.

Order Number: {{order_number}}
Original Delivery: {{original_date}}
Revised Delivery: {{new_date}}
Reason: {{delay_reason}}

We apologize for the inconvenience and appreciate your understanding.

HAMEES ATTIRE`,
      variables: ['customer_name', 'order_number', 'original_date', 'new_date', 'delay_reason'],
    },
  })

  console.log('✅ WhatsApp templates seeded successfully!')
  console.log('📊 Total templates: 6')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error seeding WhatsApp templates:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
