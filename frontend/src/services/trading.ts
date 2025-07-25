import apiService from './api'
import type { Order, OrderRequest, ApiResponse } from '@/types'

export class TradingService {
  async placeOrder(orderRequest: OrderRequest): Promise<ApiResponse<Order>> {
    return await apiService.post<Order>('/trading/orders', orderRequest)
  }

  async getActiveOrders(exchange?: string): Promise<ApiResponse<Order[]>> {
    const params = exchange ? { exchange } : undefined
    return await apiService.get<Order[]>('/trading/orders/active', params)
  }

  async getAllOrders(params?: {
    exchange?: string
    symbol?: string
    limit?: number
    page?: number
  }): Promise<ApiResponse<{ orders: Order[], total: number, page: number }>> {
    return await apiService.get('/trading/orders', params)
  }

  async getOrderById(orderId: string): Promise<ApiResponse<Order>> {
    return await apiService.get<Order>(`/trading/orders/${orderId}`)
  }

  async cancelOrder(orderId: string): Promise<ApiResponse<{ message: string }>> {
    return await apiService.delete<{ message: string }>(`/trading/orders/${orderId}`)
  }

  async getOrderHistory(params?: {
    exchange?: string
    symbol?: string
    limit?: number
    startDate?: string
    endDate?: string
  }): Promise<ApiResponse<Order[]>> {
    return await apiService.get<Order[]>('/trading/orders/history', params)
  }

  async getTradeHistory(params?: {
    exchange?: string
    symbol?: string
    limit?: number
    startDate?: string
    endDate?: string
  }): Promise<ApiResponse<any[]>> {
    return await apiService.get('/trading/trades', params)
  }
}

export const tradingService = new TradingService()
export default tradingService