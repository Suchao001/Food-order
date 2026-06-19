<script setup lang="ts">
</script>

<template>
  <div class="min-h-screen flex flex-col md:flex-row overflow-hidden">
    
    <!-- Unified POS Counter Section (Order & Cafe) -->
    <NuxtLink 
      to="/order" 
      class="flex-1 relative group overflow-hidden flex flex-col items-center justify-center p-8 md:p-12 text-center transition-all duration-700 hover:flex-[1.3]"
    >
      <!-- Animated Gradient Background (Warm Orange/Red/Pink) -->
      <div class="absolute inset-0 bg-gradient-to-br from-orange-500 via-red-500 to-amber-600 animate-gradient-slow"></div>
      
      <!-- Overlay Pattern -->
      <div class="absolute inset-0 opacity-10" style="background-image: url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E');"></div>
      
      <!-- Floating Elements -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-1/4 left-1/4 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-float"></div>
        <div class="absolute bottom-1/4 right-1/4 w-48 h-48 bg-yellow-300/20 rounded-full blur-3xl animate-float-delayed"></div>
      </div>
      
      <!-- Content -->
      <div class="relative z-10 transform transition-all duration-500 group-hover:scale-105">
        <!-- Icon Container -->
        <div class="w-28 h-28 md:w-36 md:h-36 bg-white/20 backdrop-blur-lg rounded-3xl flex items-center justify-center mb-8 mx-auto shadow-2xl border border-white/30 rotate-3 group-hover:rotate-0 transition-transform duration-500">
          <span class="text-5xl md:text-6xl">🍜☕</span>
        </div>
        
        <h1 class="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight drop-shadow-lg">
          POS Counter
        </h1>
        <p class="text-white/80 text-lg md:text-xl max-w-sm mx-auto font-medium leading-relaxed">
          สั่งอาหารและเครื่องดื่มคาเฟ่จุดเดียวกัน สั่งง่าย รวดเร็ว!
        </p>
        
        <div class="mt-10 inline-flex items-center gap-3 px-8 py-4 bg-white text-orange-600 rounded-2xl font-bold shadow-xl transform group-hover:-translate-y-2 group-hover:shadow-2xl transition-all duration-300">
          <span>เข้าสู่หน้ารับออร์เดอร์</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
      </div>
    </NuxtLink>

    <!-- Staff Section (Admin) -->
    <NuxtLink 
      to="/admin/items" 
      class="flex-1 relative group overflow-hidden flex flex-col items-center justify-center p-8 md:p-12 text-center transition-all duration-700 hover:flex-[1.3]"
    >
      <!-- Dark Gradient Background -->
      <div class="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-zinc-900"></div>
      
      <!-- Grid Pattern -->
      <div class="absolute inset-0 opacity-5" style="background-image: url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'%3E%3Cg fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath opacity=\'.5\' d=\'M96 95h4v1h-4v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9zm-1 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9z\'/%3E%3Cpath d=\'M6 5V0H5v5H0v1h5v94h1V6h94V5H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E');"></div>
      
      <!-- Floating Elements -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-1/3 right-1/4 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl animate-float-delayed"></div>
        <div class="absolute bottom-1/3 left-1/4 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl animate-float"></div>
      </div>
      
      <!-- Content -->
      <div class="relative z-10 transform transition-all duration-500 group-hover:scale-105">
        <!-- Icon Container -->
        <div class="w-28 h-28 md:w-36 md:h-36 bg-white/5 backdrop-blur-lg rounded-3xl flex items-center justify-center mb-8 mx-auto shadow-2xl border border-white/10 -rotate-3 group-hover:rotate-0 transition-transform duration-500">
          <span class="text-5xl md:text-6xl">⚙️</span>
        </div>
        
        <h2 class="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
          Staff Portal
        </h2>
        <p class="text-slate-400 text-lg md:text-xl max-w-sm mx-auto font-medium leading-relaxed">
          จัดการเมนู เพิ่ม/ลบรายการอาหาร
        </p>

        <div class="mt-10 inline-flex items-center gap-3 px-8 py-4 bg-white/10 backdrop-blur text-white rounded-2xl font-bold border border-white/20 transform group-hover:-translate-y-2 group-hover:bg-white/20 transition-all duration-300">
          <span>เข้าสู่ระบบจัดการ</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
      </div>
    </NuxtLink>

  </div>
</template>

<style scoped>
@keyframes gradient-slow {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(5deg); }
}

@keyframes float-delayed {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-30px) rotate(-5deg); }
}

.animate-gradient-slow {
  background-size: 200% 200%;
  animation: gradient-slow 8s ease infinite;
}

.animate-float {
  animation: float 6s ease-in-out infinite;
}

.animate-float-delayed {
  animation: float-delayed 8s ease-in-out infinite;
  animation-delay: 2s;
}
</style>
