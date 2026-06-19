<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted } from 'vue'

definePageMeta({
  layout: 'default'
})

// Audio Voice Feedback Helper (Web Speech API)
const speak = (text: string) => {
  if ('speechSynthesis' in window) {
    // Cancel any active speech first to avoid queue buildup
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'th-TH'
    utterance.rate = 1.1 // Slightly faster for cashier speed
    window.speechSynthesis.speak(utterance)
  }
}

// 1. Data Fetching
const { data: menuResult, pending: menusPending } = await useFetch<{ success: boolean, data: any[] }>('/api/menus')
const { data: categoryResult } = await useFetch<{ success: boolean, data: any[] }>('/api/categories')

const allMenus = computed(() => menuResult.value?.data || [])
const categories = computed(() => categoryResult.value?.data || [])

// Cart Item Interface matching original POS schema
interface CartItem {
  menuId: number
  menuName: string
  basePrice: number
  selectedOptions: { optionId: number, quantity: number, label: string, extraPrice: number }[]
  totalPrice: number // item price (base + extras)
  quantity: number
  isTakeaway: boolean
  isSpecial: boolean
  notes: string
  proteinType: string // For food items
}

// 2. State Management
const cart = ref<CartItem[]>([])
const activeCategory = ref<number | 'all'>('all')
const search = ref('')

// Active item configuration (Modifier Panel)
const selectedMenu = ref<any>(null)
const activeItemOptions = ref<any[]>([])
const activeOptionsPending = ref(false)

// Selections for the active item
const selectedOptionsState = reactive<Record<number, boolean>>({}) // For checkboxes / multi-select options
const selectedSingleOptionsState = reactive<Record<string, number>>({}) // For radio-like groups (temperature, sweetness, milk_type)
const activeQuantity = ref(1)
const isTakeaway = ref(false)
const isSpecial = ref(false) // Food special (+10)
const selectedProtein = ref('หมู') // Food protein
const notes = ref('')

// Food options presets
const proteins = ['หมู', 'หมูสับ', 'หมูชิ้น', 'ไก่', 'ทะเล', 'เนื้อ']
const quickNotes = ['เผ็ดน้อย', 'ไม่เผ็ด', 'ข้าวน้อย', 'ไม่ไส่ผัก', 'หวานน้อย', 'วิปครีมเยอะๆ']

// 3. Computed Lists
const filteredMenus = computed(() => {
  let list = allMenus.value
  if (activeCategory.value !== 'all') {
    list = list.filter(m => m.category_id === activeCategory.value)
  }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(m => m.name.toLowerCase().includes(q))
  }
  return list
})

// Group active options by option_group for rendering
const groupedActiveOptions = computed(() => {
  const groups: Record<string, any[]> = {}
  activeItemOptions.value.forEach(opt => {
    const g = opt.option_group || 'other'
    if (!groups[g]) groups[g] = []
    groups[g].push(opt)
  })
  return groups
})

// Dynamic name mapping for option groups in Thai
const groupNameThai = (group: string) => {
  switch (group) {
    case 'temperature': return '🧊 อุณหภูมิ ( Temperature )'
    case 'sweetness': return '🍬 ระดับความหวาน ( Sweetness )'
    case 'milk_type': return '🥛 ประเภทนม ( Milk Option )'
    case 'addons': return '➕ เพิ่มเติม ( Add-ons )'
    default: return '⚙️ ตัวเลือกเพิ่มเติม ( Custom Options )'
  }
}

// Calculate price of the active item (base + selected options + special)
const activeItemSinglePrice = computed(() => {
  if (!selectedMenu.value) return 0
  let total = Number(selectedMenu.value.base_price)

  // 1. Add price from radio-like single selections (temperature, sweetness, milk_type)
  Object.values(selectedSingleOptionsState).forEach(optId => {
    const opt = activeItemOptions.value.find(o => o.id === optId)
    if (opt) total += Number(opt.extra_price)
  })

  // 2. Add price from checkbox-like multi selections (addons)
  activeItemOptions.value.forEach(opt => {
    if (opt.option_group === 'addons' && selectedOptionsState[opt.id]) {
      total += Number(opt.extra_price)
    }
  })

  // 3. Add food special pricing
  if (isSpecial.value && selectedMenu.value.dept === 'Kitchen') {
    total += 10
  }

  return total
})

