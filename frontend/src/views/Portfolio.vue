<template>
  <AppLayout>
    <div class="px-4 sm:px-0">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Portfolio Management</h1>
            <p class="text-gray-600">Monitor your portfolio performance and analytics</p>
          </div>
          <div class="flex items-center space-x-4">
            <!-- Timeframe selector -->
            <select v-model="selectedTimeframe" @change="handleTimeframeChange" class="input">
              <option value="day">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="all">All Time</option>
            </select>
            
            <!-- Export button -->
            <BaseButton @click="showExportModal = true" variant="secondary">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </BaseButton>
            
            <!-- Refresh button -->
            <BaseButton @click="refreshData" variant="primary" :loading="portfolioStore.loading">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </BaseButton>
          </div>
        </div>
      </div>

      <!-- Portfolio Overview -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <BaseCard title="Total Value">
          <div class="text-center">
            <p class="text-3xl font-bold text-gray-900">
              ${{ formatCurrency(portfolioStore.totalValue) }}
            </p>
            <p class="text-sm text-gray-500 mt-1">Portfolio Value</p>
          </div>
        </BaseCard>

        <BaseCard title="Total P&L">
          <div class="text-center">
            <p :class="[
              'text-3xl font-bold',
              portfolioStore.totalPnL >= 0 ? 'text-success-600' : 'text-danger-600'
            ]">
              {{ portfolioStore.totalPnL >= 0 ? '+' : '' }}${{ formatCurrency(Math.abs(portfolioStore.totalPnL)) }}
            </p>
            <p :class="[
              'text-sm mt-1',
              portfolioStore.totalPnLPercent >= 0 ? 'text-success-600' : 'text-danger-600'
            ]">
              {{ portfolioStore.totalPnLPercent >= 0 ? '+' : '' }}{{ portfolioStore.totalPnLPercent.toFixed(2) }}%
            </p>
          </div>
        </BaseCard>

        <BaseCard title="Daily P&L">
          <div class="text-center">
            <p :class="[
              'text-3xl font-bold',
              portfolioStore.dailyPnL >= 0 ? 'text-success-600' : 'text-danger-600'
            ]">
              {{ portfolioStore.dailyPnL >= 0 ? '+' : '' }}${{ formatCurrency(Math.abs(portfolioStore.dailyPnL)) }}
            </p>
            <p :class="[
              'text-sm mt-1',
              portfolioStore.dailyPnLPercent >= 0 ? 'text-success-600' : 'text-danger-600'
            ]">
              {{ portfolioStore.dailyPnLPercent >= 0 ? '+' : '' }}{{ portfolioStore.dailyPnLPercent.toFixed(2) }}%
            </p>
          </div>
        </BaseCard>

        <BaseCard title="Portfolio Health">
          <div class="text-center">
            <div :class="[
              'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
              portfolioStore.isPortfolioHealthy ? 'bg-success-100 text-success-800' : 'bg-danger-100 text-danger-800'
            ]">
              <svg :class="[
                'w-4 h-4 mr-1',
                portfolioStore.isPortfolioHealthy ? 'text-success-500' : 'text-danger-500'
              ]" fill="currentColor" viewBox="0 0 20 20">
                <path v-if="portfolioStore.isPortfolioHealthy" fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                <path v-else fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
              {{ portfolioStore.isPortfolioHealthy ? 'Healthy' : 'Needs Attention' }}
            </div>
            <p class="text-xs text-gray-500 mt-2">
              Risk Level: {{ portfolioStore.riskLevel.charAt(0).toUpperCase() + portfolioStore.riskLevel.slice(1) }}
            </p>
          </div>
        </BaseCard>
      </div>

      <!-- Performance Chart -->
      <div class="mb-8">
        <BaseCard title="Portfolio Performance">
          <div class="h-96">
            <PortfolioChart 
              :data="portfolioStore.portfolioPerformance"
              :loading="portfolioStore.loading"
              :height="384"
            />
          </div>
        </BaseCard>
      </div>

      <!-- Asset Allocation and Performance Metrics -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        <!-- Asset Allocation -->
        <BaseCard title="Asset Allocation">
          <div v-if="portfolioStore.allocation.length === 0" class="text-center py-8">
            <p class="text-gray-500">No assets in portfolio</p>
          </div>
          <div v-else class="space-y-4">
            <div
              v-for="asset in portfolioStore.topAssets"
              :key="asset.currency"
              class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <span class="text-xs font-bold text-primary-600">{{ asset.currency.slice(0, 2) }}</span>
                </div>
                <div>
                  <p class="font-medium text-gray-900">{{ asset.currency }}</p>
                  <p class="text-sm text-gray-500">${{ formatCurrency(asset.value) }}</p>
                </div>
              </div>
              <div class="text-right">
                <p class="font-medium text-gray-900">{{ asset.percentage.toFixed(1) }}%</p>
                <p :class="[
                  'text-sm',
                  asset.change24hPercent >= 0 ? 'text-success-600' : 'text-danger-600'
                ]">
                  {{ asset.change24hPercent >= 0 ? '+' : '' }}{{ asset.change24hPercent.toFixed(2) }}%
                </p>
              </div>
            </div>
          </div>
        </BaseCard>

        <!-- Performance Metrics -->
        <BaseCard title="Performance Metrics">
          <div v-if="!portfolioStore.metrics" class="text-center py-8">
            <p class="text-gray-500">Loading metrics...</p>
          </div>
          <div v-else class="grid grid-cols-2 gap-4">
            <div class="text-center p-3 bg-gray-50 rounded-lg">
              <p class="text-sm text-gray-600">Sharpe Ratio</p>
              <p class="text-lg font-bold text-gray-900">
                {{ portfolioStore.metrics.sharpeRatio.toFixed(2) }}
              </p>
            </div>
            <div class="text-center p-3 bg-gray-50 rounded-lg">
              <p class="text-sm text-gray-600">Max Drawdown</p>
              <p class="text-lg font-bold text-danger-600">
                {{ portfolioStore.metrics.maxDrawdown.toFixed(2) }}%
              </p>
            </div>
            <div class="text-center p-3 bg-gray-50 rounded-lg">
              <p class="text-sm text-gray-600">Win Rate</p>
              <p class="text-lg font-bold text-success-600">
                {{ (portfolioStore.metrics.winRate * 100).toFixed(1) }}%
              </p>
            </div>
            <div class="text-center p-3 bg-gray-50 rounded-lg">
              <p class="text-sm text-gray-600">Profit Factor</p>
              <p class="text-lg font-bold text-gray-900">
                {{ portfolioStore.metrics.profitFactor.toFixed(2) }}
              </p>
            </div>
            <div class="text-center p-3 bg-gray-50 rounded-lg">
              <p class="text-sm text-gray-600">Total Trades</p>
              <p class="text-lg font-bold text-gray-900">
                {{ portfolioStore.metrics.totalTrades }}
              </p>
            </div>
            <div class="text-center p-3 bg-gray-50 rounded-lg">
              <p class="text-sm text-gray-600">Volatility</p>
              <p class="text-lg font-bold text-gray-900">
                {{ portfolioStore.metrics.volatility.toFixed(2) }}%
              </p>
            </div>
          </div>
        </BaseCard>
      </div>

      <!-- Top Gainers and Losers -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        <!-- Top Gainers -->
        <BaseCard title="Top Gainers (24h)">
          <div v-if="portfolioStore.topGainers.length === 0" class="text-center py-8">
            <p class="text-gray-500">No gainers today</p>
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="asset in portfolioStore.topGainers"
              :key="asset.currency"
              class="flex items-center justify-between p-3 bg-success-50 rounded-lg"
            >
              <div>
                <p class="font-medium text-gray-900">{{ asset.currency }}</p>
                <p class="text-sm text-gray-600">${{ formatCurrency(asset.value) }}</p>
              </div>
              <div class="text-right">
                <p class="font-bold text-success-600">
                  +${{ formatCurrency(asset.change24h) }}
                </p>
                <p class="text-sm text-success-600">
                  +{{ asset.change24hPercent.toFixed(2) }}%
                </p>
              </div>
            </div>
          </div>
        </BaseCard>

        <!-- Top Losers -->
        <BaseCard title="Top Losers (24h)">
          <div v-if="portfolioStore.topLosers.length === 0" class="text-center py-8">
            <p class="text-gray-500">No losers today</p>
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="asset in portfolioStore.topLosers"
              :key="asset.currency"
              class="flex items-center justify-between p-3 bg-danger-50 rounded-lg"
            >
              <div>
                <p class="font-medium text-gray-900">{{ asset.currency }}</p>
                <p class="text-sm text-gray-600">${{ formatCurrency(asset.value) }}</p>
              </div>
              <div class="text-right">
                <p class="font-bold text-danger-600">
                  -${{ formatCurrency(Math.abs(asset.change24h)) }}
                </p>
                <p class="text-sm text-danger-600">
                  {{ asset.change24hPercent.toFixed(2) }}%
                </p>
              </div>
            </div>
          </div>
        </BaseCard>
      </div>

      <!-- Risk Analysis -->
      <div v-if="portfolioStore.riskMetrics" class="mb-8">
        <BaseCard title="Risk Analysis">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="text-center p-4 bg-gray-50 rounded-lg">
              <p class="text-sm text-gray-600">Value at Risk</p>
              <p class="text-lg font-bold text-danger-600">
                {{ portfolioStore.riskMetrics.valueAtRisk.toFixed(2) }}%
              </p>
            </div>
            <div class="text-center p-4 bg-gray-50 rounded-lg">
              <p class="text-sm text-gray-600">Beta</p>
              <p class="text-lg font-bold text-gray-900">
                {{ portfolioStore.riskMetrics.beta.toFixed(2) }}
              </p>
            </div>
            <div class="text-center p-4 bg-gray-50 rounded-lg">
              <p class="text-sm text-gray-600">Alpha</p>
              <p class="text-lg font-bold text-gray-900">
                {{ portfolioStore.riskMetrics.alpha.toFixed(2) }}%
              </p>
            </div>
            <div class="text-center p-4 bg-gray-50 rounded-lg">
              <p class="text-sm text-gray-600">Sortino Ratio</p>
              <p class="text-lg font-bold text-gray-900">
                {{ portfolioStore.riskMetrics.sortinoRatio.toFixed(2) }}
              </p>
            </div>
          </div>
        </BaseCard>
      </div>

      <!-- Portfolio Insights -->
      <div v-if="portfolioStore.insights" class="mb-8">
        <BaseCard title="Portfolio Insights">
          <div class="space-y-4">
            <!-- Insights -->
            <div v-if="portfolioStore.insights.insights?.length > 0">
              <h4 class="text-sm font-medium text-gray-700 mb-3">Recommendations</h4>
              <div class="space-y-3">
                <div
                  v-for="(insight, index) in portfolioStore.insights.insights"
                  :key="index"
                  :class="[
                    'p-4 rounded-lg border-l-4',
                    insight.type === 'success' ? 'bg-success-50 border-success-400' :
                    insight.type === 'warning' ? 'bg-yellow-50 border-yellow-400' :
                    'bg-blue-50 border-blue-400'
                  ]"
                >
                  <h5 class="font-medium text-gray-900">{{ insight.title }}</h5>
                  <p class="text-sm text-gray-600 mt-1">{{ insight.description }}</p>
                  <p v-if="insight.recommendation" class="text-sm font-medium text-gray-900 mt-2">
                    Recommendation: {{ insight.recommendation }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Alerts -->
            <div v-if="portfolioStore.insights.alerts?.length > 0" class="mt-6">
              <h4 class="text-sm font-medium text-gray-700 mb-3">Active Alerts</h4>
              <div class="space-y-2">
                <div
                  v-for="(alert, index) in portfolioStore.insights.alerts"
                  :key="index"
                  :class="[
                    'p-3 rounded-lg flex items-start space-x-3',
                    alert.severity === 'high' ? 'bg-danger-50' :
                    alert.severity === 'medium' ? 'bg-yellow-50' :
                    'bg-blue-50'
                  ]"
                >
                  <svg :class="[
                    'w-5 h-5 mt-0.5',
                    alert.severity === 'high' ? 'text-danger-500' :
                    alert.severity === 'medium' ? 'text-yellow-500' :
                    'text-blue-500'
                  ]" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-900">{{ alert.message }}</p>
                    <p class="text-xs text-gray-500 mt-1">
                      {{ new Date(alert.timestamp).toLocaleDateString() }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </BaseCard>
      </div>

      <!-- Export Modal -->
      <BaseModal v-model="showExportModal" title="Export Portfolio Data">
        <form @submit.prevent="handleExport" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
            <select v-model="exportForm.format" class="input" required>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="pdf">PDF Report</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <BaseInput
              v-model="exportForm.startDate"
              type="date"
              label="Start Date"
            />
            <BaseInput
              v-model="exportForm.endDate"
              type="date"
              label="End Date"
            />
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700">Include Data</label>
            <div class="space-y-2">
              <label class="flex items-center">
                <input type="checkbox" v-model="exportForm.includeMetrics" class="mr-2">
                <span class="text-sm text-gray-700">Performance Metrics</span>
              </label>
              <label class="flex items-center">
                <input type="checkbox" v-model="exportForm.includeHistory" class="mr-2">
                <span class="text-sm text-gray-700">Portfolio History</span>
              </label>
              <label class="flex items-center">
                <input type="checkbox" v-model="exportForm.includeTrades" class="mr-2">
                <span class="text-sm text-gray-700">Trade History</span>
              </label>
            </div>
          </div>

          <div class="flex justify-end space-x-3">
            <BaseButton variant="secondary" @click="showExportModal = false">
              Cancel
            </BaseButton>
            <BaseButton
              type="submit"
              variant="primary"
              :loading="portfolioStore.loading"
            >
              Export
            </BaseButton>
          </div>
        </form>
      </BaseModal>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { usePortfolioStore } from '@/stores/portfolio'
import AppLayout from '@/components/layout/AppLayout.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import PortfolioChart from '@/components/portfolio/PortfolioChart.vue'

const portfolioStore = usePortfolioStore()

const selectedTimeframe = ref<'day' | 'week' | 'month' | 'year' | 'all'>('all')
const showExportModal = ref(false)

const exportForm = reactive({
  format: 'csv' as 'csv' | 'json' | 'pdf',
  startDate: '',
  endDate: '',
  includeMetrics: true,
  includeHistory: true,
  includeTrades: false,
})

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const handleTimeframeChange = async () => {
  await refreshData()
}

const refreshData = async () => {
  await portfolioStore.refreshAllData(selectedTimeframe.value)
}

const handleExport = async () => {
  const success = await portfolioStore.exportPortfolio(exportForm.format, {
    startDate: exportForm.startDate || undefined,
    endDate: exportForm.endDate || undefined,
    includeMetrics: exportForm.includeMetrics,
    includeHistory: exportForm.includeHistory,
    includeTrades: exportForm.includeTrades,
  })

  if (success) {
    showExportModal.value = false
  }
}

onMounted(async () => {
  await refreshData()
})
</script>