import apiService from './api'
import type { Ticker, ApiResponse } from '@/types'

export interface MarketData {
  symbol: string
  last: number
  bid: number
  ask: number
  high24h: number
  low24h: number
  volume24h: number
  change24h: number
  changePercent24h: number
  exchange: string
  timestamp: number
}

export interface OrderBook {
  symbol: string
  bids: [number, number][] // [price, quantity]
  asks: [number, number][] // [price, quantity]
  exchange: string
  timestamp: number
}

export interface Candle {
  symbol: string
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  exchange: string
}

export interface Trade {
  id: string
  symbol: string
  price: number
  amount: number
  side: 'buy' | 'sell'
  timestamp: number
  exchange: string
}

export class MarketService {
  async getTicker(symbol: string, exchange?: string): Promise<ApiResponse<Ticker>> {
    const params = exchange ? { exchange } : undefined
    return await apiService.get<Ticker>(`/market/ticker/${symbol}`, params)
  }

  async getAllTickers(exchange?: string): Promise<ApiResponse<Ticker[]>> {
    const params = exchange ? { exchange } : undefined
    return await apiService.get<Ticker[]>('/market/tickers', params)
  }

  async getOrderBook(symbol: string, exchange?: string, limit?: number): Promise<ApiResponse<OrderBook>> {
    const params = { 
      ...(exchange && { exchange }),
      ...(limit && { limit })
    }
    return await apiService.get<OrderBook>(`/market/orderbook/${symbol}`, params)
  }

  async getRecentTrades(symbol: string, exchange?: string, limit?: number): Promise<ApiResponse<Trade[]>> {
    const params = { 
      ...(exchange && { exchange }),
      ...(limit && { limit })
    }
    return await apiService.get<Trade[]>(`/market/trades/${symbol}`, params)
  }

  async getCandles(
    symbol: string, 
    timeframe: string = '1h',
    exchange?: string,
    limit?: number,
    since?: number
  ): Promise<ApiResponse<Candle[]>> {
    const params = {
      timeframe,
      ...(exchange && { exchange }),
      ...(limit && { limit }),
      ...(since && { since })
    }
    return await apiService.get<Candle[]>(`/market/candles/${symbol}`, params)
  }

  async getMarkets(exchange?: string): Promise<ApiResponse<any[]>> {
    const params = exchange ? { exchange } : undefined
    return await apiService.get('/market/markets', params)
  }

  async searchSymbols(query: string, exchange?: string): Promise<ApiResponse<string[]>> {
    const params = { 
      q: query,
      ...(exchange && { exchange })
    }
    return await apiService.get<string[]>('/market/search', params)
  }
}

export const marketService = new MarketService()
export default marketService