import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { exchangeService } from '@/services/exchanges'
import type { Exchange, ExchangeCredentials, Balance } from '@/types'

export const useExchangeStore = defineStore('exchanges', () => {
  // State
  const supportedExchanges = ref<Exchange[]>([])
  const connectedExchanges = ref<Exchange[]>([])
  const balances = ref<Balance[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const totalPortfolioValue = computed(() => {
    return balances.value.reduce((total, balance) => {
      // This would normally involve converting to USD using current prices
      // For now, we'll just sum the total amounts
      return total + balance.total
    }, 0)
  })

  const connectedExchangeNames = computed(() => {
    return connectedExchanges.value.map(exchange => exchange.name)
  })

  const isExchangeConnected = computed(() => (exchangeName: string) => {
    return connectedExchanges.value.some(exchange => exchange.name === exchangeName)
  })

  // Actions
  const fetchSupportedExchanges = async () => {
    try {
      const response = await exchangeService.getSupportedExchanges()
      
      if (response.success && response.data) {
        supportedExchanges.value = response.data
      } else {
        error.value = response.error || 'Failed to fetch supported exchanges'
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
    }
  }

  const fetchConnectedExchanges = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await exchangeService.getConnectedExchanges()
      
      if (response.success && response.data) {
        connectedExchanges.value = response.data
      } else {
        error.value = response.error || 'Failed to fetch connected exchanges'
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
    } finally {
      loading.value = false
    }
  }

  const connectExchange = async (credentials: ExchangeCredentials) => {
    loading.value = true
    error.value = null

    try {
      const response = await exchangeService.connectExchange(credentials)
      
      if (response.success) {
        // Refresh connected exchanges after successful connection
        await fetchConnectedExchanges()
        await fetchBalances()
        return true
      } else {
        error.value = response.error || 'Failed to connect exchange'
        return false
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
      return false
    } finally {
      loading.value = false
    }
  }

  const disconnectExchange = async (exchangeName: string) => {
    loading.value = true
    error.value = null

    try {
      const response = await exchangeService.disconnectExchange(exchangeName)
      
      if (response.success) {
        // Remove from connected exchanges
        connectedExchanges.value = connectedExchanges.value.filter(
          exchange => exchange.name !== exchangeName
        )
        // Remove balances from this exchange
        balances.value = balances.value.filter(
          balance => balance.exchange !== exchangeName
        )
        return true
      } else {
        error.value = response.error || 'Failed to disconnect exchange'
        return false
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
      return false
    } finally {
      loading.value = false
    }
  }

  const fetchBalances = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await exchangeService.getUnifiedBalances()
      
      if (response.success && response.data) {
        balances.value = response.data
      } else {
        error.value = response.error || 'Failed to fetch balances'
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
    } finally {
      loading.value = false
    }
  }

  const testConnection = async (exchangeName: string) => {
    try {
      const response = await exchangeService.testConnection(exchangeName)
      return response.success && response.data?.connected
    } catch (err) {
      return false
    }
  }

  const clearError = () => {
    error.value = null
  }

  return {
    // State
    supportedExchanges,
    connectedExchanges,
    balances,
    loading,
    error,
    // Getters
    totalPortfolioValue,
    connectedExchangeNames,
    isExchangeConnected,
    // Actions
    fetchSupportedExchanges,
    fetchConnectedExchanges,
    connectExchange,
    disconnectExchange,
    fetchBalances,
    testConnection,
    clearError,
  }
})