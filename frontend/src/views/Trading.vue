<template>
  <AppLayout>
    <div class="px-4 sm:px-0">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900">Trading</h1>
        <p class="text-gray-600">Place orders and manage your trades</p>
      </div>

      <!-- Trading Interface -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Order Form -->
        <div class="lg:col-span-1">
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
                placeholder="BTC/USDT"
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

              <BaseButton
                type="submit"
                :variant="orderForm.side === 'buy' ? 'success' : 'danger'"
                :loading="placingOrder"
                :disabled="exchangeStore.connectedExchanges.length === 0"
                fullWidth
              >
                {{ placingOrder ? 'Placing Order...' : `${orderForm.side === 'buy' ? 'Buy' : 'Sell'} ${orderForm.symbol}` }}
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

        <!-- Market Information -->
        <div class="lg:col-span-2">
          <div class="grid grid-cols-1 gap-6">
            <!-- Price Ticker -->
            <BaseCard title="Market Data">
              <div v-if="!selectedSymbol" class="text-center py-8 text-gray-500">
                Select a trading pair to view market data
              </div>
              <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="text-center">
                  <p class="text-sm text-gray-500">Last Price</p>
                  <p class="text-2xl font-bold text-gray-900">$42,350.00</p>
                </div>
                <div class="text-center">
                  <p class="text-sm text-gray-500">24h Change</p>
                  <p class="text-lg font-bold text-success-600">+2.34%</p>
                </div>
                <div class="text-center">
                  <p class="text-sm text-gray-500">24h High</p>
                  <p class="text-lg font-bold text-gray-900">$43,120.00</p>
                </div>
                <div class="text-center">
                  <p class="text-sm text-gray-500">24h Low</p>
                  <p class="text-lg font-bold text-gray-900">$41,850.00</p>
                </div>
              </div>
            </BaseCard>

            <!-- Order Book Preview -->
            <BaseCard title="Order Book">
              <div v-if="!selectedSymbol" class="text-center py-8 text-gray-500">
                Select a trading pair to view order book
              </div>
              <div v-else class="grid grid-cols-2 gap-4">
                <!-- Asks -->
                <div>
                  <h4 class="text-sm font-medium text-gray-700 mb-2">Asks (Sell Orders)</h4>
                  <div class="space-y-1">
                    <div v-for="i in 5" :key="`ask-${i}`" class="flex justify-between text-xs">
                      <span class="text-danger-600">{{ (42350 + i * 10).toLocaleString() }}</span>
                      <span class="text-gray-600">{{ (Math.random() * 2).toFixed(4) }}</span>
                    </div>
                  </div>
                </div>
                
                <!-- Bids -->
                <div>
                  <h4 class="text-sm font-medium text-gray-700 mb-2">Bids (Buy Orders)</h4>
                  <div class="space-y-1">
                    <div v-for="i in 5" :key="`bid-${i}`" class="flex justify-between text-xs">
                      <span class="text-success-600">{{ (42340 - i * 10).toLocaleString() }}</span>
                      <span class="text-gray-600">{{ (Math.random() * 2).toFixed(4) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </BaseCard>

            <!-- Recent Orders -->
            <BaseCard title="Your Recent Orders">
              <div class="text-center py-8 text-gray-500">
                <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                <p>No recent orders</p>
                <p class="text-sm text-gray-400 mt-1">Your trading history will appear here</p>
              </div>
            </BaseCard>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'
import { useExchangeStore } from '@/stores/exchanges'
import AppLayout from '@/components/layout/AppLayout.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import type { OrderRequest } from '@/types'

const exchangeStore = useExchangeStore()

const placingOrder = ref(false)

const orderForm = reactive<OrderRequest & { price: number; stopPrice: number }>({
  symbol: '',
  type: 'market',
  side: 'buy',
  amount: 0,
  exchange: '',
  price: 0,
  stopPrice: 0,
})

const selectedSymbol = computed(() => {
  return orderForm.symbol ? orderForm.symbol.toUpperCase() : null
})

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

  placingOrder.value = true

  try {
    // For now, just simulate the order placement
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    alert(`Order placed successfully!\n\nType: ${orderForm.type}\nSide: ${orderForm.side}\nSymbol: ${orderForm.symbol}\nAmount: ${orderForm.amount}\nExchange: ${orderForm.exchange}`)
    
    // Reset form
    orderForm.symbol = ''
    orderForm.amount = 0
    orderForm.price = 0
    orderForm.stopPrice = 0
  } catch (error) {
    alert('Failed to place order. Please try again.')
  } finally {
    placingOrder.value = false
  }
}

onMounted(async () => {
  await exchangeStore.fetchConnectedExchanges()
})
</script>