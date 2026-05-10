<script setup lang="ts">
// Fetch menus and options
const { data: menuResult } = await useFetch('/api/menus')
const { data: optionResult } = await useFetch('/api/options')

const menus = computed(() => menuResult.value?.data || [])
const options = computed(() => optionResult.value?.data || [])

// Cart state: array of cart items
interface CartItem {
  menuId: number
  menuName: string
  basePrice: number
  selectedOptions: { optionId: number, quantity: number, label: string, extraPrice: number }[]
  totalPrice: number
  quantity: number
  isTakeaway: boolean
  isSpecial: boolean
  notes: string
  proteinType: string
}

const cart = ref<CartItem[]>([])

// Modal state
const showModal = ref(false)
const selectedMenu = ref<any>(null)
const optionQuantities = reactive<Record<number, number>>({})
const dishQuantity = ref(1)
const editingIndex = ref<number | null>(null)

// Extra options
const isTakeaway = ref(false)
const isSpecial = ref(false)
const specialPrice = 10
const notes = ref('')

// Protein selector
const proteins = ['หมู', 'หมูสับ', 'หมูชิ้น', 'ไก่']
const selectedProtein = ref('หมู')

// Quick note presets
const quickNotes = ['เผ็ดมาก', 'เผ็ดน้อย', 'ไม่เผ็ด', 'ข้าวน้อย', 'ข้าวมาก', 'ไม่ใส่ผัก', 'ไม่ใส่หอม']

const addQuickNote = (note: string) => {
  if (notes.value) {
    notes.value += ', ' + note
  } else {
    notes.value = note
  }
}

const closeModal = () => {
  showModal.value = false
  editingIndex.value = null
  editingOrderItem.value = null
  selectedMenu.value = null
}

// Add directly with defaults (no modal)
const addDirectToCart = (menu: any) => {
  cart.value.push({
    menuId: menu.id,
    menuName: menu.name,
    basePrice: Number(menu.base_price),
    selectedOptions: [],
    totalPrice: Number(menu.base_price),
    quantity: 1,
    isTakeaway: false,
    isSpecial: false,
    notes: '',
    proteinType: 'หมู'
  })
}

// Open modal when clicking card
const openOptionsModal = (menu: any) => {
  selectedMenu.value = menu
  Object.keys(optionQuantities).forEach(key => delete optionQuantities[Number(key)])
  dishQuantity.value = 1
  isTakeaway.value = false
  isSpecial.value = false
  notes.value = ''
  selectedProtein.value = 'หมู'
  editingIndex.value = null
  showModal.value = true
}

// Get option quantity
const getOptionQty = (id: number) => optionQuantities[id] || 0

// Increment/Decrement option
const incrementOption = (id: number) => {
  optionQuantities[id] = (optionQuantities[id] || 0) + 1
}
const decrementOption = (id: number) => {
  if (optionQuantities[id] && optionQuantities[id] > 0) {
    optionQuantities[id]--
  }
}

// Calculate current item price (base + selected options + special) - per dish
const pricePerDish = computed(() => {
  if (!selectedMenu.value) return 0
  let total = Number(selectedMenu.value.base_price)
  // Add options
  for (const opt of options.value) {
    const qty = optionQuantities[opt.id] || 0
    total += qty * Number(opt.extra_price)
  }
  // Add special
  if (isSpecial.value) {
    total += specialPrice
  }
  return total
})

// Total price including dish quantity
const currentItemPrice = computed(() => {
  return pricePerDish.value * dishQuantity.value
})

// Dish quantity controls
const incrementDish = () => {
  dishQuantity.value++
}
const decrementDish = () => {
  if (dishQuantity.value > 1) dishQuantity.value--
}

