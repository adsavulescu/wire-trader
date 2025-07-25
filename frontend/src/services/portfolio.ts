import apiService from './api'
import type { ApiResponse } from '@/types'

export interface PortfolioMetrics {
  totalValue: number
  totalPnL: number
  totalPnLPercent: number
  dailyPnL: number
  dailyPnLPercent: number
  totalReturn: number
  totalReturnPercent: number
  sharpeRatio: number
  maxDrawdown: number
  volatility: number
  winRate: number
  profitFactor: number
  bestTrade: number
  worstTrade: number
  averageWin: number
  averageLoss: number
  totalTrades: number
  winningTrades: number
  losingTrades: number
}

export interface AssetAllocation {
  currency: string
  value: number
  percentage: number
  change24h: number
  change24hPercent: number
}

export interface PortfolioHistory {
  timestamp: string
  totalValue: number
  totalPnL: number
  totalPnLPercent: number
  balances: {
    currency: string
    value: number
  }[]
}

export interface TradeAnalysis {
  profitableAssets: string[]
  losingAssets: string[]
  topPerformers: {
    symbol: string
    pnl: number
    pnlPercent: number
  }[]
  worstPerformers: {
    symbol: string
    pnl: number
    pnlPercent: number
  }[]
  monthlyReturns: {
    month: string
    return: number
    returnPercent: number
  }[]
}

export interface RiskMetrics {
  valueAtRisk: number
  expectedShortfall: number
  beta: number
  alpha: number
  informationRatio: number
  treynorRatio: number
  calmarRatio: number
  sortinoRatio: number
  maximumDrawdownDuration: number
  averageDrawdown: number
}

export class PortfolioService {
  async getPortfolioMetrics(timeframe: 'day' | 'week' | 'month' | 'year' | 'all' = 'all'): Promise<ApiResponse<PortfolioMetrics>> {
    return await apiService.get<PortfolioMetrics>('/portfolio/metrics', { timeframe })
  }

  async getAssetAllocation(): Promise<ApiResponse<AssetAllocation[]>> {
    return await apiService.get<AssetAllocation[]>('/portfolio/allocation')
  }

  async getPortfolioHistory(params: {
    timeframe?: '1h' | '4h' | '1d' | '1w' | '1M'
    limit?: number
    startDate?: string
    endDate?: string
  } = {}): Promise<ApiResponse<PortfolioHistory[]>> {
    return await apiService.get<PortfolioHistory[]>('/portfolio/history', params)
  }

  async getTradeAnalysis(timeframe: 'day' | 'week' | 'month' | 'year' | 'all' = 'all'): Promise<ApiResponse<TradeAnalysis>> {
    return await apiService.get<TradeAnalysis>('/portfolio/trade-analysis', { timeframe })
  }

  async getRiskMetrics(timeframe: 'day' | 'week' | 'month' | 'year' | 'all' = 'all'): Promise<ApiResponse<RiskMetrics>> {
    return await apiService.get<RiskMetrics>('/portfolio/risk-metrics', { timeframe })
  }

  async exportPortfolioData(format: 'csv' | 'json' | 'pdf', params?: {
    startDate?: string
    endDate?: string
    includeMetrics?: boolean
    includeHistory?: boolean
    includeTrades?: boolean
  }): Promise<ApiResponse<{ downloadUrl: string }>> {
    return await apiService.post<{ downloadUrl: string }>('/portfolio/export', {
      format,
      ...params
    })
  }

  async comparePortfolios(portfolioIds: string[], timeframe: 'day' | 'week' | 'month' | 'year' | 'all' = 'all'): Promise<ApiResponse<{
    portfolios: {
      id: string
      name: string
      metrics: PortfolioMetrics
    }[]
    comparison: {
      metric: string
      values: { portfolioId: string; value: number }[]
    }[]
  }>> {
    return await apiService.post('/portfolio/compare', { portfolioIds, timeframe })
  }

  async getPortfolioInsights(): Promise<ApiResponse<{
    insights: {
      type: 'warning' | 'info' | 'success'
      title: string
      description: string
      actionable: boolean
      recommendation?: string
    }[]
    alerts: {
      type: 'risk' | 'opportunity' | 'performance'
      severity: 'low' | 'medium' | 'high'
      message: string
      timestamp: string
    }[]
  }>> {
    return await apiService.get('/portfolio/insights')
  }
}

export const portfolioService = new PortfolioService()
export default portfolioService