import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

declare let self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
clientsClaim()
self.skipWaiting()

self.addEventListener('push', (event) => {
  if (!event.data) return
  let data: any = {}
  try {
    data = event.data.json()
  } catch {
    data = { title: event.data.text() }
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || 'ออเดอร์ใหม่', {
        body: data.body || '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `order-${data.orderId || Date.now()}`,
        renotify: true,
        silent: false,
        vibrate: [300, 100, 300, 100, 300],
        data: { url: '/kitchen' }
      }),
      // ส่ง message ไปที่ kitchen window ถ้าเปิดอยู่ → ให้ TTS พูด
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        const kitchenClient = clients.find(c => c.url.includes('/kitchen'))
        if (kitchenClient) {
          kitchenClient.postMessage({ type: 'push-order', data })
        }
      })
    ])
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/kitchen'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/kitchen') && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