// Add to cart with selected options
const addToCart = async () => {
  if (!selectedMenu.value) return

  const selectedOpts = options.value
    .filter((opt: any) => optionQuantities[opt.id] > 0)
    .map((opt: any) => ({
      optionId: opt.id,
      quantity: optionQuantities[opt.id],
      label: opt.label,
      extraPrice: Number(opt.extra_price)
    }))

  // Editing a submitted order item (from tracker panel)
  if (editingOrderItem.value) {
    try {
      await $fetch(`/api/orders/items/${editingOrderItem.value.itemId}`, {
        method: 'PATCH',
        body: {
          quantity: dishQuantity.value,
          notes: notes.value,
          proteinType: selectedProtein.value,
          isTakeaway: isTakeaway.value,
          isSpecial: isSpecial.value,
          itemPrice: pricePerDish.value,
          selectedOptions: selectedOpts
        }
      })
      await refreshTracker()
    } catch (e: any) {
      alert('แก้ไขไม่สำเร็จ: ' + (e.data?.message || e.message || 'เกิดข้อผิดพลาด'))
    }
    closeModal()
    return
  }

  const newItem: CartItem = {
    menuId: selectedMenu.value.id,
    menuName: selectedMenu.value.name,
    basePrice: Number(selectedMenu.value.base_price),
    selectedOptions: selectedOpts,
    totalPrice: pricePerDish.value,
    quantity: dishQuantity.value,
    isTakeaway: isTakeaway.value,
    isSpecial: isSpecial.value,
    notes: notes.value,
    proteinType: selectedProtein.value
  }

  if (editingIndex.value !== null) {
    cart.value[editingIndex.value] = newItem
  } else {
    cart.value.push(newItem)
  }
  closeModal()
}

const editCartItem = (index: number) => {
  const item = cart.value[index]
  const menu = menus.value.find((m: any) => m.id === item.menuId)
  if (!menu) return
  editingIndex.value = index
  selectedMenu.value = menu
  Object.keys(optionQuantities).forEach(key => delete optionQuantities[Number(key)])
  for (const opt of item.selectedOptions) {
    optionQuantities[opt.optionId] = opt.quantity
  }
  dishQuantity.value = item.quantity
  isTakeaway.value = item.isTakeaway
  isSpecial.value = item.isSpecial
  notes.value = item.notes
  selectedProtein.value = item.proteinType || 'หมู'
  showCartModal.value = false
  showModal.value = true
}

// Cart summary
const totalItems = computed(() => cart.value.reduce((sum, item) => sum + item.quantity, 0))
const totalPrice = computed(() => cart.value.reduce((sum, item) => sum + item.totalPrice * item.quantity, 0))

// Get quantity of a menu in cart (for display on cards)
const getMenuCartCount = (menuId: number) => {
  return cart.value.filter(item => item.menuId === menuId).length
}

// Cart modal
const showCartModal = ref(false)

// Cart item management
const incrementCartItem = (index: number) => {
  cart.value[index].quantity++
}

const decrementCartItem = (index: number) => {
  if (cart.value[index].quantity > 1) {
    cart.value[index].quantity--
  } else {
    // Remove item if quantity becomes 0
    removeCartItem(index)
  }
}

const removeCartItem = (index: number) => {
  cart.value.splice(index, 1)
  if (cart.value.length === 0) {
    showCartModal.value = false
  }
}

const clearCart = () => {
  cart.value = []
  showCartModal.value = false
}

// Submit order to API
const isSubmitting = ref(false)
const orderSuccess = ref(false)
const submittedOrderId = ref<number | null>(null)

const submitOrder = async () => {
  if (cart.value.length === 0 || isSubmitting.value) return

  isSubmitting.value = true
  try {
    const response = await $fetch<{ success: boolean, data: { orderId: number, message: string } }>('/api/orders', {
      method: 'POST',
      body: {
        items: cart.value,
        totalPrice: totalPrice.value,
        location: null
      }
    })

    if (response.success) {
      pushSession(response.data.orderId)
      await refreshTracker()
      submittedOrderId.value = response.data.orderId
      orderSuccess.value = true
      cart.value = []
      showCartModal.value = false

      setTimeout(() => {
        orderSuccess.value = false
        submittedOrderId.value = null
      }, 5000)
    }
  } catch (error: any) {
    console.error('Order submission failed:', error)
    alert('เกิดข้อผิดพลาด: ' + (error.data?.message || error.message || 'ไม่ทราบสาเหตุ'))
  } finally {
    isSubmitting.value = false
  }
}

// ─── Session Order Tracker ─────────────────────────────────────────────
const SESSION_KEY = 'food-order:my-orders'
const SESSION_MAX_AGE = 6 * 60 * 60 * 1000

interface SessionEntry { id: number; ts: number }

const mySessionIds = ref<number[]>([])

function loadSession(): number[] {
  if (!import.meta.client) return []
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return []
    const arr: SessionEntry[] = JSON.parse(raw)
    const cut = Date.now() - SESSION_MAX_AGE
    const valid = arr.filter(e => e.ts > cut)
    localStorage.setItem(SESSION_KEY, JSON.stringify(valid))
    return valid.map(e => e.id)
  } catch { return [] }
}

