import type { WebSocketMessage } from '@/types'

export class WebSocketService {
  private socket: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private callbacks: Map<string, ((data: any) => void)[]> = new Map()

  constructor(private url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.url)

        this.socket.onopen = () => {
          console.log('WebSocket connected')
          this.reconnectAttempts = 0
          resolve()
        }

        this.socket.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }

        this.socket.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason)
          this.socket = null

          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnect()
          }
        }

        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error)
          reject(error)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  private reconnect(): void {
    this.reconnectAttempts++
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error)
      })
    }, this.reconnectDelay * this.reconnectAttempts)
  }

  private handleMessage(message: WebSocketMessage): void {
    const callbacks = this.callbacks.get(message.type)
    if (callbacks) {
      callbacks.forEach(callback => callback(message.data))
    }
  }

  subscribe(messageType: string, callback: (data: any) => void): void {
    if (!this.callbacks.has(messageType)) {
      this.callbacks.set(messageType, [])
    }
    this.callbacks.get(messageType)!.push(callback)
  }

  unsubscribe(messageType: string, callback: (data: any) => void): void {
    const callbacks = this.callbacks.get(messageType)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  send(message: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket is not connected')
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
  }

  get isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN
  }
}

// Create singleton instance
export const webSocketService = new WebSocketService('ws://localhost:3000/ws')
export default webSocketService