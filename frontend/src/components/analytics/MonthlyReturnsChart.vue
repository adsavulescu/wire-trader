<template>
  <div class="relative w-full" :style="{ height: `${height}px` }">
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80">
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
        <p class="text-gray-500 mt-2">Loading heatmap...</p>
      </div>
    </div>
    
    <div v-else-if="!data || data.length === 0" class="absolute inset-0 flex items-center justify-center">
      <div class="text-center">
        <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p class="text-gray-500">No monthly data available</p>
      </div>
    </div>
    
    <div v-else class="p-4">
      <!-- Heatmap -->
      <div class="space-y-2">
        <div
          v-for="yearData in data"
          :key="yearData.year"
          class="flex items-center space-x-2"
        >
          <div class="w-12 text-sm font-medium text-gray-700">
            {{ yearData.year }}
          </div>
          <div class="flex space-x-1">
            <div
              v-for="monthData in yearData.months"
              :key="monthData.month"
              :class="getHeatmapColor(monthData.return)"
              class="w-8 h-8 rounded flex items-center justify-center text-xs font-medium cursor-pointer transition-all hover:scale-110"
              :title="`${monthData.month} ${yearData.year}: ${monthData.return.toFixed(1)}%`"
            >
              {{ monthData.month.slice(0, 1) }}
            </div>
          </div>
          <div class="text-sm text-gray-600 ml-2">
            {{ getYearTotal(yearData).toFixed(1) }}%
          </div>
        </div>
      </div>

      <!-- Legend -->
      <div class="mt-6 flex items-center justify-center space-x-4">
        <span class="text-sm text-gray-600">Returns:</span>
        <div class="flex items-center space-x-1">
          <div class="w-4 h-4 bg-red-500 rounded"></div>
          <span class="text-xs text-gray-600">< -5%</span>
        </div>
        <div class="flex items-center space-x-1">
          <div class="w-4 h-4 bg-red-300 rounded"></div>
          <span class="text-xs text-gray-600">-5% to -2%</span>
        </div>
        <div class="flex items-center space-x-1">
          <div class="w-4 h-4 bg-gray-200 rounded"></div>
          <span class="text-xs text-gray-600">-2% to 2%</span>
        </div>
        <div class="flex items-center space-x-1">
          <div class="w-4 h-4 bg-green-300 rounded"></div>
          <span class="text-xs text-gray-600">2% to 5%</span>
        </div>
        <div class="flex items-center space-x-1">
          <div class="w-4 h-4 bg-green-500 rounded"></div>
          <span class="text-xs text-gray-600">> 5%</span>
        </div>
      </div>

      <!-- Summary Stats -->
      <div class="mt-6 grid grid-cols-3 gap-4 text-center">
        <div class="p-3 bg-gray-50 rounded-lg">
          <p class="text-sm text-gray-600">Best Month</p>
          <p class="text-lg font-bold text-success-600">
            +{{ getBestMonth.toFixed(1) }}%
          </p>
        </div>
        <div class="p-3 bg-gray-50 rounded-lg">
          <p class="text-sm text-gray-600">Worst Month</p>
          <p class="text-lg font-bold text-danger-600">
            {{ getWorstMonth.toFixed(1) }}%
          </p>
        </div>
        <div class="p-3 bg-gray-50 rounded-lg">
          <p class="text-sm text-gray-600">Avg Monthly</p>
          <p class="text-lg font-bold text-gray-900">
            {{ getAverageMonth.toFixed(1) }}%
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface MonthData {
  month: string
  return: number
}

interface YearData {
  year: number
  months: MonthData[]
}

interface Props {
  data: YearData[]
  loading?: boolean
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  height: 320
})

const getHeatmapColor = (returnValue: number): string => {
  if (returnValue < -5) return 'bg-red-500 text-white'
  if (returnValue < -2) return 'bg-red-300 text-white'
  if (returnValue < 2) return 'bg-gray-200 text-gray-700'
  if (returnValue < 5) return 'bg-green-300 text-gray-700'
  return 'bg-green-500 text-white'
}

const getYearTotal = (yearData: YearData): number => {
  return yearData.months.reduce((total, month) => total + month.return, 0)
}

const getBestMonth = computed((): number => {
  if (!props.data.length) return 0
  
  let best = -Infinity
  props.data.forEach(year => {
    year.months.forEach(month => {
      if (month.return > best) {
        best = month.return
      }
    })
  })
  
  return best === -Infinity ? 0 : best
})

const getWorstMonth = computed((): number => {
  if (!props.data.length) return 0
  
  let worst = Infinity
  props.data.forEach(year => {
    year.months.forEach(month => {
      if (month.return < worst) {
        worst = month.return
      }
    })
  })
  
  return worst === Infinity ? 0 : worst
})

const getAverageMonth = computed((): number => {
  if (!props.data.length) return 0
  
  let total = 0
  let count = 0
  
  props.data.forEach(year => {
    year.months.forEach(month => {
      total += month.return
      count++
    })
  })
  
  return count > 0 ? total / count : 0
})
</script>