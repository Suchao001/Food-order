import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

declare let self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
clientsClaim()
self.skipWaiting()

self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()

  event.waitUntil(
    self.registration.showNotification(data.title || 'ออเดอร์ใหม่', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `order-${data.orderId || Date.now()}`,
      renotify: true,
      data: { url: '/kitchen' }
    })
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
