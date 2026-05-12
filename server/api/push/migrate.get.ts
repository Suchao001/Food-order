import { query } from '~/server/utils/db'

export default defineEventHandler(async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  return { success: true, message: 'push_subscriptions table ready' }
})
