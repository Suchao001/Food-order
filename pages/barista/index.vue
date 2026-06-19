<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

definePageMeta({
  layout: 'default'
})

// Fetch orders with status filter (only Pending and Cooking)
const activeStatuses = ref(['Pending', 'Cooking'])
const statusQuery = computed(() => activeStatuses.value.join(','))

const { data: ordersResult, refresh, pending } = await useFetch<{ success: boolean, data: any[] }>('/api/orders/orders-by-status', {
  query: { status: statusQuery },
  key: 'barista-orders',
  server: false,
  lazy: true
})

const allOrders = computed(() => ordersResult.value?.data || [])

// Filter orders so they only contain Barista (Beverages) & Bakery (Desserts) items
const orders = computed(() => {
  return allOrders.value
    .map((o: any) => {
      // Filter out non-barista/bakery items
      const baristaItems = o.items.filter((i: any) => i.menu_dept === 'Barista' || i.menu_dept === 'Bakery')
      return {
        ...o,
        items: baristaItems
      }
    })
    .filter((o: any) => o.items.length > 0) // Only show order if it contains drink/dessert items
})

// Polling
const isPolling = ref(false)
const pollTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const lastRefreshTime = ref(new Date())

// TTS voice readout state
const autoTts = ref(true)

function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime) // C5 note
    oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1) // E5 note
    oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2) // G5 note
    
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.6)
  } catch (e) {
    console.log('Audio not supported')
  }
}

const speak = (text: string) => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'th-TH'
    utterance.rate = 1.0
    window.speechSynthesis.speak(utterance)
  }
}