function pushSession(id: number) {
  if (!import.meta.client) return
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    const arr: SessionEntry[] = raw ? JSON.parse(raw) : []
    const cut = Date.now() - SESSION_MAX_AGE
    const valid = arr.filter(e => e.ts > cut && e.id !== id)
    valid.push({ id, ts: Date.now() })
    localStorage.setItem(SESSION_KEY, JSON.stringify(valid))
    mySessionIds.value = valid.map(e => e.id)
  } catch {}
}

const { data: trackerResult, refresh: refreshTracker } = await useFetch('/api/orders/by-ids', {
  query: computed(() => ({ ids: mySessionIds.value.join(',') })),
  server: false,
  lazy: true,
  watch: false
})

const trackedOrders = computed(() => (trackerResult.value?.data || []) as any[])
const showTrackerDrawer = ref(false)

let trackerPoll: ReturnType<typeof setTimeout> | null = null

async function pollTracker() {
  if (mySessionIds.value.length > 0) {
    try { await refreshTracker() } catch {}
  }
  trackerPoll = setTimeout(pollTracker, 5000)
}

function getStatusLabel(status: string) {
  const m: Record<string, string> = {
    Pending: '⏳ รอรับออเดอร์', Cooking: '🍳 กำลังทำ',
    Ready: '✅ พร้อมเสิร์ฟ', Completed: '🎉 เสร็จ', Cancelled: '❌ ยกเลิก'
  }
  return m[status] || status
}

function getStatusColor(status: string) {
  const m: Record<string, string> = {
    Pending: 'bg-yellow-100 text-yellow-800',
    Cooking: 'bg-orange-100 text-orange-800',
    Ready: 'bg-green-100 text-green-800',
    Completed: 'bg-gray-100 text-gray-500',
    Cancelled: 'bg-red-100 text-red-500'
  }
  return m[status] || 'bg-gray-100 text-gray-500'
}

// View mode density toggle
const viewMode = ref<'normal' | 'compact'>('normal')

function setViewMode(mode: 'normal' | 'compact') {
  viewMode.value = mode
  localStorage.setItem('order:view-mode', mode)
}

// Tracker panel open/close
const trackerOpen = ref(true)

function toggleTracker() {
  trackerOpen.value = !trackerOpen.value
  localStorage.setItem('order:tracker-open', String(trackerOpen.value))
}

// Filter out completed/cancelled from display
const visibleTrackedOrders = computed(() =>
  trackedOrders.value.filter((o: any) => !['Completed', 'Cancelled'].includes(o.status))
)

// Edit submitted order item (Pending only)
const editingOrderItem = ref<{ itemId: number; orderId: number } | null>(null)

function openTrackerItemEdit(item: any, order: any) {
  if (order.status !== 'Pending') return
  const menu = menus.value.find((m: any) => m.id === item.menu_id)
  if (!menu) return
  editingOrderItem.value = { itemId: item.id, orderId: order.id }
  selectedMenu.value = menu
  Object.keys(optionQuantities).forEach(key => delete optionQuantities[Number(key)])
  for (const opt of item.options || []) {
    optionQuantities[opt.option_id] = opt.quantity
  }
  dishQuantity.value = item.quantity
  isTakeaway.value = item.is_takeaway
  isSpecial.value = item.is_special
  notes.value = item.notes || ''
  selectedProtein.value = item.protein_type || 'หมู'
  editingIndex.value = null
  showTrackerDrawer.value = false
  showModal.value = true
}

onMounted(() => {
  mySessionIds.value = loadSession()
  pollTracker()
  const savedMode = localStorage.getItem('order:view-mode')
  if (savedMode === 'compact') viewMode.value = 'compact'
  const savedOpen = localStorage.getItem('order:tracker-open')
  if (savedOpen !== null) trackerOpen.value = savedOpen !== 'false'
})

