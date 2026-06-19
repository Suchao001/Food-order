<script setup lang="ts">
definePageMeta({
  layout: 'admin'
})

// View mode: 'daily' or 'monthly'
const viewMode = ref<'daily' | 'monthly'>('daily')

// ===== DAILY VIEW =====
const today = new Date().toISOString().split('T')[0]
const selectedDate = ref(today)

const { data: result, error, refresh } = await useFetch('/api/orders/history', {
  query: { date: selectedDate }
})
const historyData = computed(() => result.value?.data || [])

watch(selectedDate, () => {
  refresh()
})

function prevDay() {
  const current = new Date(selectedDate.value)
  current.setDate(current.getDate() - 1)
  selectedDate.value = current.toISOString().split('T')[0]
}

function nextDay() {
  const current = new Date(selectedDate.value)
  current.setDate(current.getDate() + 1)
  selectedDate.value = current.toISOString().split('T')[0]
}

function goToToday() {
  selectedDate.value = today
}

const isToday = computed(() => selectedDate.value === today)

const totalRevenue = computed(() => {
  return historyData.value.reduce((sum: number, day: any) => sum + day.totalRevenue, 0)
})

const totalOrders = computed(() => {
  return historyData.value.reduce((sum: number, day: any) => sum + day.orderCount, 0)
})

// ===== DEPT REVENUE VIEW =====
const { data: deptResult } = await useFetch<{ success: boolean, data: any[] }>('/api/admin/revenue-by-dept')
const deptRevenue = computed(() => deptResult.value?.data || [])
const totalDeptRevenue = computed(() => {
  return deptRevenue.value.reduce((sum: number, r: any) => sum + r.revenue, 0)
})

function getDeptName(dept: string) {
  switch (dept) {
    case 'Kitchen': return '🍳 อาหาร'
    case 'Barista': return '☕ เครื่องดื่ม'
    case 'Bakery': return '🍰 ของหวาน'
    default: return dept
  }
}

function getDeptColorClass(dept: string) {
  switch (dept) {
    case 'Kitchen': return 'bg-orange-500'
    case 'Barista': return 'bg-blue-500'
    case 'Bakery': return 'bg-pink-500'
    default: return 'bg-gray-500'
  }
}

// ===== MONTHLY VIEW =====
const currentYear = new Date().getFullYear()
const selectedYear = ref(currentYear)

const { data: monthlyResult, refresh: refreshMonthly } = await useFetch('/api/orders/monthly', {
  query: { year: selectedYear }
})

const monthlyData = computed(() => monthlyResult.value?.data || [])
const yearlyTotal = computed(() => monthlyResult.value?.yearlyTotal || 0)
const yearlyOrders = computed(() => monthlyResult.value?.yearlyOrders || 0)

watch(selectedYear, () => {
  refreshMonthly()
})

function prevYear() {
  selectedYear.value--
}

function nextYear() {
  selectedYear.value++
}

