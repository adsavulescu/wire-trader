import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { tradingService } from '@/services/trading'
import type { Order, OrderRequest } from '@/types'

export const useTradingStore = defineStore('trading', () => {
  // State
  const activeOrders = ref<Order[]>([])
  const orderHistory = ref<Order[]>([])
  const tradeHistory = ref<any[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const activeOrdersCount = computed(() => activeOrders.value.length)
  
  const ordersByExchange = computed(() => {
    const groups: Record<string, Order[]> = {}
    activeOrders.value.forEach(order => {
      if (!groups[order.exchange]) {
        groups[order.exchange] = []
      }
      groups[order.exchange].push(order)
    })
    return groups
  })

  const openOrdersValue = computed(() => {
    return activeOrders.value.reduce((total, order) => {
      if (order.status === 'open' && order.price) {
        return total + (order.amount * order.price)
      }
      return total
    }, 0)
  })

  // Actions
  const placeOrder = async (orderRequest: OrderRequest) => {
    loading.value = true
    error.value = null

    try {
      const response = await tradingService.placeOrder(orderRequest)
      
      if (response.success && response.data) {
        // Add to active orders if not filled immediately
        if (response.data.status !== 'closed') {
          activeOrders.value.unshift(response.data)
        }
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

  const fetchActiveOrders = async (exchange?: string) => {
    loading.value = true
    error.value = null

    try {
      const response = await tradingService.getActiveOrders(exchange)
      
      if (response.success && response.data) {
        activeOrders.value = response.data
      } else {
        error.value = response.error || 'Failed to fetch active orders'
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
    } finally {
      loading.value = false
    }
  }

  const fetchOrderHistory = async (params?: {
    exchange?: string
    symbol?: string
    limit?: number
    startDate?: string
    endDate?: string
  }) => {
    loading.value = true
    error.value = null

    try {
      const response = await tradingService.getOrderHistory(params)
      
      if (response.success && response.data) {
        orderHistory.value = response.data
      } else {
        error.value = response.error || 'Failed to fetch order history'
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
    } finally {
      loading.value = false
    }
  }

  const cancelOrder = async (orderId: string) => {
    loading.value = true
    error.value = null

    try {
      const response = await tradingService.cancelOrder(orderId)
      
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

  const updateOrderStatus = (orderId: string, status: Order['status'], filled?: number) => {
    const orderIndex = activeOrders.value.findIndex(order => order.id === orderId)
    if (orderIndex !== -1) {
      const order = activeOrders.value[orderIndex]
      order.status = status
      if (filled !== undefined) {
        order.filled = filled
        order.remaining = order.amount - filled
      }
      
      // Move to history if closed/canceled
      if (status === 'closed' || status === 'canceled') {
        activeOrders.value.splice(orderIndex, 1)
        orderHistory.value.unshift(order)
      }
    }
  }

  const fetchTradeHistory = async (params?: {
    exchange?: string
    symbol?: string
    limit?: number
    startDate?: string
    endDate?: string
  }) => {
    loading.value = true
    error.value = null

    try {
      const response = await tradingService.getTradeHistory(params)
      
      if (response.success && response.data) {
        tradeHistory.value = response.data
      } else {
        error.value = response.error || 'Failed to fetch trade history'
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
    } finally {
      loading.value = false
    }
  }

  const clearError = () => {
    error.value = null
  }

  return {
    // State
    activeOrders,
    orderHistory,
    tradeHistory,
    loading,
    error,
    // Getters
    activeOrdersCount,
    ordersByExchange,
    openOrdersValue,
    // Actions
    placeOrder,
    fetchActiveOrders,
    fetchOrderHistory,
    cancelOrder,
    updateOrderStatus,
    fetchTradeHistory,
    clearError,
  }
})