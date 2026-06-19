<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const id = route.params.id

definePageMeta({
  layout: 'admin'
})

const form = reactive({
  label: '',
  extra_price: '',
  image_url: '',
  option_group: 'addons'
})

const loading = ref(false)
const uploading = ref(false)
const message = ref({ type: '', text: '' })
const fileInput = ref<HTMLInputElement | null>(null)

// Fetch existing data
const { data: optionData, error: fetchError } = await useFetch<any>(`/api/options/${id}`)

if (optionData.value?.data) {
  const data = optionData.value.data
  form.label = data.label
  form.extra_price = data.extra_price
  form.image_url = data.image_url
  form.option_group = data.option_group || 'addons'
} else if (fetchError.value) {
    message.value = { type: 'error', text: 'Failed to load option data' }
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
  loading.value = true
  message.value = { type: '', text: '' }

  try {
    await $fetch(`/api/options/${id}`, {
      method: 'PUT',
      body: {
        label: form.label,
        extra_price: Number(form.extra_price),
        image_url: form.image_url,
        option_group: form.option_group
      }
    })

    message.value = { type: 'success', text: 'Option updated successfully!' }
  } catch (error: any) {
    message.value = { type: 'error', text: error.data?.statusMessage || 'Failed to update option' }
  } finally {
    loading.value = false
  }
}

async function handleDelete() {
  if (!confirm('Are you sure you want to delete this option? This action cannot be undone.')) return;

  loading.value = true;
  try {
      await $fetch(`/api/options/${id}`, {
          method: 'DELETE'
      });
      router.push('/admin/options');
  } catch (error: any) {
      message.value = { type: 'error', text: error.data?.statusMessage || 'Failed to delete option' };
      loading.value = false;
  }
}
</script>

<template>
  <div class="max-w-md mx-auto bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-800">Edit Option</h1>
        <NuxtLink to="/admin/options" class="text-gray-500 hover:text-gray-700 text-sm">
            &larr; Back
        </NuxtLink>
    </div>

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

      <!-- Option Group Selection -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Option Group (กลุ่มประเภทตัวเลือก)</label>
        <select 
          v-model="form.option_group"
          required
          class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
        >
          <option value="addons">➕ เพิ่มเติม (Add-ons / Toppings)</option>
          <option value="temperature">🧊 อุณหภูมิ (Temperature)</option>
          <option value="sweetness">🍬 ระดับความหวาน (Sweetness)</option>
          <option value="milk_type">🥛 ประเภทนม (Milk Option)</option>
          <option value="spiciness">🌶️ ระดับความเผ็ด (Spiciness)</option>
          <option value="meat_type">🥩 เลือกเนื้อสัตว์ (Meat / Protein Type)</option>
        </select>
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
        <span v-else>Update Option</span>
      </button>

      <div class="pt-4 border-t border-gray-100">
         <button 
            type="button" 
            @click="handleDelete"
            class="w-full text-red-600 font-medium py-3 rounded-lg hover:bg-red-50 transition-colors"
        >
            Delete Option
        </button>
      </div>
    </form>
  </div>
</template>
