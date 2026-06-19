<script setup lang="ts">
// Fetch orders with status filter (only Pending and Cooking)
const activeStatuses = ref(['Pending', 'Cooking'])
const statusQuery = computed(() => activeStatuses.value.join(','))

const { data: ordersResult, refresh, pending } = await useFetch('/api/orders/orders-by-status', {
  query: { status: statusQuery },
  key: 'kitchen-orders',
  server: false,
  lazy: true
})

const allOrders = computed(() => ordersResult.value?.data || [])
const orders = computed(() => {
  return allOrders.value
    .map((o: any) => {
      const kitchenItems = o.items.filter((i: any) => i.menu_dept === 'Kitchen')
      return {
        ...o,
        items: kitchenItems
      }
    })
    .filter((o: any) => o.items.length > 0)
})

// Robust Polling
const isPolling = ref(false)
const pollTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const lastRefreshTime = ref(new Date())
const previousOrderIds = ref<number[]>([])

// Notification sound using Web Audio API
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    // Create a pleasant "ding" sound
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime) // A5 note
    oscillator.frequency.setValueAtTime(1320, audioContext.currentTime + 0.1) // E6 note
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.5)
  } catch (e) {
    console.log('Audio not supported')
  }
}

async function startPolling() {
  if (isPolling.value) return
  isPolling.value = true
  
  const poll = async () => {
    if (!isPolling.value) return
    
    try {
      const oldOrderIds = orders.value.map((o: any) => o.id)
      await refresh()
      lastRefreshTime.value = new Date()
      
      // Check for new orders
      const newOrderIds = orders.value.map((o: any) => o.id)
      const newOrders = orders.value.filter((o: any) => !oldOrderIds.includes(o.id))
      const hasNewOrders = newOrders.length > 0

      if (hasNewOrders && oldOrderIds.length > 0) {
        playNotificationSound()
      }
      
      previousOrderIds.value = newOrderIds
    } catch (err) {
      console.error('Polling error:', err)
    } finally {
      if (isPolling.value) {
        pollTimeout.value = setTimeout(poll, document.hidden ? 15000 : 5000)
      }
    }
  }

  poll()
}

function stopPolling() {
  isPolling.value = false
  if (pollTimeout.value) {
    clearTimeout(pollTimeout.value)
    pollTimeout.value = null
  }
}

// View mode density toggle
const viewMode = ref<'normal' | 'compact'>('normal')

function setViewMode(mode: 'normal' | 'compact') {
  viewMode.value = mode
  localStorage.setItem('kitchen:view-mode', mode)
}

function onSwMessage(event: MessageEvent) {
  if (event.data?.type === 'push-order') {
    playNotificationSound()
  }
}

onMounted(() => {
  startPolling()
  const savedMode = localStorage.getItem('kitchen:view-mode')
  if (savedMode === 'compact') viewMode.value = 'compact'
  checkPushStatus()
  navigator.serviceWorker?.addEventListener('message', onSwMessage)
})

onUnmounted(() => {
  navigator.serviceWorker?.removeEventListener('message', onSwMessage)
})

onUnmounted(() => {
  stopPolling()
})

// Update order status
const isUpdating = ref<number | null>(null)
const isDeleting = ref<number | null>(null)

// Custom Confirm Dialog
const showConfirmDialog = ref(false)
const confirmOrderId = ref<number | null>(null)

function requestDelete(orderId: number) {
  confirmOrderId.value = orderId
  showConfirmDialog.value = true
}

function cancelDelete() {
  showConfirmDialog.value = false
  confirmOrderId.value = null
}

async function confirmDelete() {
  if (!confirmOrderId.value) return
  
  const orderId = confirmOrderId.value
  showConfirmDialog.value = false
  confirmOrderId.value = null
  
  isDeleting.value = orderId
  try {
    await $fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      body: { status: 'Cancelled' }
    })
    await refresh()
    lastRefreshTime.value = new Date()
  } catch (error) {
    console.error('Failed to delete order:', error)
  } finally {
    isDeleting.value = null
  }
}

