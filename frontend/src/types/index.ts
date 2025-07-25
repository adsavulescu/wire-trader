// Authentication types
export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  createdAt: string
  updatedAt: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  email: string
  password: string
  firstName: string
  lastName: string
}

export interface AuthResponse {
  user: User
  token: string
}

// Exchange types
export interface Exchange {
  id: string
  name: string
  enabled: boolean
  connected: boolean
  sandbox: boolean
}

export interface ExchangeCredentials {
  exchangeName: string
  apiKey: string
  secret: string
  sandbox: boolean
  passphrase?: string
}

export interface Balance {
  currency: string
  available: number
  locked: number
  total: number
  exchange: string
}

// Trading types
export interface Order {
  id: string
  clientOrderId: string
  exchangeOrderId?: string
  symbol: string
  type: 'market' | 'limit' | 'stop'
  side: 'buy' | 'sell'
  amount: number
  price?: number
  stopPrice?: number
  status: 'pending' | 'open' | 'closed' | 'canceled' | 'failed'
  filled: number
  remaining: number
  exchange: string
  createdAt: string
  updatedAt: string
}

export interface OrderRequest {
  symbol: string
  type: 'market' | 'limit' | 'stop'
  side: 'buy' | 'sell'
  amount: number
  price?: number
  stopPrice?: number
  exchange: string
}

// Market data types
export interface Ticker {
  symbol: string
  last: number
  bid: number
  ask: number
  high: number
  low: number
  volume: number
  change: number
  changePercent: number
  timestamp: number
  exchange: string
}

export interface Portfolio {
  totalValue: number
  totalPnL: number
  totalPnLPercent: number
  balances: Balance[]
  lastUpdated: string
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

// WebSocket types
export interface WebSocketMessage {
  type: string
  data: any
  timestamp: number
}

// Error types
export interface ApiError {
  message: string
  code?: string
  status?: number
}