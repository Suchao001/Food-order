<script setup lang="ts">
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
    message.value = { type: 'success', text: 'อัปโหลดรูปสำเร็จ!' }
  } catch (error: any) {
    console.error(error)
    message.value = { type: 'error', text: error.data?.statusMessage || 'อัปโหลดรูปไม่สำเร็จ' }
    if (fileInput.value) fileInput.value.value = ''
  } finally {
    uploading.value = false
  }
}

async function handleSubmit() {
  if (!form.image_url) {
    message.value = { type: 'error', text: 'กรุณาอัปโหลดรูปภาพก่อน' }
    return
  }

  loading.value = true
  message.value = { type: '', text: '' }

  try {
    await $fetch('/api/menus', {
      method: 'POST',
      body: {
        name: form.name,
        base_price: Number(form.base_price),
        image_url: form.image_url
      }
    })

    message.value = { type: 'success', text: 'สร้างเมนูสำเร็จ!' }
    form.name = ''
    form.base_price = ''
    form.image_url = ''
    if (fileInput.value) fileInput.value.value = ''
  } catch (error: any) {
    message.value = { type: 'error', text: error.data?.statusMessage || 'สร้างเมนูไม่สำเร็จ' }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-lg mx-auto">
    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <h1 class="text-2xl font-bold text-gray-800 mb-6">➕ เพิ่มเมนูใหม่</h1>

      <div v-if="message.text" :class="`p-4 rounded-xl mb-6 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`">
        {{ message.text }}
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-5">
        <!-- Dish Name -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">ชื่ออาหาร</label>
          <input 
            v-model="form.name"
            type="text" 
            placeholder="เช่น ข้าวผัดกะเพรา"
            required
            class="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
          >
        </div>

        <!-- Base Price -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">ราคา (บาท)</label>
          <div class="relative">
            <span class="absolute left-4 top-3 text-gray-500">฿</span>
            <input 
              v-model="form.base_price"
              type="number" 
              placeholder="0"
              step="1"
              required
              class="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            >
          </div>
        </div>

        <!-- Image Upload -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">รูปภาพอาหาร</label>
          <div class="flex items-center justify-center w-full">
            <label 
              v-if="!form.image_url"
              class="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div class="flex flex-col items-center justify-center pt-5 pb-6">
                <div v-if="uploading" class="text-center">
                  <div class="animate-spin text-4xl mb-2">⏳</div>
                  <p class="text-sm text-gray-500">กำลังอัปโหลด...</p>
                </div>
                <div v-else class="text-center">
                  <div class="text-4xl mb-3">📷</div>
                  <p class="mb-2 text-sm text-gray-500"><span class="font-semibold">คลิกเพื่ออัปโหลด</span></p>
                  <p class="text-xs text-gray-400">PNG, JPG หรือ GIF</p>
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

            <div v-else class="relative w-full h-48 rounded-2xl overflow-hidden border border-gray-200 group">
              <img :src="form.image_url" alt="Preview" class="w-full h-full object-cover">
              <div class="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button 
                  type="button" 
                  @click="form.image_url = ''; if(fileInput) fileInput.value = ''"
                  class="bg-white text-red-600 px-4 py-2 rounded-xl font-medium hover:bg-gray-100 transition-colors"
                >
                  🔄 เปลี่ยนรูป
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Submit Button -->
        <button 
          type="submit" 
          :disabled="loading || uploading || !form.image_url"
          class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <span v-if="loading" class="flex items-center justify-center gap-2">
            <span class="animate-spin">⏳</span>
            กำลังบันทึก...
          </span>
          <span v-else>✅ บันทึกเมนู</span>
        </button>
      </form>
    </div>
  </div>
</template>
