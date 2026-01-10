<script setup lang="ts">
const isAuthenticated = ref(false)
const pin = ref('')
const loading = ref(false)
const error = ref('')

onMounted(() => {
  // Check localStorage on mount
  if (localStorage.getItem('access_granted') === 'true') {
    isAuthenticated.value = true
  }
})

async function verifyPin() {
  if (!pin.value) return
  
  loading.value = true
  error.value = ''
  
  try {
    const { success } = await $fetch('/api/auth/verify', {
      method: 'POST',
      body: { pin: pin.value }
    })
    
    if (success) {
      isAuthenticated.value = true
      localStorage.setItem('access_granted', 'true')
    }
  } catch (err: any) {
    error.value = 'รหัสผ่านไม่ถูกต้อง'
    pin.value = ''
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <!-- Gate -->
    <div v-if="!isAuthenticated" class="fixed inset-0 z-[9999] bg-gradient-to-br from-emerald-900 to-black flex items-center justify-center p-4">
      <div class="bg-white/10 backdrop-blur-xl p-8 rounded-3xl w-full max-w-sm border border-white/20 shadow-2xl">
        <div class="text-center mb-8">
          <div class="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
            <span class="text-4xl">🔒</span>
          </div>
          <h1 class="text-2xl font-bold text-white mb-2">Food Order System</h1>
          <p class="text-emerald-200">กรุณาใส่รหัสเพื่อเข้าใช้งาน</p>
        </div>
        
        <form @submit.prevent="verifyPin" class="space-y-4">
          <div>
            <input 
              v-model="pin"
              type="password"
              placeholder="Enter PIN"
              class="w-full text-center text-2xl tracking-widest px-4 py-4 rounded-xl bg-white/20 border border-white/30 text-white placeholder-white/50 focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none transition-all"
              autofocus
            >
          </div>
          
          <div v-if="error" class="text-red-300 text-center text-sm font-medium bg-red-500/20 py-2 rounded-lg">
            {{ error }}
          </div>
          
          <button 
            type="submit"
            :disabled="loading || !pin"
            class="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-900/20 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="loading">⏳ Checking...</span>
            <span v-else>เข้าสู่ระบบ</span>
          </button>
        </form>
      </div>
    </div>
    
    <!-- App Content -->
    <slot v-else />
  </div>
</template>