async function updateStatus(orderId: number, newStatus: string) {
  isUpdating.value = orderId
  try {
    const order = orders.value.find((o: any) => o.id === orderId)
    if (order && order.items.length > 0) {
      // Determine what status to set for the items
      let itemTargetStatus = 'Pending'
      if (newStatus === 'Cooking') {
        itemTargetStatus = 'Preparing'
      } else if (newStatus === 'Completed') {
        itemTargetStatus = 'Ready'
      }

      // Update all kitchen items in this order
      const promises = order.items.map((item: any) => 
        $fetch(`/api/orders/items/${item.id}/status`, {
          method: 'PATCH',
          body: { status: itemTargetStatus }
        })
      )
      await Promise.all(promises)
    }
    await refresh()
    lastRefreshTime.value = new Date()
  } catch (error) {
    console.error('Failed to update status:', error)
  } finally {
    isUpdating.value = null
  }
}

// Kitchen workflow: Pending -> Cooking -> Completed
function getNextStatus(currentStatus: string): string | null {
  const workflow: Record<string, string> = {
    'Pending': 'Cooking',
    'Cooking': 'Completed'
  }
  return workflow[currentStatus] || null
}

function getButtonStyle(status: string) {
  if (status === 'Pending') {
    return 'bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600'
  }
  return 'bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600'
}

function getButtonText(status: string): string {
  if (status === 'Pending') return '🍳 เริ่มทำ'
  return '✅ เสร็จแล้ว'
}



// Push Notifications
const pushSupported = ref(false)
const pushStatus = ref<'loading' | 'denied' | 'subscribed' | 'unsubscribed'>('loading')

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

async function checkPushStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    pushSupported.value = false
    return
  }
  pushSupported.value = true
  if (Notification.permission === 'denied') {
    pushStatus.value = 'denied'
    return
  }
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  pushStatus.value = sub ? 'subscribed' : 'unsubscribed'
}

async function subscribePush() {
  try {
    const { publicKey } = await $fetch<{ publicKey: string }>('/api/push/vapid-public-key')
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    })
    await $fetch('/api/push/subscribe', { method: 'POST', body: sub.toJSON() })
    pushStatus.value = 'subscribed'
  } catch (e) {
    console.error('Push subscribe failed', e)
    if (Notification.permission === 'denied') pushStatus.value = 'denied'
  }
}

