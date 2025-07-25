<template>
  <div class="relative">
    <canvas ref="chartCanvas" :width="width" :height="height"></canvas>
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import {
  Chart,
  CategoryScale,
  LinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import type { Balance } from '@/types'

// Register Chart.js components
Chart.register(
  CategoryScale,
  LinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

interface Props {
  balances: Balance[]
  width?: number
  height?: number
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  width: 400,
  height: 400,
  loading: false,
})

const chartCanvas = ref<HTMLCanvasElement>()
let chart: Chart | null = null

const generateColors = (count: number) => {
  const colors = [
    'rgb(59, 130, 246)',   // blue
    'rgb(16, 185, 129)',   // green
    'rgb(245, 158, 11)',   // yellow
    'rgb(239, 68, 68)',    // red
    'rgb(139, 92, 246)',   // purple
    'rgb(236, 72, 153)',   // pink
    'rgb(20, 184, 166)',   // teal
    'rgb(251, 146, 60)',   // orange
  ]
  
  const result = []
  for (let i = 0; i < count; i++) {
    result.push(colors[i % colors.length])
  }
  return result
}

const createChart = async () => {
  await nextTick()
  
  if (!chartCanvas.value || props.balances.length === 0) return

  const ctx = chartCanvas.value.getContext('2d')
  if (!ctx) return

  // Destroy existing chart
  if (chart) {
    chart.destroy()
  }

  // Filter balances with value > 0
  const nonZeroBalances = props.balances.filter(balance => balance.total > 0)
  
  if (nonZeroBalances.length === 0) {
    return
  }

  const labels = nonZeroBalances.map(balance => balance.currency)
  const data = nonZeroBalances.map(balance => balance.total)
  const colors = generateColors(nonZeroBalances.length)

  chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderColor: colors.map(color => color.replace('rgb', 'rgba').replace(')', ', 0.8)')),
          borderWidth: 2,
          hoverBorderWidth: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Portfolio Allocation',
          color: 'rgb(75, 85, 99)',
          font: {
            size: 16,
            weight: 'bold',
          },
        },
        legend: {
          position: 'bottom',
          labels: {
            padding: 20,
            usePointStyle: true,
            color: 'rgb(107, 114, 128)',
            font: {
              size: 12,
            },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: 'white',
          bodyColor: 'white',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderWidth: 1,
          callbacks: {
            label: (context) => {
              const balance = nonZeroBalances[context.dataIndex]
              const total = data.reduce((sum, value) => sum + value, 0)
              const percentage = ((balance.total / total) * 100).toFixed(1)
              return [
                `${balance.currency}: ${balance.total.toFixed(8)}`,
                `Exchange: ${balance.exchange}`,
                `Percentage: ${percentage}%`,
              ]
            },
          },
        },
      },
      elements: {
        arc: {
          borderWidth: 2,
        },
      },
    },
  })
}

// Watch for data changes
watch(
  () => props.balances,
  () => {
    createChart()
  },
  { deep: true }
)

onMounted(() => {
  createChart()
})

onUnmounted(() => {
  if (chart) {
    chart.destroy()
  }
})
</script>