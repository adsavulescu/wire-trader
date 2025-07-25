import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { marketService } from '@/services/market'
import type { Ticker } from '@/types'
import type { OrderBook, Trade, Candle } from '@/services/market'

export const useMarketStore = defineStore('market', () => {
  // State
  const tickers = ref<Record<string, Ticker>>({})
  const orderBooks = ref<Record<string, OrderBook>>({})
  const recentTrades = ref<Record<string, Trade[]>>({})
  const candles = ref<Record<string, Candle[]>>({})
  const markets = ref<any[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const getTickerBySymbol = computed(() => (symbol: string) => {
    return tickers.value[symbol]
  })

  const getOrderBookBySymbol = computed(() => (symbol: string) => {
    return orderBooks.value[symbol]
  })

  const getRecentTradesBySymbol = computed(() => (symbol: string) => {
    return recentTrades.value[symbol] || []
  })

  const getCandlesBySymbol = computed(() => (symbol: string) => {
    return candles.value[symbol] || []
  })

  const topGainers = computed(() => {
    return Object.values(tickers.value)
      .filter(ticker => ticker.changePercent > 0)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 10)
  })

  const topLosers = computed(() => {
    return Object.values(tickers.value)
      .filter(ticker => ticker.changePercent < 0)
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, 10)
  })

  // Actions
  const fetchTicker = async (symbol: string, exchange?: string) => {
    try {
      const response = await marketService.getTicker(symbol, exchange)
      
      if (response.success && response.data) {
        tickers.value[symbol] = response.data
        return response.data
      } else {
        error.value = response.error || 'Failed to fetch ticker'
        return null
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
      return null
    }
  }

  const fetchAllTickers = async (exchange?: string) => {
    loading.value = true
    error.value = null

    try {
      const response = await marketService.getAllTickers(exchange)
      
      if (response.success && response.data) {
        // Update tickers map
        response.data.forEach(ticker => {
          tickers.value[ticker.symbol] = ticker
        })
      } else {
        error.value = response.error || 'Failed to fetch tickers'
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
    } finally {
      loading.value = false
    }
  }

  const fetchOrderBook = async (symbol: string, exchange?: string, limit?: number) => {
    try {
      const response = await marketService.getOrderBook(symbol, exchange, limit)
      
      if (response.success && response.data) {
        orderBooks.value[symbol] = response.data
        return response.data
      } else {
        error.value = response.error || 'Failed to fetch order book'
        return null
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
      return null
    }
  }

  const fetchRecentTrades = async (symbol: string, exchange?: string, limit?: number) => {
    try {
      const response = await marketService.getRecentTrades(symbol, exchange, limit)
      
      if (response.success && response.data) {
        recentTrades.value[symbol] = response.data
        return response.data
      } else {
        error.value = response.error || 'Failed to fetch recent trades'
        return null
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
      return null
    }
  }

  const fetchCandles = async (
    symbol: string, 
    timeframe: string = '1h',
    exchange?: string,
    limit?: number,
    since?: number
  ) => {
    try {
      const response = await marketService.getCandles(symbol, timeframe, exchange, limit, since)
      
      if (response.success && response.data) {
        const key = `${symbol}-${timeframe}`
        candles.value[key] = response.data
        return response.data
      } else {
        error.value = response.error || 'Failed to fetch candles'
        return null
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
      return null
    }
  }

  const fetchMarkets = async (exchange?: string) => {
    loading.value = true
    error.value = null

    try {
      const response = await marketService.getMarkets(exchange)
      
      if (response.success && response.data) {
        markets.value = response.data
      } else {
        error.value = response.error || 'Failed to fetch markets'
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
    } finally {
      loading.value = false
    }
  }

  const searchSymbols = async (query: string, exchange?: string) => {
    try {
      const response = await marketService.searchSymbols(query, exchange)
      
      if (response.success && response.data) {
        return response.data
      } else {
        error.value = response.error || 'Failed to search symbols'
        return []
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
      return []
    }
  }

  const updateTickerFromWebSocket = (data: Ticker) => {
    tickers.value[data.symbol] = data
  }

  const updateOrderBookFromWebSocket = (data: OrderBook) => {
    orderBooks.value[data.symbol] = data
  }

  const updateTradesFromWebSocket = (symbol: string, newTrades: Trade[]) => {
    const existing = recentTrades.value[symbol] || []
    recentTrades.value[symbol] = [...newTrades, ...existing].slice(0, 100) // Keep last 100 trades
  }

  const clearError = () => {
    error.value = null
  }

  return {
    // State
    tickers,
    orderBooks,
    recentTrades,
    candles,
    markets,
    loading,
    error,
    // Getters
    getTickerBySymbol,
    getOrderBookBySymbol,
    getRecentTradesBySymbol,
    getCandlesBySymbol,
    topGainers,
    topLosers,
    // Actions
    fetchTicker,
    fetchAllTickers,
    fetchOrderBook,
    fetchRecentTrades,
    fetchCandles,
    fetchMarkets,
    searchSymbols,
    updateTickerFromWebSocket,
    updateOrderBookFromWebSocket,
    updateTradesFromWebSocket,
    clearError,
  }
})