import { query } from '~/server/utils/db'

export default defineEventHandler(async () => {
  // Add telegram_message_id column to orders
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS telegram_message_id INTEGER`)

  // Register webhook with Telegram
  const token = process.env.TELEGRAM_BOT_TOKEN
  const webhookUrl = 'https://food-order-kohl-mu.vercel.app/api/telegram/webhook'
  const res: any = await $fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    body: { url: webhookUrl }
  })

  return { success: true, webhook: res }
})
