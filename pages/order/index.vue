<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'

definePageMeta({
  layout: 'default'
})

// 1. Data Fetching
const { data: menuResult, pending: menusPending } = await useFetch<{ success: boolean, data: any[] }>('/api/menus')
const { data: categoryResult } = await useFetch<{ success: boolean, data: any[] }>('/api/categories')

const allMenus = computed(() => menuResult.value?.data || [])
const categories = computed(() => categoryResult.value?.data || [])

// Compute all menus, but dynamically split beverage items with temperature options
const processedMenus = computed(() => {
  const list: any[] = []
  
  allMenus.value.forEach((menu: any) => {
    // Check if it's a beverage (dept === 'Barista') and has options
    if (menu.dept === 'Barista' && menu.options && Array.isArray(menu.options)) {
      // Exclude blended ('ปั่น') options
      const tempOpts = menu.options.filter((o: any) => o.option_group === 'temperature' && o.label !== 'ปั่น')
      
      if (tempOpts.length > 0) {
        // Sort temp options: 'ร้อน' first, then 'เย็น'
        const order = { 'ร้อน': 1, 'เย็น': 2 }
        const sortedTempOpts = [...tempOpts].sort((a: any, b: any) => (order[a.label] || 99) - (order[b.label] || 99))
        
        sortedTempOpts.forEach((opt: any) => {
          list.push({
            ...menu,
            clientUniqueId: `${menu.id}-${opt.id}`,
            name: `${menu.name} [${opt.label}]`,
            originalName: menu.name,
            base_price: Number(menu.base_price) + Number(opt.extra_price),
            base_price_raw: Number(menu.base_price),
            preSelectedTempOptionId: opt.id
          })
        })
        return
      }
    }
    
    list.push({
      ...menu,
      clientUniqueId: `menu-${menu.id}`
    })
  })
  
  return list
})

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
  categoryId: number
  discount: number
}

// 2. State Management
const cart = ref<CartItem[]>([])
const activeCategory = ref<number | 'all'>('all')
const search = ref('')
const showImages = ref(true)

const beverageTempFilter = ref<'hot' | 'cold' | 'all'>('cold')

const beverageCategoryId = computed(() => {
  const bevCat = categories.value.find(c => c.name === 'Beverage')
  return bevCat ? bevCat.id : null
})

// Default to the first category (Beverage) when categories are loaded
watch(categories, (newCats) => {
  if (newCats && newCats.length > 0 && activeCategory.value === 'all') {
    activeCategory.value = newCats[0].id
  }
}, { immediate: true })

watch(activeCategory, (newCat) => {
  if (newCat === beverageCategoryId.value) {
    beverageTempFilter.value = 'cold'
  }
})

// Persist the showImages preference
if (import.meta.client) {
  const savedVal = localStorage.getItem('pos:show-images')
  if (savedVal !== null) {
    showImages.value = savedVal === 'true'
  }
}

const toggleShowImages = () => {
  showImages.value = !showImages.value
  if (import.meta.client) {
    localStorage.setItem('pos:show-images', String(showImages.value))
  }
}

// Drag & Drop State
const draggedMenu = ref<any>(null)
const isDraggingOverCart = ref(false)
let dragCounter = 0

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

// Discount state (built-in POS feature)
const discountAmount = ref(0) // default to 0 (no discount)
const isCustomDiscount = ref(false)
const customDiscountInput = ref<number | null>(null)

const selectDiscountPreset = (preset: number) => {
  isCustomDiscount.value = false
  discountAmount.value = preset
  customDiscountInput.value = null
}

const enableCustomDiscount = () => {
  isCustomDiscount.value = true
  discountAmount.value = Number(customDiscountInput.value || 0)
}

const handleCustomDiscountInput = () => {
  if (isCustomDiscount.value) {
    discountAmount.value = Math.max(0, Number(customDiscountInput.value || 0))
  }
}

// Cart item inline editing state
const editingCartItem = ref<CartItem | null>(null)

watch(selectedMenu, (newVal) => {
  if (!newVal) {
    editingCartItem.value = null
  }
})

const editCartItemConfig = (item: CartItem) => {
  // Find the menu object from allMenus
  const menu = allMenus.value.find((m: any) => m.id === item.menuId)
  if (!menu) return

  // Set active item state
  selectedMenu.value = menu
  activeQuantity.value = item.quantity
  isTakeaway.value = item.isTakeaway
  isSpecial.value = item.isSpecial
  selectedProtein.value = item.proteinType || 'หมู'
  notes.value = item.notes
  
  // Clear states
  Object.keys(selectedOptionsState).forEach(key => delete selectedOptionsState[Number(key)])
  Object.keys(selectedSingleOptionsState).forEach(key => delete selectedSingleOptionsState[key])

  // Set discount from item
  discountAmount.value = item.discount || 0
  isCustomDiscount.value = ![0, 10, 20].includes(item.discount)
  customDiscountInput.value = isCustomDiscount.value ? item.discount : null

  editingCartItem.value = item

  activeOptionsPending.value = false
  
  let menuOpts: any[] = []
  if (menu.options && Array.isArray(menu.options)) {
    menuOpts = menu.options.filter((o: any) => !(o.option_group === 'temperature' && o.label === 'ปั่น'))
  }
  
  activeItemOptions.value = menuOpts

  // Pre-select options that were saved on the cart item
  item.selectedOptions.forEach(opt => {
    const optionInfo = activeItemOptions.value.find(o => o.id === opt.optionId)
    if (optionInfo) {
      if (['temperature', 'sweetness', 'milk_type'].includes(optionInfo.option_group)) {
        selectedSingleOptionsState[optionInfo.option_group] = opt.optionId
      } else if (optionInfo.option_group === 'addons') {
        selectedOptionsState[opt.optionId] = true
      }
    }
  })

  // If any group doesn't have a selection, select defaults
  const groups = ['temperature', 'sweetness', 'milk_type']
  groups.forEach(g => {
    if (selectedSingleOptionsState[g] === undefined) {
      const opts = activeItemOptions.value.filter(o => o.option_group === g)
      if (opts.length > 0) {
        if (g === 'temperature' && menu.preSelectedTempOptionId) {
          selectedSingleOptionsState[g] = menu.preSelectedTempOptionId
        } else {
          const defaultOpt = opts.find(o => Number(o.extra_price) === 0) || opts[0]
          selectedSingleOptionsState[g] = defaultOpt.id
        }
      }
    }
  })
}

// Food options presets
const proteins = ['หมู', 'หมูสับ', 'หมูชิ้น', 'ไก่', 'ทะเล', 'เนื้อ']
const quickNotes = ['เผ็ดน้อย', 'ไม่เผ็ด', 'ข้าวน้อย', 'ไม่ใส่ผัก', 'หวานน้อย', 'วิปครีมเยอะๆ']

