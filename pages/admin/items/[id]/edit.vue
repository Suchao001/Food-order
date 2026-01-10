<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const id = route.params.id

definePageMeta({
  layout: 'admin'
})

const form = reactive({
  name: '',
  base_price: '',
  image_url: ''
})

const loading = ref(false)
const uploading = ref(false)
const message = ref({ type: '', text: '' })
const fileInput = ref<HTMLInputElement | null>(null)

// Fetch existing data
const { data: menuData, error: fetchError } = await useFetch<any>(`/api/menus/${id}`)

if (menuData.value?.data) {
  const data = menuData.value.data
  form.name = data.name
  form.base_price = data.base_price
  form.image_url = data.image_url
} else if (fetchError.value) {
    message.value = { type: 'error', text: 'Failed to load menu data' }
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
        image_url: form.image_url
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
        <label class="block text-sm font-medium text-gray-700 mb-1">Dish Name (ชื่ออาหาร)</label>
        <input 
          v-model="form.name"
          type="text" 
          placeholder="e.g. Pad Thai"
          required
          class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
        >
      </div>

      <!-- Base Price -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Price (ราคา)</label>
        <div class="relative">
          <span class="absolute left-4 top-3 text-gray-500">฿</span>
          <input 
            v-model="form.base_price"
            type="number" 
            placeholder="0.00"
            step="0.01"
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
