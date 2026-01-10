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
}

const cart = ref<CartItem[]>([])

// Modal state
const showModal = ref(false)
const selectedMenu = ref<any>(null)
const optionQuantities = reactive<Record<number, number>>({})
const dishQuantity = ref(1) // จำนวนจาน

// Extra options
const isTakeaway = ref(false) // ใส่กล่อง
 const isSpecial = ref(false) // พิเศษ +10฿
const specialPrice = 10
const notes = ref('') // คำอธิบายเพิ่มเติม

// Collapsible sections
const showOptions = ref(true)
const showNotes = ref(false)

// Quick note presets
const quickNotes = ['เผ็ดมาก', 'เผ็ดน้อย', 'ไม่เผ็ด', 'ข้าวน้อย', 'ข้าวมาก', 'ไม่ใส่ผัก', 'ไม่ใส่หอม']

const addQuickNote = (note: string) => {
  if (notes.value) {
    notes.value += ', ' + note
  } else {
    notes.value = note
  }
}

// Open modal when clicking "Add"
const openOptionsModal = (menu: any) => {
  selectedMenu.value = menu
  // Reset all states
  Object.keys(optionQuantities).forEach(key => delete optionQuantities[Number(key)])
  dishQuantity.value = 1
  isTakeaway.value = false
  isSpecial.value = false
  notes.value = ''
  showOptions.value = true
  showNotes.value = false
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
const addToCart = () => {
  if (!selectedMenu.value) return

  const selectedOpts = options.value
    .filter((opt: any) => optionQuantities[opt.id] > 0)
    .map((opt: any) => ({
      optionId: opt.id,
      quantity: optionQuantities[opt.id],
      label: opt.label,
      extraPrice: Number(opt.extra_price)
    }))

  const newItem: CartItem = {
    menuId: selectedMenu.value.id,
    menuName: selectedMenu.value.name,
    basePrice: Number(selectedMenu.value.base_price),
    selectedOptions: selectedOpts,
    totalPrice: pricePerDish.value,
    quantity: dishQuantity.value,
    isTakeaway: isTakeaway.value,
    isSpecial: isSpecial.value,
    notes: notes.value
  }

  cart.value.push(newItem)
  showModal.value = false
  selectedMenu.value = null
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
        location: null // สามารถเพิ่ม input โต๊ะ/สถานที่ทีหลัง
      }
    })
    
    if (response.success) {
      submittedOrderId.value = response.data.orderId
      orderSuccess.value = true
      cart.value = []
      showCartModal.value = false
      
      // Auto-hide success message after 5 seconds
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
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
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
    <header class="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
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

        <!-- Kitchen Panel Link -->
        <NuxtLink 
          to="/kitchen" 
          class="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-medium transition-all shadow-lg hover:shadow-xl"
        >
          <span class="text-xl">👨‍🍳</span>
          <span class="hidden sm:inline">ครัว</span>
        </NuxtLink>
      </div>
    </header>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-40">
      
      <!-- Menu Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        <div 
          v-for="menu in menus" 
          :key="menu.id" 
          class="bg-white rounded-3xl shadow-sm overflow-hidden flex flex-col transform transition-all duration-500 hover:shadow-2xl hover:-translate-y-2"
          :class="{ 'ring-3 ring-orange-400 ring-offset-4 shadow-lg shadow-orange-200': getMenuCartCount(menu.id) > 0 }"
        >
          <!-- Image Container -->
          <div class="aspect-square relative overflow-hidden bg-gray-100 group">
            <img 
              :src="menu.image_url" 
              :alt="menu.name" 
              class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            >
            
            <div class="absolute bottom-3 left-3">
              <span class="text-white font-black text-2xl drop-shadow-lg bg-black/40 px-2 py-1 rounded-lg">฿{{ menu.base_price }}</span>
            </div>

            <!-- Cart Count Badge -->
            <div 
              v-if="getMenuCartCount(menu.id) > 0"
              class="absolute top-3 right-3 w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg"
            >
              {{ getMenuCartCount(menu.id) }}
            </div>
          </div>

          <!-- Content -->
          <div class="p-4 sm:p-5 flex-grow flex flex-col">
            <h3 class="font-bold text-base sm:text-lg text-gray-800 mb-3 leading-tight line-clamp-2">{{ menu.name }}</h3>
            
            <div class="mt-auto">
              <!-- Add Button (Opens Modal) -->
              <button 
                @click="openOptionsModal(menu)"
                class="w-full py-3 sm:py-4 rounded-2xl bg-gradient-to-r from-orange-400 to-red-500 text-white font-bold shadow-lg shadow-orange-200 hover:shadow-xl hover:shadow-orange-300 active:scale-95 transition-all duration-300 flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>เพิ่ม</span>
              </button>
            </div>
          </div>
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
    </div>

    <!-- Options Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="showModal && selectedMenu" 
          class="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        >
          <!-- Backdrop -->
          <div 
            class="absolute inset-0 bg-black/60 backdrop-blur-sm"
            @click="showModal = false"
          ></div>
          
          <!-- Modal Content -->
          <div class="relative bg-white w-full max-w-lg max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-slide-up">
            
            <!-- Header with Image -->
            <div class="relative h-48 bg-gray-100 flex-shrink-0">
              <img 
                :src="selectedMenu.image_url" 
                :alt="selectedMenu.name" 
                class="w-full h-full object-cover"
              >
              <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
              
              <!-- Close Button -->
              <button 
                @click="showModal = false"
                class="absolute top-4 right-4 w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              <!-- Menu Info -->
              <div class="absolute bottom-4 left-4 right-4">
                <h2 class="text-2xl font-black text-white drop-shadow-lg">{{ selectedMenu.name }}</h2>
                <p class="text-white/80 text-lg">ราคาเริ่มต้น ฿{{ selectedMenu.base_price }}</p>
              </div>
            </div>
            
            <!-- Options List (Collapsible) -->
            <div class="flex-1 overflow-y-auto p-6 space-y-4">
              
              <!-- Quick Checkboxes: Takeaway & Special -->
              <div class="flex flex-wrap gap-3 mb-4">
                <label 
                  class="flex items-center gap-2 px-4 py-3 rounded-2xl cursor-pointer transition-all"
                  :class="isTakeaway ? 'bg-orange-100 ring-2 ring-orange-400' : 'bg-gray-50 hover:bg-gray-100'"
                >
                  <input type="checkbox" v-model="isTakeaway" class="hidden">
                  <span class="text-xl">📦</span>
                  <span class="font-medium" :class="isTakeaway ? 'text-orange-700' : 'text-gray-700'">ใส่กล่อง</span>
                </label>
                
                <label 
                  class="flex items-center gap-2 px-4 py-3 rounded-2xl cursor-pointer transition-all"
                  :class="isSpecial ? 'bg-orange-100 ring-2 ring-orange-400' : 'bg-gray-50 hover:bg-gray-100'"
                >
                  <input type="checkbox" v-model="isSpecial" class="hidden">
                  <span class="text-xl">⭐</span>
                  <span class="font-medium" :class="isSpecial ? 'text-orange-700' : 'text-gray-700'">พิเศษ</span>
                  <span class="text-xs px-2 py-0.5 bg-orange-500 text-white rounded-full">+฿{{ specialPrice }}</span>
                </label>
              </div>
              
              <!-- Options Section (Collapsible) -->
              <div class="border border-gray-200 rounded-2xl overflow-hidden">
                <button 
                  @click="showOptions = !showOptions"
                  class="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span class="font-bold text-gray-800">🍳 Options เพิ่มเติม</span>
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    class="h-5 w-5 text-gray-500 transition-transform" 
                    :class="{ 'rotate-180': showOptions }"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                <Transition name="collapse">
                  <div v-if="showOptions" class="p-4 space-y-3">
                    <div v-if="options.length === 0" class="text-center py-4 text-gray-500">
                      ไม่มี Options ให้เลือก
                    </div>
                    
                    <div 
                      v-for="option in options" 
                      :key="option.id"
                      class="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl"
                      :class="{ 'bg-orange-50 border-orange-200': getOptionQty(option.id) > 0 }"
                    >
                      <div class="flex items-center gap-3">
                        <div v-if="option.image_url" class="w-10 h-10 rounded-lg overflow-hidden bg-gray-200">
                          <img :src="option.image_url" :alt="option.label" class="w-full h-full object-cover">
                        </div>
                        <div v-else class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xl">
                          🍳
                        </div>
                        <div>
                          <p class="font-medium text-gray-800 text-sm">{{ option.label }}</p>
                          <p class="text-orange-600 font-medium text-xs">+฿{{ option.extra_price }}</p>
                        </div>
                      </div>
                      
                      <!-- Quantity Controls -->
                      <div v-if="getOptionQty(option.id) === 0">
                        <button 
                          @click="incrementOption(option.id)"
                          class="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 hover:bg-orange-100 hover:text-orange-500 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>
                      <div v-else class="flex items-center gap-1">
                        <button 
                          @click="decrementOption(option.id)"
                          class="w-7 h-7 bg-white border border-orange-200 rounded-lg flex items-center justify-center text-orange-600 hover:bg-orange-50 transition-colors font-bold text-sm"
                        >
                          −
                        </button>
                        <span class="w-6 text-center font-bold text-orange-600 text-sm">{{ getOptionQty(option.id) }}</span>
                        <button 
                          @click="incrementOption(option.id)"
                          class="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center text-white hover:bg-orange-600 transition-colors font-bold text-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>
              
              <!-- Notes Section (Collapsible) -->
              <div class="border border-gray-200 rounded-2xl overflow-hidden">
                <button 
                  @click="showNotes = !showNotes"
                  class="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span class="font-bold text-gray-800">📝 คำอธิบายเพิ่มเติม</span>
                  <div class="flex items-center gap-2">
                    <span v-if="notes" class="text-xs text-orange-500 font-medium">มีแล้ว</span>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      class="h-5 w-5 text-gray-500 transition-transform" 
                      :class="{ 'rotate-180': showNotes }"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                
                <Transition name="collapse">
                  <div v-if="showNotes" class="p-4 space-y-3">
                    <!-- Quick Note Buttons -->
                    <div class="flex flex-wrap gap-2">
                      <button 
                        v-for="qn in quickNotes" 
                        :key="qn"
                        @click="addQuickNote(qn)"
                        class="px-3 py-1.5 bg-gray-100 hover:bg-orange-100 text-gray-700 hover:text-orange-700 rounded-full text-sm font-medium transition-colors"
                      >
                        {{ qn }}
                      </button>
                    </div>
                    
                    <!-- Text Area -->
                    <textarea 
                      v-model="notes"
                      placeholder="เขียนคำอธิบายเพิ่มเติมที่นี่..."
                      rows="2"
                      class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none resize-none text-gray-700"
                    ></textarea>
                  </div>
                </Transition>
              </div>
              
            </div>
            
            <!-- Footer with Quantity & Price -->
            <div class="flex-shrink-0 p-6 bg-white border-t border-gray-100">
              <!-- Dish Quantity Selector -->
              <div class="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-2xl">
                <span class="text-gray-700 font-medium">จำนวน (จาน)</span>
                <div class="flex items-center gap-3">
                  <button 
                    @click="decrementDish"
                    :disabled="dishQuantity <= 1"
                    class="w-10 h-10 bg-white border-2 border-gray-200 rounded-xl flex items-center justify-center text-gray-600 hover:border-orange-400 hover:text-orange-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xl"
                  >
                    −
                  </button>
                  <span class="w-10 text-center font-black text-xl text-gray-800">{{ dishQuantity }}</span>
                  <button 
                    @click="incrementDish"
                    class="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white hover:bg-orange-600 transition-colors font-bold text-xl"
                  >
                    +
                  </button>
                </div>
              </div>
              
              <!-- Price Summary -->
              <div class="flex items-center justify-between mb-4">
                <div>
                  <span class="text-gray-500 text-sm">฿{{ pricePerDish }} x {{ dishQuantity }} จาน</span>
                </div>
                <span class="text-3xl font-black text-orange-600">฿{{ currentItemPrice.toLocaleString() }}</span>
              </div>
              
              <button 
                @click="addToCart"
                class="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-400 to-red-500 text-white font-bold text-lg shadow-lg shadow-orange-200 hover:shadow-xl active:scale-95 transition-all"
              >
                เพิ่มรายการ ({{ dishQuantity }} จาน)
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
          class="bg-gradient-to-r from-orange-500 to-red-500 rounded-3xl p-4 sm:p-5 shadow-2xl shadow-orange-500/40 flex items-center justify-between gap-4 text-white cursor-pointer hover:shadow-3xl transition-shadow"
        >
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
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
            class="absolute inset-0 bg-black/60 backdrop-blur-sm"
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
                class="bg-gray-50 rounded-2xl p-4"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex-1">
                    <h3 class="font-bold text-gray-800 text-lg">{{ item.menuName }}</h3>
                    
                    <!-- Base Price -->
                    <p class="text-gray-500 text-sm mt-1">ราคาพื้นฐาน: ฿{{ item.basePrice }}</p>
                    
                    <!-- Selected Options -->
                    <div v-if="item.selectedOptions.length > 0" class="mt-2 space-y-1">
                      <div class="flex flex-wrap gap-1">
                        <span 
                          v-for="opt in item.selectedOptions" 
                          :key="opt.optionId"
                          class="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full flex items-center gap-1"
                        >
                          <span>{{ opt.label }}</span>
                          <span class="text-orange-500">x{{ opt.quantity }}</span>
                          <span class="text-orange-400">(+฿{{ opt.extraPrice * opt.quantity }})</span>
                        </span>
                      </div>
                    </div>
                    
                    <!-- Extra Info: Takeaway, Special, Notes -->
                    <div class="mt-2 flex flex-wrap gap-1.5">
                      <span v-if="item.isTakeaway" class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full flex items-center gap-1">
                        📦 ใส่กล่อง
                      </span>
                      <span v-if="item.isSpecial" class="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full flex items-center gap-1">
                        ⭐ พิเศษ (+฿10)
                      </span>
                    </div>
                    
                    <!-- Notes -->
                    <div v-if="item.notes" class="mt-2 p-2 bg-gray-100 rounded-lg">
                      <p class="text-xs text-gray-600">
                        <span class="font-medium">📝 หมายเหตุ:</span> {{ item.notes }}
                      </p>
                    </div>
                    
                    <!-- Price Breakdown -->
                    <div class="mt-3 pt-2 border-t border-gray-100">
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-gray-500">ราคาต่อจาน</span>
                        <span class="text-orange-600 font-bold text-lg">฿{{ item.totalPrice }}</span>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Remove Button -->
                  <button 
                    @click="removeCartItem(index)"
                    class="w-8 h-8 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg flex items-center justify-center transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                
                <!-- Quantity Controls -->
                <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                  <span class="text-gray-600 text-sm">จำนวน</span>
                  <div class="flex items-center gap-2">
                    <button 
                      @click="decrementCartItem(index)"
                      class="w-9 h-9 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-gray-600 hover:border-orange-400 hover:text-orange-500 transition-colors font-bold"
                    >
                      −
                    </button>
                    <span class="w-10 text-center font-bold text-gray-800">{{ item.quantity }}</span>
                    <button 
                      @click="incrementCartItem(index)"
                      class="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center text-white hover:bg-orange-600 transition-colors font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
                
                <!-- Item Total -->
                <div class="flex items-center justify-between mt-2">
                  <span class="text-gray-500 text-sm">รวม</span>
                  <span class="font-black text-orange-600">฿{{ (item.totalPrice * item.quantity).toLocaleString() }}</span>
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
  transition: opacity 0.3s ease;
}
.modal-enter-active .animate-slide-up,
.modal-leave-active .animate-slide-up {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .animate-slide-up {
  transform: translateY(100%);
}
.modal-leave-to .animate-slide-up {
  transform: translateY(100%);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(100%);
}

.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  max-height: 500px;
}
</style>
