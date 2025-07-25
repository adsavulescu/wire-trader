<template>
  <AppLayout>
    <div class="px-4 sm:px-0">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p class="text-gray-600">Advanced performance metrics and trading analytics</p>
          </div>
          <div class="flex items-center space-x-4">
            <!-- Period selector -->
            <select v-model="selectedPeriod" @change="handlePeriodChange" class="input">
              <option value="day">Last 24 Hours</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="quarter">Last 3 Months</option>
              <option value="year">Last Year</option>
              <option value="all">All Time</option>
            </select>
            
            <!-- Compare toggle -->
            <BaseButton 
              @click="showCompareMode = !showCompareMode" 
              :variant="showCompareMode ? 'primary' : 'secondary'"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Compare
            </BaseButton>
            
            <!-- Refresh button -->
            <BaseButton @click="refreshData" variant="primary" :loading="loading">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </BaseButton>
          </div>
        </div>
      </div>

      <!-- Key Performance Indicators -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <BaseCard title="Total Return">
          <div class="text-center">
            <p :class="[
              'text-3xl font-bold',
              metrics.totalReturnPercent >= 0 ? 'text-success-600' : 'text-danger-600'
            ]">
              {{ metrics.totalReturnPercent >= 0 ? '+' : '' }}{{ metrics.totalReturnPercent.toFixed(2) }}%
            </p>
            <p class="text-sm text-gray-500 mt-1">
              ${{ formatCurrency(Math.abs(metrics.totalReturn)) }}
            </p>
          </div>
        </BaseCard>

        <BaseCard title="Sharpe Ratio">
          <div class="text-center">
            <p class="text-3xl font-bold text-gray-900">
              {{ metrics.sharpeRatio.toFixed(2) }}
            </p>
            <p class="text-sm text-gray-500 mt-1">Risk-adjusted return</p>
          </div>
        </BaseCard>

        <BaseCard title="Max Drawdown">
          <div class="text-center">
            <p class="text-3xl font-bold text-danger-600">
              {{ metrics.maxDrawdown.toFixed(2) }}%
            </p>
            <p class="text-sm text-gray-500 mt-1">Peak to trough</p>
          </div>
        </BaseCard>

        <BaseCard title="Win Rate">
          <div class="text-center">
            <p class="text-3xl font-bold text-success-600">
              {{ (metrics.winRate * 100).toFixed(1) }}%
            </p>
            <p class="text-sm text-gray-500 mt-1">
              {{ metrics.winningTrades }}/{{ metrics.totalTrades }} trades
            </p>
          </div>
        </BaseCard>
      </div>

      <!-- Performance Charts -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        <!-- Returns Distribution -->
        <BaseCard title="Returns Distribution">
          <div class="h-80">
            <ReturnsDistributionChart 
              :data="returnsData"
              :loading="loading"
              :height="320"
            />
          </div>
        </BaseCard>

        <!-- Monthly Returns Heatmap -->
        <BaseCard title="Monthly Returns">
          <div class="h-80">
            <MonthlyReturnsChart 
              :data="monthlyReturns"
              :loading="loading"
              :height="320"
            />
          </div>
        </BaseCard>
      </div>

      <!-- Risk Metrics -->
      <div class="mb-8">
        <BaseCard title="Risk Analysis">
          <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div class="text-center p-4 bg-gray-50 rounded-lg">
              <p class="text-sm text-gray-600">Volatility</p>
              <p class="text-lg font-bold text-gray-900">
                {{ metrics.volatility.toFixed(2) }}%
              </p>
            </div>
            <div class="text-center p-4 bg-gray-50 rounded-lg">
              <p class="text-sm text-gray-600">Value at Risk</p>
              <p class="text-lg font-bold text-danger-600">
                {{ riskMetrics.valueAtRisk.toFixed(2) }}%
              </p>
            </div>
            <div class="text-center p-4 bg-gray-50 rounded-lg">
              <p class="text-sm text-gray-600">Beta</p>
              <p class="text-lg font-bold text-gray-900">
                {{ riskMetrics.beta.toFixed(2) }}
              </p>
            </div>
            <div class="text-center p-4 bg-gray-50 rounded-lg">
              <p class="text-sm text-gray-600">Alpha</p>
              <p class="text-lg font-bold text-gray-900">
                {{ riskMetrics.alpha.toFixed(2) }}%
              </p>
            </div>
            <div class="text-center p-4 bg-gray-50 rounded-lg">
              <p class="text-sm text-gray-600">Sortino Ratio</p>
              <p class="text-lg font-bold text-gray-900">
                {{ riskMetrics.sortinoRatio.toFixed(2) }}
              </p>
            </div>
            <div class="text-center p-4 bg-gray-50 rounded-lg">
              <p class="text-sm text-gray-600">Calmar Ratio</p>
              <p class="text-lg font-bold text-gray-900">
                {{ riskMetrics.calmarRatio.toFixed(2) }}
              </p>
            </div>
          </div>
        </BaseCard>
      </div>

      <!-- Trade Analysis -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        <!-- Best/Worst Trades -->
        <BaseCard title="Trade Performance">
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="text-center p-4 bg-success-50 rounded-lg">
                <p class="text-sm text-success-700">Best Trade</p>
                <p class="text-xl font-bold text-success-600">
                  +${{ formatCurrency(metrics.bestTrade) }}
                </p>
              </div>
              <div class="text-center p-4 bg-danger-50 rounded-lg">
                <p class="text-sm text-danger-700">Worst Trade</p>
                <p class="text-xl font-bold text-danger-600">
                  -${{ formatCurrency(Math.abs(metrics.worstTrade)) }}
                </p>
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div class="text-center p-3 bg-gray-50 rounded-lg">
                <p class="text-sm text-gray-600">Avg Win</p>
                <p class="text-lg font-bold text-success-600">
                  +${{ formatCurrency(metrics.averageWin) }}
                </p>
              </div>
              <div class="text-center p-3 bg-gray-50 rounded-lg">
                <p class="text-sm text-gray-600">Avg Loss</p>
                <p class="text-lg font-bold text-danger-600">
                  -${{ formatCurrency(Math.abs(metrics.averageLoss)) }}
                </p>
              </div>
            </div>

            <div class="text-center p-3 bg-primary-50 rounded-lg">
              <p class="text-sm text-primary-700">Profit Factor</p>
              <p class="text-xl font-bold text-primary-600">
                {{ metrics.profitFactor.toFixed(2) }}
              </p>
              <p class="text-xs text-primary-600 mt-1">
                ({{ metrics.profitFactor > 1 ? 'Profitable' : 'Losing' }})
              </p>
            </div>
          </div>
        </BaseCard>

        <!-- Asset Performance -->
        <BaseCard title="Top Performing Assets">
          <div v-if="!tradeAnalysis?.topPerformers?.length" class="text-center py-8">
            <p class="text-gray-500">No trading data available</p>
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="performer in tradeAnalysis.topPerformers.slice(0, 5)"
              :key="performer.symbol"
              class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div>
                <p class="font-medium text-gray-900">{{ performer.symbol }}</p>
                <p class="text-sm text-gray-600">Trading pair</p>
              </div>
              <div class="text-right">
                <p :class="[
                  'font-bold',
                  performer.pnl >= 0 ? 'text-success-600' : 'text-danger-600'
                ]">
                  {{ performer.pnl >= 0 ? '+' : '' }}${{ formatCurrency(Math.abs(performer.pnl)) }}
                </p>
                <p :class="[
                  'text-sm',
                  performer.pnlPercent >= 0 ? 'text-success-600' : 'text-danger-600'
                ]">
                  {{ performer.pnlPercent >= 0 ? '+' : '' }}{{ performer.pnlPercent.toFixed(2) }}%
                </p>
              </div>
            </div>
          </div>
        </BaseCard>
      </div>

      <!-- Comparative Analysis (shown when compare mode is enabled) -->
      <div v-if="showCompareMode" class="mb-8">
        <BaseCard title="Comparative Analysis">
          <div class="space-y-6">
            <!-- Comparison periods selector -->
            <div class="flex items-center space-x-4">
              <label class="text-sm font-medium text-gray-700">Compare with:</label>
              <div class="flex space-x-2">
                <button
                  v-for="period in comparisonPeriods"
                  :key="period.value"
                  @click="selectedComparison = period.value"
                  :class="[
                    'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                    selectedComparison === period.value
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  ]"
                >
                  {{ period.label }}
                </button>
              </div>
            </div>

            <!-- Comparison metrics -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div class="text-center p-4 border rounded-lg">
                <p class="text-sm text-gray-600">Current Period Return</p>
                <p :class="[
                  'text-xl font-bold',
                  metrics.totalReturnPercent >= 0 ? 'text-success-600' : 'text-danger-600'
                ]">
                  {{ metrics.totalReturnPercent >= 0 ? '+' : '' }}{{ metrics.totalReturnPercent.toFixed(2) }}%
                </p>
              </div>
              <div class="text-center p-4 border rounded-lg">
                <p class="text-sm text-gray-600">Previous Period Return</p>
                <p :class="[
                  'text-xl font-bold',
                  comparisonMetrics.previousReturn >= 0 ? 'text-success-600' : 'text-danger-600'
                ]">
                  {{ comparisonMetrics.previousReturn >= 0 ? '+' : '' }}{{ comparisonMetrics.previousReturn.toFixed(2) }}%
                </p>
              </div>
              <div class="text-center p-4 border rounded-lg">
                <p class="text-sm text-gray-600">Performance Difference</p>
                <p :class="[
                  'text-xl font-bold',
                  comparisonMetrics.difference >= 0 ? 'text-success-600' : 'text-danger-600'
                ]">
                  {{ comparisonMetrics.difference >= 0 ? '+' : '' }}{{ comparisonMetrics.difference.toFixed(2) }}%
                </p>
              </div>
              <div class="text-center p-4 border rounded-lg">
                <p class="text-sm text-gray-600">Relative Performance</p>
                <p :class="[
                  'text-xl font-bold',
                  comparisonMetrics.relativePerformance >= 0 ? 'text-success-600' : 'text-danger-600'
                ]">
                  {{ comparisonMetrics.improvement ? '↗' : '↘' }} {{ Math.abs(comparisonMetrics.relativePerformance).toFixed(1) }}%
                </p>
              </div>
            </div>
          </div>
        </BaseCard>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'
