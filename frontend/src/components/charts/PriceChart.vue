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
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import type { Candle } from '@/services/market'

// Register Chart.js components
Chart.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface Props {
  data: Candle[]
  symbol: string
  timeframe?: string
  width?: number
  height?: number
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  timeframe: '1h',
  width: 600,
  height: 400,
  loading: false,
})

const chartCanvas = ref<HTMLCanvasElement>()
let chart: Chart | null = null

const createChart = async () => {
  await nextTick()
  
  if (!chartCanvas.value || props.data.length === 0) return

  const ctx = chartCanvas.value.getContext('2d')
  if (!ctx) return

  // Destroy existing chart
  if (chart) {
    chart.destroy()
  }

  const labels = props.data.map(candle => 
    new Date(candle.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  )

  const prices = props.data.map(candle => candle.close)

  // Determine line color based on overall trend
  const firstPrice = prices[0]
  const lastPrice = prices[prices.length - 1]
  const isPositive = lastPrice >= firstPrice

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: `${props.symbol} Price`,
          data: prices,
          borderColor: isPositive ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)',
          backgroundColor: isPositive 
            ? 'rgba(16, 185, 129, 0.1)' 
            : 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: isPositive ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        title: {
          display: true,
          text: `${props.symbol} - ${props.timeframe}`,
          color: 'rgb(75, 85, 99)',
          font: {
            size: 16,
            weight: 'bold',
          },
        },
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: 'white',
          bodyColor: 'white',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderWidth: 1,
          callbacks: {
            label: (context) => {
              const candle = props.data[context.dataIndex]
              return [
                `Open: $${candle.open.toLocaleString()}`,
                `High: $${candle.high.toLocaleString()}`,
                `Low: $${candle.low.toLocaleString()}`,
                `Close: $${candle.close.toLocaleString()}`,
                `Volume: ${candle.volume.toLocaleString()}`,
              ]
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(0, 0, 0, 0.1)',
          },
          ticks: {
            color: 'rgb(107, 114, 128)',
            maxTicksLimit: 8,
          },
        },
        y: {
          position: 'right',
          grid: {
            color: 'rgba(0, 0, 0, 0.1)',
          },
          ticks: {
            color: 'rgb(107, 114, 128)',
            callback: (value) => `$${(value as number).toLocaleString()}`,
          },
        },
      },
      elements: {
        point: {
          hoverBorderWidth: 2,
        },
      },
    },
  })
}

// Watch for data changes
watch(
  () => [props.data, props.symbol, props.timeframe],
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