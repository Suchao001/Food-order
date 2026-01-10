<template>
  <div class="min-h-screen bg-gray-50 font-sans text-gray-900">
    <!-- Mobile Header -->
    <header class="bg-white shadow-sm sticky top-0 z-30 flex items-center justify-between px-4 py-3 lg:hidden">
      <div class="font-bold text-xl text-emerald-600">FoodAdmin</div>
      <button class="text-gray-500 focus:outline-none">
        <!-- Simple Hamburger Icon -->
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </header>

    <div class="flex">
      <!-- Sidebar (Desktop) -->
      <aside class="hidden lg:block w-64 bg-white border-r h-screen sticky top-0 px-6 py-8">
        <div class="text-2xl font-bold text-emerald-600 mb-8">FoodAdmin</div>
        <nav class="space-y-2">
          <NuxtLink to="/admin/items/create" class="block px-4 py-2 rounded-lg text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 font-medium">
            Add New Menu
          </NuxtLink>
           <NuxtLink to="/admin/items" class="block px-4 py-2 rounded-lg text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 font-medium">
            All Menus
          </NuxtLink>
        </nav>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 p-4 lg:p-8 max-w-3xl mx-auto w-full">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
/* Add any layout specific styles here */
</style>