import { usePortfolioStore } from '@/stores/portfolio'
import AppLayout from '@/components/layout/AppLayout.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import ReturnsDistributionChart from '@/components/analytics/ReturnsDistributionChart.vue'
import MonthlyReturnsChart from '@/components/analytics/MonthlyReturnsChart.vue'

const portfolioStore = usePortfolioStore()

const selectedPeriod = ref<'day' | 'week' | 'month' | 'quarter' | 'year' | 'all'>('month')
const showCompareMode = ref(false)
const selectedComparison = ref('previous')
const loading = ref(false)

const comparisonPeriods = [
  { value: 'previous', label: 'Previous Period' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'benchmark', label: 'Market Benchmark' },
]

// Mock data for demonstration
const metrics = reactive({
  totalReturn: 12500,
  totalReturnPercent: 15.2,
  sharpeRatio: 1.8,
  maxDrawdown: 8.5,
  winRate: 0.65,
  volatility: 18.2,
  profitFactor: 2.4,
  bestTrade: 2850,
  worstTrade: -1420,
  averageWin: 485,
  averageLoss: -280,
  totalTrades: 142,
  winningTrades: 92,
})

const riskMetrics = reactive({
  valueAtRisk: -5.2,
  beta: 1.15,
  alpha: 3.8,
  sortinoRatio: 2.1,
  calmarRatio: 1.6,
})

