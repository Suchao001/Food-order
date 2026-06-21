<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const id = route.params.id

definePageMeta({
  layout: 'admin'
})

const { data: categoryResult } = await useFetch<{ success: boolean, data: { id: number, name: string, icon: string }[] }>('/api/categories')
const categories = computed(() => categoryResult.value?.data || [])

const form = reactive({
  name: '',
  base_price: '',
  image_url: '',
  category_id: '' as string | number,
  sub_category_id: '' as string | number,
  dept: 'Kitchen' as 'Kitchen' | 'Barista' | 'Bakery'
})

const loading = ref(false)
const uploading = ref(false)
const message = ref({ type: '', text: '' })
const fileInput = ref<HTMLInputElement | null>(null)

// Fetch sub-categories
const { data: subCategoryResult } = await useFetch<{ success: boolean, data: { id: number, category_id: number, name: string }[] }>('/api/sub-categories')
const allSubCategories = computed(() => subCategoryResult.value?.data || [])

// Filtered sub-categories based on selected category_id
const filteredSubCategories = computed(() => {
  if (!form.category_id) return []
  return allSubCategories.value.filter(sc => sc.category_id === Number(form.category_id))
})

// Reset sub_category_id when category_id changes (only after initial load)
let isInitialLoad = true
watch(() => form.category_id, () => {
  if (!isInitialLoad) {
    form.sub_category_id = ''
  }
})

// Fetch existing data
const { data: menuData, error: fetchError } = await useFetch<any>(`/api/menus/${id}`)

if (menuData.value?.data) {
  const data = menuData.value.data
  form.name = data.name
  form.base_price = data.base_price
  form.image_url = data.image_url
  form.category_id = data.category_id || ''
  form.sub_category_id = data.sub_category_id || ''
  form.dept = data.dept || 'Kitchen'
  // Delay disabling initial load flag to let watches settle
  nextTick(() => {
    isInitialLoad = false
  })
} else if (fetchError.value) {
    message.value = { type: 'error', text: 'Failed to load menu data' }
}

// Fetch all available options and currently active ones for this menu item
const { data: allOptionsResult } = await useFetch<{ success: boolean, data: any[] }>('/api/options')
const allOptions = computed(() => allOptionsResult.value?.data || [])

const { data: activeOptionsResult } = await useFetch<{ success: boolean, data: any[] }>(`/api/menus/${id}/options`)
const activeOptionIds = ref<number[]>([])

if (activeOptionsResult.value?.data) {
  activeOptionIds.value = activeOptionsResult.value.data.map((o: any) => o.id)
}

const groupedAllOptions = computed(() => {
  const groups: Record<string, any[]> = {}
  allOptions.value.forEach(opt => {
    const g = opt.option_group || 'addons'
    if (!groups[g]) groups[g] = []
    groups[g].push(opt)
  })
  return groups
})

const groupNameThai = (group: string) => {
  switch (group) {
    case 'temperature': return '🧊 อุณหภูมิ (Temperature)'
    case 'sweetness': return '🍬 ระดับความหวาน (Sweetness)'
    case 'milk_type': return '🥛 ประเภทนม (Milk Option)'
    case 'spiciness': return '🌶️ ระดับความเผ็ด (Spiciness)'
    case 'meat_type': return '🥩 เลือกเนื้อสัตว์ (Meat / Protein Type)'
    case 'addons': return '➕ เพิ่มเติม (Add-ons / Toppings)'
    default: return '⚙️ อื่นๆ (Others)'
  }
}

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files?.length) return

  const file = target.files[0]
  uploading.value = true
  message.value = { type: '', text: '' }

  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await $fetch<{ url: string }>('/api/upload', {
      method: 'POST',
      body: formData
    })

    form.image_url = response.url
    message.value = { type: 'success', text: 'Image uploaded successfully!' }
  } catch (error: any) {
    console.error(error)
    message.value = { type: 'error', text: error.data?.statusMessage || 'Failed to upload image' }
    if (fileInput.value) fileInput.value.value = ''
  } finally {
    uploading.value = false
  }
}