// 3. Computed Lists
const filteredMenus = computed(() => {
  let list = processedMenus.value
  
  if (activeCategory.value !== 'all') {
    list = list.filter(m => m.category_id === activeCategory.value)
    
    // Apply temperature filter if viewing Beverages
    if (activeCategory.value === beverageCategoryId.value) {
      if (beverageTempFilter.value === 'cold') {
        list = list.filter(m => {
          if (!m.preSelectedTempOptionId) return true // Keep drinks without temp options
          const opt = m.options?.find((o: any) => o.id === m.preSelectedTempOptionId)
          return opt && opt.label === 'เย็น'
        })
      } else if (beverageTempFilter.value === 'hot') {
        list = list.filter(m => {
          if (!m.preSelectedTempOptionId) return false
          const opt = m.options?.find((o: any) => o.id === m.preSelectedTempOptionId)
          return opt && opt.label === 'ร้อน'
        })
      }
    }
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
    case 'discount': return '💸 ส่วนลดราคา ( Discount )'
    default: return '⚙️ ตัวเลือกเพิ่มเติม ( Custom Options )'
  }
}

// Calculate price of the active item (base + selected options + special - discount)
const activeItemSinglePrice = computed(() => {
  if (!selectedMenu.value) return 0
  let total = Number(selectedMenu.value.base_price_raw !== undefined ? selectedMenu.value.base_price_raw : selectedMenu.value.base_price)

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

  // 4. Subtract discount
  total -= discountAmount.value

  return Math.max(0, total) // Prevent price from going below zero
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

// Group cart items by category for structured receipt lists
const groupedCart = computed(() => {
  const groups: { category: any, items: CartItem[] }[] = []
  
  categories.value.forEach(cat => {
    const items = cart.value.filter(item => item.categoryId === cat.id)
    if (items.length > 0) {
      groups.push({
        category: cat,
        items: [...items].sort((a, b) => a.menuName.localeCompare(b.menuName, 'th'))
      })
    }
  })
  
  const knownCatIds = categories.value.map(c => c.id)
  const unknownItems = cart.value.filter(item => !knownCatIds.includes(item.categoryId))
  if (unknownItems.length > 0) {
    groups.push({
      category: { id: 0, name: 'อื่นๆ', icon: '📦' },
      items: [...unknownItems].sort((a, b) => a.menuName.localeCompare(b.menuName, 'th'))
    })
  }
  
  return groups
})

// Sorted list to submit to the API (food first, then drinks, then desserts)
const sortedCart = computed(() => {
  const list: CartItem[] = []
  groupedCart.value.forEach(g => {
    list.push(...g.items)
  })
  return list
})

// Grouped submitted receipt data for modal preview and printing
const groupedReceiptData = computed(() => {
  if (!receiptData.value) return []
  
  const groups: { category: any, items: CartItem[] }[] = []
  
  categories.value.forEach(cat => {
    const items = receiptData.value!.items.filter(item => item.categoryId === cat.id)
    if (items.length > 0) {
      groups.push({
        category: cat,
        items: [...items].sort((a, b) => a.menuName.localeCompare(b.menuName, 'th'))
      })
    }
  })
  
  const knownCatIds = categories.value.map(c => c.id)
  const unknownItems = receiptData.value!.items.filter(item => !knownCatIds.includes(item.categoryId))
  if (unknownItems.length > 0) {
    groups.push({
      category: { id: 0, name: 'อื่นๆ', icon: '📦' },
      items: [...unknownItems].sort((a, b) => a.menuName.localeCompare(b.menuName, 'th'))
    })
  }
  
  return groups
})

// 4. Methods
// When clicking a menu item on the left panel
const selectMenu = (menu: any) => {
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

  // Reset discount to default 0 (no discount)
  discountAmount.value = 0
  isCustomDiscount.value = false
  customDiscountInput.value = null

  activeOptionsPending.value = false
  
  let menuOpts: any[] = []
  if (menu.options && Array.isArray(menu.options)) {
    // Exclude temperature option labeled 'ปั่น'
    menuOpts = menu.options.filter((o: any) => !(o.option_group === 'temperature' && o.label === 'ปั่น'))
  }
  
  activeItemOptions.value = menuOpts

  // Pre-select defaults for radio option groups
  const groups = ['temperature', 'sweetness', 'milk_type']
  groups.forEach(g => {
    const opts = activeItemOptions.value.filter(o => o.option_group === g)
    if (opts.length > 0) {
      if (g === 'temperature' && menu.preSelectedTempOptionId) {
        selectedSingleOptionsState[g] = menu.preSelectedTempOptionId
      } else {
        const defaultOpt = opts.find(o => Number(o.extra_price) === 0) || opts[0]
        selectedSingleOptionsState[g] = defaultOpt.id
      }
    }
  })
}

// Add configured active item to cart
const addActiveToCart = () => {
  if (!selectedMenu.value) return

  const isFood = selectedMenu.value.dept === 'Kitchen'

  // Gather selected options
  const selectedOpts: any[] = []

  // Gather radio selections
  Object.entries(selectedSingleOptionsState).forEach(([group, optId]) => {
    const opt = activeItemOptions.value.find(o => o.id === optId)
    if (opt && opt.id > 0) { // Exclude 'No Discount' (id = 0) which is not in DB
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

  if (editingCartItem.value) {
    // Update the item in-place
    const item = editingCartItem.value
    item.quantity = activeQuantity.value
    item.isTakeaway = isTakeaway.value
    item.isSpecial = isSpecial.value
    item.notes = notes.value
    item.proteinType = isFood ? selectedProtein.value : ''
    item.selectedOptions = selectedOpts
    item.totalPrice = activeItemSinglePrice.value
    item.discount = discountAmount.value
  } else {
    // Check if item with exact same configurations already exists in cart, if so, combine quantity
    const matchingIndex = cart.value.findIndex(item => {
      if (item.menuId !== selectedMenu.value.id) return false
      if (item.isTakeaway !== isTakeaway.value) return false
      if (isFood && (item.isSpecial !== isSpecial.value || item.proteinType !== selectedProtein.value)) return false
      if (item.notes !== notes.value) return false
      if (item.discount !== discountAmount.value) return false
      
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
        menuName: selectedMenu.value.originalName || selectedMenu.value.name,
        basePrice: Number(selectedMenu.value.base_price_raw !== undefined ? selectedMenu.value.base_price_raw : selectedMenu.value.base_price),
        selectedOptions: selectedOpts,
        totalPrice: activeItemSinglePrice.value,
        quantity: activeQuantity.value,
        isTakeaway: isTakeaway.value,
        isSpecial: isSpecial.value,
        notes: notes.value,
        proteinType: isFood ? selectedProtein.value : '',
        categoryId: selectedMenu.value.category_id,
        discount: discountAmount.value
      })
    }
  }

  // Clear selections
  selectedMenu.value = null
}

// Play pleasant high-quality audio beep on drop
const playAddSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(1000, audioContext.currentTime + 0.15)
    
    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15)
    
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.15)
  } catch (err) {
    console.log('Audio not supported or blocked')
  }
}

// Add menu item directly to cart with default options (for drag-and-drop bypass)
const addMenuToCartDirectly = (menu: any) => {
  const isFood = menu.dept === 'Kitchen'
  const selectedOpts: any[] = []
  
  if (menu.options && Array.isArray(menu.options)) {
    const groups = ['temperature', 'sweetness', 'milk_type']
    groups.forEach(g => {
      const opts = menu.options.filter((o: any) => o.option_group === g && !(g === 'temperature' && o.label === 'ปั่น'))
      if (opts.length > 0) {
        let selectedOpt: any = null
        if (g === 'temperature' && menu.preSelectedTempOptionId) {
          selectedOpt = opts.find((o: any) => o.id === menu.preSelectedTempOptionId)
        }
        if (!selectedOpt) {
          selectedOpt = opts.find((o: any) => Number(o.extra_price) === 0) || opts[0]
        }
        if (selectedOpt) {
          selectedOpts.push({
            optionId: selectedOpt.id,
            quantity: 1,
            label: selectedOpt.label,
            extraPrice: Number(selectedOpt.extra_price)
          })
        }
      }
    })
  }

  let singleItemPrice = Number(menu.base_price_raw !== undefined ? menu.base_price_raw : menu.base_price)
  selectedOpts.forEach(o => {
    singleItemPrice += Number(o.extraPrice)
  })

  const matchingIndex = cart.value.findIndex(item => {
    if (item.menuId !== menu.id) return false
    if (item.isTakeaway !== false) return false
    if (isFood && (item.isSpecial !== false || item.proteinType !== 'หมู')) return false
    if (item.notes !== '') return false
    if (item.discount !== 0) return false
    
    if (item.selectedOptions.length !== selectedOpts.length) return false
    const itemOptIds = item.selectedOptions.map(o => o.optionId).sort()
    const currentOptIds = selectedOpts.map(o => o.optionId).sort()
    return itemOptIds.every((id, idx) => id === currentOptIds[idx])
  })

  if (matchingIndex > -1) {
    cart.value[matchingIndex].quantity += 1
  } else {
    cart.value.push({
      menuId: menu.id,
      menuName: menu.originalName || menu.name,
      basePrice: Number(menu.base_price_raw !== undefined ? menu.base_price_raw : menu.base_price),
      selectedOptions: selectedOpts,
      totalPrice: singleItemPrice,
      quantity: 1,
      isTakeaway: false,
      isSpecial: false,
      notes: '',
      proteinType: isFood ? 'หมู' : '',
      categoryId: menu.category_id,
      discount: 0
    })
  }
}

// HTML5 Drag & Drop event handlers
const onDragStart = (e: DragEvent, menu: any) => {
  draggedMenu.value = menu
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', menu.name)
  }
}

const onDragEnd = () => {
  draggedMenu.value = null
  isDraggingOverCart.value = false
}

