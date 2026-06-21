<script setup lang="ts">
import { ref, computed } from 'vue'

definePageMeta({
  layout: 'admin'
})

const { data: result, error, refresh } = await useFetch<{ success: boolean, data: any[] }>('/api/menus')
const { data: categoryResult } = await useFetch<{ success: boolean, data: any[] }>('/api/categories')
const { data: subCategoryResult } = await useFetch<{ success: boolean, data: any[] }>('/api/sub-categories')

const allMenus = computed(() => result.value?.data || [])
const categories = computed(() => categoryResult.value?.data || [])
const subCategories = computed(() => subCategoryResult.value?.data || [])

// Filter States
const searchQuery = ref('')
const selectedCategoryId = ref<number | 'all'>('all')
const selectedSubCategoryId = ref<number | 'all'>('all')

// Filtered sub-categories based on category selection
const filteredSubCategories = computed(() => {
  if (selectedCategoryId.value === 'all') return []
  return subCategories.value.filter((s: any) => s.category_id === selectedCategoryId.value)
})

// Filtered list of menus
const filteredMenus = computed(() => {
  let list = allMenus.value
  
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter((m: any) => m.name.toLowerCase().includes(q))
  }
  
  if (selectedCategoryId.value !== 'all') {
    list = list.filter((m: any) => m.category_id === selectedCategoryId.value)
  }
  
  if (selectedSubCategoryId.value !== 'all') {
    list = list.filter((m: any) => m.sub_category_id === selectedSubCategoryId.value)
  }
  
  return list
})
</script>

<template>
  <div>
    <!-- Title Header -->
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-800">🍜 เมนูทั้งหมด</h1>
      <div class="flex gap-2">
        <NuxtLink to="/admin/categories" class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          📂 หมวดหมู่
        </NuxtLink>
        <NuxtLink to="/admin/options" class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          🍳 Options
        </NuxtLink>
        <NuxtLink to="/admin/items/create" class="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
          ➕ เพิ่มเมนู
        </NuxtLink>
      </div>
    </div>

    <!-- Error Handling -->
    <div v-if="error" class="bg-red-50 text-red-700 p-4 rounded-xl mb-4">
      โหลดเมนูไม่สำเร็จ: {{ error.message }}
    </div>

    <div v-else>
      <!-- Filter Control Row -->
      <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6 flex flex-wrap gap-4 items-center">
        <!-- Search keyword -->
        <div class="flex-1 min-w-[240px] relative">
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="🔎 ค้นหาเมนู..." 
            class="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
          />
        </div>
        
        <!-- Category Selection -->
        <div class="flex items-center gap-2">
          <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">หมวดหมู่:</label>
          <select 
            v-model="selectedCategoryId" 
            @change="selectedSubCategoryId = 'all'"
            class="px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all bg-white"
          >
            <option value="all">ทั้งหมด</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.icon }} {{ cat.name === 'Food' ? 'อาหาร' : cat.name === 'Beverage' ? 'เครื่องดื่ม' : cat.name === 'Dessert' ? 'ของหวาน' : cat.name }}
            </option>
          </select>
        </div>

        <!-- Sub-Category Selection -->
        <div v-if="filteredSubCategories.length > 0" class="flex items-center gap-2">
          <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">หมวดหมู่ย่อย:</label>
          <select 
            v-model="selectedSubCategoryId" 
            class="px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all bg-white"
          >
            <option value="all">ทั้งหมด</option>
            <option v-for="sub in filteredSubCategories" :key="sub.id" :value="sub.id">
              {{ sub.name }}
            </option>
          </select>
        </div>
      </div>

      <!-- Empty State: No menus in database at all -->
      <div v-if="!allMenus || allMenus.length === 0" class="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div class="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span class="text-4xl">🍽️</span>
        </div>
        <h3 class="text-xl font-bold text-gray-800 mb-2">ยังไม่มีเมนู</h3>
        <p class="text-gray-500 mb-4">เริ่มต้นเพิ่มเมนูแรกของร้านคุณ</p>
        <NuxtLink to="/admin/items/create" class="inline-block bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-emerald-700 transition-colors">
          ➕ เพิ่มเมนูใหม่
        </NuxtLink>
      </div>

      <!-- Empty State: Filter results empty -->
      <div v-else-if="filteredMenus.length === 0" class="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div class="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <span class="text-2xl">🔍</span>
        </div>
        <h3 class="text-lg font-bold text-gray-800 mb-1">ไม่พบผลลัพธ์</h3>
        <p class="text-gray-500 text-sm">ลองเปลี่ยนเงื่อนไขหรือคำค้นหาใหม่</p>
      </div>

      <!-- Menus Grid List -->
      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="menu in filteredMenus" :key="menu.id" class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
          <div class="aspect-video bg-gray-100 relative group">
            <img v-if="menu.image_url" :src="menu.image_url" :alt="menu.name" class="w-full h-full object-cover">
            <div v-else class="w-full h-full flex items-center justify-center bg-zinc-50 text-4xl select-none">
              {{ menu.dept === 'Kitchen' ? '🍜' : menu.dept === 'Barista' ? '☕' : '🍰' }}
            </div>
            <div class="absolute top-3 right-3 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-sm font-bold text-emerald-700 shadow-sm">
              ฿{{ menu.base_price }}
            </div>
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <NuxtLink :to="`/admin/items/${menu.id}/edit`" class="bg-white text-gray-800 px-5 py-2.5 rounded-xl font-medium hover:bg-emerald-50 transition-colors shadow-lg">
                ✏️ แก้ไข
              </NuxtLink>
            </div>
          </div>
          <div class="p-4 flex flex-col gap-2">
            <h3 class="font-bold text-lg text-gray-800 leading-snug">{{ menu.name }}</h3>
            <div class="flex flex-wrap gap-1.5">
              <!-- Department Tag -->
              <span :class="`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${
                menu.dept === 'Kitchen' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                menu.dept === 'Barista' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                'bg-pink-50 text-pink-700 border border-pink-100'
              }`">
                {{ menu.dept === 'Kitchen' ? '🍳 ครัวอาหาร' : menu.dept === 'Barista' ? '☕ บาร์น้ำ' : '🍰 ตู้ขนม' }}
              </span>
              <!-- Sub Category Tag -->
              <span 
                v-if="menu.sub_category_id" 
                class="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-zinc-100 text-zinc-700 border border-zinc-200"
              >
                📂 {{ subCategories.find(s => s.id === menu.sub_category_id)?.name }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