function speakOrder(order: any) {
  let text = `โต๊ะ ${order.location || 'ไม่ระบุโต๊ะ'}, ออเดอร์เครื่องดื่มมี `
  text += order.items.map((i: any) => {
    const opts = i.options?.map((o: any) => o.label).join(' ') || ''
    return `${i.menu_name} ${opts} ${i.quantity} แก้ว`
  }).join(', ')
  speak(text)
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
      
      const newOrders = orders.value.filter((o: any) => !oldOrderIds.includes(o.id))
      const hasNewOrders = newOrders.length > 0

      if (hasNewOrders && oldOrderIds.length > 0) {
        playNotificationSound()
        if (autoTts.value) {
          for (const order of newOrders) {
            speakOrder(order)
          }
        }
      }
    } catch (err) {
      console.error('Barista polling error:', err)
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

onMounted(() => {
  startPolling()
  const savedTts = localStorage.getItem('barista:auto-tts')
  if (savedTts !== null) autoTts.value = savedTts === 'true'
})

onUnmounted(() => {
  stopPolling()
})

const isUpdating = ref<number | null>(null)

// Barista Status Workflow: Pending (ชง) -> Cooking (ชงอยู่) -> Completed (เสร็จแล้ว)
function getNextStatus(currentStatus: string): string | null {
  const workflow: Record<string, string> = {
    'Pending': 'Cooking',
    'Cooking': 'Completed'
  }
  return workflow[currentStatus] || null
}

function getButtonText(status: string): string {
  if (status === 'Pending') return '☕ เริ่มชง'
  return '✅ เสร็จแล้ว'
}

function getButtonStyle(status: string) {
  if (status === 'Pending') {
    return 'bg-blue-600 hover:bg-blue-750 text-white font-bold'
  }
  return 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold'
}

async function updateStatus(orderId: number, newStatus: string) {
  isUpdating.value = orderId
  try {
    const order = orders.value.find((o: any) => o.id === orderId)
    if (order && order.items.length > 0) {
      let itemTargetStatus = 'Pending'
      if (newStatus === 'Cooking') {
        itemTargetStatus = 'Preparing'
      } else if (newStatus === 'Completed') {
        itemTargetStatus = 'Ready'
      }

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
    console.error('Failed to update drink item status:', error)
  } finally {
    isUpdating.value = null
  }
}

function toggleTts() {
  autoTts.value = !autoTts.value
  localStorage.setItem('barista:auto-tts', String(autoTts.value))
}
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
    
    <!-- Top Bar -->
    <header class="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
      <div class="flex items-center gap-3">
        <NuxtLink to="/" class="text-lg">🏠</NuxtLink>
        <h1 class="text-2xl font-black text-white flex items-center gap-2">
          ☕ บาร์น้ำและขนม (Barista Screen)
        </h1>
        <span class="text-xs bg-blue-900 text-blue-200 font-bold px-2 py-0.5 rounded-full">
          {{ orders.length }} คิวรอชง
        </span>
      </div>

      <div class="flex items-center gap-4">
        <!-- Speak voice switch -->
        <button 
          @click="toggleTts"
          :class="`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 border transition-all ${
            autoTts 
              ? 'bg-blue-600/20 text-blue-400 border-blue-500/40' 
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`"
        >
          <span>{{ autoTts ? '🔊 อ่านอัตโนมัติ' : '🔇 ปิดเสียงพูด' }}</span>
        </button>

        <button 
          @click="refresh"
          class="bg-slate-800 hover:bg-slate-750 border border-slate-700 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
        >
          🔄 โหลดใหม่
        </button>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="flex-1 p-6 overflow-y-auto">
      <div v-if="pending && orders.length === 0" class="flex flex-col items-center justify-center py-32 text-slate-400">
        <span class="text-4xl animate-spin mb-4">⏳</span>
        <p class="text-lg">กำลังโหลดออร์เดอร์เครื่องดื่ม...</p>
      </div>

      <div v-else-if="orders.length === 0" class="flex flex-col items-center justify-center py-32 text-slate-500 text-center">
        <span class="text-6xl mb-4 block">☕</span>
        <h3 class="text-xl font-bold text-slate-400">ไม่มีคิวเครื่องดื่ม</h3>
        <p class="text-sm text-slate-500 mt-1">ออร์เดอร์ที่สั่งชงใหม่จะปรากฏที่หน้านี้อัตโนมัติ</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <!-- Order Queue Card -->
        <div 
          v-for="order in orders" 
          :key="order.id"
          :class="`bg-slate-900 border rounded-2xl overflow-hidden flex flex-col justify-between ${
            order.status === 'Cooking' ? 'border-blue-500 shadow-lg shadow-blue-900/10' : 'border-slate-800'
          }`"
        >
          <!-- Card Header -->
          <div class="bg-slate-850 p-4 border-b border-slate-800/60 flex items-center justify-between">
            <div>
              <span class="text-xs text-slate-400 font-bold block">ออร์เดอร์ #{{ order.id }}</span>
              <span class="text-lg font-black text-white">📍 โต๊ะ: {{ order.location || 'หน้าร้าน' }}</span>
            </div>
            <span class="text-xs text-slate-400 font-medium">
              {{ new Date(order.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) }}
            </span>
          </div>

          <!-- Items list (optimized for cashier - large clean text) -->
          <div class="p-4 flex-1 space-y-3">
            <div 
              v-for="item in order.items" 
              :key="item.id"
              class="border border-slate-800 bg-slate-950/40 p-3 rounded-xl flex items-center justify-between"
            >
              <div>
                <div class="flex items-baseline gap-2">
                  <h4 class="font-extrabold text-white text-lg leading-tight">{{ item.menu_name }}</h4>
                  <span class="text-sm text-blue-400 font-bold">x{{ item.quantity }}</span>
                </div>
                
                <!-- Drink options (ice, sugar) -->
                <div class="flex flex-wrap gap-1.5 mt-2">
                  <span 
                    v-for="opt in item.options" 
                    :key="opt.option_id"
                    class="bg-blue-950 text-blue-300 text-xs px-2 py-0.5 rounded-full border border-blue-900/35"
                  >
                    + {{ opt.label }}
                  </span>
                  
                  <span v-if="item.is_takeaway" class="bg-orange-950 text-orange-400 text-xs px-2 py-0.5 rounded-full">
                    📦 ใส่แก้วกลับบ้าน
                  </span>
                </div>

                <p v-if="item.notes" class="text-xs text-yellow-500 mt-2 italic">
                  📝 {{ item.notes }}
                </p>
              </div>

              <!-- Item Ready checkmark indicator -->
              <div v-if="item.status === 'Ready'" class="text-emerald-400 font-bold text-lg" title="แผนกนี้ทำเสร็จแล้ว">
                ✅
              </div>
            </div>
          </div>

          <!-- Card Actions -->
          <div class="p-4 pt-0 flex gap-2">
            <!-- Speak order button -->
            <button 
              @click="speakOrder(order)"
              class="w-12 h-12 bg-slate-800 hover:bg-slate-750 text-white rounded-xl flex items-center justify-center transition-colors text-xl"
              title="อ่านออกเสียงรายการ"
            >
              🔊
            </button>

            <!-- Status progress button -->
            <button 
              v-if="getNextStatus(order.status)"
              @click="updateStatus(order.id, getNextStatus(order.status)!)"
              :disabled="isUpdating === order.id"
              class="flex-1 py-3.5 rounded-xl text-center text-sm font-black transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              :class="getButtonStyle(order.status)"
            >
              <span v-if="isUpdating === order.id" class="animate-spin text-sm">⏳</span>
              <span v-else>{{ getButtonText(order.status) }}</span>
            </button>
          </div>

        </div>
      </div>
    </main>

  </div>
</template>
