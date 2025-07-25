<template>
  <div class="space-y-6">
    <!-- Symbol Search -->
    <div class="relative">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search trading pairs (e.g., BTC/USDT)"
        class="input pr-10"
        @input="handleSearchInput"
      />
      <svg class="absolute right-3 top-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      
      <!-- Search Results -->
      <div v-if="searchResults.length > 0" class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
        <button
          v-for="symbol in searchResults"
          :key="symbol"
          @click="selectSymbol(symbol)"
          class="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
        >
          {{ symbol }}
        </button>
      </div>
    </div>

    <!-- Current Symbol Info -->
    <BaseCard v-if="selectedSymbol" :title="`${selectedSymbol} Market Data`">
      <div v-if="loadingTicker" class="text-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
        <p class="text-gray-500 mt-2">Loading market data...</p>
      </div>
      
      <div v-else-if="currentTicker" class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="text-center">
          <p class="text-sm text-gray-500">Last Price</p>
          <p class="text-2xl font-bold" :class="priceChangeColor">
            ${{ formatCurrency(currentTicker.last) }}
          </p>
        </div>
        <div class="text-center">
          <p class="text-sm text-gray-500">24h Change</p>
          <p class="text-lg font-bold" :class="priceChangeColor">
            {{ currentTicker.changePercent > 0 ? '+' : '' }}{{ currentTicker.changePercent.toFixed(2) }}%
          </p>
          <p class="text-sm" :class="priceChangeColor">
            {{ currentTicker.change > 0 ? '+' : '' }}${{ formatCurrency(Math.abs(currentTicker.change)) }}
          </p>
        </div>
        <div class="text-center">
          <p class="text-sm text-gray-500">24h High</p>
          <p class="text-lg font-bold text-gray-900">
            ${{ formatCurrency(currentTicker.high) }}
          </p>
        </div>
        <div class="text-center">
          <p class="text-sm text-gray-500">24h Low</p>
          <p class="text-lg font-bold text-gray-900">
            ${{ formatCurrency(currentTicker.low) }}
          </p>
        </div>
        <div class="text-center">
          <p class="text-sm text-gray-500">24h Volume</p>
          <p class="text-lg font-bold text-gray-900">
            {{ formatVolume(currentTicker.volume) }}
          </p>
        </div>
        <div class="text-center">
          <p class="text-sm text-gray-500">Bid</p>
          <p class="text-lg font-bold text-success-600">
            ${{ formatCurrency(currentTicker.bid) }}
          </p>
        </div>
        <div class="text-center">
          <p class="text-sm text-gray-500">Ask</p>
          <p class="text-lg font-bold text-danger-600">
            ${{ formatCurrency(currentTicker.ask) }}
          </p>
        </div>
        <div class="text-center">
          <p class="text-sm text-gray-500">Spread</p>
          <p class="text-lg font-bold text-gray-900">
            {{ ((currentTicker.ask - currentTicker.bid) / currentTicker.bid * 100).toFixed(3) }}%
          </p>
        </div>
      </div>
      
      <div v-else class="text-center py-8">
        <p class="text-gray-500">No market data available</p>
      </div>
    </BaseCard>

    <!-- Price Chart -->
    <BaseCard v-if="selectedSymbol" :title="`${selectedSymbol} Price Chart`">
      <div class="mb-4 flex justify-between items-center">
        <div class="flex space-x-2">
          <button
            v-for="timeframe in timeframes"
            :key="timeframe"
            @click="selectedTimeframe = timeframe"
            :class="[
              'px-3 py-1 text-sm font-medium rounded-md transition-colors',
              selectedTimeframe === timeframe
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            ]"
          >
            {{ timeframe }}
          </button>
        </div>
        <BaseButton variant="secondary" size="sm" @click="refreshChart" :loading="loadingCandles">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </BaseButton>
      </div>
      
      <div class="h-96">
        <PriceChart
          :data="candleData"
          :symbol="selectedSymbol"
          :timeframe="selectedTimeframe"
          :loading="loadingCandles"
          :height="384"
        />
      </div>
    </BaseCard>

    <!-- Order Book -->
    <BaseCard v-if="selectedSymbol" title="Order Book">
      <div v-if="loadingOrderBook" class="text-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
        <p class="text-gray-500 mt-2">Loading order book...</p>
      </div>
      
      <div v-else-if="currentOrderBook" class="grid grid-cols-2 gap-4">
        <!-- Asks -->
        <div>
          <h4 class="text-sm font-medium text-gray-700 mb-3">Asks (Sell Orders)</h4>
          <div class="space-y-1">
            <div
              v-for="([price, quantity], index) in currentOrderBook.asks.slice(0, 10)"
              :key="`ask-${index}`"
              class="flex justify-between text-sm bg-red-50 px-2 py-1 rounded"
            >
              <span class="text-danger-600 font-medium">${{ formatCurrency(price) }}</span>
              <span class="text-gray-600">{{ formatNumber(quantity) }}</span>
            </div>
          </div>
        </div>
        
        <!-- Bids -->
        <div>
          <h4 class="text-sm font-medium text-gray-700 mb-3">Bids (Buy Orders)</h4>
          <div class="space-y-1">
            <div
              v-for="([price, quantity], index) in currentOrderBook.bids.slice(0, 10)"
              :key="`bid-${index}`"
              class="flex justify-between text-sm bg-green-50 px-2 py-1 rounded"
            >
              <span class="text-success-600 font-medium">${{ formatCurrency(price) }}</span>
              <span class="text-gray-600">{{ formatNumber(quantity) }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="text-center py-8">
        <p class="text-gray-500">No order book data available</p>
      </div>
    </BaseCard>

    <!-- Recent Trades -->
    <BaseCard v-if="selectedSymbol" title="Recent Trades">
      <div v-if="loadingTrades" class="text-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
        <p class="text-gray-500 mt-2">Loading recent trades...</p>
      </div>
      
      <div v-else-if="recentTrades.length > 0" class="space-y-2 max-h-64 overflow-y-auto">
        <div
          v-for="trade in recentTrades"
          :key="trade.id"
          class="flex justify-between items-center text-sm p-2 bg-gray-50 rounded"
        >
          <div class="flex items-center space-x-2">
            <span :class="[
              'px-2 py-1 rounded text-xs font-medium',
              trade.side === 'buy' ? 'bg-success-100 text-success-800' : 'bg-danger-100 text-danger-800'
            ]">
              {{ trade.side.toUpperCase() }}
            </span>
            <span class="font-medium">${{ formatCurrency(trade.price) }}</span>
          </div>
          <div class="text-right">
            <div class="font-medium">{{ formatNumber(trade.amount) }}</div>
            <div class="text-xs text-gray-500">
              {{ new Date(trade.timestamp).toLocaleTimeString() }}
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="text-center py-8">
        <p class="text-gray-500">No recent trades available</p>
      </div>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useMarketStore } from '@/stores/market'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import PriceChart from '@/components/charts/PriceChart.vue'