async function unsubscribePush() {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await $fetch('/api/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } })
      await sub.unsubscribe()
    }
    pushStatus.value = 'unsubscribed'
  } catch (e) {
    console.error('Push unsubscribe failed', e)
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Confirm Dialog Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showConfirmDialog" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/60" @click="cancelDelete"></div>
          
          <!-- Dialog -->
          <div class="relative bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full animate-bounce-in">
            <div class="text-center">
              <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="text-3xl">🗑️</span>
              </div>
              <h3 class="text-xl font-bold text-gray-800 mb-2">ยืนยันลบออเดอร์?</h3>
              <p class="text-gray-500 mb-6">ออเดอร์นี้จะถูกยกเลิก</p>
              
              <div class="flex gap-3">
                <button 
                  @click="cancelDelete"
                  class="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-colors"
                >
                  ยกเลิก
                </button>
                <button 
                  @click="confirmDelete"
                  class="flex-1 py-3 px-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl transition-colors"
                >
                  ลบเลย
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Header -->
    <header class="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <NuxtLink to="/order" class="flex items-center gap-2 text-gray-600 hover:text-orange-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </NuxtLink>
        
        <div class="flex items-center gap-2">
          <span class="text-2xl">👨‍🍳</span>
          <h1 class="text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-red-500">
            ครัว
          </h1>
        </div>

        <div class="flex items-center gap-2">
          <span v-if="pending" class="animate-pulse text-orange-500">⏳</span>
          <span v-else class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <!-- Density toggle -->
          <div class="flex bg-gray-100 rounded-xl p-0.5 gap-0.5">
            <button @click="setViewMode('normal')" class="px-2 py-1 rounded-lg text-xs transition-colors" :class="viewMode === 'normal' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400'" title="ปกติ">🔲</button>
            <button @click="setViewMode('compact')" class="px-2 py-1 rounded-lg text-xs transition-colors" :class="viewMode === 'compact' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400'" title="กระชับ">▦</button>
          </div>

          <!-- Push notification toggle -->
          <button
            v-if="pushSupported && pushStatus !== 'loading'"
            @click="pushStatus === 'subscribed' ? unsubscribePush() : subscribePush()"
            class="px-2 py-1 rounded-lg text-xs font-medium transition-colors"
            :class="pushStatus === 'subscribed' ? 'bg-orange-100 text-orange-700' : pushStatus === 'denied' ? 'bg-red-100 text-red-400 cursor-not-allowed' : 'bg-gray-100 text-gray-500'"
            :title="pushStatus === 'subscribed' ? 'ปิด notification' : pushStatus === 'denied' ? 'ถูกบล็อก — เปิดใน Settings' : 'เปิด notification'"
            :disabled="pushStatus === 'denied'"
          >{{ pushStatus === 'subscribed' ? '🔔' : pushStatus === 'denied' ? '🔕' : '🔕' }}</button>
          <button @click="refresh()" class="text-gray-500 hover:text-gray-700">🔄</button>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 pb-32">
      <!-- Empty State -->
      <div v-if="orders.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
        <div class="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <span class="text-6xl">🍽️</span>
        </div>
        <h3 class="text-2xl font-bold text-gray-800 mb-2">ไม่มีออเดอร์</h3>
        <p class="text-gray-500">รอออเดอร์ใหม่...</p>
      </div>

      <!-- Orders Grid -->
      <div v-else :class="viewMode === 'compact'
        ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3'
        : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'">
        <div 
          v-for="(order, index) in orders" 
          :key="order.id"
          class="bg-white rounded-3xl overflow-hidden relative"
          :class="{
            'ring-2 ring-yellow-400': order.status === 'Pending',
            'ring-2 ring-orange-400': order.status === 'Cooking'
          }"
        >
          <!-- Delete Button (Top Right Corner) -->
          <button 
            @click="requestDelete(order.id)"
            :disabled="isDeleting === order.id"
            class="absolute top-2 right-2 z-10 w-8 h-8 bg-red-100 hover:bg-red-200 text-red-600 rounded-full flex items-center justify-center transition-colors text-sm"
            title="ลบออเดอร์"
          >
            <span v-if="isDeleting === order.id" class="animate-spin">⏳</span>
            <span v-else>✕</span>
          </button>

          <!-- Order Header (Simple: just list number) -->
          <div class="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span class="text-2xl font-black text-gray-800">{{ index + 1 }}.</span>
          </div>

          <!-- Order Items -->
          <div class="p-3 space-y-3">

            <!-- Compact mode: text list -->
            <template v-if="viewMode === 'compact'">
              <div
                v-for="item in order.items"
                :key="item.id"
                class="p-2 rounded-xl border border-gray-100 bg-gray-50"
              >
                <div class="flex items-start gap-1.5 flex-wrap">
                  <span class="font-black text-gray-800 text-sm">{{ item.menu_name }}</span>
                  <span class="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">x{{ item.quantity }}</span>
                  <span v-if="item.protein_type" class="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{{ item.protein_type }}</span>
                  <span v-if="item.is_special" class="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">⭐</span>
                  <span v-if="item.is_takeaway" class="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">📦</span>
                </div>
                <div v-if="item.options?.length" class="flex flex-wrap gap-1 mt-1">
                  <span v-for="opt in item.options" :key="opt.option_id" class="text-xs text-orange-600 font-medium">
                    +{{ opt.label }}{{ opt.quantity > 1 ? ` x${opt.quantity}` : '' }}
                  </span>
                </div>
                <p v-if="item.notes" class="text-xs text-yellow-700 mt-1 truncate">📝 {{ item.notes }}</p>
              </div>
            </template>

            <!-- Normal mode: large image cards -->
            <template v-else>
              <div
                v-for="item in order.items"
                :key="item.id"
                class="rounded-2xl overflow-hidden border border-gray-100"
              >
                <!-- Food Image (Large, Square) -->
                <div class="aspect-square relative bg-gray-100">
                  <img
                    v-if="item.image_url"
                    :src="item.image_url"
                    :alt="item.menu_name"
                    class="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  >
                  <div v-else class="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-orange-100 to-orange-50">
                    🍽️
                  </div>

                  <div
                    v-if="item.is_special"
                    class="absolute top-3 left-3 w-14 h-14 bg-yellow-400 rounded-full flex items-center justify-center animate-pulse"
                  >
                    <span class="text-3xl">⭐</span>
                  </div>

                  <div class="absolute top-3 right-3 bg-orange-500 text-white text-xl font-black px-4 py-2 rounded-full">
                    x{{ item.quantity }}
                  </div>

                  <div v-if="item.options?.length" class="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2">
                    <div
                      v-for="opt in item.options"
                      :key="opt.option_id"
                      class="relative"
                    >
                      <div
                        v-if="opt.image_url"
                        class="w-16 h-16 rounded-xl overflow-hidden border-3 border-white bg-white"
                      >
                        <img :src="opt.image_url" :alt="opt.label" class="w-full h-full object-cover" loading="lazy" decoding="async">
                        <div
                          v-if="opt.quantity > 1"
                          class="absolute -top-1 -right-1 w-6 h-6 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
                        >{{ opt.quantity }}</div>
                      </div>
                      <div
                        v-else
                        class="w-16 h-16 rounded-xl bg-orange-100 border-3 border-white flex items-center justify-center"
                      >
                        <span class="text-2xl">🍳</span>
                        <div
                          v-if="opt.quantity > 1"
                          class="absolute -top-1 -right-1 w-6 h-6 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
                        >{{ opt.quantity }}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Item Details -->
                <div class="p-3 bg-white">
                  <h4 class="font-black text-gray-800 text-xl mb-2">{{ item.menu_name }}</h4>
                  <div v-if="item.protein_type" class="mb-1">
                    <span class="text-sm bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{{ item.protein_type }}</span>
                  </div>

                  <div v-if="item.options?.length" class="flex flex-wrap gap-1 mb-2">
                    <span
                      v-for="opt in item.options"
                      :key="opt.option_id"
                      class="bg-orange-100 text-orange-700 text-sm px-2 py-0.5 rounded-full font-medium"
                    >{{ opt.label }}<span v-if="opt.quantity > 1"> x{{ opt.quantity }}</span></span>
                  </div>

                  <div class="flex flex-wrap gap-1.5">
                    <span v-if="item.is_special" class="text-sm bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">⭐ พิเศษ</span>
                    <span v-if="item.is_takeaway" class="text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">📦 กล่อง</span>
                  </div>

                  <div v-if="item.notes" class="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-xl">
                    <p class="text-yellow-800 text-sm font-medium">📝 {{ item.notes }}</p>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Action Buttons -->
          <div class="p-3 pt-0 flex gap-2">


            <button
              v-if="getNextStatus(order.status)"
              @click="updateStatus(order.id, getNextStatus(order.status)!)"
              :disabled="isUpdating === order.id"
              class="flex-1 py-4 rounded-2xl text-white font-bold text-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              :class="getButtonStyle(order.status)"
            >
              <span v-if="isUpdating === order.id" class="animate-spin">⏳</span>
              <span v-else>{{ getButtonText(order.status) }}</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.border-3 {
  border-width: 3px;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.animate-bounce-in {
  animation: bounceIn 0.3s ease-out;
}

@keyframes bounceIn {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
