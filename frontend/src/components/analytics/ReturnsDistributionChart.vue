<template>
  <div class="relative w-full" :style="{ height: `${height}px` }">
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80">
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
        <p class="text-gray-500 mt-2">Loading distribution...</p>
      </div>
    </div>
    
    <div v-else-if="!data || data.length === 0" class="absolute inset-0 flex items-center justify-center">
      <div class="text-center">
        <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p class="text-gray-500">No returns data available</p>
      </div>
    </div>
    
    <canvas 
      v-else
      ref="chartCanvas" 
      :width="canvasWidth" 
      :height="canvasHeight"
      class="w-full h-full"
    ></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'

// Register Chart.js components
Chart.register(...registerables)

interface ReturnsDataPoint {
  return: number
  frequency: number
}

interface Props {
  data: ReturnsDataPoint[]
  loading?: boolean
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  height: 320
})

const chartCanvas = ref<HTMLCanvasElement>()
const canvasWidth = ref(800)
const canvasHeight = ref(320)
let chartInstance: Chart | null = null
let resizeObserver: ResizeObserver | null = null

const updateCanvasSize = () => {
  if (chartCanvas.value) {
    const container = chartCanvas.value.parentElement
    if (container) {
      canvasWidth.value = container.clientWidth
      canvasHeight.value = props.height
    }
  }
}

const createChart = () => {
  if (!chartCanvas.value || !props.data.length) return

  const ctx = chartCanvas.value.getContext('2d')
  if (!ctx) return

  // Destroy existing chart
  if (chartInstance) {
    chartInstance.destroy()
  }

  const labels = props.data.map(item => `${item.return.toFixed(1)}%`)
  const frequencies = props.data.map(item => item.frequency)

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Frequency',
          data: frequencies,
          backgroundColor: props.data.map(item => 
            item.return >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'
          ),
          borderColor: props.data.map(item => 
            item.return >= 0 ? 'rgba(16, 185, 129, 1)' : 'rgba(239, 68, 68, 1)'
          ),
          borderWidth: 1,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            title: function(context) {
              const dataIndex = context[0].dataIndex
              return `Return: ${props.data[dataIndex].return.toFixed(1)}%`
            },
            label: function(context) {
              return `Frequency: ${context.parsed.y}`
            }
          }
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Return (%)'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          },
          ticks: {
            maxTicksLimit: 10
          }
        },
        y: {
          display: true,
          title: {
            display: true,
            text: 'Frequency'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          },
          beginAtZero: true
        }
      }
    }
  })
}

watch(() => props.data, () => {
  nextTick(() => {
    createChart()
  })
}, { deep: true })

watch(() => props.loading, (newLoading) => {
  if (!newLoading && props.data.length > 0) {
    nextTick(() => {
      createChart()
    })
  }
})

onMounted(() => {
  updateCanvasSize()
  
  // Set up resize observer
  if (window.ResizeObserver) {
    resizeObserver = new ResizeObserver(() => {
      updateCanvasSize()
      if (chartInstance && props.data.length > 0) {
        nextTick(() => {
          createChart()
        })
      }
    })
    
    if (chartCanvas.value?.parentElement) {
      resizeObserver.observe(chartCanvas.value.parentElement)
    }
  }
  
  if (!props.loading && props.data.length > 0) {
    nextTick(() => {
      createChart()
    })
  }
})

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy()
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})
</script>