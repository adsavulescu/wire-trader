<template>
  <AppLayout>
    <div class="px-4 sm:px-0">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p class="text-gray-600">Welcome back, {{ authStore.userFullName }}</p>
      </div>

      <!-- Portfolio Overview -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <BaseCard>
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
            <div class="ml-4">
              <p class="text-sm text-gray-500">Total Portfolio</p>
              <p class="text-2xl font-bold text-gray-900">
                ${{ formatCurrency(exchangeStore.totalPortfolioValue) }}
              </p>
            </div>
          </div>
        </BaseCard>

        <BaseCard>
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-success-500 rounded-lg flex items-center justify-center">
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <div class="ml-4">
              <p class="text-sm text-gray-500">24h P&L</p>
              <p class="text-2xl font-bold text-success-600">+$1,234.56</p>
            </div>
          </div>
        </BaseCard>

        <BaseCard>
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <div class="ml-4">
              <p class="text-sm text-gray-500">Active Trades</p>
              <p class="text-2xl font-bold text-gray-900">5</p>
            </div>
          </div>
        </BaseCard>

        <BaseCard>
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
            <div class="ml-4">
              <p class="text-sm text-gray-500">Connected Exchanges</p>
              <p class="text-2xl font-bold text-gray-900">{{ exchangeStore.connectedExchanges.length }}</p>
            </div>
          </div>
        </BaseCard>
      </div>

      <!-- Quick Actions -->
      <div class="mb-8">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <BaseButton @click="$router.push('/trading')" class="h-16">
            <div class="flex flex-col items-center">
              <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span class="text-sm">Start Trading</span>
            </div>
          </BaseButton>
          
          <BaseButton variant="secondary" @click="$router.push('/exchanges')" class="h-16">
            <div class="flex flex-col items-center">
              <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span class="text-sm">Manage Exchanges</span>
            </div>
          </BaseButton>
          
          <BaseButton variant="secondary" @click="refreshData" :loading="exchangeStore.loading" class="h-16">
            <div class="flex flex-col items-center">
              <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span class="text-sm">Refresh Data</span>
            </div>
          </BaseButton>
          
          <BaseButton variant="secondary" disabled class="h-16">
            <div class="flex flex-col items-center">
              <svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span class="text-sm">Analytics</span>
            </div>
          </BaseButton>
        </div>
      </div>

      <!-- Portfolio Breakdown -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Portfolio Chart -->
        <BaseCard title="Portfolio Allocation">
          <div class="h-80">
            <PortfolioChart :balances="exchangeStore.balances" :loading="exchangeStore.loading" />
          </div>
        </BaseCard>

        <!-- Portfolio Balances -->
        <BaseCard title="Portfolio Balances">
          <div v-if="exchangeStore.loading" class="text-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
            <p class="text-gray-500 mt-2">Loading balances...</p>
          </div>
          
          <div v-else-if="exchangeStore.balances.length === 0" class="text-center py-8">
            <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p class="text-gray-500">No balances found</p>
            <p class="text-sm text-gray-400 mt-1">Connect an exchange to see your balances</p>
            <BaseButton variant="primary" size="sm" class="mt-4" @click="$router.push('/exchanges')">
              Connect Exchange
            </BaseButton>
          </div>
          
          <div v-else class="space-y-4 max-h-80 overflow-y-auto">
            <div
              v-for="balance in exchangeStore.balances.filter(b => b.total > 0)"
              :key="`${balance.exchange}-${balance.currency}`"
              class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div class="flex items-center">
                <div class="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                  <span class="text-xs font-bold text-primary-600">{{ balance.currency.slice(0, 2) }}</span>
                </div>
                <div>
                  <p class="font-medium text-gray-900">{{ balance.currency }}</p>
                  <p class="text-sm text-gray-500">{{ balance.exchange }}</p>
                </div>
              </div>
              <div class="text-right">
                <p class="font-medium text-gray-900">{{ formatNumber(balance.total) }}</p>
                <p class="text-sm text-gray-500">${{ formatCurrency(balance.total) }}</p>
              </div>
            </div>
          </div>
        </BaseCard>

        <!-- Connected Exchanges -->
        <BaseCard title="Connected Exchanges">
          <div v-if="exchangeStore.connectedExchanges.length === 0" class="text-center py-8">
            <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
            </svg>
            <p class="text-gray-500">No exchanges connected</p>
            <p class="text-sm text-gray-400 mt-1">Connect your first exchange to start trading</p>
            <BaseButton variant="primary" size="sm" class="mt-4" @click="$router.push('/exchanges')">
              Connect Exchange
            </BaseButton>
          </div>
          
          <div v-else class="space-y-4 max-h-80 overflow-y-auto">
            <div
              v-for="exchange in exchangeStore.connectedExchanges"
              :key="exchange.name"
              class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div class="flex items-center">
                <div class="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mr-3">
                  <span class="text-sm font-bold text-primary-600 capitalize">{{ exchange.name.slice(0, 2) }}</span>
                </div>
                <div>
                  <p class="font-medium text-gray-900 capitalize">{{ exchange.name }}</p>
                  <p class="text-sm text-gray-500">{{ exchange.sandbox ? 'Sandbox' : 'Live' }}</p>
                </div>
              </div>
              <div class="flex items-center">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                  Connected
                </span>
              </div>
            </div>
          </div>
        </BaseCard>
      </div>

      <!-- Active Orders Summary -->
      <div v-if="tradingStore.activeOrdersCount > 0" class="mt-8">
        <BaseCard title="Recent Active Orders">
          <div class="space-y-3">
            <div
              v-for="order in tradingStore.activeOrders.slice(0, 5)"
              :key="order.id"
              class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div class="flex items-center space-x-3">
                <span :class="[
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  order.side === 'buy' ? 'bg-success-100 text-success-800' : 'bg-danger-100 text-danger-800'
                ]">
                  {{ order.side.toUpperCase() }}
                </span>
                <div>
                  <p class="font-medium text-gray-900">{{ order.symbol }}</p>
                  <p class="text-sm text-gray-500">{{ order.exchange }} • {{ order.type }}</p>
                </div>
              </div>
              <div class="text-right">
                <p class="font-medium text-gray-900">{{ formatNumber(order.amount) }}</p>
                <p class="text-sm text-gray-500">
                  {{ order.price ? `$${formatCurrency(order.price)}` : 'Market' }}
                </p>
              </div>
            </div>
            <div v-if="tradingStore.activeOrdersCount > 5" class="text-center pt-2">
              <BaseButton variant="secondary" size="sm" @click="$router.push('/trading')">
                View All {{ tradingStore.activeOrdersCount }} Orders
              </BaseButton>
            </div>
          </div>
        </BaseCard>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useExchangeStore } from '@/stores/exchanges'
import { useTradingStore } from '@/stores/trading'
import AppLayout from '@/components/layout/AppLayout.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import PortfolioChart from '@/components/charts/PortfolioChart.vue'

const authStore = useAuthStore()
const exchangeStore = useExchangeStore()
const tradingStore = useTradingStore()

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(value)
}

const refreshData = async () => {
  await Promise.all([
    exchangeStore.fetchConnectedExchanges(),
    exchangeStore.fetchBalances(),
    tradingStore.fetchActiveOrders(),
  ])
}

onMounted(async () => {
  await refreshData()
})
</script>