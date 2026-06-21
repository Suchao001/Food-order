<script setup lang="ts">
definePageMeta({
  layout: 'admin'
})

interface Category {
  id?: number
  name: string
  icon: string
  display_order: number
}

// Fetch categories
const { data: result, error, refresh } = await useFetch<{ success: boolean; data: Category[] }>('/api/categories')
const categories = computed(() => result.value?.data || [])

// Form state
const isEditing = ref(false)
const editingId = ref<number | null>(null)
const form = ref<Category>({
  name: '',
  icon: '📁',
  display_order: 1
})

// UI state
const statusMsg = ref({ type: '', text: '' })
const isSubmitting = ref(false)

// Select a category to edit
const selectEdit = (cat: Category) => {
  isEditing.value = true
  editingId.value = cat.id || null
  form.value = {
    name: cat.name,
    icon: cat.icon,
    display_order: cat.display_order
  }
  statusMsg.value = { type: '', text: '' }
}

// Reset form
const resetForm = () => {
  isEditing.value = false
  editingId.value = null
  form.value = {
    name: '',
    icon: '📁',
    display_order: categories.value.length > 0 
      ? Math.max(...categories.value.map(c => c.display_order)) + 1 
      : 1
  }
  statusMsg.value = { type: '', text: '' }
}

// Submit Create/Update
const handleSubmit = async () => {
  if (!form.value.name.trim() || !form.value.icon.trim()) {
    statusMsg.value = { type: 'error', text: 'กรุณากรอกชื่อและไอคอนให้ครบถ้วน' }
    return
  }

  isSubmitting.value = true
  statusMsg.value = { type: '', text: '' }

  try {
    if (isEditing.value && editingId.value) {
      // Update
      const res = await $fetch(`/api/categories/${editingId.value}`, {
        method: 'PUT',
        body: form.value
      })
      statusMsg.value = { type: 'success', text: 'แก้ไขหมวดหมู่สำเร็จ!' }
    } else {
      // Create
      const res = await $fetch('/api/categories', {
        method: 'POST',
        body: form.value
      })
      statusMsg.value = { type: 'success', text: 'สร้างหมวดหมู่สำเร็จ!' }
    }
    
    await refresh()
    resetForm()
  } catch (err: any) {
    console.error(err)
    statusMsg.value = { 
      type: 'error', 
      text: err.data?.statusMessage || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' 
    }
  } finally {
    isSubmitting.value = false
  }
}

