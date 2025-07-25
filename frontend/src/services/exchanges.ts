import apiService from './api'
import type { Exchange, ExchangeCredentials, Balance, ApiResponse } from '@/types'

export class ExchangeService {
  async getSupportedExchanges(): Promise<ApiResponse<Exchange[]>> {
    return await apiService.get<Exchange[]>('/exchanges')
  }

  async getConnectedExchanges(): Promise<ApiResponse<Exchange[]>> {
    return await apiService.get<Exchange[]>('/exchanges/connected')
  }

  async connectExchange(credentials: ExchangeCredentials): Promise<ApiResponse<{ message: string }>> {
    return await apiService.post<{ message: string }>('/exchanges/connect', credentials)
  }

  async disconnectExchange(exchangeName: string): Promise<ApiResponse<{ message: string }>> {
    return await apiService.delete<{ message: string }>(`/exchanges/${exchangeName}`)
  }

  async getUnifiedBalances(): Promise<ApiResponse<Balance[]>> {
    return await apiService.get<Balance[]>('/exchanges/balances')
  }

  async getExchangeBalance(exchangeName: string): Promise<ApiResponse<Balance[]>> {
    return await apiService.get<Balance[]>(`/exchanges/${exchangeName}/balances`)
  }

  async testConnection(exchangeName: string): Promise<ApiResponse<{ connected: boolean; message: string }>> {
    return await apiService.post<{ connected: boolean; message: string }>(`/exchanges/${exchangeName}/test`)
  }
}

export const exchangeService = new ExchangeService()
export default exchangeService