const tradeAnalysis = reactive({
  topPerformers: [
    { symbol: 'BTC/USDT', pnl: 3250, pnlPercent: 18.5 },
    { symbol: 'ETH/USDT', pnl: 2100, pnlPercent: 12.8 },
    { symbol: 'SOL/USDT', pnl: 1890, pnlPercent: 15.2 },
    { symbol: 'AVAX/USDT', pnl: 1420, pnlPercent: 9.8 },
    { symbol: 'DOT/USDT', pnl: 980, pnlPercent: 7.2 },
  ]
})

const comparisonMetrics = computed(() => {
  const previousReturn = selectedComparison.value === 'previous' ? 8.5 : 12.1
  const difference = metrics.totalReturnPercent - previousReturn
  const relativePerformance = (difference / Math.abs(previousReturn)) * 100
  
  return {
    previousReturn,
    difference,
    relativePerformance,
    improvement: difference >= 0
  }
})

// Mock returns data for distribution chart
const returnsData = computed(() => {
  const returns = []
  for (let i = 0; i < 100; i++) {
    returns.push({
      return: (Math.random() - 0.5) * 10, // Random returns between -5% and 5%
      frequency: Math.floor(Math.random() * 20) + 1
    })
  }
  return returns.sort((a, b) => a.return - b.return)
})

// Mock monthly returns data
const monthlyReturns = computed(() => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const years = [2022, 2023, 2024]
  
  return years.map(year => ({
    year,
    months: months.map(month => ({
      month,
      return: (Math.random() - 0.4) * 15 // Slightly positive bias
    }))
  }))
})

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const handlePeriodChange = async () => {
  await refreshData()
}

const refreshData = async () => {
  loading.value = true
  try {
    await portfolioStore.refreshAllData(selectedPeriod.value as any)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await refreshData()
})
</script>