const activeItemTotalPrice = computed(() => {
  return activeItemSinglePrice.value * activeQuantity.value
})

// Cart Totals
const cartTotalItems = computed(() => {
  return cart.value.reduce((sum, item) => sum + item.quantity, 0)
})

const cartTotalPrice = computed(() => {
  return cart.value.reduce((sum, item) => sum + (item.totalPrice * item.quantity), 0)
})

// 4. Methods
// When clicking a menu item on the left panel
const selectMenu = async (menu: any) => {
  selectedMenu.value = menu
  activeQuantity.value = 1
  isTakeaway.value = false
  isSpecial.value = false
  selectedProtein.value = 'หมู'
  notes.value = ''
  activeItemOptions.value = []
  
  // Clear states
  Object.keys(selectedOptionsState).forEach(key => delete selectedOptionsState[Number(key)])
  Object.keys(selectedSingleOptionsState).forEach(key => delete selectedSingleOptionsState[key])

  // Speak name of item for accessibility/speed
  speak(menu.name)

  activeOptionsPending.value = true
  try {
    const response = await $fetch<{ success: boolean, data: any[] }>(`/api/menus/${menu.id}/options`)
    if (response.success) {
      activeItemOptions.value = response.data

      // Pre-select defaults for radio option groups
      const groups = ['temperature', 'sweetness', 'milk_type']
      groups.forEach(g => {
        const opts = response.data.filter(o => o.option_group === g)
        if (opts.length > 0) {
          // Preselect the first option or one with 0 extra price as default
          const defaultOpt = opts.find(o => Number(o.extra_price) === 0) || opts[0]
          selectedSingleOptionsState[g] = defaultOpt.id
        }
      })
    }
  } catch (error) {
    console.error('Failed to load menu options:', error)
  } finally {
    activeOptionsPending.value = false
  }
}

// Add configured active item to cart
const addActiveToCart = () => {
  if (!selectedMenu.value) return

  // Gather selected options
  const selectedOpts: any[] = []

  // Gather radio selections
  Object.entries(selectedSingleOptionsState).forEach(([group, optId]) => {
    const opt = activeItemOptions.value.find(o => o.id === optId)
    if (opt) {
      selectedOpts.push({
        optionId: opt.id,
        quantity: 1,
        label: opt.label,
        extraPrice: Number(opt.extra_price)
      })
    }
  })

  // Gather checkbox selections
  activeItemOptions.value.forEach(opt => {
    if (opt.option_group === 'addons' && selectedOptionsState[opt.id]) {
      selectedOpts.push({
        optionId: opt.id,
        quantity: 1,
        label: opt.label,
        extraPrice: Number(opt.extra_price)
      })
    }
  })

  // Check if item with exact same configurations already exists in cart, if so, combine quantity
  const isFood = selectedMenu.value.dept === 'Kitchen'
  const matchingIndex = cart.value.findIndex(item => {
    if (item.menuId !== selectedMenu.value.id) return false
    if (item.isTakeaway !== isTakeaway.value) return false
    if (isFood && (item.isSpecial !== isSpecial.value || item.proteinType !== selectedProtein.value)) return false
    if (item.notes !== notes.value) return false
    
    // Compare selected options ids
    if (item.selectedOptions.length !== selectedOpts.length) return false
    const itemOptIds = item.selectedOptions.map(o => o.optionId).sort()
    const currentOptIds = selectedOpts.map(o => o.optionId).sort()
    return itemOptIds.every((id, idx) => id === currentOptIds[idx])
  })

  if (matchingIndex > -1) {
    cart.value[matchingIndex].quantity += activeQuantity.value
  } else {
    cart.value.push({
      menuId: selectedMenu.value.id,
      menuName: selectedMenu.value.name,
      basePrice: Number(selectedMenu.value.base_price),
      selectedOptions: selectedOpts,
      totalPrice: activeItemSinglePrice.value,
      quantity: activeQuantity.value,
      isTakeaway: isTakeaway.value,
      isSpecial: isSpecial.value,
      notes: notes.value,
      proteinType: isFood ? selectedProtein.value : ''
    })
  }

  // Voice confirmation
  const drinkOptionsVoice = selectedOpts.map(o => o.label).join(' ')
  const voiceText = `เพิ่ม ${selectedMenu.value.name} ${drinkOptionsVoice} ${activeQuantity.value} ชิ้นลงบิล`
  speak(voiceText)

  // Clear selections
  selectedMenu.value = null
}

