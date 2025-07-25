import apiService from './api'
import type { Order, OrderRequest, ApiResponse } from '@/types'

export interface PaperTradingAccount {
  id: string
  userId: string
  name: string
  initialBalance: number
  currentBalance: number
  totalPnL: number
  totalPnLPercent: number
  virtualBalances: VirtualBalance[]
  createdAt: string
  updatedAt: string
}

export interface VirtualBalance {
  currency: string
  available: number
  locked: number
  total: number
  averagePrice: number
  totalCost: number
  unrealizedPnL: number
  realizedPnL: number
}

export interface PaperOrder extends Order {
  accountId: string
  virtualFill: boolean
  simulatedPrice: number
}

export interface PaperTrade {
  id: string
  accountId: string
  orderId: string
  symbol: string
  side: 'buy' | 'sell'
  amount: number
  price: number
  fee: number
  timestamp: string
  pnl?: number
}

export interface AccountPerformance {
  accountId: string
  period: 'daily' | 'weekly' | 'monthly' | 'all'
  totalReturn: number
  totalReturnPercent: number
  sharpeRatio: number
  maxDrawdown: number
  winRate: number
  profitFactor: number
  totalTrades: number
  winningTrades: number
  losingTrades: number
  averageWin: number
  averageLoss: number
  largestWin: number
  largestLoss: number
}

export class PaperTradingService {
  async getAccounts(): Promise<ApiResponse<PaperTradingAccount[]>> {
    return await apiService.get<PaperTradingAccount[]>('/paper-trading/accounts')
  }

  async createAccount(name: string, initialBalance: number): Promise<ApiResponse<PaperTradingAccount>> {
    return await apiService.post<PaperTradingAccount>('/paper-trading/accounts', {
      name,
      initialBalance,
    })
  }

  async getAccount(accountId: string): Promise<ApiResponse<PaperTradingAccount>> {
    return await apiService.get<PaperTradingAccount>(`/paper-trading/accounts/${accountId}`)
  }

  async resetAccount(accountId: string): Promise<ApiResponse<PaperTradingAccount>> {
    return await apiService.post<PaperTradingAccount>(`/paper-trading/accounts/${accountId}/reset`)
  }

  async deleteAccount(accountId: string): Promise<ApiResponse<{ message: string }>> {
    return await apiService.delete<{ message: string }>(`/paper-trading/accounts/${accountId}`)
  }

  async placeOrder(accountId: string, orderRequest: OrderRequest): Promise<ApiResponse<PaperOrder>> {
    return await apiService.post<PaperOrder>(`/paper-trading/accounts/${accountId}/orders`, orderRequest)
  }

  async getActiveOrders(accountId: string): Promise<ApiResponse<PaperOrder[]>> {
    return await apiService.get<PaperOrder[]>(`/paper-trading/accounts/${accountId}/orders/active`)
  }

  async getOrderHistory(accountId: string, params?: {
    symbol?: string
    limit?: number
    startDate?: string
    endDate?: string
  }): Promise<ApiResponse<PaperOrder[]>> {
    return await apiService.get<PaperOrder[]>(`/paper-trading/accounts/${accountId}/orders/history`, params)
  }

  async cancelOrder(accountId: string, orderId: string): Promise<ApiResponse<{ message: string }>> {
    return await apiService.delete<{ message: string }>(`/paper-trading/accounts/${accountId}/orders/${orderId}`)
  }

  async getTradeHistory(accountId: string, params?: {
    symbol?: string
    limit?: number
    startDate?: string
    endDate?: string
  }): Promise<ApiResponse<PaperTrade[]>> {
    return await apiService.get<PaperTrade[]>(`/paper-trading/accounts/${accountId}/trades`, params)
  }

  async getPerformance(accountId: string, period: 'daily' | 'weekly' | 'monthly' | 'all' = 'all'): Promise<ApiResponse<AccountPerformance>> {
    return await apiService.get<AccountPerformance>(`/paper-trading/accounts/${accountId}/performance`, { period })
  }

  async getBalances(accountId: string): Promise<ApiResponse<VirtualBalance[]>> {
    return await apiService.get<VirtualBalance[]>(`/paper-trading/accounts/${accountId}/balances`)
  }

  async getPortfolioHistory(accountId: string, params?: {
    timeframe?: string
    limit?: number
  }): Promise<ApiResponse<any[]>> {
    return await apiService.get(`/paper-trading/accounts/${accountId}/portfolio-history`, params)
  }
}

export const paperTradingService = new PaperTradingService()
export default paperTradingService