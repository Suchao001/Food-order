<script setup lang="ts">
definePageMeta({
  layout: 'admin'
})

const { data: result, error, refresh } = await useFetch('/api/options')
const options = computed(() => result.value?.data || [])
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-800">🍳 Options ทั้งหมด</h1>
      <NuxtLink to="/admin/options/create" class="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
        ➕ เพิ่ม Option
      </NuxtLink>
    </div>

    <div v-if="error" class="bg-red-50 text-red-700 p-4 rounded-xl mb-4">
      โหลด Options ไม่สำเร็จ: {{ error.message }}
    </div>

    <div v-else-if="options.length === 0" class="text-center py-16">
      <div class="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <span class="text-4xl">🍳</span>
      </div>
      <h3 class="text-xl font-bold text-gray-800 mb-2">ยังไม่มี Options</h3>
      <p class="text-gray-500 mb-4">เริ่มต้นเพิ่ม Options เช่น ไข่ดาว, ไข่เจียว</p>
      <NuxtLink to="/admin/options/create" class="inline-block bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-emerald-700 transition-colors">
        ➕ เพิ่ม Option ใหม่
      </NuxtLink>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="option in options" :key="option.id" class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
        <div class="aspect-video bg-gray-100 relative group">
          <img v-if="option.image_url" :src="option.image_url" :alt="option.label" class="w-full h-full object-cover">
          <div v-else class="w-full h-full flex items-center justify-center text-4xl">🍳</div>
          <div class="absolute top-3 right-3 bg-emerald-500 text-white px-3 py-1.5 rounded-full text-sm font-bold shadow-sm">
            +฿{{ option.extra_price }}
          </div>
          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <NuxtLink :to="`/admin/options/${option.id}/edit`" class="bg-white text-gray-800 px-5 py-2.5 rounded-xl font-medium hover:bg-emerald-50 transition-colors shadow-lg">
              ✏️ แก้ไข
            </NuxtLink>
          </div>
        </div>
        <div class="p-4">
          <h3 class="font-bold text-lg text-gray-800">{{ option.label }}</h3>
          <p v-if="option.option_group" class="text-gray-500 text-sm">กลุ่ม: {{ option.option_group }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