const onDragEnter = (e: DragEvent) => {
  dragCounter++
  isDraggingOverCart.value = true
}

const onDragLeave = (e: DragEvent) => {
  dragCounter--
  if (dragCounter <= 0) {
    dragCounter = 0
    isDraggingOverCart.value = false
  }
}

const onDragOver = (e: DragEvent) => {
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy'
  }
}

const onDrop = (e: DragEvent) => {
  dragCounter = 0
  isDraggingOverCart.value = false
  if (draggedMenu.value) {
    addMenuToCartDirectly(draggedMenu.value)
    selectedMenu.value = null
    activeTab.value = 'cart'
    playAddSound()
    draggedMenu.value = null
  }
}

const addQuickNote = (note: string) => {
  if (notes.value) {
    notes.value += ', ' + note
  } else {
    notes.value = note
  }
}

const removeFromCart = (item: CartItem) => {
  const index = cart.value.indexOf(item)
  if (index > -1) {
    cart.value.splice(index, 1)
  }
}

const clearCart = () => {
  cart.value = []
}

// Active orders & Editing state
const activeTab = ref<'cart' | 'active_orders'>('cart')
const editingOrderId = ref<number | null>(null)

// Fetch active orders (Pending, Cooking, Ready)
const { data: activeOrdersResult, refresh: refreshActiveOrders } = await useFetch<{ success: boolean, data: any[] }>('/api/orders/orders-by-status?status=Pending,Cooking,Ready')
const activeOrders = computed(() => activeOrdersResult.value?.data || [])

// Poll active orders every 10 seconds to keep cash register synced with kitchen
if (import.meta.client) {
  setInterval(() => {
    refreshActiveOrders()
  }, 10000)
}

const cancelEdit = () => {
  editingOrderId.value = null
  cart.value = []
  tableNumber.value = ''
}

const formatOrderTime = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

const archiveOrder = async (orderId: number) => {
  try {
    const response = await $fetch<{ success: boolean }>(`/api/orders/${orderId}`, {
      method: 'PATCH',
      body: { status: 'Completed' }
    })
    if (response.success) {
      await refreshActiveOrders()
    }
  } catch (error: any) {
    console.error('Failed to archive order:', error)
    alert('เกิดข้อผิดพลาดในการเก็บออร์เดอร์: ' + (error.data?.message || error.message))
  }
}

const cancelOrder = async (orderId: number) => {
  if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการยกเลิกออร์เดอร์ #${orderId}?`)) {
    return
  }
  try {
    const response = await $fetch<{ success: boolean }>(`/api/orders/${orderId}`, {
      method: 'PATCH',
      body: { status: 'Cancelled' }
    })
    if (response.success) {
      await refreshActiveOrders()
    }
  } catch (error: any) {
    console.error('Failed to cancel order:', error)
    alert('เกิดข้อผิดพลาดในการยกเลิกออร์เดอร์: ' + (error.data?.message || error.message))
  }
}

const openDropdownOrderId = ref<number | null>(null)

const toggleOrderDropdown = (orderId: number) => {
  openDropdownOrderId.value = openDropdownOrderId.value === orderId ? null : orderId
}

const handleEditFromDropdown = (order: any) => {
  openDropdownOrderId.value = null
  editOrder(order)
}

const handleCancelFromDropdown = (orderId: number) => {
  openDropdownOrderId.value = null
  cancelOrder(orderId)
}

if (import.meta.client) {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('.meatball-container')) {
      openDropdownOrderId.value = null
    }
  })
}

const editOrder = (order: any) => {
  editingOrderId.value = order.id
  
  // Extract table number
  const match = order.location?.match(/โต๊ะ\s*(.+)/)
  tableNumber.value = match ? match[1] : ''
  
  // Build items list
  cart.value = order.items.map((item: any) => {
      const menu = allMenus.value.find((m: any) => m.id === item.menu_id)
      const categoryId = menu ? menu.category_id : 0
      
      let discountVal = Number(item.discount || 0)
      const discountDefaults: Record<number, number> = {
          15: 5.00,
          16: 10.00,
          17: 20.00,
          18: 50.00
      }
      
      const filteredOptions: any[] = []
      ;(item.options || []).forEach((opt: any) => {
          const optId = Number(opt.option_id)
          if (discountDefaults[optId] !== undefined) {
              if (discountVal === 0) {
                  discountVal = discountDefaults[optId]
              }
          } else {
              let extraPrice = 0
              for (const m of allMenus.value) {
                  const o = m.options?.find((x: any) => x.id === opt.option_id)
                  if (o) {
                      extraPrice = Number(o.extra_price)
                      break
                  }
              }
              filteredOptions.push({
                  optionId: optId,
                  quantity: Number(opt.quantity || 1),
                  label: opt.label,
                  extraPrice
              })
          }
      })

      return {
          menuId: item.menu_id,
          menuName: item.menu_name,
          basePrice: menu ? Number(menu.base_price) : Number(item.item_price),
          selectedOptions: filteredOptions,
          totalPrice: Number(item.item_price),
          quantity: Number(item.quantity),
          isTakeaway: !!item.is_takeaway,
          isSpecial: !!item.is_special,
          notes: item.notes || '',
          proteinType: item.protein_type || '',
          categoryId,
          discount: discountVal
      }
  })
  
  // Switch to cart tab
  activeTab.value = 'cart'
}

const printActiveOrderReceipt = (order: any) => {
  // Map order items to CartItem format for the receipt
  const items = order.items.map((item: any) => {
    const menu = allMenus.value.find((m: any) => m.id === item.menu_id)
    const categoryId = menu ? menu.category_id : 0
    
    let discountVal = Number(item.discount || 0)
    const discountDefaults: Record<number, number> = {
        15: 5.00,
        16: 10.00,
        17: 20.00,
        18: 50.00
    }
    
    const filteredOptions: any[] = []
    ;(item.options || []).forEach((opt: any) => {
        const optId = Number(opt.option_id)
        if (discountDefaults[optId] !== undefined) {
            if (discountVal === 0) {
                discountVal = discountDefaults[optId]
            }
        } else {
            let extraPrice = 0
            for (const m of allMenus.value) {
                const o = m.options?.find((x: any) => x.id === opt.option_id)
                if (o) {
                    extraPrice = Number(o.extra_price)
                    break
                }
            }
            filteredOptions.push({
                optionId: optId,
                quantity: Number(opt.quantity || 1),
                label: opt.label,
                extraPrice
            })
        }
    })

    const isFood = menu ? menu.dept === 'Kitchen' : false
    return {
        menuId: item.menu_id,
        menuName: item.menu_name,
        basePrice: menu ? Number(menu.base_price) : Number(item.item_price),
        selectedOptions: filteredOptions,
        totalPrice: Number(item.item_price),
        quantity: Number(item.quantity),
        isTakeaway: !!item.is_takeaway,
        isSpecial: !!item.is_special,
        notes: item.notes || '',
        proteinType: isFood ? (item.protein_type || '') : '',
        categoryId,
        discount: discountVal
    }
  })

  receiptData.value = {
    orderId: order.id,
    date: new Date(order.created_at).toLocaleString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }),
    location: order.location || 'จุดขาย POS หน้าร้าน',
    items,
    totalPrice: Number(order.total_price)
  }
  showReceiptModal.value = true
}

// 5. Submit Order to API
const isSubmitting = ref(false)
const orderSuccess = ref(false)
const submittedOrderId = ref<number | null>(null)
const tableNumber = ref('')

// State for receipt printing
const showReceiptModal = ref(false)
const receiptData = ref<{
  orderId: number | null
  date: string
  location: string
  items: CartItem[]
  totalPrice: number
} | null>(null)

const printReceipt = () => {
  if (import.meta.client) {
    window.print()
  }
}

