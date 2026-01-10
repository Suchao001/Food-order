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
      <h1 class="text-2xl font-bold text-gray-800">Manage Options</h1>
      <NuxtLink to="/admin/options/create" class="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
        + Add New Option
      </NuxtLink>
    </div>

    <div v-if="error" class="bg-red-50 text-red-700 p-4 rounded-lg mb-4">
      Failed to load options. {{ error.message }}
    </div>

    <div v-else class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div v-if="options.length === 0" class="text-center py-12 text-gray-500">
        <p>No options found. Add one to get started!</p>
      </div>
      
      <table v-else class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-gray-50 border-b border-gray-100">
            <th class="px-6 py-4 font-semibold text-gray-600 text-sm">Image</th>
            <th class="px-6 py-4 font-semibold text-gray-600 text-sm">Label</th>
            <th class="px-6 py-4 font-semibold text-gray-600 text-sm">Extra Price</th>
            <th class="px-6 py-4 font-semibold text-gray-600 text-sm">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="option in options" :key="option.id" class="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
            <td class="px-6 py-3">
              <div v-if="option.image_url" class="w-12 h-12 rounded-lg overflow-hidden border border-gray-200">
                <img :src="option.image_url" :alt="option.label" class="w-full h-full object-cover">
              </div>
              <div v-else class="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                <span class="text-xs">No img</span>
              </div>
            </td>
            <td class="px-6 py-3 font-medium text-gray-800">{{ option.label }}</td>
            <td class="px-6 py-3 text-emerald-600 font-medium">+฿{{ option.extra_price }}</td>
            <td class="px-6 py-3">
              <NuxtLink :to="`/admin/options/${option.id}/edit`" class="text-emerald-600 hover:text-emerald-800 font-medium text-sm">
                Edit
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