// Delete Category
const handleDelete = async (id: number, name: string) => {
  if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบหมวดหมู่ "${name}"? เมนูที่อยู่ในหมวดหมู่นี้จะถูกเปลี่ยนเป็นไม่มีหมวดหมู่`)) {
    return
  }

  try {
    await $fetch(`/api/categories/${id}`, {
      method: 'DELETE'
    })
    statusMsg.value = { type: 'success', text: 'ลบหมวดหมู่สำเร็จ!' }
    await refresh()
    resetForm()
  } catch (err: any) {
    console.error(err)
    statusMsg.value = { 
      type: 'error', 
      text: err.data?.statusMessage || 'ไม่สามารถลบหมวดหมู่ได้' 
    }
  }
}

// Re-order display using arrow buttons
const moveOrder = async (index: number, direction: 'up' | 'down') => {
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= categories.value.length) return

  const currentCat = categories.value[index]
  const swapCat = categories.value[targetIndex]

  // Swap display_order values
  const currentOrder = currentCat.display_order
  const swapOrder = swapCat.display_order

  try {
    // Perform updates sequentially
    await $fetch(`/api/categories/${currentCat.id}`, {
      method: 'PUT',
      body: { ...currentCat, display_order: swapOrder }
    })
    await $fetch(`/api/categories/${swapCat.id}`, {
      method: 'PUT',
      body: { ...swapCat, display_order: currentOrder }
    })

    await refresh()
    statusMsg.value = { type: 'success', text: 'ปรับเปลี่ยนลำดับสำเร็จ!' }
  } catch (err) {
    console.error(err)
    statusMsg.value = { type: 'error', text: 'ไม่สามารถปรับเปลี่ยนลำดับได้' }
  }
}

// ==========================================
// SUB-CATEGORIES CRUD LOGIC
// NOTE: ในอนาคตอาจต้องพิจารณาแยกหมวดหมู่ย่อยตามสถานะร้อน/เย็นเพิ่มเติมด้วย (เช่น กาแฟร้อน vs กาแฟเย็น)
// เนื่องจากเครื่องดื่มบางรายการมีพฤติกรรมแยกตามประเภทอุณหภูมิโดยเฉพาะ
// ==========================================
const { data: subResult, refresh: refreshSub } = await useFetch<{ success: boolean; data: any[] }>('/api/sub-categories')
const subCategories = computed(() => subResult.value?.data || [])

const expandedCategoryIds = ref<number[]>([])
const toggleExpandCategory = (catId: number) => {
  const idx = expandedCategoryIds.value.indexOf(catId)
  if (idx > -1) {
    expandedCategoryIds.value.splice(idx, 1)
  } else {
    expandedCategoryIds.value.push(catId)
    // Automatically reset sub form for this category when expanding
    resetSubForm(catId)
  }
}

const activeSubCategoryCategoryId = ref<number | null>(null)
const isEditingSub = ref(false)
const editingSubId = ref<number | null>(null)
const subForm = ref({
  name: '',
  display_order: 1
})

const selectEditSub = (sub: any) => {
  activeSubCategoryCategoryId.value = sub.category_id
  isEditingSub.value = true
  editingSubId.value = sub.id
  subForm.value = {
    name: sub.name,
    display_order: sub.display_order
  }
}

const resetSubForm = (categoryId: number) => {
  activeSubCategoryCategoryId.value = categoryId
  isEditingSub.value = false
  editingSubId.value = null
  const existingSubs = subCategories.value.filter(s => s.category_id === categoryId)
  subForm.value = {
    name: '',
    display_order: existingSubs.length > 0 
      ? Math.max(...existingSubs.map(s => s.display_order)) + 1 
      : 1
  }
}

const handleSubmitSub = async (categoryId: number) => {
  if (!subForm.value.name.trim()) return

  isSubmitting.value = true
  statusMsg.value = { type: '', text: '' }

  try {
    if (isEditingSub.value && editingSubId.value) {
      await $fetch(`/api/sub-categories/${editingSubId.value}`, {
        method: 'PUT',
        body: {
          name: subForm.value.name,
          display_order: subForm.value.display_order
        }
      })
      statusMsg.value = { type: 'success', text: 'แก้ไขหมวดหมู่ย่อยสำเร็จ!' }
    } else {
      await $fetch('/api/sub-categories', {
        method: 'POST',
        body: {
          category_id: categoryId,
          name: subForm.value.name,
          display_order: subForm.value.display_order
        }
      })
      statusMsg.value = { type: 'success', text: 'เพิ่มหมวดหมู่ย่อยสำเร็จ!' }
    }
    await refreshSub()
    resetSubForm(categoryId)
  } catch (err: any) {
    console.error(err)
    statusMsg.value = { type: 'error', text: err.data?.statusMessage || 'เกิดข้อผิดพลาดในการดำเนินการ' }
  } finally {
    isSubmitting.value = false
  }
}

const handleDeleteSub = async (subId: number, name: string) => {
  if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบหมวดหมู่ย่อย "${name}"? เมนูที่อยู่ในหมวดหมู่ย่อยนี้จะถูกเปลี่ยนเป็นไม่มีหมวดหมู่ย่อย`)) {
    return
  }
  try {
    await $fetch(`/api/sub-categories/${subId}`, { method: 'DELETE' })
    statusMsg.value = { type: 'success', text: 'ลบหมวดหมู่ย่อยสำเร็จ!' }
    await refreshSub()
  } catch (err: any) {
    console.error(err)
    statusMsg.value = { type: 'error', text: err.data?.statusMessage || 'เกิดข้อผิดพลาดในการลบ' }
  }
}

