<script setup lang="ts">
definePageMeta({
  layout: 'admin'
})

const { data: result, error, refresh } = await useFetch('/api/menus')
const menus = computed(() => result.value?.data || [])
</script>

<template>
  <div>
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

    <div v-if="error" class="bg-red-50 text-red-700 p-4 rounded-xl mb-4">
      โหลดเมนูไม่สำเร็จ: {{ error.message }}
    </div>

    <div v-else-if="!menus || menus.length === 0" class="text-center py-16">
      <div class="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <span class="text-4xl">🍽️</span>
      </div>
      <h3 class="text-xl font-bold text-gray-800 mb-2">ยังไม่มีเมนู</h3>
      <p class="text-gray-500 mb-4">เริ่มต้นเพิ่มเมนูแรกของร้านคุณ</p>
      <NuxtLink to="/admin/items/create" class="inline-block bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-emerald-700 transition-colors">
        ➕ เพิ่มเมนูใหม่
      </NuxtLink>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="menu in menus" :key="menu.id" class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
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
            <span :class="`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${
              menu.dept === 'Kitchen' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
              menu.dept === 'Barista' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
              'bg-pink-50 text-pink-700 border border-pink-100'
            }`">
              {{ menu.dept === 'Kitchen' ? '🍳 ครัวอาหาร' : menu.dept === 'Barista' ? '☕ บาร์น้ำ' : '🍰 ตู้ขนม' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
