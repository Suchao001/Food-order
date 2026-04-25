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

const orders = computed(() => ordersResult.value?.data || [])

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
      const hasNewOrders = newOrderIds.some((id: number) => !oldOrderIds.includes(id))
      
      if (hasNewOrders && oldOrderIds.length > 0) {
        playNotificationSound()
      }
      
      previousOrderIds.value = newOrderIds
    } catch (err) {
      console.error('Polling error:', err)
    } finally {
      if (isPolling.value) {
        pollTimeout.value = setTimeout(poll, 5000)
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

onMounted(() => {
  startPolling()
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
    await $fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      body: { status: newStatus }
    })
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

// Build TTS summary for an item
function buildItemSummary(item: any): string {
  let summary = `${item.menu_name} ${item.quantity} จาน`
  
  if (item.options?.length > 0) {
    const optionsText = item.options.map((o: any) => {
      return o.quantity > 1 ? `${o.label} ${o.quantity}` : o.label
    }).join(', ')
    summary += `, เพิ่ม ${optionsText}`
  }
  
  if (item.is_special) {
    summary += ', พิเศษ'
  }
  
  if (item.is_takeaway) {
    summary += ', ใส่กล่อง'
  }
  
  if (item.notes) {
    summary += `, ${item.notes}`
  }
  
  return summary
}

// TTS using Web Speech API
function speakItem(item: any) {
  const summary = buildItemSummary(item)
  
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(summary)
    utterance.lang = 'th-TH'
    utterance.rate = 0.9
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <!-- Confirm Dialog Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showConfirmDialog" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="cancelDelete"></div>
          
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
    <header class="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-gray-200/50">
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
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                >
                <div v-else class="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-orange-100 to-orange-50">
                  🍽️
                </div>
                
                <!-- Star overlay for Special -->
                <div 
                  v-if="item.is_special"
                  class="absolute top-3 left-3 w-14 h-14 bg-yellow-400 rounded-full flex items-center justify-center animate-pulse"
                >
                  <span class="text-3xl">⭐</span>
                </div>

                <!-- Quantity Badge -->
                <div class="absolute top-3 right-3 bg-orange-500 text-white text-xl font-black px-4 py-2 rounded-full">
                  x{{ item.quantity }}
                </div>

                <!-- Options with Images -->
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
                      <img :src="opt.image_url" :alt="opt.label" class="w-full h-full object-cover">
                      <div 
                        v-if="opt.quantity > 1"
                        class="absolute -top-1 -right-1 w-6 h-6 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
                      >
                        {{ opt.quantity }}
                      </div>
                    </div>
                    <div 
                      v-else
                      class="w-16 h-16 rounded-xl bg-orange-100 border-3 border-white flex items-center justify-center"
                    >
                      <span class="text-2xl">🍳</span>
                      <div 
                        v-if="opt.quantity > 1"
                        class="absolute -top-1 -right-1 w-6 h-6 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
                      >
                        {{ opt.quantity }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Item Details -->
              <div class="p-3 bg-white">
                <h4 class="font-black text-gray-800 text-xl mb-2">{{ item.menu_name }}</h4>

                <div v-if="item.options?.length" class="flex flex-wrap gap-1 mb-2">
                  <span 
                    v-for="opt in item.options" 
                    :key="opt.option_id"
                    class="bg-orange-100 text-orange-700 text-sm px-2 py-0.5 rounded-full font-medium"
                  >
                    {{ opt.label }}<span v-if="opt.quantity > 1"> x{{ opt.quantity }}</span>
                  </span>
                </div>

                <div class="flex flex-wrap gap-1.5">
                  <span v-if="item.is_special" class="text-sm bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">
                    ⭐ พิเศษ
                  </span>
                  <span v-if="item.is_takeaway" class="text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    📦 กล่อง
                  </span>
                </div>

                <div v-if="item.notes" class="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <p class="text-yellow-800 text-sm font-medium">📝 {{ item.notes }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="p-3 pt-0 flex gap-2">
            <button 
              v-if="order.items.length > 0"
              @click="speakItem(order.items[0])"
              class="w-16 h-14 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl flex items-center justify-center transition-all active:scale-95 text-2xl"
              title="อ่านออกเสียง"
            >
              🔊
            </button>

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
