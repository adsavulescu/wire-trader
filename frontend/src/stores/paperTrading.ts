import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { paperTradingService } from '@/services/paperTrading'
import type { OrderRequest } from '@/types'
import type { 
  PaperTradingAccount, 
  PaperOrder, 
  PaperTrade, 
  VirtualBalance,
  AccountPerformance 
} from '@/services/paperTrading'

export const usePaperTradingStore = defineStore('paperTrading', () => {
  // State
  const accounts = ref<PaperTradingAccount[]>([])
  const currentAccount = ref<PaperTradingAccount | null>(null)
  const activeOrders = ref<PaperOrder[]>([])
  const orderHistory = ref<PaperOrder[]>([])
  const tradeHistory = ref<PaperTrade[]>([])
  const balances = ref<VirtualBalance[]>([])
  const performance = ref<AccountPerformance | null>(null)
  const portfolioHistory = ref<any[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const activeOrdersCount = computed(() => activeOrders.value.length)
  
  const totalPortfolioValue = computed(() => {
    if (!currentAccount.value) return 0
    return currentAccount.value.currentBalance + balances.value.reduce((total, balance) => {
      return total + (balance.total * balance.averagePrice)
    }, 0)
  })

  const totalPnL = computed(() => {
    if (!currentAccount.value) return 0
    return currentAccount.value.totalPnL
  })

  const totalPnLPercent = computed(() => {
    if (!currentAccount.value) return 0
    return currentAccount.value.totalPnLPercent
  })

  const profitablePositions = computed(() => {
    return balances.value.filter(balance => balance.unrealizedPnL > 0)
  })

  const losingPositions = computed(() => {
    return balances.value.filter(balance => balance.unrealizedPnL < 0)
  })

  // Actions
  const fetchAccounts = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await paperTradingService.getAccounts()
      
      if (response.success && response.data) {
        accounts.value = response.data
        // Set current account to first account if none selected
        if (!currentAccount.value && response.data.length > 0) {
          currentAccount.value = response.data[0]
        }
      } else {
        error.value = response.error || 'Failed to fetch accounts'
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
    } finally {
      loading.value = false
    }
  }

  const createAccount = async (name: string, initialBalance: number) => {
    loading.value = true
    error.value = null

    try {
      const response = await paperTradingService.createAccount(name, initialBalance)
      
      if (response.success && response.data) {
        accounts.value.push(response.data)
        currentAccount.value = response.data
        return true
      } else {
        error.value = response.error || 'Failed to create account'
        return false
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
      return false
    } finally {
      loading.value = false
    }
  }

  const selectAccount = async (accountId: string) => {
    const account = accounts.value.find(acc => acc.id === accountId)
    if (account) {
      currentAccount.value = account
      // Fetch account details
      await Promise.all([
        fetchActiveOrders(accountId),
        fetchBalances(accountId),
        fetchPerformance(accountId),
      ])
    }
  }

  const resetAccount = async (accountId: string) => {
    loading.value = true
    error.value = null

    try {
      const response = await paperTradingService.resetAccount(accountId)
      
      if (response.success && response.data) {
        // Update account in the list
        const index = accounts.value.findIndex(acc => acc.id === accountId)
        if (index !== -1) {
          accounts.value[index] = response.data
        }
        
        // Update current account if it's the one being reset
        if (currentAccount.value?.id === accountId) {
          currentAccount.value = response.data
          // Clear related data
          activeOrders.value = []
          balances.value = []
          tradeHistory.value = []
          orderHistory.value = []
        }
        
        return true
      } else {
        error.value = response.error || 'Failed to reset account'
        return false
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
      return false
    } finally {
      loading.value = false
    }
  }

  const deleteAccount = async (accountId: string) => {
    loading.value = true
    error.value = null

    try {
      const response = await paperTradingService.deleteAccount(accountId)
      
      if (response.success) {
        accounts.value = accounts.value.filter(acc => acc.id !== accountId)
        
        // If deleted account was current, select another
        if (currentAccount.value?.id === accountId) {
          currentAccount.value = accounts.value.length > 0 ? accounts.value[0] : null
        }
        
        return true
      } else {
        error.value = response.error || 'Failed to delete account'
        return false
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
      return false
    } finally {
      loading.value = false
    }
  }

  const placeOrder = async (orderRequest: OrderRequest) => {
    if (!currentAccount.value) {
      error.value = 'No account selected'
      return { success: false, error: 'No account selected' }
    }

    loading.value = true
    error.value = null

    try {
      const response = await paperTradingService.placeOrder(currentAccount.value.id, orderRequest)
      
      if (response.success && response.data) {
        // Add to active orders if not filled immediately
        if (response.data.status !== 'closed') {
          activeOrders.value.unshift(response.data)
        }
        
        // Refresh account data
        await fetchAccount(currentAccount.value.id)
        
        return { success: true, order: response.data }
      } else {
        error.value = response.error || 'Failed to place order'
        return { success: false, error: error.value }
      }
    } catch (err) {
      error.value = 'An unexpected error occurred while placing order'
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  const fetchActiveOrders = async (accountId: string) => {
    try {
      const response = await paperTradingService.getActiveOrders(accountId)
      
      if (response.success && response.data) {
        activeOrders.value = response.data
      } else {
        error.value = response.error || 'Failed to fetch active orders'
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
    }
  }

  const fetchOrderHistory = async (accountId: string, params?: any) => {
    try {
      const response = await paperTradingService.getOrderHistory(accountId, params)
      
      if (response.success && response.data) {
        orderHistory.value = response.data
      } else {
        error.value = response.error || 'Failed to fetch order history'
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
    }
  }

  const fetchTradeHistory = async (accountId: string, params?: any) => {
    try {
      const response = await paperTradingService.getTradeHistory(accountId, params)
      
      if (response.success && response.data) {
        tradeHistory.value = response.data
      } else {
        error.value = response.error || 'Failed to fetch trade history'
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
    }
  }

  const fetchBalances = async (accountId: string) => {
    try {
      const response = await paperTradingService.getBalances(accountId)
      
      if (response.success && response.data) {
        balances.value = response.data
      } else {
        error.value = response.error || 'Failed to fetch balances'
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
    }
  }

  const fetchPerformance = async (accountId: string, period: 'daily' | 'weekly' | 'monthly' | 'all' = 'all') => {
    try {
      const response = await paperTradingService.getPerformance(accountId, period)
      
      if (response.success && response.data) {
        performance.value = response.data
      } else {
        error.value = response.error || 'Failed to fetch performance'
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
    }
  }

  const fetchAccount = async (accountId: string) => {
    try {
      const response = await paperTradingService.getAccount(accountId)
      
      if (response.success && response.data) {
        const index = accounts.value.findIndex(acc => acc.id === accountId)
        if (index !== -1) {
          accounts.value[index] = response.data
        }
        
        if (currentAccount.value?.id === accountId) {
          currentAccount.value = response.data
        }
      }
    } catch (err) {
      console.error('Failed to fetch account:', err)
    }
  }

  const cancelOrder = async (orderId: string) => {
    if (!currentAccount.value) return false

    loading.value = true
    error.value = null

    try {
      const response = await paperTradingService.cancelOrder(currentAccount.value.id, orderId)
      
      if (response.success) {
        // Remove from active orders
        activeOrders.value = activeOrders.value.filter(order => order.id !== orderId)
        return true
      } else {
        error.value = response.error || 'Failed to cancel order'
        return false
      }
    } catch (err) {
      error.value = 'An unexpected error occurred while canceling order'
      return false
    } finally {
      loading.value = false
    }
  }

  const clearError = () => {
    error.value = null
  }

  return {
    // State
    accounts,
    currentAccount,
    activeOrders,
    orderHistory,
    tradeHistory,
    balances,
    performance,
    portfolioHistory,
    loading,
    error,
    // Getters
    activeOrdersCount,
    totalPortfolioValue,
    totalPnL,
    totalPnLPercent,
    profitablePositions,
    losingPositions,
    // Actions
    fetchAccounts,
    createAccount,
    selectAccount,
    resetAccount,
    deleteAccount,
    placeOrder,
    fetchActiveOrders,
    fetchOrderHistory,
    fetchTradeHistory,
    fetchBalances,
    fetchPerformance,
    fetchAccount,
    cancelOrder,
    clearError,
  }
})