const marketStore = useMarketStore()

const searchQuery = ref('')
const searchResults = ref<string[]>([])
const selectedSymbol = ref('')
const selectedTimeframe = ref('1h')
const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d']

const loadingTicker = ref(false)
const loadingOrderBook = ref(false)
const loadingTrades = ref(false)
const loadingCandles = ref(false)

const currentTicker = computed(() => 
  selectedSymbol.value ? marketStore.getTickerBySymbol(selectedSymbol.value) : null
)

const currentOrderBook = computed(() => 
  selectedSymbol.value ? marketStore.getOrderBookBySymbol(selectedSymbol.value) : null
)

const recentTrades = computed(() => 
  selectedSymbol.value ? marketStore.getRecentTradesBySymbol(selectedSymbol.value) : []
)

const candleData = computed(() => 
  selectedSymbol.value ? marketStore.getCandlesBySymbol(`${selectedSymbol.value}-${selectedTimeframe.value}`) : []
)

const priceChangeColor = computed(() => {
  if (!currentTicker.value) return 'text-gray-900'
  return currentTicker.value.changePercent >= 0 ? 'text-success-600' : 'text-danger-600'
})

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value)
}

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(value)
}

const formatVolume = (value: number): string => {
  if (value >= 1e9) {
    return (value / 1e9).toFixed(2) + 'B'
  } else if (value >= 1e6) {
    return (value / 1e6).toFixed(2) + 'M'
  } else if (value >= 1e3) {
    return (value / 1e3).toFixed(2) + 'K'
  }
  return value.toFixed(2)
}

const handleSearchInput = async () => {
  if (searchQuery.value.length < 2) {
    searchResults.value = []
    return
  }

  try {
    const results = await marketStore.searchSymbols(searchQuery.value)
    searchResults.value = results.slice(0, 10) // Limit to 10 results
  } catch (error) {
    console.error('Search error:', error)
    searchResults.value = []
  }
}

const selectSymbol = async (symbol: string) => {
  selectedSymbol.value = symbol
  searchQuery.value = symbol
  searchResults.value = []
  
  await loadMarketData()
}

const loadMarketData = async () => {
  if (!selectedSymbol.value) return

  // Load ticker
  loadingTicker.value = true
  try {
    await marketStore.fetchTicker(selectedSymbol.value)
  } finally {
    loadingTicker.value = false
  }

  // Load order book
  loadingOrderBook.value = true
  try {
    await marketStore.fetchOrderBook(selectedSymbol.value, undefined, 20)
  } finally {
    loadingOrderBook.value = false
  }

  // Load recent trades
  loadingTrades.value = true
  try {
    await marketStore.fetchRecentTrades(selectedSymbol.value, undefined, 50)
  } finally {
    loadingTrades.value = false
  }

  // Load candles
  await refreshChart()
}

const refreshChart = async () => {
  if (!selectedSymbol.value) return

  loadingCandles.value = true
  try {
    await marketStore.fetchCandles(selectedSymbol.value, selectedTimeframe.value, undefined, 100)
  } finally {
    loadingCandles.value = false
  }
}

// Watch for timeframe changes
watch(selectedTimeframe, () => {
  refreshChart()
})

// Emit selected symbol for parent components
const emit = defineEmits<{
  symbolSelected: [symbol: string]
}>()

watch(selectedSymbol, (newSymbol) => {
  if (newSymbol) {
    emit('symbolSelected', newSymbol)
  }
})

onMounted(() => {
  // Default to BTC/USDT
  selectSymbol('BTC/USDT')
})
</script>