const moveSubOrder = async (categoryId: number, subIndexInFilteredList: number, direction: 'up' | 'down') => {
  const filteredSubs = subCategories.value.filter(s => s.category_id === categoryId)
  const targetIndex = direction === 'up' ? subIndexInFilteredList - 1 : subIndexInFilteredList + 1
  if (targetIndex < 0 || targetIndex >= filteredSubs.length) return

  const currentSub = filteredSubs[subIndexInFilteredList]
  const swapSub = filteredSubs[targetIndex]

  const currentOrder = currentSub.display_order
  const swapOrder = swapSub.display_order

  try {
    await $fetch(`/api/sub-categories/${currentSub.id}`, {
      method: 'PUT',
      body: { name: currentSub.name, display_order: swapOrder }
    })
    await $fetch(`/api/sub-categories/${swapSub.id}`, {
      method: 'PUT',
      body: { name: swapSub.name, display_order: currentOrder }
    })
    await refreshSub()
    statusMsg.value = { type: 'success', text: 'สลับลำดับหมวดหมู่ย่อยสำเร็จ!' }
  } catch (err) {
    console.error(err)
    statusMsg.value = { type: 'error', text: 'ไม่สามารถปรับเปลี่ยนลำดับได้' }
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-800">📂 จัดการหมวดหมู่สินค้า (Categories)</h1>
      <NuxtLink to="/admin/items" class="text-sm font-semibold text-emerald-600 hover:text-emerald-700">
        ← กลับไปหน้าจัดการเมนู
      </NuxtLink>
    </div>

    <!-- Alert Message -->
    <div 
      v-if="statusMsg.text" 
      :class="`p-4 rounded-xl mb-6 transition-all ${
        statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' : 'bg-red-50 text-red-700 border border-red-250'
      }`"
    >
      {{ statusMsg.text }}
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- Left Column: Categories List -->
      <div class="md:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
        <h2 class="text-lg font-bold text-gray-800 flex items-center gap-2">
          📋 รายการหมวดหมู่ทั้งหมด
        </h2>

        <div v-if="error" class="text-red-500 py-8 text-center">
          เกิดข้อผิดพลาดในการดึงข้อมูล: {{ error.message }}
        </div>

        <div v-else-if="categories.length === 0" class="text-zinc-400 py-12 text-center italic">
          ยังไม่มีหมวดหมู่ในระบบ เริ่มต้นโดยการเพิ่มหมวดหมู่ใหม่ทางขวา
        </div>

        <div v-else class="divide-y divide-gray-100">
          <div 
            v-for="(cat, index) in categories" 
            :key="cat.id" 
            class="flex flex-col py-1"
          >
            <!-- Category Main Row -->
            <div 
              :class="`flex items-center justify-between py-2.5 transition-colors rounded-xl ${
                editingId === cat.id ? 'bg-orange-50/50 border border-orange-100 px-3' : ''
              }`"
            >
              <div class="flex items-center gap-3.5">
                <span class="text-3xl bg-zinc-150/50 w-12 h-12 flex items-center justify-center rounded-xl">{{ cat.icon }}</span>
                <div>
                  <h3 class="font-bold text-gray-800 text-base">
                    {{ cat.name === 'Food' ? 'อาหาร (Food)' : cat.name === 'Beverage' ? 'เครื่องดื่ม (Beverage)' : cat.name === 'Dessert' ? 'ของหวาน (Dessert)' : cat.name }}
                  </h3>
                  <p class="text-xs text-gray-400 font-medium font-sans">
                    ลำดับการแสดงผล: {{ cat.display_order }}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <!-- Re-order buttons -->
                <div class="flex flex-col gap-0.5 border border-zinc-200 rounded-lg p-0.5 bg-zinc-50">
                  <button 
                    @click="moveOrder(index, 'up')" 
                    :disabled="index === 0"
                    class="p-1 hover:bg-zinc-200 rounded text-zinc-500 hover:text-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="เลื่อนขึ้น"
                  >
                    ▲
                  </button>
                  <button 
                    @click="moveOrder(index, 'down')" 
                    :disabled="index === categories.length - 1"
                    class="p-1 hover:bg-zinc-200 rounded text-zinc-500 hover:text-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="เลื่อนลง"
                  >
                    ▼
                  </button>
                </div>

                <!-- Manage Sub-categories Toggle -->
                <button 
                  @click="toggleExpandCategory(cat.id!)"
                  :class="`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
                    expandedCategoryIds.includes(cat.id!)
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-250'
                  }`"
                >
                  📂 ย่อย ({{ subCategories.filter(s => s.category_id === cat.id).length }})
                </button>

                <!-- Edit & Delete -->
                <button 
                  @click="selectEdit(cat)"
                  class="px-3.5 py-2 rounded-xl text-sm font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 hover:text-zinc-900 transition-colors"
                >
                  ✏️ แก้ไข
                </button>
                
                <!-- Prevent deleting core default categories unless they want to, but keep it available -->
                <button 
                  @click="handleDelete(cat.id!, cat.name)"
                  class="px-3.5 py-2 rounded-xl text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  🗑️ ลบ
                </button>
              </div>
            </div>

            <!-- Sub-categories Nested List (Rendered if expanded) -->
            <div 
              v-if="expandedCategoryIds.includes(cat.id!)" 
              class="pl-12 pr-4 py-4 bg-zinc-50/50 border-t border-b border-zinc-100 my-2 rounded-xl flex flex-col gap-3"
            >
              <div class="flex items-center justify-between">
                <h4 class="text-xs font-black text-zinc-500 uppercase tracking-wider font-sans">
                  📂 หมวดหมู่ย่อย (Sub-categories) สำหรับหมวดนี้
                </h4>
              </div>

              <!-- List of Subcategories -->
              <div v-if="subCategories.filter(s => s.category_id === cat.id).length === 0" class="text-zinc-400 text-xs italic py-2">
                ยังไม่มีหมวดหมู่ย่อยในหมวดหมู่นี้
              </div>
              <div v-else class="space-y-2 max-w-lg">
                <div 
                  v-for="(sub, subIdx) in subCategories.filter(s => s.category_id === cat.id)" 
                  :key="sub.id"
                  class="flex items-center justify-between py-2 px-3.5 bg-white border border-zinc-200 rounded-xl text-xs transition-shadow hover:shadow-sm"
                >
                  <span class="font-bold text-zinc-800 font-sans">
                    {{ sub.name }} <span class="text-zinc-400 font-normal ml-1.5">(ลำดับ: {{ sub.display_order }})</span>
                  </span>

                  <div class="flex items-center gap-2">
                    <!-- Sub-category Reorder Arrows -->
                    <div class="flex gap-0.5 border border-zinc-200 rounded bg-zinc-50 p-0.5">
                      <button 
                        @click="moveSubOrder(cat.id!, subIdx, 'up')" 
                        :disabled="subIdx === 0"
                        class="px-1 hover:bg-zinc-200 rounded text-[9px] disabled:opacity-30"
                        title="เลื่อนขึ้น"
                        type="button"
                      >
                        ▲
                      </button>
                      <button 
                        @click="moveSubOrder(cat.id!, subIdx, 'down')" 
                        :disabled="subIdx === subCategories.filter(s => s.category_id === cat.id).length - 1"
                        class="px-1 hover:bg-zinc-200 rounded text-[9px] disabled:opacity-30"
                        title="เลื่อนลง"
                        type="button"
                      >
                        ▼
                      </button>
                    </div>

                    <button 
                      @click="selectEditSub(sub)"
                      type="button"
                      class="text-emerald-600 hover:text-emerald-700 font-bold px-2 py-1 rounded hover:bg-emerald-50 transition-colors"
                    >
                      ✏️ แก้ไข
                    </button>
                    <button 
                      @click="handleDeleteSub(sub.id, sub.name)"
                      type="button"
                      class="text-red-600 hover:text-red-700 font-bold px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      🗑️ ลบ
                    </button>
                  </div>
                </div>
              </div>

              <!-- Sub-category Form (Inline) -->
              <form @submit.prevent="handleSubmitSub(cat.id!)" class="mt-2 pt-3 border-t border-dashed border-zinc-200 flex items-center gap-2 max-w-lg">
                <input 
                  v-model="subForm.name" 
                  type="text" 
                  placeholder="ชื่อหมวดหมู่ย่อย เช่น Coffee, Non-Coffee"
                  required
                  class="flex-1 px-3 py-2 rounded-xl border border-gray-300 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors"
                />
                <input 
                  v-model.number="subForm.display_order" 
                  type="number" 
                  placeholder="ลำดับ"
                  required
                  min="1"
                  class="w-16 px-2 py-2 rounded-xl border border-gray-300 text-xs text-center focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors"
                />
                <button 
                  type="submit"
                  class="bg-emerald-600 text-white font-bold py-2 px-4 rounded-xl text-xs hover:bg-emerald-700 active:scale-95 transition-all shadow-sm"
                >
                  {{ isEditingSub && activeSubCategoryCategoryId === cat.id ? '💾 บันทึก' : '➕ เพิ่มย่อย' }}
                </button>
                <button 
                  v-if="isEditingSub && activeSubCategoryCategoryId === cat.id"
                  type="button"
                  @click="resetSubForm(cat.id!)"
                  class="bg-zinc-200 text-zinc-700 py-2 px-3 rounded-xl text-xs hover:bg-zinc-300 transition-colors"
                >
                  ยกเลิก
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Add/Edit Form -->
      <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-fit">
        <h2 class="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2">
          {{ isEditing ? '✏️ แก้ไขหมวดหมู่' : '➕ เพิ่มหมวดหมู่ใหม่' }}
        </h2>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-zinc-700 mb-1.5">ชื่อหมวดหมู่</label>
            <input 
              v-model="form.name" 
              type="text" 
              placeholder="เช่น ของทานเล่น, อาหารจานเดียว" 
              required
              class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-zinc-700 mb-1.5">ไอคอน (Emoji)</label>
            <div class="flex gap-2">
              <input 
                v-model="form.icon" 
                type="text" 
                placeholder="เช่น 🍟, 🍕" 
                required
                maxlength="10"
                class="w-20 px-3 py-2.5 rounded-xl border border-gray-300 text-center text-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-colors"
              />
              <div class="flex-1 flex flex-wrap gap-1.5 p-2 bg-zinc-50 border border-gray-200 rounded-xl max-h-24 overflow-y-auto">
                <!-- Helper emoji selector -->
                <button 
                  v-for="emoji in ['🍜', '☕', '🍰', '🍟', '🥤', '🍨', '🍿', '🍣', '🍛', '🥯', '🥗', '🥩', '🍕', '🍻']" 
                  :key="emoji"
                  type="button"
                  @click="form.icon = emoji"
                  class="w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-200 transition-colors text-sm"
                >
                  {{ emoji }}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-sm font-semibold text-zinc-700 mb-1.5">ลำดับการแสดงผล (Display Order)</label>
            <input 
              v-model.number="form.display_order" 
              type="number" 
              placeholder="1" 
              required
              min="1"
              class="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-colors"
            />
          </div>

          <div class="pt-4 flex flex-col gap-2">
            <button 
              type="submit" 
              :disabled="isSubmitting"
              class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-sm hover:shadow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ isSubmitting ? '⏳ กำลังบันทึก...' : (isEditing ? '💾 บันทึกการแก้ไข' : '✅ เพิ่มหมวดหมู่') }}
            </button>

            <button 
              v-if="isEditing" 
              type="button" 
              @click="resetForm"
              class="w-full bg-zinc-150 hover:bg-zinc-200 text-zinc-750 font-bold py-3 rounded-xl transition-colors"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