// ===== HELPERS =====
function getStatusColor(status: string) {
  switch (status) {
    case 'Pending': return 'bg-yellow-100 text-yellow-700'
    case 'Cooking': return 'bg-orange-100 text-orange-700'
    case 'Ready': return 'bg-blue-100 text-blue-700'
    case 'Completed': return 'bg-green-100 text-green-700'
    case 'Cancelled': return 'bg-red-100 text-red-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

function getStatusText(status: string) {
  switch (status) {
    case 'Pending': return 'รอ'
    case 'Cooking': return 'กำลังทำ'
    case 'Ready': return 'พร้อม'
    case 'Completed': return 'เสร็จสิ้น'
    case 'Cancelled': return 'ยกเลิก'
    default: return status
  }
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString('th-TH', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}
</script>

<template>
  <div>
    <!-- Header with View Toggle -->
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-800">📊 สรุปรายรับ</h1>
      
      <!-- View Toggle -->
      <div class="flex bg-gray-100 rounded-xl p-1">
        <button 
          @click="viewMode = 'daily'"
          :class="[
            'px-4 py-2 rounded-lg font-medium text-sm transition-colors',
            viewMode === 'daily' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600'
          ]"
        >
          📅 รายวัน
        </button>
        <button 
          @click="viewMode = 'monthly'"
          :class="[
            'px-4 py-2 rounded-lg font-medium text-sm transition-colors',
            viewMode === 'monthly' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600'
          ]"
        >
          🗓️ รายเดือน
        </button>
      </div>
    </div>

    <!-- Department Revenue Breakdown Card -->
    <div v-if="deptRevenue.length > 0" class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
      <h3 class="text-sm font-bold text-gray-400 mb-4 uppercase tracking-wider">📊 สัดส่วนรายได้สะสมแยกตามฝ่าย</h3>
      <div class="space-y-4">
        <!-- Visual Bar -->
        <div class="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex">
          <div 
            v-for="dept in deptRevenue" 
            :key="dept.dept"
            :class="getDeptColorClass(dept.dept)"
            :style="{ width: `${(dept.revenue / Math.max(totalDeptRevenue, 1)) * 100}%` }"
            :title="`${getDeptName(dept.dept)}: ฿${dept.revenue}`"
          ></div>
        </div>
        <!-- Legend -->
        <div class="grid grid-cols-3 gap-4">
          <div v-for="dept in deptRevenue" :key="dept.dept" class="flex flex-col">
            <span class="text-xs text-gray-500 flex items-center gap-1.5">
              <span :class="`w-2.5 h-2.5 rounded-full ${getDeptColorClass(dept.dept)}`"></span>
              {{ getDeptName(dept.dept) }}
            </span>
            <span class="text-base font-bold text-gray-800 mt-1">฿{{ dept.revenue.toLocaleString() }}</span>
            <span class="text-[11px] text-gray-400 font-medium">{{ dept.itemCount }} รายการ</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== DAILY VIEW ===== -->
    <template v-if="viewMode === 'daily'">
      <!-- Date Picker -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <div class="flex items-center justify-between gap-3">
          <button 
            @click="prevDay"
            class="w-12 h-12 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors text-2xl font-bold text-gray-600"
          >
            ‹
          </button>

          <div class="flex-1 text-center">
            <label class="cursor-pointer block">
            <div v-if="isToday" class="text-emerald-500 text-sm font-medium">วันนี้</div>
              <input 
                v-model="selectedDate"
                type="date"
                class="mt-1 px-4 py-2 rounded-xl border border-gray-200 text-center w-full max-w-[200px] mx-auto block focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
            </label>
          </div>

          <button 
            @click="nextDay"
            class="w-12 h-12 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors text-2xl font-bold text-gray-600"
          >
            ›
          </button>
        </div>

        <div v-if="!isToday" class="flex justify-center mt-3">
          <button 
            @click="goToToday"
            class="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-xl text-sm font-medium transition-colors"
          >
            📅 ไปวันนี้
          </button>
        </div>
      </div>

      <!-- Daily Summary Cards -->
      <div class="grid grid-cols-2 gap-4 mb-6">
        <div class="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white p-5 rounded-2xl">
          <div class="text-emerald-100 text-sm mb-1">💰 รายรับ</div>
          <div class="text-3xl font-black">฿{{ totalRevenue.toLocaleString() }}</div>
        </div>
        <div class="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-5 rounded-2xl">
          <div class="text-blue-100 text-sm mb-1">📋 ออเดอร์</div>
          <div class="text-3xl font-black">{{ totalOrders }}</div>
        </div>
      </div>

      <!-- Orders List -->
      <div v-if="error" class="bg-red-50 text-red-700 p-4 rounded-xl mb-4">
        โหลดข้อมูลไม่สำเร็จ
      </div>

      <div v-else-if="historyData.length === 0" class="text-center py-16">
        <div class="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span class="text-4xl">📋</span>
        </div>
        <h3 class="text-xl font-bold text-gray-800 mb-2">ไม่มีรายการ</h3>
        <p class="text-gray-500">ไม่มีออเดอร์ในวันนี้</p>
      </div>

      <div v-else class="space-y-4">
        <div v-for="dayData in historyData" :key="dayData.date" class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div class="divide-y divide-gray-100">
            <div v-for="order in dayData.orders" :key="order.id" class="p-4 hover:bg-gray-50 transition-colors">
              <div class="flex items-start justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-gray-800">#{{ order.id }}</span>
                  <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', getStatusColor(order.status)]">
                    {{ getStatusText(order.status) }}
                  </span>
                  <span class="text-gray-400 text-sm">{{ formatTime(order.created_at) }}</span>
                </div>
                <span class="font-bold text-emerald-600">฿{{ order.total_price }}</span>
              </div>
              
              <div class="flex flex-wrap gap-2">
                <span 
                  v-for="item in order.items" 
                  :key="item.id"
                  class="bg-gray-100 text-gray-700 text-sm px-2 py-1 rounded-lg"
                >
                  {{ item.menu_name }} x{{ item.quantity }}
                  <span v-if="item.is_special" class="text-yellow-600">⭐</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ===== MONTHLY VIEW ===== -->
    <template v-else>
      <!-- Year Picker -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <div class="flex items-center justify-between gap-3">
          <button 
            @click="prevYear"
            class="w-12 h-12 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors text-2xl font-bold text-gray-600"
          >
            ‹
          </button>

          <div class="flex-1 text-center">
            <div class="text-2xl font-black text-gray-800">{{ selectedYear }}</div>
            <div v-if="selectedYear === currentYear" class="text-emerald-500 text-sm font-medium">ปีนี้</div>
          </div>

          <button 
            @click="nextYear"
            class="w-12 h-12 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors text-2xl font-bold text-gray-600"
          >
            ›
          </button>
        </div>
      </div>

      <!-- Yearly Summary Cards -->
      <div class="grid grid-cols-2 gap-4 mb-6">
        <div class="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-5 rounded-2xl">
          <div class="text-purple-100 text-sm mb-1">💰 รายรับรวมทั้งปี</div>
          <div class="text-3xl font-black">฿{{ yearlyTotal.toLocaleString() }}</div>
        </div>
        <div class="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-5 rounded-2xl">
          <div class="text-indigo-100 text-sm mb-1">📋 ออเดอร์ทั้งปี</div>
          <div class="text-3xl font-black">{{ yearlyOrders }}</div>
        </div>
      </div>

      <!-- Monthly Breakdown -->
      <div v-if="monthlyData.length === 0" class="text-center py-16">
        <div class="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span class="text-4xl">�️</span>
        </div>
        <h3 class="text-xl font-bold text-gray-800 mb-2">ไม่มีข้อมูล</h3>
        <p class="text-gray-500">ไม่มีออเดอร์ในปี {{ selectedYear }}</p>
      </div>

      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div 
          v-for="month in monthlyData" 
          :key="month.month"
          class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
        >
          <div class="text-lg font-bold text-gray-800 mb-3">📅 {{ month.monthName }}</div>
          <div class="flex justify-between items-end">
            <div>
              <div class="text-gray-500 text-sm">{{ month.orderCount }} ออเดอร์</div>
            </div>
            <div class="text-right">
              <div class="text-2xl font-black text-emerald-600">฿{{ month.totalRevenue.toLocaleString() }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
