import { query } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { endpoint } = body
  if (!endpoint) throw createError({ statusCode: 400, message: 'Missing endpoint' })
  await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint])
  return { success: true }
})
