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
      <h1 class="text-2xl font-bold text-gray-800">All Menus</h1>
      <div class="flex gap-2">
        <NuxtLink to="/admin/options" class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
          Manage Options
        </NuxtLink>
        <NuxtLink to="/admin/items/create" class="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
          + Add Menu
        </NuxtLink>
      </div>
    </div>

    <div v-if="error" class="bg-red-50 text-red-700 p-4 rounded-lg mb-4">
      Failed to load menus. {{ error.message }}
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="menu in menus" :key="menu.id" class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col">
        <div class="h-40 bg-gray-100 rounded-lg overflow-hidden mb-4 relative group">
          <img :src="menu.image_url" :alt="menu.name" class="w-full h-full object-cover">
          <div class="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-bold text-emerald-700 shadow-sm">
            ฿{{ menu.base_price }}
          </div>
          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
             <NuxtLink :to="`/admin/items/${menu.id}/edit`" class="bg-white text-gray-800 px-4 py-2 rounded-lg font-medium hover:bg-emerald-50 transition-colors shadow-lg">
                Edit
             </NuxtLink>
          </div>
        </div>
        <h3 class="font-bold text-lg text-gray-800 mb-1">{{ menu.name }}</h3>
        <p class="text-gray-500 text-sm mt-auto">ID: {{ menu.id }}</p>
      </div>
    </div>
    
    <div v-if="!menus || menus.length === 0" class="text-center py-12 text-gray-500">
      <p>No menus found. Start by adding one!</p>
    </div>
  </div>
</template>
