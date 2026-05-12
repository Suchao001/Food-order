import { query } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { endpoint, keys } = body

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw createError({ statusCode: 400, message: 'Invalid subscription' })
  }

  await query(`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth)
    VALUES ($1, $2, $3)
    ON CONFLICT (endpoint) DO UPDATE SET p256dh = $2, auth = $3
  `, [endpoint, keys.p256dh, keys.auth])

  return { success: true }
})