onUnmounted(() => {
  if (trackerPoll) clearTimeout(trackerPoll)
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Success Toast -->
    <Transition name="slide-up">
      <div 
        v-if="orderSuccess"
        class="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3"
      >
        <span class="text-2xl">✅</span>
        <div>
          <p class="font-bold">สั่งอาหารสำเร็จ!</p>
          <p class="text-sm text-green-100">Order #{{ submittedOrderId }}</p>
        </div>
        <button @click="orderSuccess = false" class="ml-2 text-green-200 hover:text-white">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </Transition>
    <!-- Header -->
    <header class="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2 text-gray-600 hover:text-orange-600 transition-colors group">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </NuxtLink>
        
        <div class="flex items-center gap-2">
          <span class="text-2xl">🍜</span>
          <h1 class="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-red-500">
            Menu
          </h1>
        </div>

        <div class="flex items-center gap-2">
          <!-- Density toggle -->
          <div class="flex bg-gray-100 rounded-xl p-0.5 gap-0.5">
            <button @click="setViewMode('normal')" class="px-2 py-1.5 rounded-lg text-sm transition-colors" :class="viewMode === 'normal' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400'" title="ปกติ">🔲</button>
            <button @click="setViewMode('compact')" class="px-2 py-1.5 rounded-lg text-sm transition-colors" :class="viewMode === 'compact' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400'" title="กระชับ">▦</button>
          </div>
          <!-- Kitchen Panel Link -->
          <NuxtLink
            to="/kitchen"
            class="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-medium transition-all shadow-lg hover:shadow-xl"
          >
            <span class="text-xl">👨‍🍳</span>
            <span class="hidden sm:inline">ครัว</span>
          </NuxtLink>
        </div>
      </div>
    </header>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-40">
      <div :class="trackerOpen ? 'lg:grid lg:grid-cols-[1fr_300px] lg:gap-6 lg:items-start' : ''">
      <div><!-- left column -->

      <!-- Menu Grid -->
      <div :class="viewMode === 'compact'
        ? 'grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3'
        : 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6'">
        <div
          v-for="menu in menus"
          :key="menu.id"
          @click="openOptionsModal(menu)"
          class="relative bg-white rounded-3xl shadow-sm overflow-hidden flex flex-col cursor-pointer active:scale-[0.97] transition-transform"
          :class="{ 'ring-2 ring-orange-400 ring-offset-2': getMenuCartCount(menu.id) > 0 }"
        >
          <!-- Image Container -->
          <div
            class="relative overflow-hidden bg-gray-100"
            :class="viewMode === 'compact' ? 'aspect-[4/3]' : 'aspect-square'"
          >
            <img
              :src="menu.image_url"
              :alt="menu.name"
              class="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            >

            <div class="absolute bottom-2 left-2">
              <span
                class="text-white drop-shadow-lg bg-black/40 rounded-md"
                :class="viewMode === 'compact' ? 'font-bold text-xs px-1.5 py-0.5' : 'font-black text-xl px-2 py-1'"
              >฿{{ menu.base_price }}</span>
            </div>

            <!-- Cart Count Badge -->
            <div
              v-if="getMenuCartCount(menu.id) > 0"
              class="absolute bg-orange-500 text-white rounded-full flex items-center justify-center font-bold shadow-lg"
              :class="viewMode === 'compact' ? 'top-1 right-1 w-5 h-5 text-xs' : 'top-3 right-3 w-10 h-10 text-lg'"
            >
              {{ getMenuCartCount(menu.id) }}
            </div>
          </div>

          <!-- Content -->
          <div class="flex-grow" :class="viewMode === 'compact' ? 'p-2 pb-8' : 'p-3 sm:p-4 pb-10'">
            <h3
              class="font-bold text-gray-800 leading-tight line-clamp-2"
              :class="viewMode === 'compact' ? 'text-xs' : 'text-sm sm:text-base'"
            >{{ menu.name }}</h3>
          </div>

          <!-- Add button: absolute bottom-right — adds directly with defaults -->
          <button
            @click.stop="addDirectToCart(menu)"
            class="absolute bottom-2 right-2 bg-gradient-to-r from-orange-400 to-red-500 text-white shadow-md rounded-xl flex items-center justify-center"
            :class="viewMode === 'compact' ? 'w-9 h-9' : 'w-11 h-11'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" :class="viewMode === 'compact' ? 'h-4 w-4' : 'h-6 w-6'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Empty State -->
      <div v-if="!menus || menus.length === 0" class="flex flex-col items-center justify-center py-24 text-center">
        <div class="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center mb-8">
          <span class="text-6xl">🍽️</span>
        </div>
        <h3 class="text-2xl font-bold text-gray-800 mb-3">ยังไม่มีเมนูอาหาร</h3>
        <p class="text-gray-500 max-w-sm">กรุณาเพิ่มเมนูในหน้าผู้ดูแลระบบก่อน</p>
      </div>
      </div><!-- /left column -->

      <!-- Right: Order Tracker Panel (lg+ only) -->
      <aside v-show="trackerOpen" class="hidden lg:block sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
        <div class="bg-white rounded-3xl shadow-sm overflow-hidden">
          <div class="p-3 border-b border-gray-100 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <h2 class="font-bold text-gray-800 text-sm">📋 ออเดอร์ของฉัน</h2>
              <span v-if="visibleTrackedOrders.length" class="w-5 h-5 bg-orange-500 text-white rounded-full text-xs flex items-center justify-center font-bold">{{ visibleTrackedOrders.length }}</span>
            </div>
            <button @click="toggleTracker" class="w-7 h-7 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 transition-colors" title="ปิดแถบ">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>

          <div v-if="visibleTrackedOrders.length === 0" class="p-6 text-center text-gray-400">
            <p class="text-sm mb-1">ยังไม่มีออเดอร์</p>
            <p class="text-xs">สั่งอาหารแล้วจะแสดงที่นี่</p>
          </div>

          <div v-else class="divide-y divide-gray-50">
            <div v-for="order in visibleTrackedOrders" :key="order.id" class="p-3">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs text-gray-400 font-medium">#{{ order.id }}</span>
                <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="getStatusColor(order.status)">
                  {{ getStatusLabel(order.status) }}
                </span>
              </div>
              <div class="space-y-1">
                <div v-for="item in order.items" :key="item.id" class="flex items-center gap-1.5 text-xs text-gray-700">
                  <span class="font-medium flex-1 truncate">{{ item.menu_name }}</span>
                  <span class="text-gray-400 flex-shrink-0">x{{ item.quantity }}</span>
                  <span v-if="item.protein_type && item.protein_type !== 'หมู'" class="text-amber-600 flex-shrink-0">({{ item.protein_type }})</span>
                  <!-- Edit button (Pending only) -->
                  <button
                    v-if="order.status === 'Pending'"
                    @click="openTrackerItemEdit(item, order)"
                    class="w-5 h-5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                    title="แก้ไข"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                </div>
              </div>
              <p class="text-xs text-gray-400 mt-1.5">฿{{ Number(order.total_price).toLocaleString() }}</p>
            </div>
          </div>
        </div>
      </aside>

      <!-- Reopen tab (lg+, when panel is closed) -->
      <button
        v-show="!trackerOpen"
        @click="toggleTracker"
        class="hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 z-20 bg-white shadow-lg border border-gray-200 rounded-l-xl px-2 py-4 flex-col items-center gap-1.5 text-gray-500 hover:text-orange-500 hover:bg-orange-50 transition-colors"
        title="เปิดแถบออเดอร์"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        <span class="text-xs" style="writing-mode:vertical-rl">📋 ออเดอร์</span>
        <span v-if="visibleTrackedOrders.length" class="w-5 h-5 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{{ visibleTrackedOrders.length }}</span>
      </button>
      </div><!-- /lg:grid -->
    </div>

    <!-- Mobile: tracker floating button -->
    <Transition name="slide-up">
      <button
        v-if="visibleTrackedOrders.length > 0"
        @click="showTrackerDrawer = true"
        class="fixed bottom-28 right-4 z-30 bg-gray-800 text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg lg:hidden"
      >
        <span class="text-xl">📋</span>
        <span class="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full text-xs flex items-center justify-center font-bold">{{ visibleTrackedOrders.length }}</span>
      </button>
    </Transition>

    <!-- Mobile: tracker drawer -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showTrackerDrawer" class="fixed inset-0 z-50 flex items-end justify-center lg:hidden">
          <div class="absolute inset-0 bg-black/60" @click="showTrackerDrawer = false"></div>
          <div class="relative bg-white w-full max-w-lg max-h-[70vh] rounded-t-3xl shadow-2xl overflow-hidden flex flex-col animate-slide-up">
            <div class="p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h2 class="font-bold text-gray-800">📋 ออเดอร์ของฉัน</h2>
              <button @click="showTrackerDrawer = false" class="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-500 transition-colors">✕</button>
            </div>
            <div class="flex-1 overflow-y-auto">
              <div v-if="visibleTrackedOrders.length === 0" class="p-8 text-center text-gray-400 text-sm">ยังไม่มีออเดอร์ที่กำลังดำเนินการ</div>
              <div v-else class="divide-y divide-gray-50">
                <div v-for="order in visibleTrackedOrders" :key="order.id" class="p-4">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm text-gray-500 font-medium">#{{ order.id }}</span>
                    <span class="text-sm px-3 py-0.5 rounded-full font-medium" :class="getStatusColor(order.status)">
                      {{ getStatusLabel(order.status) }}
                    </span>
                  </div>
                  <div class="space-y-1.5">
                    <div v-for="item in order.items" :key="item.id" class="flex items-center gap-2 text-sm text-gray-700">
                      <span class="font-medium flex-1">{{ item.menu_name }}</span>
                      <span class="text-gray-400">x{{ item.quantity }}</span>
                      <span v-if="item.protein_type && item.protein_type !== 'หมู'" class="text-amber-600 text-xs">({{ item.protein_type }})</span>
                      <button
                        v-if="order.status === 'Pending'"
                        @click="openTrackerItemEdit(item, order)"
                        class="w-6 h-6 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                        title="แก้ไข"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      </button>
                    </div>
                  </div>
                  <p class="text-sm text-gray-400 mt-1.5">฿{{ Number(order.total_price).toLocaleString() }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Options Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showModal && selectedMenu"
          class="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black/60"
            @click="closeModal"
          ></div>

          <!-- Modal Content: 2-col on sm+, single-col scroll on mobile -->
          <div class="relative bg-white w-full max-w-5xl max-h-[95vh] sm:min-h-[75vh] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-slide-up">

            <div class="flex-1 min-h-0 overflow-y-auto sm:overflow-hidden sm:flex sm:flex-row">

              <!-- LEFT: image + protein + checkboxes + qty -->
              <div class="sm:w-[300px] sm:flex-shrink-0 sm:flex sm:flex-col sm:overflow-y-auto sm:border-r sm:border-gray-100">

                <!-- Image -->
                <div class="relative h-44 sm:h-52 bg-gray-100 flex-shrink-0">
                  <img
                    :src="selectedMenu.image_url"
                    :alt="selectedMenu.name"
                    class="w-full h-full object-cover"
                  >
                  <div class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent"></div>
                  <button
                    @click="closeModal"
                    class="absolute top-4 right-4 w-9 h-9 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <div class="absolute bottom-4 left-4 right-12">
                    <h2 class="text-xl font-black text-white leading-tight line-clamp-1">{{ selectedMenu.name }}</h2>
                    <p class="text-white/80 text-base">฿{{ selectedMenu.base_price }}</p>
                  </div>
                </div>

                <!-- Protein Selector -->
                <div class="p-4 border-b border-gray-100">
                  <p class="text-sm font-semibold text-gray-500 mb-3">🥩 เนื้อสัตว์</p>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="p in proteins"
                      :key="p"
                      @click="selectedProtein = p"
                      class="px-4 py-2 rounded-xl text-base font-medium transition-colors"
                      :class="selectedProtein === p ? 'bg-orange-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
                    >{{ p }}</button>
                  </div>
                </div>

                <!-- Takeaway + Special -->
                <div class="p-4 border-b border-gray-100">
                  <div class="flex gap-3 flex-wrap">
                    <label
                      class="flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-colors text-base"
                      :class="isTakeaway ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-300' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
                    >
                      <input type="checkbox" v-model="isTakeaway" class="hidden">
                      <span>📦</span><span class="font-medium">ใส่กล่อง</span>
                    </label>
                    <label
                      class="flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-colors text-base"
                      :class="isSpecial ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-300' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
                    >
                      <input type="checkbox" v-model="isSpecial" class="hidden">
                      <span>⭐</span><span class="font-medium">พิเศษ</span>
                      <span class="text-sm px-2 py-0.5 bg-orange-500 text-white rounded-full">+฿10</span>
                    </label>
                  </div>
                </div>

                <!-- Qty -->
                <div class="p-5 sm:mt-auto">
                  <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span class="text-gray-700 text-base font-medium">จำนวน (จาน)</span>
                    <div class="flex items-center gap-3">
                      <button
                        @click="decrementDish"
                        :disabled="dishQuantity <= 1"
                        class="w-10 h-10 bg-white border-2 border-gray-200 rounded-xl flex items-center justify-center text-gray-600 hover:border-orange-400 hover:text-orange-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-colors text-lg"
                      >−</button>
                      <span class="w-10 text-center font-black text-xl text-gray-800">{{ dishQuantity }}</span>
                      <button
                        @click="incrementDish"
                        class="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white hover:bg-orange-600 font-bold transition-colors text-lg"
                      >+</button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- RIGHT: options + notes -->
              <div class="sm:flex-1 sm:overflow-y-auto border-t sm:border-t-0 border-gray-100">

                <!-- Options (no collapse) -->
                <div class="p-5 border-b border-gray-100">
                  <p class="font-bold text-gray-700 text-base mb-4">🍳 Options เพิ่มเติม</p>
                  <div v-if="options.length === 0" class="text-base text-gray-400 py-2">ไม่มี Options ให้เลือก</div>
                  <div class="flex flex-wrap gap-2.5">
                    <div
                      v-for="option in options"
                      :key="option.id"
                      class="flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors"
                      :class="getOptionQty(option.id) > 0 ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-200'"
                    >
                      <div v-if="option.image_url" class="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                        <img :src="option.image_url" :alt="option.label" class="w-full h-full object-cover" loading="lazy" decoding="async">
                      </div>
                      <span class="text-base font-medium text-gray-700">{{ option.label }}</span>
                      <span class="text-sm text-orange-500">+฿{{ option.extra_price }}</span>

                      <div v-if="getOptionQty(option.id) === 0">
                        <button
                          @click="incrementOption(option.id)"
                          class="w-8 h-8 bg-gray-200 hover:bg-orange-200 rounded-lg flex items-center justify-center text-gray-600 hover:text-orange-600 transition-colors"
                        >
                          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
                          </svg>
                        </button>
                      </div>
                      <div v-else class="flex items-center gap-1">
                        <button @click="decrementOption(option.id)" class="w-8 h-8 bg-orange-100 hover:bg-orange-200 text-orange-600 rounded-lg flex items-center justify-center font-bold text-sm transition-colors">−</button>
                        <span class="w-6 text-center font-bold text-orange-600 text-sm">{{ getOptionQty(option.id) }}</span>
                        <button @click="incrementOption(option.id)" class="w-8 h-8 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center justify-center font-bold text-sm transition-colors">+</button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Notes (no collapse) -->
                <div class="p-5">
                  <p class="font-bold text-gray-700 text-base mb-3">📝 คำอธิบายเพิ่มเติม</p>
                  <div class="flex flex-wrap gap-2 mb-3">
                    <button
                      v-for="qn in quickNotes"
                      :key="qn"
                      @click="addQuickNote(qn)"
                      class="px-3 py-1.5 bg-gray-100 hover:bg-orange-100 text-gray-700 hover:text-orange-700 rounded-full text-sm font-medium transition-colors"
                    >{{ qn }}</button>
                  </div>
                  <textarea
                    v-model="notes"
                    placeholder="เขียนคำอธิบายเพิ่มเติมที่นี่..."
                    rows="4"
                    class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none resize-none text-gray-700 text-base"
                  ></textarea>
                </div>

              </div>
            </div>

            <!-- Modal footer: price + CTA at right -->
            <div class="flex-shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-between gap-4 bg-white">
              <div>
                <p class="text-gray-400 text-sm">฿{{ pricePerDish }} × {{ dishQuantity }} จาน</p>
                <p class="text-3xl font-black text-orange-600">฿{{ currentItemPrice.toLocaleString() }}</p>
              </div>
              <button
                @click="addToCart"
                class="px-8 py-4 rounded-2xl bg-gradient-to-r from-orange-400 to-red-500 text-white text-lg font-bold shadow-lg shadow-orange-200 active:scale-95 transition-transform flex-shrink-0"
              >
                {{ editingOrderItem ? 'บันทึก (ออเดอร์ที่สั่ง)' : editingIndex !== null ? 'บันทึกการแก้ไข' : `เพิ่ม ${dishQuantity} จาน` }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Floating Cart Summary (Clickable) -->
    <Transition name="slide-up">
      <div 
        v-if="totalItems > 0"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg z-40"
      >
        <div 
          @click="showCartModal = true"
          class="bg-gradient-to-r from-orange-500 to-red-500 rounded-3xl p-4 sm:p-5 shadow-xl flex items-center justify-between gap-4 text-white cursor-pointer"
        >
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
              <span class="text-3xl">🍽️</span>
            </div>
            <div>
              <p class="text-white/80 text-sm font-medium">{{ totalItems }} รายการ</p>
              <p class="text-2xl font-black">฿{{ totalPrice.toLocaleString() }}</p>
            </div>
          </div>
          
          <button 
            @click.stop="showCartModal = true"
            class="bg-white text-orange-600 px-6 py-3 rounded-2xl font-bold hover:bg-orange-50 active:scale-95 transition-all shadow-lg"
          >
            ดูออเดอร์
          </button>
        </div>
      </div>
    </Transition>

    <!-- Cart Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="showCartModal" 
          class="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        >
          <!-- Backdrop -->
          <div 
            class="absolute inset-0 bg-black/60"
            @click="showCartModal = false"
          ></div>
          
          <!-- Cart Modal Content -->
          <div class="relative bg-white w-full max-w-lg max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-slide-up">
            
            <!-- Header -->
            <div class="flex-shrink-0 p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 class="text-2xl font-black text-gray-800">🍽️ รายการสั่งอาหาร</h2>
                <p class="text-gray-500 text-sm">{{ totalItems }} รายการ</p>
              </div>
              <button 
                @click="showCartModal = false"
                class="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <!-- Cart Items List -->
            <div class="flex-1 overflow-y-auto p-6 space-y-4">
              <div v-if="cart.length === 0" class="text-center py-12 text-gray-500">
                <span class="text-6xl mb-4 block">🍽️</span>
                <p>ยังไม่มีรายการสั่ง</p>
              </div>
              
              <div
                v-for="(item, index) in cart"
                :key="index"
                class="bg-gray-50 rounded-2xl p-3"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h3 class="font-bold text-gray-800">{{ item.menuName }}</h3>
                      <span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{{ item.proteinType || 'หมู' }}</span>
                    </div>

                    <!-- Options + flags inline -->
                    <div class="mt-1.5 flex flex-wrap gap-1">
                      <span
                        v-for="opt in item.selectedOptions"
                        :key="opt.optionId"
                        class="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full"
                      >{{ opt.label }}{{ opt.quantity > 1 ? ` x${opt.quantity}` : '' }}</span>
                      <span v-if="item.isTakeaway" class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">📦 ใส่กล่อง</span>
                      <span v-if="item.isSpecial" class="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">⭐ พิเศษ</span>
                    </div>

                    <!-- Notes -->
                    <p v-if="item.notes" class="mt-1 text-xs text-gray-500 truncate">📝 {{ item.notes }}</p>

                    <!-- Price -->
                    <p class="mt-1.5 text-sm text-gray-500">฿{{ item.totalPrice }} x {{ item.quantity }} = <span class="font-bold text-orange-600">฿{{ (item.totalPrice * item.quantity).toLocaleString() }}</span></p>
                  </div>

                  <!-- Edit + Remove buttons -->
                  <div class="flex gap-1 flex-shrink-0">
                    <button
                      @click="editCartItem(index)"
                      class="w-8 h-8 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg flex items-center justify-center transition-colors"
                      title="แก้ไข"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      @click="removeCartItem(index)"
                      class="w-8 h-8 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg flex items-center justify-center transition-colors"
                      title="ลบ"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Quantity Controls -->
                <div class="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                  <span class="text-gray-500 text-xs">จำนวน</span>
                  <div class="flex items-center gap-1.5">
                    <button
                      @click="decrementCartItem(index)"
                      class="w-7 h-7 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-gray-600 hover:border-orange-400 hover:text-orange-500 transition-colors font-bold text-sm"
                    >−</button>
                    <span class="w-8 text-center font-bold text-gray-800 text-sm">{{ item.quantity }}</span>
                    <button
                      @click="incrementCartItem(index)"
                      class="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center text-white hover:bg-orange-600 transition-colors font-bold text-sm"
                    >+</button>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Footer -->
            <div class="flex-shrink-0 p-6 bg-white border-t border-gray-100 space-y-4">
              <!-- Total -->
              <div class="flex items-center justify-between">
                <span class="text-gray-600 font-medium">ยอดรวมทั้งหมด</span>
                <span class="text-3xl font-black text-orange-600">฿{{ totalPrice.toLocaleString() }}</span>
              </div>
              
              <!-- Action Buttons -->
              <div class="flex gap-3">
                <button 
                  @click="clearCart"
                  :disabled="isSubmitting"
                  class="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50"
                >
                  ยกเลิกทั้งหมด
                </button>
                <button 
                  @click="submitOrder"
                  :disabled="isSubmitting"
                  class="flex-[2] py-3 rounded-2xl bg-gradient-to-r from-orange-400 to-red-500 text-white font-bold shadow-lg shadow-orange-200 hover:shadow-xl active:scale-95 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  <svg v-if="isSubmitting" class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{{ isSubmitting ? 'กำลังสั่ง...' : 'ยืนยันสั่งอาหาร' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.ring-3 {
  --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
  --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(3px + var(--tw-ring-offset-width)) var(--tw-ring-color);
  box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s ease;
}
.modal-enter-active .animate-slide-up,
.modal-leave-active .animate-slide-up {
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.modal-enter-from,
.modal-leave-to { opacity: 0; }
.modal-enter-from .animate-slide-up,
.modal-leave-to .animate-slide-up { transform: translateY(100%); }

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.2s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(1rem);
}

</style>