async function handleSubmit() {
  if (!form.image_url) {
    message.value = { type: 'error', text: 'Please upload an image first' }
    return
  }

  loading.value = true
  message.value = { type: '', text: '' }

  try {
    await $fetch(`/api/menus/${id}`, {
      method: 'PUT',
      body: {
        name: form.name,
        base_price: Number(form.base_price),
        image_url: form.image_url,
        category_id: form.category_id ? Number(form.category_id) : null,
        sub_category_id: form.sub_category_id ? Number(form.sub_category_id) : null,
        dept: form.dept,
        optionIds: activeOptionIds.value
      }
    })

    message.value = { type: 'success', text: 'Menu updated successfully!' }
    // Redirect back to list after short delay? Or just show success.
  } catch (error: any) {
    message.value = { type: 'error', text: error.data?.statusMessage || 'Failed to update menu' }
  } finally {
    loading.value = false
  }
}

async function handleDelete() {
  if (!confirm('Are you sure you want to delete this dish details? This action cannot be undone.')) return;

  loading.value = true;
  try {
      await $fetch(`/api/menus/${id}`, {
          method: 'DELETE'
      });
      router.push('/admin/items');
  } catch (error: any) {
      message.value = { type: 'error', text: error.data?.statusMessage || 'Failed to delete menu' };
      loading.value = false;
  }
}
</script>

