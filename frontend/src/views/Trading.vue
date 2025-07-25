<template>
  <AppLayout>
    <div class="px-4 sm:px-0">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Trading</h1>
            <p class="text-gray-600">Place orders and manage your trades</p>
          </div>
          <div class="flex items-center space-x-4">
            <div class="text-sm text-gray-500">
              Active Orders: <span class="font-semibold text-gray-900">{{ tradingStore.activeOrdersCount }}</span>
            </div>
            <div class="text-sm text-gray-500">
              Open Value: <span class="font-semibold text-gray-900">${{ formatCurrency(tradingStore.openOrdersValue) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Trading Interface -->
      <div class="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <!-- Order Form -->
        <div class="xl:col-span-1">
          <BaseCard title="Place Order">
            <form @submit.prevent="handlePlaceOrder" class="space-y-4">
              <!-- Exchange Selection -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Exchange</label>
                <select v-model="orderForm.exchange" class="input" required>
                  <option value="">Select exchange</option>
                  <option
                    v-for="exchange in exchangeStore.connectedExchanges"
                    :key="exchange.name"
                    :value="exchange.name"
                  >
                    {{ exchange.name.charAt(0).toUpperCase() + exchange.name.slice(1) }}
                  </option>
                </select>
              </div>

              <!-- Symbol Input -->
              <BaseInput
                v-model="orderForm.symbol"
                label="Trading Pair"
                :placeholder="selectedSymbol || 'BTC/USDT'"
                required
                hint="Enter symbol in format: BTC/USDT"
              />

              <!-- Order Type -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Order Type</label>
                <select v-model="orderForm.type" class="input" required>
                  <option value="market">Market</option>
                  <option value="limit">Limit</option>
                  <option value="stop">Stop</option>
                </select>
              </div>

              <!-- Side Selection -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Side</label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    @click="orderForm.side = 'buy'"
                    :class="[
                      'px-4 py-2 rounded-lg border-2 font-medium transition-colors',
                      orderForm.side === 'buy'
                        ? 'border-success-500 bg-success-50 text-success-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    ]"
                  >
                    Buy
                  </button>
                  <button
                    type="button"
                    @click="orderForm.side = 'sell'"
                    :class="[
                      'px-4 py-2 rounded-lg border-2 font-medium transition-colors',
                      orderForm.side === 'sell'
                        ? 'border-danger-500 bg-danger-50 text-danger-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    ]"
                  >
                    Sell
                  </button>
                </div>
              </div>

              <!-- Amount -->
              <BaseInput
                v-model="orderForm.amount"
                type="number"
                step="0.00000001"
                label="Amount"
                placeholder="0.001"
                required
              />

              <!-- Price (for limit orders) -->
              <BaseInput
                v-if="orderForm.type === 'limit'"
                v-model="orderForm.price"
                type="number"
                step="0.01"
                label="Price"
                placeholder="50000.00"
                required
              />

              <!-- Stop Price (for stop orders) -->
              <BaseInput
                v-if="orderForm.type === 'stop'"
                v-model="orderForm.stopPrice"
                type="number"
                step="0.01"
                label="Stop Price"
                placeholder="48000.00"
                required
              />

              <!-- Quick Amount Buttons -->
              <div class="grid grid-cols-4 gap-2">
                <button
                  v-for="percentage in [25, 50, 75, 100]"
                  :key="percentage"
                  type="button"
                  @click="setAmountPercentage(percentage)"
                  class="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  {{ percentage }}%
                </button>
              </div>

              <BaseButton
                type="submit"
                :variant="orderForm.side === 'buy' ? 'success' : 'danger'"
                :loading="tradingStore.loading"
                :disabled="exchangeStore.connectedExchanges.length === 0"
                fullWidth
              >
                {{ tradingStore.loading ? 'Placing Order...' : `${orderForm.side === 'buy' ? 'Buy' : 'Sell'} ${orderForm.symbol || 'Asset'}` }}
              </BaseButton>
            </form>

            <div v-if="exchangeStore.connectedExchanges.length === 0" class="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p class="text-sm text-yellow-700">
                No exchanges connected. 
                <router-link to="/exchanges" class="font-medium underline">Connect an exchange</router-link> 
                to start trading.
              </p>
            </div>
          </BaseCard>
        </div>

        <!-- Market Data Panel -->
        <div class="xl:col-span-3">
          <MarketDataPanel @symbol-selected="handleSymbolSelected" />
        </div>
      </div>

      <!-- Active Orders Table -->
      <div class="mt-8">
        <ActiveOrdersTable />
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useExchangeStore } from '@/stores/exchanges'
import { useTradingStore } from '@/stores/trading'
import AppLayout from '@/components/layout/AppLayout.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import MarketDataPanel from '@/components/trading/MarketDataPanel.vue'
import ActiveOrdersTable from '@/components/trading/ActiveOrdersTable.vue'
import type { OrderRequest } from '@/types'

const exchangeStore = useExchangeStore()
const tradingStore = useTradingStore()

const selectedSymbol = ref('')

const orderForm = reactive<OrderRequest & { price: number; stopPrice: number }>({
  symbol: '',
  type: 'market',
  side: 'buy',
  amount: 0,
  exchange: '',
  price: 0,
  stopPrice: 0,
})

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const handleSymbolSelected = (symbol: string) => {
  selectedSymbol.value = symbol
  orderForm.symbol = symbol
}

const setAmountPercentage = (percentage: number) => {
  // This would calculate based on available balance
  // For now, just set a placeholder amount
  const baseAmount = 0.1
  orderForm.amount = (baseAmount * percentage) / 100
}

const handlePlaceOrder = async () => {
  if (!orderForm.exchange) {
    alert('Please select an exchange')
    return
  }

  if (!orderForm.symbol) {
    alert('Please enter a trading pair')
    return
  }

  if (!orderForm.amount || orderForm.amount <= 0) {
    alert('Please enter a valid amount')
    return
  }

  if (orderForm.type === 'limit' && (!orderForm.price || orderForm.price <= 0)) {
    alert('Please enter a valid price for limit order')
    return
  }

  if (orderForm.type === 'stop' && (!orderForm.stopPrice || orderForm.stopPrice <= 0)) {
    alert('Please enter a valid stop price for stop order')
    return
  }

  // Prepare order request
  const orderRequest: OrderRequest = {
    symbol: orderForm.symbol,
    type: orderForm.type,
    side: orderForm.side,
    amount: orderForm.amount,
    exchange: orderForm.exchange,
    ...(orderForm.type === 'limit' && { price: orderForm.price }),
    ...(orderForm.type === 'stop' && { stopPrice: orderForm.stopPrice }),
  }

  const result = await tradingStore.placeOrder(orderRequest)
  
  if (result.success) {
    alert(`Order placed successfully!\n\nType: ${orderForm.type}\nSide: ${orderForm.side}\nSymbol: ${orderForm.symbol}\nAmount: ${orderForm.amount}\nExchange: ${orderForm.exchange}`)
    
    // Reset form
    orderForm.amount = 0
    orderForm.price = 0
    orderForm.stopPrice = 0
  } else {
    alert(`Failed to place order: ${result.error}`)
  }
}

onMounted(async () => {
  await Promise.all([
    exchangeStore.fetchConnectedExchanges(),
    tradingStore.fetchActiveOrders(),
  ])
})
</script>