const addQuickNote = (note: string) => {
  if (notes.value) {
    notes.value += ', ' + note
  } else {
    notes.value = note
  }
}

const removeFromCart = (index: number) => {
  const item = cart.value[index]
  speak(`ลบ ${item.menuName} ออกจากบิล`)
  cart.value.splice(index, 1)
}

const clearCart = () => {
  speak('ล้างข้อมูลบิลทั้งหมด')
  cart.value = []
}

// 5. Submit Order to API
const isSubmitting = ref(false)
const orderSuccess = ref(false)
const submittedOrderId = ref<number | null>(null)

const submitOrder = async () => {
  if (cart.value.length === 0 || isSubmitting.value) return

  isSubmitting.value = true
  
  // Voice readout of the full receipt before submitting
  let summaryVoice = `สรุปยอดสั่งซื้อทั้งหมด ${cartTotalItems.value} รายการ รวมราคา ${cartTotalPrice.value} บาทค่ะ`
  speak(summaryVoice)

  try {
    const response = await $fetch<{ success: boolean, data: { orderId: number, message: string } }>('/api/orders', {
      method: 'POST',
      body: {
        items: cart.value,
        totalPrice: cartTotalPrice.value,
        location: 'จุดคิดเงินคาเฟ่ (Cashier Counter)'
      }
    })

    if (response.success) {
      submittedOrderId.value = response.data.orderId
      orderSuccess.value = true
      cart.value = []
      
      speak('บันทึกยอดขายส่งออเดอร์เข้าแต่ละแผนกเรียบร้อยแล้วค่ะ')

      setTimeout(() => {
        orderSuccess.value = false
        submittedOrderId.value = null
      }, 6000)
    }
  } catch (error: any) {
    console.error('Order submission failed:', error)
    speak('เกิดข้อผิดพลาดในการส่งออเดอร์ กรุณาลองใหม่อีกครั้ง')
    alert('เกิดข้อผิดพลาด: ' + (error.data?.message || error.message || 'ไม่ทราบสาเหตุ'))
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="h-screen flex flex-col bg-slate-900 text-slate-100 overflow-hidden font-sans">
    
    <!-- Top Header bar -->
    <header class="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
      <div class="flex items-center gap-3">
        <NuxtLink to="/" class="text-xl hover:opacity-80 transition-opacity">🏠</NuxtLink>
        <h1 class="text-2xl font-black tracking-tight text-white flex items-center gap-2">
          ☕ Cafe POS <span class="text-xs font-bold px-2 py-0.5 bg-orange-500 rounded text-white uppercase">Cashier Screen</span>
        </h1>
      </div>
      
      <!-- Search & Category Filters -->
      <div class="flex items-center gap-3 w-1/2 justify-end">
        <input 
          v-model="search"
          type="text" 
          placeholder="🔎 ค้นหาเมนู..." 
          class="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white w-48 focus:w-64 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-all"
        />
        
        <NuxtLink to="/admin/items" class="bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          ⚙️ หลังบ้าน
        </NuxtLink>
      </div>
    </header>

    <!-- Main Grid -->
    <div class="flex-1 flex overflow-hidden">
      
      <!-- LEFT SIDEBAR / GRID: 65% width -->
      <main class="w-[65%] flex flex-col border-r border-slate-800 bg-slate-950 overflow-hidden">
        
        <!-- Category Selection Tabs (Large touch targets) -->
        <div class="flex p-3 gap-2 bg-slate-900/60 border-b border-slate-800 overflow-x-auto flex-shrink-0">
          <button 
            @click="activeCategory = 'all'"
            :class="`px-5 py-3 rounded-xl font-bold transition-all text-base ${
              activeCategory === 'all' 
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/30' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
            }`"
          >
            📂 ทั้งหมด
          </button>
          
          <button 
            v-for="cat in categories" 
            :key="cat.id"
            @click="activeCategory = cat.id"
            :class="`px-5 py-3 rounded-xl font-bold transition-all text-base flex items-center gap-1.5 ${
              activeCategory === cat.id 
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/30' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
            }`"
          >
            <span>{{ cat.icon }}</span>
            <span>{{ cat.name === 'Food' ? 'อาหาร' : cat.name === 'Beverage' ? 'เครื่องดื่ม' : cat.name === 'Dessert' ? 'ของหวาน' : cat.name }}</span>
          </button>
        </div>

        <!-- Menu Cards Grid (Scrollable) -->
        <div class="flex-1 p-4 overflow-y-auto min-h-0">
          <div v-if="menusPending" class="flex flex-col items-center justify-center py-24">
            <span class="text-4xl animate-spin mb-4">☕</span>
            <p class="text-slate-400">กำลังโหลดรายการเมนู...</p>
          </div>
          
          <div v-else-if="filteredMenus.length === 0" class="text-center py-24">
            <span class="text-5xl mb-4 block">🔍</span>
            <p class="text-slate-400 text-lg font-medium">ไม่พบเมนูที่ตรงกับเงื่อนไข</p>
          </div>
          
          <div v-else class="grid grid-cols-2 md:grid-cols-3 gap-3.5">
            <!-- Menus list (Optimized for slow hardware - no hover image scales, clean borders) -->
            <button 
              v-for="menu in filteredMenus" 
              :key="menu.id"
              @click="selectMenu(menu)"
              :class="`p-4 rounded-2xl border text-left flex flex-col justify-between h-32 active:scale-98 transition-all duration-100 ${
                selectedMenu?.id === menu.id
                  ? 'border-orange-500 bg-orange-950/40 ring-2 ring-orange-500'
                  : menu.dept === 'Kitchen'
                    ? 'border-slate-800 bg-slate-900 hover:bg-slate-850 hover:border-orange-900/50'
                    : menu.dept === 'Barista'
                      ? 'border-slate-800 bg-slate-900 hover:bg-slate-850 hover:border-blue-900/50'
                      : 'border-slate-800 bg-slate-900 hover:bg-slate-850 hover:border-pink-900/50'
              }`"
            >
              <div class="flex justify-between items-start w-full">
                <!-- Emoji Badges as lightweight assets -->
                <span class="text-2xl">{{ menu.dept === 'Kitchen' ? '🍜' : menu.dept === 'Barista' ? '☕' : '🍰' }}</span>
                <span :class="`text-[10px] uppercase font-black px-2 py-0.5 rounded ${
                  menu.dept === 'Kitchen' ? 'bg-orange-900 text-orange-200' :
                  menu.dept === 'Barista' ? 'bg-blue-900 text-blue-200' :
                  'bg-pink-900 text-pink-200'
                }`">
                  {{ menu.dept === 'Kitchen' ? 'ครัว' : menu.dept === 'Barista' ? 'บาร์น้ำ' : 'ขนม' }}
                </span>
              </div>
              
              <div>
                <h3 class="font-bold text-white text-base leading-snug line-clamp-2">{{ menu.name }}</h3>
                <span class="text-orange-400 font-extrabold text-lg mt-1 block">฿{{ menu.base_price }}</span>
              </div>
            </button>
          </div>
        </div>
      </main>

      <!-- RIGHT PANEL: 35% width (Modifier Options + Cart Receipt) -->
      <aside class="w-[35%] bg-slate-900 flex flex-col overflow-hidden min-h-0">
        
        <!-- SECTION 1: Modifier / Options Editor (Top 55% space) -->
        <div class="h-[55%] border-b border-slate-800 flex flex-col overflow-hidden min-h-0">
          <div class="bg-slate-850 px-4 py-3 flex items-center justify-between border-b border-slate-800 flex-shrink-0">
            <h2 class="text-sm font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
              <span>⚙️ ปรับแต่งเครื่องดื่ม/อาหาร</span>
            </h2>
            <button 
              v-if="selectedMenu" 
              @click="selectedMenu = null" 
              class="text-xs text-slate-400 hover:text-white"
            >
              ✕ ยกเลิก
            </button>
          </div>

          <!-- If NO item is selected -->
          <div v-if="!selectedMenu" class="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-950/30">
            <span class="text-4xl text-slate-600 mb-2">👈</span>
            <p class="text-slate-400 font-bold text-base">เลือกเมนูเครื่องดื่มหรืออาหาร</p>
            <p class="text-xs text-slate-500 mt-1 max-w-[200px]">เพื่อทำการเริ่มปรับแต่งส่วนผสมลงใบเสร็จรับเงิน</p>
          </div>

          <!-- Loading state for options -->
          <div v-else-if="activeOptionsPending" class="flex-1 flex flex-col items-center justify-center py-12">
            <span class="text-2xl animate-spin mb-2">⏳</span>
            <p class="text-xs text-slate-400">กำลังโหลดตัวเลือกสำหรับ {{ selectedMenu.name }}...</p>
          </div>

          <!-- Options Editor Container (Scrollable) -->
          <div v-else class="flex-1 overflow-y-auto p-4 space-y-4">
            
            <!-- Item Header -->
            <div class="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
              <div class="flex items-center gap-2.5">
                <span class="text-3xl">{{ selectedMenu.dept === 'Kitchen' ? '🍜' : selectedMenu.dept === 'Barista' ? '☕' : '🍰' }}</span>
                <div class="flex-1">
                  <h3 class="font-black text-white text-lg leading-tight">{{ selectedMenu.name }}</h3>
                  <span class="text-xs text-slate-400">ราคาเริ่มต้น ฿{{ selectedMenu.base_price }}</span>
                </div>
              </div>
            </div>

            <!-- Standard Food Modifiers: Protein & Special (Show ONLY for Food Kitchen items) -->
            <div v-if="selectedMenu.dept === 'Kitchen'" class="space-y-4">
              <!-- Protein Selection -->
              <div>
                <p class="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">🥩 เลือกเนื้อสัตว์ (Protein)</p>
                <div class="grid grid-cols-3 gap-2">
                  <button 
                    v-for="p in proteins" 
                    :key="p"
                    @click="selectedProtein = p; speak(p)"
                    :class="`py-2 rounded-xl text-sm font-semibold border transition-all ${
                      selectedProtein === p 
                        ? 'border-orange-500 bg-orange-950/40 text-orange-400' 
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-850'
                    }`"
                  >
                    {{ p }}
                  </button>
                </div>
              </div>

              <!-- Special Checkbox -->
              <div class="flex gap-2">
                <button 
                  @click="isSpecial = !isSpecial; speak(isSpecial ? 'พิเศษบวกสิบบาท' : 'ธรรมดา')"
                  :class="`flex-1 py-3 px-4 rounded-xl border text-sm font-bold flex items-center justify-between transition-all ${
                    isSpecial 
                      ? 'border-orange-500 bg-orange-950/40 text-orange-400' 
                      : 'border-slate-800 bg-slate-950 text-slate-400'
                  }`"
                >
                  <span>⭐ จานพิเศษ (Special)</span>
                  <span class="text-xs px-2 py-0.5 bg-orange-600 text-white rounded-full">+฿10</span>
                </button>
              </div>
            </div>

            <!-- Custom Beverage Option Groups (Show if beverage/dessert has linked options) -->
            <div v-if="activeItemOptions.length > 0" class="space-y-4">
              <div v-for="(opts, group) in groupedActiveOptions" :key="group" class="space-y-2">
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wide">
                  {{ groupNameThai(group) }}
                </p>

                <!-- Temperature, Sweetness, Milk options: Single selection (Radio buttons) -->
                <div v-if="['temperature', 'sweetness', 'milk_type'].includes(group)" class="grid grid-cols-3 gap-2">
                  <button 
                    v-for="opt in opts" 
                    :key="opt.id"
                    @click="selectedSingleOptionsState[group] = opt.id; speak(opt.label)"
                    :class="`py-2.5 px-2 rounded-xl border text-center flex flex-col justify-center transition-all ${
                      selectedSingleOptionsState[group] === opt.id 
                        ? 'border-orange-500 bg-orange-950/40 text-orange-400' 
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-850'
                    }`"
                  >
                    <span class="text-sm font-bold leading-tight">{{ opt.label }}</span>
                    <span v-if="Number(opt.extra_price) > 0" class="text-[10px] text-orange-400 font-extrabold mt-0.5">+฿{{ opt.extra_price }}</span>
                  </button>
                </div>

                <!-- Addons options: Multi selection (Checkboxes) -->
                <div v-else class="grid grid-cols-2 gap-2">
                  <button 
                    v-for="opt in opts" 
                    :key="opt.id"
                    @click="selectedOptionsState[opt.id] = !selectedOptionsState[opt.id]; speak(opt.label)"
                    :class="`py-2.5 px-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                      selectedOptionsState[opt.id] 
                        ? 'border-orange-500 bg-orange-950/40 text-orange-400 font-bold' 
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-850'
                    }`"
                  >
                    <span class="text-sm">{{ opt.label }}</span>
                    <span class="text-xs text-orange-400 font-extrabold">
                      {{ Number(opt.extra_price) > 0 ? `+฿${opt.extra_price}` : 'ฟรี' }}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Notes & Quick presets -->
            <div class="space-y-2">
              <p class="text-xs font-bold text-slate-400 uppercase tracking-wide">📝 หมายเหตุ ( Notes )</p>
              <input 
                v-model="notes"
                type="text" 
                placeholder="ระบุเพิ่มเติม เช่น ขมน้อย, หวานธรรมชาติ..."
                class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              />
              <div class="flex flex-wrap gap-1">
                <button 
                  v-for="qn in quickNotes" 
                  :key="qn"
                  type="button"
                  @click="addQuickNote(qn)"
                  class="bg-slate-950 text-slate-400 px-2 py-1 rounded border border-slate-800 hover:bg-slate-850 text-xs transition-colors"
                >
                  + {{ qn }}
                </button>
              </div>
            </div>

            <!-- Quantity & Add to Bill Box -->
            <div class="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
              <!-- Stepper -->
              <div class="flex items-center bg-slate-950 rounded-xl border border-slate-800 p-1">
                <button 
                  @click="activeQuantity > 1 && activeQuantity--" 
                  class="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-750 text-white font-extrabold text-lg flex items-center justify-center transition-colors"
                >
                  －
                </button>
                <span class="px-5 text-lg font-black text-white">{{ activeQuantity }}</span>
                <button 
                  @click="activeQuantity++" 
                  class="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-750 text-white font-extrabold text-lg flex items-center justify-center transition-colors"
                >
                  ＋
                </button>
              </div>
              
              <!-- Add button -->
              <button 
                @click="addActiveToCart"
                class="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-black py-3 px-4 rounded-xl flex items-center justify-between shadow-lg shadow-orange-950/30 transition-colors"
              >
                <span>➕ ใส่บิลนี้</span>
                <span class="text-orange-100 font-extrabold">฿{{ activeItemTotalPrice }}</span>
              </button>
            </div>
            
          </div>
        </div>

        <!-- SECTION 2: Receipt / Cart Billing Panel (Bottom 45% space) -->
        <div class="h-[45%] flex flex-col overflow-hidden min-h-0 bg-slate-900">
          
          <!-- Cart Header -->
          <div class="bg-slate-850 px-4 py-2 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
            <div class="flex items-center gap-1.5">
              <span class="text-sm">🧾</span>
              <h2 class="text-sm font-bold text-slate-300">รายการใบเสร็จรับเงิน (บิลค้างจ่าย)</h2>
            </div>
            <span class="text-xs bg-slate-950 text-orange-400 font-black px-2 py-0.5 rounded-full">
              {{ cartTotalItems }} รายการ
            </span>
          </div>

          <!-- Empty Cart state -->
          <div v-if="cart.length === 0" class="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-950/20">
            <p v-if="orderSuccess" class="text-emerald-400 font-bold mb-1">🎉 บันทึกออร์เดอร์ #{{ submittedOrderId }} สำเร็จ!</p>
            <p v-if="orderSuccess" class="text-xs text-slate-400">บิลส่งตรงไปครัว/บาร์เรียบร้อย</p>
            <div v-else>
              <span class="text-3xl block mb-2 opacity-50">🛒</span>
              <p class="text-slate-500 text-sm font-medium">ยังไม่มีรายการชงหรือทำอาหารในบิลนี้</p>
            </div>
          </div>

          <!-- Cart Items List (Scrollable) -->
          <div v-else class="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            <div 
              v-for="(item, idx) in cart" 
              :key="idx"
              class="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-sm"
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-baseline gap-1.5">
                  <span class="font-extrabold text-white text-sm">{{ item.menuName }}</span>
                  <span class="text-xs text-slate-400">x{{ item.quantity }}</span>
                </div>
                
                <!-- Print config detail options -->
                <div class="flex flex-wrap gap-1.5 mt-1 text-[11px]">
                  <span v-if="item.proteinType" class="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                    🥩 {{ item.proteinType }}{{ item.isSpecial ? ' (พิเศษ)' : '' }}
                  </span>
                  <span v-for="opt in item.selectedOptions" :key="opt.optionId" class="bg-slate-850 text-orange-400 px-1.5 py-0.5 rounded border border-orange-950/40">
                    + {{ opt.label }}
                  </span>
                  <span v-if="item.notes" class="text-slate-400 font-medium italic block w-full mt-0.5">
                    📝 {{ item.notes }}
                  </span>
                </div>
              </div>

              <!-- Price & Remove button -->
              <div class="flex items-center gap-3">
                <span class="font-black text-white">฿{{ item.totalPrice * item.quantity }}</span>
                <button 
                  @click="removeFromCart(idx)"
                  class="text-red-500 hover:text-red-400 font-bold p-1 bg-red-950/30 hover:bg-red-950/60 rounded"
                  title="ลบ"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>

          <!-- Checkout / Action Footer block -->
          <div v-if="cart.length > 0" class="p-4 bg-slate-850 border-t border-slate-800 space-y-3 flex-shrink-0">
            <!-- Summary Row -->
            <div class="flex items-center justify-between">
              <span class="text-slate-300 font-medium">รวมยอดเงินทั้งบิล:</span>
              <span class="text-2xl font-black text-emerald-400">฿{{ cartTotalPrice }}</span>
            </div>

            <!-- Confirm Buttons -->
            <div class="flex gap-2">
              <button 
                @click="clearCart"
                class="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-3.5 px-4 rounded-xl border border-slate-750 active:scale-95 transition-all text-sm"
              >
                ล้างบิล
              </button>
              
              <button 
                @click="submitOrder"
                :disabled="isSubmitting"
                class="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/30 active:scale-95 transition-all text-base"
              >
                <span v-if="isSubmitting" class="animate-spin text-sm">⏳</span>
                <span>✅ ยืนยันออร์เดอร์ (ชำระเงิน)</span>
              </button>
            </div>
          </div>

        </div>

      </aside>

    </div>

  </div>
</template>

<style scoped>
/* Scrollbar optimizations for Cashier touchscreen POS */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: #020617;
}
::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background: #475569;
}
</style>