<template>
  <div class="max-w-md mx-auto bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-800">Edit Dish</h1>
        <NuxtLink to="/admin/items" class="text-gray-500 hover:text-gray-700 text-sm">
            &larr; Back
        </NuxtLink>
    </div>

    <div v-if="message.text" :class="`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`">
      {{ message.text }}
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-5">
      <!-- Dish Name -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Menu Name (ชื่อเมนู)</label>
        <input 
          v-model="form.name"
          type="text" 
          placeholder="เช่น ข้าวผัดกะเพรา, ลาเต้เย็น, ช็อกโกแลตเค้ก"
          required
          class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
        >
      </div>

      <!-- Category Select -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่สินค้า</label>
        <select 
          v-model="form.category_id"
          required
          class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
        >
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">
            {{ cat.icon }} {{ cat.name === 'Food' ? 'อาหาร (Food)' : cat.name === 'Beverage' ? 'เครื่องดื่ม (Beverage)' : cat.name === 'Dessert' ? 'ของหวาน (Dessert)' : cat.name }}
          </option>
        </select>
      </div>

      <!-- Sub-Category Select -->
      <div v-if="filteredSubCategories.length > 0">
        <label class="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่ย่อย (Sub-Category)</label>
        <select 
          v-model="form.sub_category_id"
          class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
        >
          <option value="">ไม่มีหมวดหมู่ย่อย</option>
          <option v-for="sub in filteredSubCategories" :key="sub.id" :value="sub.id">
            {{ sub.name }}
          </option>
        </select>
      </div>

      <!-- Department Select (Preparation Area) -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">แผนกที่ผลิต (สถานที่เตรียมสินค้า)</label>
        <div class="grid grid-cols-3 gap-3">
          <label 
            v-for="d in ['Kitchen', 'Barista', 'Bakery']" 
            :key="d"
            :class="`flex items-center justify-center py-3 px-4 rounded-lg border text-sm font-medium cursor-pointer transition-all ${
              form.dept === d 
                ? 'border-emerald-600 bg-emerald-50 text-emerald-700 font-semibold' 
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`"
          >
            <input 
              type="radio" 
              :value="d" 
              v-model="form.dept" 
              class="sr-only"
            >
            <span>
              {{ d === 'Kitchen' ? '🍳 ห้องครัว' : d === 'Barista' ? '☕ บาร์น้ำ' : '🍰 ตู้ขนม' }}
            </span>
          </label>
        </div>
      </div>

      <!-- Base Price -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Price (ราคาเริ่มต้น)</label>
        <div class="relative">
          <span class="absolute left-4 top-3 text-gray-500">฿</span>
          <input 
            v-model="form.base_price"
            type="number" 
            placeholder="0"
            step="1"
            required
            class="w-full pl-8 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
          >
        </div>
      </div>

      <!-- Image Upload -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Dish Image</label>
        <div class="flex items-center justify-center w-full">
          <label 
            v-if="!form.image_url"
            class="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
            @dragover.prevent
            @drop.prevent
          >
            <div class="flex flex-col items-center justify-center pt-5 pb-6">
              <div v-if="uploading">
                 <svg class="animate-spin h-8 w-8 text-emerald-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="text-sm text-gray-500">Uploading...</p>
              </div>
              <div v-else class="text-center">
                <p class="mb-2 text-sm text-gray-500"><span class="font-semibold">Click to upload</span> or drag and drop</p>
              </div>
            </div>
            <input 
              ref="fileInput"
              type="file" 
              class="hidden" 
              accept="image/*"
              @change="handleFileUpload"
            />
          </label>

          <div v-else class="relative w-full h-48 rounded-lg overflow-hidden border border-gray-200 group">
             <img :src="form.image_url" alt="Preview" class="w-full h-full object-cover">
             <div class="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button 
                  type="button" 
                  @click="form.image_url = ''; if(fileInput) fileInput.value = ''"
                  class="bg-white text-red-600 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
                >
                  Change Image
                </button>
             </div>
          </div>
        </div>
      </div>

      <!-- Enabled Options Grouped Checkbox List -->
      <div class="border-t border-gray-150 pt-5 space-y-4">
        <h3 class="text-lg font-bold text-gray-800 flex items-center gap-1.5 font-sans">
          <span>⚙️ ตั้งค่าตัวเลือกเสริม (Menu Options)</span>
        </h3>
        <p class="text-xs text-gray-500 font-sans">ติ๊กเลือกตัวเลือกเสริมที่ต้องการเปิดใช้งานสำหรับเมนูนี้</p>
        
        <div v-if="allOptions.length === 0" class="text-sm text-gray-400 italic font-sans">
          ยังไม่มี Option ในระบบ ไปสร้าง Option ก่อนได้ที่เมนูแผงควบคุมหลังบ้าน
        </div>
        
        <div v-else class="space-y-4">
          <div v-for="(opts, group) in groupedAllOptions" :key="group" class="bg-gray-50 p-4 rounded-xl space-y-2.5">
            <h4 class="text-xs font-black text-gray-500 uppercase tracking-wider font-sans">{{ groupNameThai(group) }}</h4>
            
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <label 
                v-for="opt in opts" 
                :key="opt.id"
                class="flex items-center gap-2 bg-white px-3 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-150/50 cursor-pointer text-sm transition-all"
              >
                <input 
                  type="checkbox" 
                  :value="opt.id" 
                  v-model="activeOptionIds"
                  class="rounded text-emerald-600 focus:ring-emerald-500 w-4.5 h-4.5 border-gray-300"
                >
                <span class="text-gray-700 font-medium font-sans">{{ opt.label }}</span>
                <span v-if="Number(opt.extra_price) > 0" class="text-xs text-emerald-600 font-bold ml-auto font-sans">+฿{{ opt.extra_price }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Submit Button -->
      <button 
        type="submit" 
        :disabled="loading || uploading || !form.image_url"
        class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-lg shadow-lg hover:shadow-xl transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        <span v-if="loading" class="flex items-center justify-center gap-2">
          Saving...
        </span>
        <span v-else>Update Dish</span>
      </button>

      <div class="pt-4 border-t border-gray-100">
         <button 
            type="button" 
            @click="handleDelete"
            class="w-full text-red-600 font-medium py-3 rounded-lg hover:bg-red-50 transition-colors"
        >
            Delete Dish
        </button>
      </div>
    </form>
  </div>
</template>
