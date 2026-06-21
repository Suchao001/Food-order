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
            :class="`flex items-center justify-between py-3.5 transition-colors ${
              editingId === cat.id ? 'bg-orange-50/50 -mx-4 px-4 rounded-xl border border-orange-100' : ''
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
