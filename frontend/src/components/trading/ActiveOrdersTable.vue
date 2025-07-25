<template>
  <BaseCard title="Active Orders">
    <template #header>
      <div class="flex justify-between items-center">
        <h3 class="text-lg font-medium text-gray-900">Active Orders</h3>
        <div class="flex items-center space-x-2">
          <span class="text-sm text-gray-500">
            {{ tradingStore.activeOrdersCount }} active
          </span>
          <BaseButton 
            variant="secondary" 
            size="sm" 
            @click="refreshOrders"
            :loading="tradingStore.loading"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </BaseButton>
        </div>
      </div>
    </template>

    <div v-if="tradingStore.loading && tradingStore.activeOrders.length === 0" class="text-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
      <p class="text-gray-500 mt-2">Loading orders...</p>
    </div>

    <div v-else-if="tradingStore.activeOrders.length === 0" class="text-center py-8">
      <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
      <p class="text-gray-500">No active orders</p>
      <p class="text-sm text-gray-400 mt-1">Your open orders will appear here</p>
    </div>

    <div v-else class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Symbol
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Side
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Amount
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Price
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Filled
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Exchange
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="order in tradingStore.activeOrders" :key="order.id" class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
              {{ order.symbol }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
              {{ order.type }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
              <span :class="[
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                order.side === 'buy' 
                  ? 'bg-success-100 text-success-800' 
                  : 'bg-danger-100 text-danger-800'
              ]">
                {{ order.side.toUpperCase() }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
              {{ formatNumber(order.amount) }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
              {{ order.price ? `$${formatCurrency(order.price)}` : 'Market' }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
              <div class="flex items-center">
                <span class="mr-2">{{ formatNumber(order.filled) }}</span>
                <div class="w-16 bg-gray-200 rounded-full h-2">
                  <div 
                    class="bg-primary-500 h-2 rounded-full transition-all duration-300"
                    :style="{ width: `${(order.filled / order.amount) * 100}%` }"
                  ></div>
                </div>
                <span class="ml-2 text-xs text-gray-500">
                  {{ Math.round((order.filled / order.amount) * 100) }}%
                </span>
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
              <span :class="[
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                getStatusColor(order.status)
              ]">
                {{ order.status.toUpperCase() }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
              {{ order.exchange }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
              <BaseButton
                variant="danger"
                size="sm"
                @click="handleCancelOrder(order)"
                :loading="cancelingOrders.has(order.id)"
                :disabled="order.status !== 'open' && order.status !== 'pending'"
              >
                Cancel
              </BaseButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Error Display -->
    <div v-if="tradingStore.error" class="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
      <div class="flex">
        <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <div class="ml-3">
          <p class="text-sm text-red-600">{{ tradingStore.error }}</p>
        </div>
        <div class="ml-auto">
          <button @click="tradingStore.clearError" class="text-red-400 hover:text-red-600">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useTradingStore } from '@/stores/trading'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import type { Order } from '@/types'

const tradingStore = useTradingStore()
const cancelingOrders = ref(new Set<string>())

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(value)
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const getStatusColor = (status: Order['status']): string => {
  switch (status) {
    case 'open':
      return 'bg-blue-100 text-blue-800'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'closed':
      return 'bg-success-100 text-success-800'
    case 'canceled':
      return 'bg-gray-100 text-gray-800'
    case 'failed':
      return 'bg-danger-100 text-danger-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const refreshOrders = async () => {
  await tradingStore.fetchActiveOrders()
}

const handleCancelOrder = async (order: Order) => {
  if (!confirm(`Are you sure you want to cancel the ${order.side} order for ${order.amount} ${order.symbol}?`)) {
    return
  }

  cancelingOrders.value.add(order.id)
  
  try {
    const success = await tradingStore.cancelOrder(order.id)
    if (success) {
      // Show success message (in a real app, use a toast notification)
      console.log('Order canceled successfully')
    }
  } finally {
    cancelingOrders.value.delete(order.id)
  }
}

onMounted(async () => {
  await refreshOrders()
})
</script>