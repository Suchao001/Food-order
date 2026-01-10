<script setup lang="ts">
definePageMeta({
  layout: 'admin'
})

const form = reactive({
  label: '',
  extra_price: '',
  image_url: ''
})

const loading = ref(false)
const uploading = ref(false)
const message = ref({ type: '', text: '' })
const fileInput = ref<HTMLInputElement | null>(null)

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
  loading.value = true
  message.value = { type: '', text: '' }

  try {
    await $fetch('/api/options', {
      method: 'POST',
      body: {
        label: form.label,
        extra_price: Number(form.extra_price),
        image_url: form.image_url
      }
    })

    message.value = { type: 'success', text: 'Option created successfully!' }
    form.label = ''
    form.extra_price = ''
    form.image_url = ''
    if (fileInput.value) fileInput.value.value = ''
  } catch (error: any) {
    message.value = { type: 'error', text: error.data?.statusMessage || 'Failed to create option' }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-md mx-auto bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <h1 class="text-2xl font-bold text-gray-800 mb-6">Add New Option</h1>

    <div v-if="message.text" :class="`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`">
      {{ message.text }}
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-5">
      <!-- Label -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Option Name (ชื่อตัวเลือก)</label>
        <input 
          v-model="form.label"
          type="text" 
          placeholder="e.g. Fried Egg, Pork, Beef"
          required
          class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
        >
      </div>

      <!-- Extra Price -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Extra Price (บวกเพิ่ม)</label>
        <div class="relative">
          <span class="absolute left-4 top-3 text-gray-500">+฿</span>
          <input 
            v-model="form.extra_price"
            type="number" 
            placeholder="0.00"
            step="0.01"
            class="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
          >
        </div>
      </div>

      <!-- Image Upload -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Option Image (Optional)</label>
        <div class="flex items-center gap-4">
          <div v-if="form.image_url" class="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 group flex-shrink-0">
             <img :src="form.image_url" alt="Preview" class="w-full h-full object-cover">
             <button 
                type="button" 
                @click="form.image_url = ''; if(fileInput) fileInput.value = ''"
                class="absolute inset-0 bg-black bg-opacity-40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
          </div>
          
          <label class="flex-grow cursor-pointer">
             <div class="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-center text-gray-500 text-sm">
               <span v-if="uploading">Uploading...</span>
               <span v-else>Click to upload image</span>
             </div>
             <input 
                ref="fileInput"
                type="file" 
                class="hidden" 
                accept="image/*"
                @change="handleFileUpload"
              />
          </label>
        </div>
      </div>

      <!-- Submit Button -->
      <button 
        type="submit" 
        :disabled="loading || uploading"
        class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-lg shadow-lg hover:shadow-xl transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        <span v-if="loading" class="flex items-center justify-center gap-2">
          Saving...
        </span>
        <span v-else>Add Option</span>
      </button>
    </form>
  </div>
</template>