const submitOrder = async () => {
  if (cart.value.length === 0 || isSubmitting.value) return

  isSubmitting.value = true

  try {
    const url = editingOrderId.value 
      ? `/api/orders/${editingOrderId.value}`
      : '/api/orders'
    const method = editingOrderId.value ? 'PUT' : 'POST'

    const response = await $fetch<{ success: boolean, data: { orderId: number, message: string } }>(url, {
      method,
      body: {
        items: sortedCart.value,
        totalPrice: cartTotalPrice.value,
        location: tableNumber.value ? `โต๊ะ ${tableNumber.value}` : 'จุดขาย POS หน้าร้าน'
      }
    })

    if (response.success) {
      const orderId = response.data.orderId
      
      // Store current cart data in receipt state before clearing it
      receiptData.value = {
        orderId,
        date: new Date().toLocaleString('th-TH', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        location: tableNumber.value ? `โต๊ะ ${tableNumber.value}` : 'จุดขาย POS หน้าร้าน',
        items: [...sortedCart.value],
        totalPrice: cartTotalPrice.value
      }

      submittedOrderId.value = orderId
      orderSuccess.value = true
      showReceiptModal.value = true
      
      // Clear cart
      cart.value = []
      tableNumber.value = ''
      editingOrderId.value = null
      
      // Refresh active orders list
      await refreshActiveOrders()

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
  <div class="h-screen flex flex-col bg-zinc-100 text-zinc-800 overflow-hidden font-sans">
    
    <!-- Top Header bar -->
    <header class="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
      <div class="flex items-center gap-3">
        <NuxtLink to="/" class="text-xl hover:opacity-80 transition-opacity">🏠</NuxtLink>
        <h1 class="text-2xl font-black tracking-tight text-zinc-900 flex items-center gap-2">
          🍜 ระบบสั่งอาหาร & คาเฟ่ <span class="text-xs font-bold px-2 py-0.5 bg-orange-600 rounded text-white uppercase">POS Counter</span>
        </h1>
      </div>
      
      <!-- Search & Category Filters -->
      <div class="flex items-center gap-3 w-[60%] justify-end font-sans">
        <!-- Toggle Image Layout Button -->
        <button 
          @click="toggleShowImages"
          class="bg-zinc-200 hover:bg-zinc-300 text-zinc-800 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border border-zinc-300 active:scale-95 transition-all"
        >
          <span>{{ showImages ? '🖼️ มีรูป' : '🚫🖼️ ไม่มีรูป' }}</span>
        </button>

        <input 
          v-model="search"
          type="text" 
          placeholder="🔎 ค้นหาเมนู..." 
          class="bg-zinc-100 border border-zinc-300 rounded-xl px-4 py-2 text-sm text-zinc-900 w-48 focus:w-64 focus:outline-none focus:border-orange-600 focus:ring-1 focus:ring-orange-600 transition-all"
        />
        
        <NuxtLink to="/admin/items" class="bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 px-4 py-2 rounded-xl text-sm font-semibold active:scale-95 transition-all">
          ⚙️ หลังบ้าน
        </NuxtLink>
      </div>
    </header>

    <!-- Main Grid -->
    <div class="flex-1 flex portrait:flex-col overflow-hidden">
      
      <!-- LEFT SIDEBAR / GRID: 65% width (100% in portrait) -->
      <main class="w-[65%] portrait:w-full portrait:h-[60%] flex flex-col border-r portrait:border-r-0 portrait:border-b border-zinc-200 bg-zinc-50 overflow-hidden">
        
        <!-- Category Selection Tabs (Large touch targets) -->
        <div class="flex p-3 gap-2 bg-white border-b border-zinc-200 overflow-x-auto flex-shrink-0">
          <button 
            v-for="cat in categories" 
            :key="cat.id"
            @click="activeCategory = cat.id"
            :class="`px-5 py-3 rounded-xl font-bold transition-all text-base flex items-center gap-1.5 border ${
              activeCategory === cat.id 
                ? 'bg-orange-600 text-white border-orange-700' 
                : 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200'
            }`"
          >
            <span>{{ cat.icon }}</span>
            <span>{{ cat.name === 'Food' ? 'อาหาร' : cat.name === 'Beverage' ? 'เครื่องดื่ม' : cat.name === 'Dessert' ? 'ของหวาน' : cat.name }}</span>
          </button>

          <button 
            @click="activeCategory = 'all'"
            :class="`px-5 py-3 rounded-xl font-bold transition-all text-base border ${
              activeCategory === 'all' 
                ? 'bg-orange-600 text-white border-orange-700' 
                : 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200'
            }`"
          >
            📂 ทั้งหมด
          </button>
        </div>

        <!-- Beverage Temperature Sub-Tabs (Shown only when Beverage category is selected) -->
        <div v-if="activeCategory === beverageCategoryId" class="flex px-4 py-2 gap-2 bg-zinc-100/50 border-b border-zinc-200 flex-shrink-0 animate-fade-in">
          <button 
            @click="beverageTempFilter = 'cold'"
            :class="`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
              beverageTempFilter === 'cold' 
                ? 'bg-blue-600 text-white border-blue-700' 
                : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
            }`"
          >
            🧊 เมนูเย็น (Cold)
          </button>
          <button 
            @click="beverageTempFilter = 'hot'"
            :class="`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
              beverageTempFilter === 'hot' 
                ? 'bg-orange-600 text-white border-orange-700' 
                : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
            }`"
          >
            ☕ เมนูร้อน (Hot)
          </button>
          <button 
            @click="beverageTempFilter = 'all'"
            :class="`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
              beverageTempFilter === 'all' 
                ? 'bg-zinc-250 text-zinc-800 border-zinc-300' 
                : 'bg-white text-zinc-600 border-zinc-200'
            }`"
          >
            📂 ทั้งหมด
          </button>
        </div>

        <!-- Menu Cards Grid (Scrollable) -->
        <div class="flex-1 p-4 overflow-y-auto min-h-0">
          <div v-if="menusPending" class="flex flex-col items-center justify-center py-24">
            <span class="text-4xl animate-spin mb-4">⏳</span>
            <p class="text-zinc-500">กำลังโหลดรายการเมนู...</p>
          </div>
          
          <div v-else-if="filteredMenus.length === 0" class="text-center py-24">
            <span class="text-5xl mb-4 block">🔍</span>
            <p class="text-zinc-500 text-lg font-medium">ไม่พบเมนูที่ตรงกับเงื่อนไข</p>
          </div>
          
          <div v-else class="grid gap-3" :class="showImages ? 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'">
            <!-- Menus List -->
            <button 
              v-for="menu in filteredMenus" 
              :key="menu.clientUniqueId"
              draggable="true"
              @dragstart="onDragStart($event, menu)"
              @dragend="onDragEnd"
              @click="selectMenu(menu)"
              :class="`rounded-2xl border text-left flex active:scale-98 transition-all duration-100 cursor-grab active:cursor-grabbing ${
                showImages ? 'flex-col overflow-hidden h-auto' : 'p-4 flex-col justify-between h-32'
              } ${
                selectedMenu?.clientUniqueId === menu.clientUniqueId
                  ? 'border-orange-600 ring-2 ring-orange-600 bg-orange-50'
                  : 'border-zinc-200 bg-white hover:bg-zinc-50'
              }`"
            >
              <!-- Card Image (Shown ONLY if showImages is true) -->
              <template v-if="showImages">
                <div class="h-20 md:h-[86px] w-full bg-zinc-100 relative overflow-hidden flex-shrink-0">
                  <img 
                    v-if="menu.image_url" 
                    :src="menu.image_url" 
                    :alt="menu.name" 
                    class="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <div v-else class="w-full h-full flex items-center justify-center text-2xl">
                    {{ menu.dept === 'Kitchen' ? '🍜' : menu.dept === 'Barista' ? '☕' : '🍰' }}
                  </div>
                  
                  <!-- Department badge overlay -->
                  <span :class="`absolute top-1.5 right-1.5 text-[9px] uppercase font-black px-1.5 py-0.5 rounded shadow ${
                    menu.dept === 'Kitchen' ? 'bg-orange-600 text-white' :
                    menu.dept === 'Barista' ? 'bg-blue-600 text-white' :
                    'bg-pink-600 text-white'
                  }`">
                    {{ menu.dept === 'Kitchen' ? 'อาหาร' : menu.dept === 'Barista' ? 'บาร์น้ำ' : 'ขนม' }}
                  </span>
                </div>
                
                <!-- Card details -->
                <div class="p-2 md:p-2.5 flex-1 flex flex-col justify-between">
                  <h3 class="font-bold text-zinc-900 text-xs md:text-sm leading-snug line-clamp-2">{{ menu.name }}</h3>
                  <span class="text-orange-600 font-extrabold text-sm md:text-base mt-0.5 block">฿{{ menu.base_price }}</span>
                </div>
              </template>

              <!-- Text/Emoji Card layout (Shown when showImages is false) -->
              <template v-else>
                <div class="flex justify-between items-start w-full">
                  <span class="text-2xl">{{ menu.dept === 'Kitchen' ? '🍜' : menu.dept === 'Barista' ? '☕' : '🍰' }}</span>
                  <span :class="`text-[10px] uppercase font-black px-2 py-0.5 rounded ${
                    menu.dept === 'Kitchen' ? 'bg-orange-100 text-orange-850' :
                    menu.dept === 'Barista' ? 'bg-blue-100 text-blue-850' :
                    'bg-pink-100 text-pink-850'
                  }`">
                    {{ menu.dept === 'Kitchen' ? 'ครัว' : menu.dept === 'Barista' ? 'บาร์น้ำ' : 'ขนม' }}
                  </span>
                </div>
                
                <div>
                  <h3 class="font-bold text-zinc-900 text-sm md:text-base leading-snug line-clamp-2 font-sans">{{ menu.name }}</h3>
                  <span class="text-orange-600 font-extrabold text-lg mt-1 block">฿{{ menu.base_price }}</span>
                </div>
              </template>
            </button>
          </div>
        </div>
      </main>

      <!-- RIGHT PANEL: 35% width (100% in portrait) -->
      <aside 
        class="w-[35%] portrait:w-full portrait:h-[40%] bg-zinc-100 flex flex-col overflow-hidden min-h-0 relative transition-all duration-200"
        :class="{ 'ring-4 ring-orange-500 ring-inset bg-orange-50/10': isDraggingOverCart }"
        @dragover.prevent="onDragOver"
        @dragenter.prevent="onDragEnter"
        @dragleave.prevent="onDragLeave"
        @drop="onDrop($event)"
      >
        <!-- Drag & Drop overlay visual indicator -->
        <div 
          v-if="isDraggingOverCart"
          class="absolute inset-0 bg-orange-500/95 flex flex-col items-center justify-center text-white z-50 p-6 pointer-events-none"
        >
          <span class="text-5xl mb-3 animate-bounce">🛒</span>
          <span class="text-xl font-black text-center">วางที่นี่เพื่อใส่บิลโดยตรง</span>
          <span class="text-sm text-orange-100 text-center mt-1">(พร้อมตัวเลือกเริ่มต้น)</span>
        </div>
        
        <!-- SECTION 1: Modifier / Options Editor (Full height of the sidebar in landscape, full screen overlay in portrait) -->
        <div 
          v-if="selectedMenu"
          class="modifier-panel h-full flex flex-col overflow-hidden min-h-0 portrait:fixed portrait:inset-0 portrait:z-50 portrait:w-full portrait:h-full portrait:max-h-screen portrait:bg-white animate-fade-in border-l border-zinc-200 bg-white"
        >
          <div class="bg-zinc-50 px-4 py-4 flex items-center justify-between border-b border-zinc-200 flex-shrink-0">
            <h2 class="text-base font-black tracking-wider text-zinc-900 uppercase flex items-center gap-1.5 font-sans">
              <span>{{ editingCartItem ? '✏️ แก้ไขรายการในตะกร้า' : '⚙️ ปรับแต่งเครื่องดื่ม/อาหาร' }}</span>
            </h2>
            <button 
              @click="selectedMenu = null" 
              class="text-sm font-bold text-zinc-700 hover:bg-zinc-100 bg-white px-3.5 py-1.5 rounded-xl active:scale-95 border border-zinc-200 transition-all"
            >
              ✕ ยกเลิก (Cancel)
            </button>
          </div>

          <!-- Loading state for options -->
          <div v-if="activeOptionsPending" class="flex-1 flex flex-col items-center justify-center py-12">
            <span class="text-2xl animate-spin mb-2">⏳</span>
            <p class="text-xs text-zinc-505">กำลังโหลดตัวเลือกสำหรับ {{ selectedMenu.name }}...</p>
          </div>

          <!-- Options Editor Container (Scrollable) -->
          <div v-else class="flex-1 overflow-y-auto p-4 space-y-4">
            
            <!-- Item Header -->
            <div class="bg-zinc-50 p-3.5 rounded-xl border border-zinc-200 flex items-center gap-3">
              <div class="w-12 h-12 rounded-lg bg-zinc-200 overflow-hidden flex-shrink-0">
                <img v-if="selectedMenu.image_url" :src="selectedMenu.image_url" class="w-full h-full object-cover">
                <div v-else class="w-full h-full flex items-center justify-center text-xl">☕</div>
              </div>
              <div class="flex-1">
                <h3 class="font-black text-zinc-900 text-lg leading-tight">{{ selectedMenu.name }}</h3>
                <span class="text-xs text-zinc-505 font-medium">ราคาเริ่มต้น ฿{{ selectedMenu.base_price }}</span>
              </div>
            </div>

            <!-- Standard Food Modifiers: Protein & Special (Show ONLY for Food Kitchen items) -->
            <div v-if="selectedMenu.dept === 'Kitchen'" class="space-y-4">
              <!-- Protein Selection -->
              <div>
                <p class="text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wide">🥩 เลือกเนื้อสัตว์ (Protein)</p>
                <div class="grid grid-cols-3 gap-2">
                  <button 
                    v-for="p in proteins" 
                    :key="p"
                    @click="selectedProtein = p"
                    :class="`py-2 rounded-xl text-sm font-semibold border transition-all ${
                      selectedProtein === p 
                        ? 'border-orange-600 bg-orange-50 text-orange-750 font-bold' 
                        : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                    }`"
                  >
                    {{ p }}
                  </button>
                </div>
              </div>

              <!-- Special Checkbox -->
              <div class="flex gap-2">
                <button 
                  @click="isSpecial = !isSpecial"
                  :class="`flex-1 py-3 px-4 rounded-xl border text-sm font-bold flex items-center justify-between transition-all ${
                    isSpecial 
                      ? 'border-orange-600 bg-orange-50 text-orange-750' 
                      : 'border-zinc-200 bg-white text-zinc-700'
                  }`"
                >
                  <span>⭐ จานพิเศษ (Special)</span>
                  <span class="text-xs px-2.5 py-0.5 bg-orange-600 text-white rounded-full font-bold">+฿10</span>
                </button>
              </div>
            </div>

            <!-- Custom Beverage Option Groups (Show if beverage/dessert has linked options) -->
            <div v-if="activeItemOptions.length > 0" class="space-y-4">
              <div v-for="(opts, group) in groupedActiveOptions" :key="group" class="space-y-2">
                <p class="text-xs font-bold text-zinc-500 uppercase tracking-wide font-sans">
                  {{ groupNameThai(group) }}
                </p>

                <!-- Temperature, Sweetness, Milk options: Single selection (Radio buttons) -->
                <div v-if="['temperature', 'sweetness', 'milk_type', 'discount'].includes(group)" class="grid grid-cols-3 gap-2">
                  <button 
                    v-for="opt in opts" 
                    :key="opt.id"
                    @click="selectedSingleOptionsState[group] = opt.id"
                    :class="`py-2.5 px-2 rounded-xl border text-center flex flex-col justify-center transition-all ${
                      selectedSingleOptionsState[group] === opt.id 
                        ? 'border-orange-600 bg-orange-50 text-orange-750 font-bold' 
                        : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                    }`"
                  >
                    <span class="text-sm font-bold leading-tight">{{ opt.label }}</span>
                    <span v-if="Number(opt.extra_price) > 0" class="text-[10px] text-orange-600 font-extrabold mt-0.5">+฿{{ opt.extra_price }}</span>
                    <span v-else-if="Number(opt.extra_price) < 0" class="text-[10px] text-green-600 font-extrabold mt-0.5">-฿{{ Math.abs(Number(opt.extra_price)) }}</span>
                  </button>
                </div>

                <!-- Addons options: Multi selection (Checkboxes) -->
                <div v-else class="grid grid-cols-2 gap-2">
                  <button 
                    v-for="opt in opts" 
                    :key="opt.id"
                    @click="selectedOptionsState[opt.id] = !selectedOptionsState[opt.id]"
                    :class="`py-2.5 px-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                      selectedOptionsState[opt.id] 
                        ? 'border-orange-600 bg-orange-50 text-orange-750 font-bold' 
                        : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                    }`"
                  >
                    <span class="text-sm">{{ opt.label }}</span>
                    <span class="text-xs text-orange-600 font-extrabold">
                      {{ Number(opt.extra_price) > 0 ? `+฿${opt.extra_price}` : 'ฟรี' }}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Notes & Quick presets -->
            <div class="space-y-2">
              <p class="text-xs font-bold text-zinc-500 uppercase tracking-wide font-sans">📝 หมายเหตุ ( Notes )</p>
              <input 
                v-model="notes"
                type="text" 
                placeholder="ระบุเพิ่มเติม เช่น ขมน้อย, หวานธรรมชาติ..."
                class="w-full bg-white border border-zinc-300 rounded-xl px-4 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-orange-655 focus:ring-1 focus:ring-orange-655"
              />
              <div class="flex flex-wrap gap-1 font-sans">
                <button 
                  v-for="qn in quickNotes" 
                  :key="qn"
                  type="button"
                  @click="addQuickNote(qn)"
                  class="bg-white text-zinc-650 px-2.5 py-1.5 rounded-lg border border-zinc-250 hover:bg-zinc-50 text-xs font-semibold"
                >
                  + {{ qn }}
                </button>
              </div>
            </div>

            <!-- Discount Section (Built-in POS feature, applies to all menus) -->
            <div class="space-y-2 border-t border-zinc-200 pt-4 font-sans">
              <p class="text-xs font-bold text-zinc-500 uppercase tracking-wide flex items-center justify-between">
                <span>💸 ส่วนลดราคา (Discount)</span>
                <span v-if="discountAmount > 0" class="text-green-600 font-black">-฿{{ discountAmount }}</span>
              </p>
              
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="preset in [0, 10, 20]"
                  :key="preset"
                  type="button"
                  @click="selectDiscountPreset(preset)"
                  :class="`py-2.5 rounded-xl border text-center transition-all ${
                    !isCustomDiscount && discountAmount === preset
                      ? 'border-green-600 bg-green-50 text-green-700 font-bold'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                  }`"
                >
                  <span class="text-sm font-bold">{{ preset === 0 ? 'ไม่มี' : `${preset} ฿` }}</span>
                </button>
              </div>

              <!-- Custom discount option -->
              <div class="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  @click="enableCustomDiscount"
                  :class="`py-2.5 px-3 rounded-xl border text-center transition-all flex-shrink-0 text-sm font-bold ${
                    isCustomDiscount
                      ? 'border-green-600 bg-green-50 text-green-700'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                  }`"
                >
                  กำหนดเอง
                </button>
                <div class="relative flex-1">
                  <input
                    v-model.number="customDiscountInput"
                    type="number"
                    min="0"
                    placeholder="ระบุส่วนลดเอง..."
                    :disabled="!isCustomDiscount"
                    @input="handleCustomDiscountInput"
                    class="w-full bg-white border border-zinc-300 rounded-xl px-4 py-2 text-sm text-zinc-900 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed"
                  />
                  <span class="absolute right-3 top-2.5 text-xs text-zinc-505 font-bold font-mono">บาท (฿)</span>
                </div>
              </div>
            </div>

            <!-- Quantity & Add to Bill Box -->
            <div class="pt-4 border-t border-zinc-200 flex items-center justify-between gap-3">
              <!-- Stepper -->
              <div class="flex items-center bg-zinc-50 rounded-xl border border-zinc-200 p-1">
                <button 
                  @click="activeQuantity > 1 && activeQuantity--" 
                  class="w-10 h-10 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-800 font-extrabold text-lg flex items-center justify-center"
                >
                  －
                </button>
                <span class="px-5 text-lg font-black text-zinc-900">{{ activeQuantity }}</span>
                <button 
                  @click="activeQuantity++" 
                  class="w-10 h-10 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-800 font-extrabold text-lg flex items-center justify-center"
                >
                  ＋
                </button>
              </div>
              
              <!-- Add button -->
              <button 
                @click="addActiveToCart"
                :class="`flex-1 text-white font-black py-3.5 px-4 rounded-xl flex items-center justify-between ${
                  editingCartItem
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-orange-600 hover:bg-orange-500'
                }`"
              >
                <span>{{ editingCartItem ? '💾 บันทึกการแก้ไข' : '➕ ใส่บิลนี้' }}</span>
                <span class="text-orange-100 font-extrabold">฿{{ activeItemTotalPrice }}</span>
              </button>
            </div>
            
          </div>
        </div>

        <!-- SECTION 2: Receipt / Cart Billing Panel (Full space when no menu is selected) -->
        <div 
          v-if="!selectedMenu"
          class="flex flex-col overflow-hidden min-h-0 bg-white h-full border-l border-zinc-200"
        >
          
          <!-- Tabs Header -->
          <div class="bg-zinc-50 border-b border-zinc-200 flex flex-shrink-0">
            <button 
              @click="activeTab = 'cart'"
              :class="`flex-1 py-3.5 px-4 text-xs font-black tracking-wider uppercase border-b-2 flex items-center justify-center gap-2 ${
                activeTab === 'cart' 
                  ? 'border-orange-600 text-orange-600 bg-white' 
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'
              }`"
            >
              <span>🛒 ตะกร้าสินค้า</span>
              <span v-if="cart.length > 0" class="px-1.5 py-0.5 text-[10px] bg-orange-600 text-white rounded-full">
                {{ cartTotalItems }}
              </span>
            </button>
            <button 
              @click="activeTab = 'active_orders'"
              :class="`flex-1 py-3.5 px-4 text-xs font-black tracking-wider uppercase border-b-2 flex items-center justify-center gap-2 ${
                activeTab === 'active_orders' 
                  ? 'border-orange-600 text-orange-600 bg-white' 
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'
              }`"
            >
              <span>⏳ ออเดอร์ค้าง ({{ activeOrders.length }})</span>
            </button>
          </div>

          <!-- Tab Content: Cart -->
          <div v-if="activeTab === 'cart'" class="flex-1 flex flex-col min-h-0 overflow-hidden">
            <!-- Editing Banner -->
            <div v-if="editingOrderId" class="bg-amber-50 border-b border-amber-200 text-amber-800 px-4 py-2 text-xs flex items-center justify-between font-sans flex-shrink-0">
              <span>⚠️ กำลังแก้ไขออเดอร์ <b>#{{ editingOrderId }}</b></span>
              <button 
                @click="cancelEdit" 
                class="bg-amber-600 hover:bg-amber-700 px-2.5 py-1 rounded text-white font-bold text-[10px]"
              >
                ยกเลิกแก้ไข
              </button>
            </div>

            <!-- Empty Cart state -->
            <div v-if="cart.length === 0" class="flex-1 flex flex-col items-center justify-center text-center p-6 bg-zinc-50">
              <p v-if="orderSuccess" class="text-green-600 font-black mb-1">🎉 บันทึกออร์เดอร์ #{{ submittedOrderId }} สำเร็จ!</p>
              <p v-if="orderSuccess" class="text-xs text-zinc-505">บิลส่งตรงไปครัวเรียบร้อย</p>
              <div v-else>
                <span class="text-3xl block mb-2 opacity-50">🛒</span>
                <p class="text-zinc-400 text-sm font-medium">ยังไม่มีรายการชงหรือทำอาหารในบิลนี้</p>
              </div>
            </div>

            <!-- Cart Items List (Scrollable, Grouped by Category) -->
            <div v-else class="flex-1 overflow-y-auto p-3 space-y-4 min-h-0">
              <div v-for="group in groupedCart" :key="group.category.id || 'unknown'" class="space-y-1.5">
                <!-- Category Header Tag -->
                <div class="text-[11px] uppercase tracking-wider font-extrabold text-orange-700 px-2 py-1 bg-orange-50 rounded flex items-center gap-1 font-sans">
                  <span>{{ group.category.icon }}</span>
                  <span>{{ group.category.name === 'Food' ? 'อาหาร' : group.category.name === 'Beverage' ? 'เครื่องดื่ม' : group.category.name === 'Dessert' ? 'ของหวาน' : group.category.name }}</span>
                </div>
                
                <!-- Items in Category -->
                <div 
                  v-for="item in group.items" 
                  :key="item.menuId + '-' + JSON.stringify(item.selectedOptions) + '-' + item.notes + '-' + (item.discount || 0)"
                  class="bg-white p-3.5 rounded-xl border border-zinc-200 flex items-center justify-between gap-3 text-sm animate-fade-in hover:border-zinc-350 hover:bg-zinc-50 cursor-pointer active:scale-[0.99]"
                  @click="editCartItemConfig(item)"
                >
                  <div class="flex-1 min-w-0">
                    <div class="flex items-baseline gap-1.5">
                      <span class="font-black text-zinc-900 text-sm">{{ item.menuName }}</span>
                      <span class="text-xs text-zinc-505">x{{ item.quantity }}</span>
                    </div>
                    
                    <!-- Print config detail options -->
                    <div class="flex flex-wrap gap-1.5 mt-1 text-[11px] font-sans">
                      <span v-if="item.proteinType && item.proteinType !== ''" class="bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded font-semibold text-[10px]">
                        {{ item.proteinType }}{{ item.isSpecial ? ' (พิเศษ)' : '' }}
                      </span>
                      <span v-for="opt in item.selectedOptions" :key="opt.optionId" class="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200 text-[10px]">
                        + {{ opt.label }}
                      </span>
                      <span v-if="item.discount > 0" class="bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-200 font-extrabold text-[10px]">
                        💸 ส่วนลด -฿{{ item.discount }}
                      </span>
                      <span v-if="item.notes" class="text-zinc-505 font-medium italic block w-full mt-0.5">
                        📝 {{ item.notes }}
                      </span>
                    </div>
                  </div>

                  <!-- Price & Remove button -->
                  <div class="flex items-center gap-3">
                    <span class="font-black text-zinc-900">฿{{ item.totalPrice * item.quantity }}</span>
                    <button 
                      @click.stop="removeFromCart(item)"
                      class="text-red-650 hover:bg-red-50 p-1.5 rounded-lg active:scale-90"
                      title="ลบ"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Checkout / Action Footer block -->
            <div v-if="cart.length > 0" class="p-4 bg-zinc-50 border-t border-zinc-200 space-y-3 flex-shrink-0">
              <!-- Summary Row -->
              <div class="flex items-center justify-between">
                <input 
                  v-model="tableNumber"
                  type="text" 
                  placeholder="ระบุเบอร์โต๊ะ (ถ้ามี)..."
                  class="bg-white border border-zinc-300 rounded-xl px-3 py-2 text-zinc-900 w-32 focus:outline-none focus:border-orange-655 focus:ring-1 focus:ring-orange-655 text-xs font-sans font-medium"
                />
                <div class="text-right">
                  <span class="text-zinc-500 block text-[10px] font-sans font-bold">ราคารวมทั้งบิล</span>
                  <span class="text-2xl font-black text-green-600">฿{{ cartTotalPrice }}</span>
                </div>
              </div>

              <!-- Confirm Buttons -->
              <div class="flex gap-2">
                <button 
                  @click="clearCart"
                  class="bg-white hover:bg-zinc-100 text-zinc-700 font-bold py-3.5 px-4 rounded-xl border border-zinc-250 active:scale-95 text-sm font-sans"
                >
                  ล้างบิล
                </button>
                
                <button 
                  @click="submitOrder"
                  :disabled="isSubmitting"
                  :class="`flex-1 disabled:opacity-50 text-white font-black py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 text-base font-sans ${
                    editingOrderId 
                      ? 'bg-amber-600 hover:bg-amber-700' 
                      : 'bg-green-600 hover:bg-green-700'
                  }`"
                >
                  <span v-if="isSubmitting" class="animate-spin text-sm">⏳</span>
                  <span>{{ editingOrderId ? '💾 บันทึกการแก้ไข' : '✅ ยืนยันออร์เดอร์ (ชำระเงิน)' }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Tab Content: Active Orders -->
          <div v-else-if="activeTab === 'active_orders'" class="flex-1 flex flex-col min-h-0 overflow-hidden">
            <!-- Empty Active Orders state -->
            <div v-if="activeOrders.length === 0" class="flex-1 flex flex-col items-center justify-center text-center p-6 bg-zinc-50">
              <span class="text-3xl block mb-2 opacity-50">📋</span>
              <p class="text-zinc-400 text-sm font-medium">ไม่มีออเดอร์ค้างเตรียมในระบบ</p>
            </div>

            <!-- Active Orders List -->
            <div v-else class="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
              <div 
                v-for="order in activeOrders" 
                :key="order.id"
                :class="`bg-white p-3.5 rounded-2xl border ${
                  editingOrderId === order.id 
                    ? 'border-amber-500 bg-amber-50' 
                    : 'border-zinc-200'
                }`"
              >
                <div class="flex items-center justify-between mb-2 relative meatball-container">
                  <span class="font-extrabold text-zinc-900 flex items-center gap-1.5">
                    <span>#{{ order.id }}</span>
                    <span class="text-xs text-zinc-505 font-normal">({{ order.location || 'POS หน้าร้าน' }})</span>
                  </span>
                  
                  <!-- Meatball Menu (Dropdown) -->
                  <div class="relative">
                    <button 
                      @click.stop="toggleOrderDropdown(order.id)"
                      class="p-1 hover:bg-zinc-100 rounded-lg text-zinc-500 hover:text-zinc-700 transition-colors active:scale-95"
                      title="เมนูเพิ่มเติม"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                    
                    <div 
                      v-if="openDropdownOrderId === order.id" 
                      class="absolute right-0 mt-1 w-36 bg-white border border-zinc-200 rounded-xl shadow-lg z-50 py-1"
                    >
                      <button 
                        @click.stop="handleEditFromDropdown(order)"
                        class="w-full text-left px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5"
                      >
                        ✏️ แก้ไข/เพิ่ม
                      </button>
                      <button 
                        @click.stop="handleCancelFromDropdown(order.id)"
                        class="w-full text-left px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-1.5 border-t border-zinc-100"
                      >
                        ❌ ยกเลิกออเดอร์
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Order Items list -->
                <div class="text-xs text-zinc-700 space-y-1.5 pl-1 py-2 border-t border-b border-zinc-200 my-2 font-sans">
                  <div v-for="item in order.items" :key="item.id" class="leading-relaxed">
                    <span class="font-bold text-zinc-900">{{ item.menu_name }}</span>
                    <span class="text-zinc-505 font-bold ml-1">x{{ item.quantity }}</span>
                    <div class="pl-2 text-[10px] text-zinc-505 font-sans flex flex-wrap gap-1 mt-0.5">
                      <span v-if="item.protein_type && item.menu_dept === 'Kitchen'" class="bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded text-[9px] font-semibold">
                        {{ item.protein_type }}{{ item.is_special ? ' (พิเศษ)' : '' }}{{ item.is_takeaway ? ' (กล่อง)' : '' }}
                      </span>
                      <span v-for="opt in item.options" :key="opt.option_id" class="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded text-[9px] font-semibold border border-orange-200">
                        + {{ opt.label }}
                      </span>
                      <span v-if="item.notes" class="text-zinc-505 italic block w-full">
                        📝 {{ item.notes }}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="flex items-center justify-between mb-3 text-xs font-sans">
                  <span class="text-zinc-505 font-medium">ราคารวม: <span class="font-black text-green-600 text-sm">฿{{ order.total_price }}</span></span>
                  <span class="font-mono text-zinc-400">{{ formatOrderTime(order.created_at) }}</span>
                </div>

                <!-- Actions buttons (Archive and Receipt) -->
                <div class="grid grid-cols-2 gap-1.5">
                  <button 
                    @click="archiveOrder(order.id)"
                    class="bg-green-600 hover:bg-green-700 text-white text-xs font-extrabold py-2 px-1 rounded-xl active:scale-95 text-center flex items-center justify-center gap-1"
                    title="เก็บประวัติออเดอร์นี้"
                  >
                    📥 เก็บ (Archive)
                  </button>
                  <button 
                    @click="printActiveOrderReceipt(order)"
                    class="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-250 text-xs font-extrabold py-2 px-1 rounded-xl active:scale-95 text-center flex items-center justify-center gap-1"
                    title="พิมพ์ใบเสร็จออเดอร์นี้"
                  >
                    🖨️ ใบเสร็จ
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

      </aside>

    </div>

    <!-- RECEIPT PREVIEW MODAL -->
    <Transition name="fade">
      <div v-if="showReceiptModal && receiptData" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-zinc-900/60" @click="showReceiptModal = false"></div>
        
        <!-- Modal Content -->
        <div class="relative bg-white border border-zinc-200 rounded-3xl p-6 max-w-sm w-full z-10 flex flex-col max-h-[90vh] animate-fade-in">
          <div class="text-center border-b border-zinc-200 pb-3 mb-4">
            <span class="text-3xl">🧾</span>
            <h3 class="text-lg font-black text-zinc-900 mt-1">ตัวอย่างใบเสร็จ</h3>
            <p class="text-xs text-zinc-505 font-medium">ออร์เดอร์ #{{ receiptData.orderId }} บันทึกสำเร็จ</p>
          </div>
          
          <!-- Receipt Paper Slip Preview (White Paper style for visual realism) -->
          <div class="flex-1 overflow-y-auto bg-white text-zinc-900 p-4 rounded-xl font-mono text-xs select-none border border-zinc-300">
            <div class="text-center font-bold text-sm mb-1">🍜☕ POS Counter</div>
            <div class="text-center text-[10px] text-slate-500 mb-2">ใบสั่งสินค้า / ใบเสร็จรับเงิน</div>
            
            <div class="space-y-1 mb-3">
              <div>ออร์เดอร์: #{{ receiptData.orderId }}</div>
              <div>วันที่: {{ receiptData.date }}</div>
              <div>จุดบริการ: {{ receiptData.location }}</div>
            </div>
            
            <div class="border-t border-dashed border-slate-400 my-2"></div>
            
            <div class="space-y-3">
              <div v-for="group in groupedReceiptData" :key="group.category.id || 'unknown'">
                <!-- Category Heading inside thermal preview -->
                <div class="text-[10px] font-black text-zinc-500 border-b border-dashed border-zinc-300 pb-0.5 mb-1.5">
                  {{ group.category.icon }} {{ group.category.name === 'Food' ? 'อาหาร' : group.category.name === 'Beverage' ? 'เครื่องดื่ม' : group.category.name === 'Dessert' ? 'ของหวาน' : group.category.name }}
                </div>
                
                <!-- Items in category -->
                <div v-for="(item, idx) in group.items" :key="idx" class="mb-2">
                  <div class="flex justify-between font-bold">
                    <span class="w-[60%] truncate">{{ item.menuName }}</span>
                    <span class="w-[15%] text-center">x{{ item.quantity }}</span>
                    <span class="w-[25%] text-right">฿{{ item.totalPrice * item.quantity }}</span>
                  </div>
                  <div class="pl-2 text-[10px] text-zinc-650 font-mono">
                    <span v-if="item.proteinType && item.proteinType !== ''">{{ item.proteinType }}{{ item.isSpecial ? ' (พิเศษ)' : '' }}</span>
                    <div v-for="opt in item.selectedOptions" :key="opt.optionId">
                      + {{ opt.label }}
                    </div>
                    <div v-if="item.discount > 0" class="text-green-600 font-bold">
                      💸 ส่วนลด -฿{{ item.discount }}
                    </div>
                    <div v-if="item.notes" class="italic font-sans">📝 {{ item.notes }}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="border-t border-dashed border-slate-400 my-2"></div>
            
            <div class="flex justify-between font-black text-sm text-slate-900">
              <span>ราคารวมทั้งสิ้น:</span>
              <span>฿{{ receiptData.totalPrice }}</span>
            </div>
            
            <div class="text-center text-[10px] text-slate-500 mt-4">
              🙏 ขอบคุณที่ใช้บริการค่ะ / Thank you 🙏
            </div>
          </div>
          
          <!-- Action Buttons -->
          <div class="grid grid-cols-2 gap-3 mt-5 pt-3 border-t border-zinc-200 flex-shrink-0">
            <button 
              @click="showReceiptModal = false"
              class="py-3 bg-white hover:bg-zinc-100 text-zinc-700 font-bold rounded-xl text-sm border border-zinc-200 active:scale-95 transition-all"
            >
              ✕ ปิดหน้าต่าง
            </button>
            <button 
              @click="printReceipt"
              class="py-3 bg-green-600 hover:bg-green-700 text-white font-extrabold rounded-xl text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <span>🖨️ พิมพ์ใบเสร็จ</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- PRINT-ONLY RECEIPT ELEMENT (HIDDEN ON SCREEN, VISIBLE ON PRINT) -->
    <div id="receipt-print-area" class="text-black bg-white p-4 font-mono text-sm leading-normal">
      <div v-if="receiptData" class="space-y-2">
        <div class="text-center font-bold text-lg">🍜☕ POS Counter</div>
        <div class="text-center text-xs">ใบเสร็จรับเงิน / ใบสั่งเตรียมของ</div>
        <div class="h-2"></div>
        
        <div>เลขที่ออร์เดอร์: #{{ receiptData.orderId }}</div>
        <div>วันที่: {{ receiptData.date }}</div>
        <div>จุดจัดส่ง: {{ receiptData.location }}</div>
        
        <div class="border-t border-dashed border-black my-2"></div>
        
        <div class="flex justify-between font-bold text-xs">
          <span class="w-[60%]">รายการ</span>
          <span class="w-[15%] text-center">จำนวน</span>
          <span class="w-[25%] text-right">ราคา</span>
        </div>
        <div class="border-t border-black my-1"></div>
        
        <div v-for="group in groupedReceiptData" :key="group.category.id || 'unknown'" class="text-xs">
          <!-- Category Header -->
          <div class="font-bold border-b border-black pb-0.5 mt-2 mb-1">
            {{ group.category.icon }} {{ group.category.name === 'Food' ? 'อาหาร' : group.category.name === 'Beverage' ? 'เครื่องดื่ม' : group.category.name === 'Dessert' ? 'ของหวาน' : group.category.name }}
          </div>
          <div v-for="(item, idx) in group.items" :key="idx" class="mb-1">
            <div class="flex justify-between">
              <span class="w-[60%] font-bold">{{ item.menuName }}</span>
              <span class="w-[15%] text-center">x{{ item.quantity }}</span>
              <span class="w-[25%] text-right">฿{{ item.totalPrice * item.quantity }}</span>
            </div>
            <div class="pl-2 text-[10px] text-gray-800">
              <span v-if="item.proteinType && item.proteinType !== ''">{{ item.proteinType }}{{ item.isSpecial ? ' (พิเศษ)' : '' }}</span>
              <div v-for="opt in item.selectedOptions" :key="opt.optionId">
                + {{ opt.label }}
              </div>
              <div v-if="item.discount > 0" class="font-bold">
                💸 ส่วนลด -฿{{ item.discount }}
              </div>
              <div v-if="item.notes" class="italic">📝 {{ item.notes }}</div>
            </div>
          </div>
        </div>
        
        <div class="border-t border-dashed border-black my-2"></div>
        
        <div class="flex justify-between font-bold text-sm">
          <span>ราคารวมทั้งสิ้น (Total):</span>
          <span>฿{{ receiptData.totalPrice }}</span>
        </div>
        
        <div class="h-6"></div>
        <div class="text-center text-xs font-bold">🙏 ขอบคุณที่ใช้บริการค่ะ 🙏</div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Scrollbar optimizations for Cashier touchscreen POS */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: #f4f4f5;
}
::-webkit-scrollbar-thumb {
  background: #d4d4d8;
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background: #a1a1aa;
}

/* Print Media stylesheet */
@media print {
  /* Hide the entire Nuxt app structure */
  #__nuxt, #nuxt-app, header, main, aside, div, button {
    display: none !important;
  }
  
  /* Show only the print-only receipt element */
  #receipt-print-area {
    display: block !important;
    width: 100% !important;
    max-width: 80mm !important; /* Standard thermal printer width */
    margin: 0 auto !important;
    padding: 10px !important;
    color: #000 !important;
    background: #fff !important;
    font-family: 'Courier New', Courier, monospace !important;
    box-sizing: border-box;
  }
}

#receipt-print-area {
  display: none;
}

/* Animations for modal transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.animate-fade-in {
  animation: fadeIn 0.2s ease-out forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Force full screen overlay in portrait mode to completely cover other elements */
@media (orientation: portrait) {
  .modifier-panel {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-height: 100vh !important;
    z-index: 9999 !important;
    background-color: #ffffff !important; /* bg-white */
    border: none !important;
  }
}
</style>
