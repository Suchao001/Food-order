import webpush from 'web-push'
import { query } from './db'

let initialized = false

function initWebPush() {
  if (initialized) return
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  initialized = true
}

export async function sendPushToAll(payload: object) {
  initWebPush()
  const result = await query('SELECT * FROM push_subscriptions')
  const subs = result.rows

  const results = await Promise.allSettled(
    subs.map(async (row) => {
      const sub = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth }
      }
      await webpush.sendNotification(sub, JSON.stringify(payload))
    })
  )

  // Remove expired subscriptions
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status === 'rejected') {
      const statusCode = (r.reason as any)?.statusCode
      if (statusCode === 410 || statusCode === 404) {
        await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [subs[i].endpoint])
      }
    }
  }
}
