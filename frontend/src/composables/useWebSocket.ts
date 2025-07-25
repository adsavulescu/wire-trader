import { ref, onMounted, onUnmounted } from 'vue'
import { webSocketService } from '@/services/websocket'

export function useWebSocket() {
  const isConnected = ref(false)
  const connecting = ref(false)
  const error = ref<string | null>(null)

  const connect = async () => {
    if (connecting.value || isConnected.value) return

    connecting.value = true
    error.value = null

    try {
      await webSocketService.connect()
      isConnected.value = true
    } catch (err) {
      error.value = 'Failed to connect to WebSocket'
      console.error('WebSocket connection error:', err)
    } finally {
      connecting.value = false
    }
  }

  const disconnect = () => {
    webSocketService.disconnect()
    isConnected.value = false
  }

  const subscribe = (messageType: string, callback: (data: any) => void) => {
    webSocketService.subscribe(messageType, callback)
  }

  const unsubscribe = (messageType: string, callback: (data: any) => void) => {
    webSocketService.unsubscribe(messageType, callback)
  }

  const send = (message: any) => {
    webSocketService.send(message)
  }

  // Auto-connect on mount (optional)
  onMounted(() => {
    // Uncomment to auto-connect
    // connect()
  })

  // Clean up on unmount
  onUnmounted(() => {
    disconnect()
  })

  return {
    isConnected,
    connecting,
    error,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    send,
  }
}

// Composable for real-time market data
export function useMarketData() {
  const { subscribe, unsubscribe, isConnected } = useWebSocket()
  const tickers = ref<Record<string, any>>({})
  const orderBooks = ref<Record<string, any>>({})

  const subscribeToTicker = (symbol: string) => {
    const callback = (data: any) => {
      tickers.value[symbol] = data
    }

    subscribe('ticker', callback)
    
    // Send subscription message
    if (isConnected.value) {
      webSocketService.send({
        type: 'subscribe',
        channel: 'ticker',
        symbol,
      })
    }

    return () => unsubscribe('ticker', callback)
  }

  const subscribeToOrderBook = (symbol: string) => {
    const callback = (data: any) => {
      orderBooks.value[symbol] = data
    }

    subscribe('orderbook', callback)

    // Send subscription message
    if (isConnected.value) {
      webSocketService.send({
        type: 'subscribe',
        channel: 'orderbook',
        symbol,
      })
    }

    return () => unsubscribe('orderbook', callback)
  }

  return {
    tickers,
    orderBooks,
    subscribeToTicker,
    subscribeToOrderBook,
  }
}