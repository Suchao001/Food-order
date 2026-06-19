<template>
  <div class="min-h-screen bg-gray-50 font-sans text-gray-900">
    <!-- Mobile Header with Back Button -->
    <header class="bg-white shadow-sm sticky top-0 z-30 flex items-center justify-between px-4 py-3 lg:hidden">
      <button @click="$router.back()" class="text-gray-600 hover:text-emerald-600">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>
      <div class="font-bold text-xl text-emerald-600">จัดการร้าน</div>
      <div class="w-6"></div>
    </header>

    <div class="flex">
      <!-- Sidebar (Desktop) -->
      <aside class="hidden lg:block w-64 bg-white border-r h-screen sticky top-0 px-6 py-8">
        <div class="text-2xl font-bold text-emerald-600 mb-8">🍽️ จัดการร้าน</div>
        <nav class="space-y-2">
          <NuxtLink to="/" class="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 font-medium transition-colors">
            🏠 หน้าแรก
          </NuxtLink>
          <NuxtLink to="/admin/history" class="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 font-medium transition-colors">
            📊 ประวัติรายการ
          </NuxtLink>
          <NuxtLink to="/admin/items" class="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 font-medium transition-colors">
            🍜 จัดการเมนู
          </NuxtLink>
          <NuxtLink to="/admin/items/create" class="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 font-medium transition-colors">
            ➕ เพิ่มเมนูใหม่
          </NuxtLink>
          <NuxtLink to="/admin/options" class="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 font-medium transition-colors">
            🍳 จัดการ Options
          </NuxtLink>
          <div class="h-px bg-gray-200 my-3"></div>
          <NuxtLink to="/kitchen" class="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-750 hover:bg-emerald-50 hover:text-emerald-750 font-bold transition-colors">
            👨‍🍳 จอห้องครัว
          </NuxtLink>
          <NuxtLink to="/barista" class="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-755 hover:bg-emerald-50 hover:text-emerald-755 font-bold transition-colors">
            ☕ จอบาริสต้า
          </NuxtLink>
        </nav>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 p-4 lg:p-8 max-w-4xl mx-auto w-full pb-24 lg:pb-8">
        <slot />
      </main>
    </div>

    <!-- Mobile Floating Menu Button -->
    <div class="fixed bottom-6 right-6 lg:hidden z-40">
      <button 
        @click="showMobileMenu = !showMobileMenu"
        class="w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all text-2xl"
      >
        {{ showMobileMenu ? '✕' : '☰' }}
      </button>

      <!-- Mobile Menu Popup -->
      <Transition name="slide-up">
        <div v-if="showMobileMenu" class="absolute bottom-16 right-0 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden w-52">
          <NuxtLink 
            to="/" 
            @click="showMobileMenu = false"
            class="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 font-medium border-b border-gray-100"
          >
            🏠 หน้าแรก
          </NuxtLink>
          <NuxtLink 
            to="/admin/history" 
            @click="showMobileMenu = false"
            class="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 font-medium border-b border-gray-100"
          >
            📊 ประวัติรายการ
          </NuxtLink>
          <NuxtLink 
            to="/admin/items" 
            @click="showMobileMenu = false"
            class="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 font-medium border-b border-gray-100"
          >
            🍜 จัดการเมนู
          </NuxtLink>
          <NuxtLink 
            to="/admin/items/create" 
            @click="showMobileMenu = false"
            class="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 font-medium border-b border-gray-100"
          >
            ➕ เพิ่มเมนูใหม่
          </NuxtLink>
          <NuxtLink 
            to="/admin/options" 
            @click="showMobileMenu = false"
            class="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 font-medium border-b border-gray-100"
          >
            🍳 จัดการ Options
          </NuxtLink>
          <NuxtLink 
            to="/kitchen" 
            @click="showMobileMenu = false"
            class="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 font-medium border-b border-gray-100"
          >
            👨‍🍳 จอห้องครัว
          </NuxtLink>
          <NuxtLink 
            to="/barista" 
            @click="showMobileMenu = false"
            class="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 font-medium"
          >
            ☕ จอบาริสต้า
          </NuxtLink>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup>
const showMobileMenu = ref(false)
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.2s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
