import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { portfolioService } from '@/services/portfolio'
import type { 
  PortfolioMetrics, 
  AssetAllocation, 
  PortfolioHistory, 
  TradeAnalysis,
  RiskMetrics 
} from '@/services/portfolio'

export const usePortfolioStore = defineStore('portfolio', () => {
  // State
  const metrics = ref<PortfolioMetrics | null>(null)
  const allocation = ref<AssetAllocation[]>([])
  const history = ref<PortfolioHistory[]>([])
  const tradeAnalysis = ref<TradeAnalysis | null>(null)
  const riskMetrics = ref<RiskMetrics | null>(null)
  const insights = ref<any>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const totalValue = computed(() => metrics.value?.totalValue || 0)
  const totalPnL = computed(() => metrics.value?.totalPnL || 0)
  const totalPnLPercent = computed(() => metrics.value?.totalPnLPercent || 0)
  const dailyPnL = computed(() => metrics.value?.dailyPnL || 0)
  const dailyPnLPercent = computed(() => metrics.value?.dailyPnLPercent || 0)
  
  const topAssets = computed(() => 
    allocation.value
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  )

  const topGainers = computed(() => 
    allocation.value
      .filter(asset => asset.change24hPercent > 0)
      .sort((a, b) => b.change24hPercent - a.change24hPercent)
      .slice(0, 5)
  )

  const topLosers = computed(() => 
    allocation.value
      .filter(asset => asset.change24hPercent < 0)
      .sort((a, b) => a.change24hPercent - b.change24hPercent)
      .slice(0, 5)
  )

  const portfolioPerformance = computed(() => {
    if (!history.value.length) return []
    
    return history.value.map(item => ({
      timestamp: item.timestamp,
      value: item.totalValue,
      pnl: item.totalPnL,
      pnlPercent: item.totalPnLPercent
    }))
  })

  const isPortfolioHealthy = computed(() => {
    if (!metrics.value) return false
    
    const hasPositiveReturn = metrics.value.totalPnLPercent > 0
    const hasReasonableDrawdown = metrics.value.maxDrawdown < 20 // Less than 20% drawdown
    const hasDecentWinRate = metrics.value.winRate > 0.4 // More than 40% win rate
    
    return hasPositiveReturn && hasReasonableDrawdown && hasDecentWinRate
  })

  const riskLevel = computed(() => {
    if (!riskMetrics.value) return 'unknown'
    
    const drawdown = Math.abs(riskMetrics.value.valueAtRisk)
    if (drawdown < 5) return 'low'
    if (drawdown < 15) return 'medium'
    return 'high'
  })

  // Actions
  const fetchPortfolioMetrics = async (timeframe: 'day' | 'week' | 'month' | 'year' | 'all' = 'all') => {
    loading.value = true
    error.value = null

    try {
      const response = await portfolioService.getPortfolioMetrics(timeframe)
      
      if (response.success && response.data) {
        metrics.value = response.data
      } else {
        error.value = response.error || 'Failed to fetch portfolio metrics'
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
    } finally {
      loading.value = false
    }
  }

  const fetchAssetAllocation = async () => {
    try {
      const response = await portfolioService.getAssetAllocation()
      
      if (response.success && response.data) {
        allocation.value = response.data
      } else {
        error.value = response.error || 'Failed to fetch asset allocation'
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
    }
  }

  const fetchPortfolioHistory = async (params: {
    timeframe?: '1h' | '4h' | '1d' | '1w' | '1M'
    limit?: number
    startDate?: string
    endDate?: string
  } = {}) => {
    try {
      const response = await portfolioService.getPortfolioHistory(params)
      
      if (response.success && response.data) {
        history.value = response.data
      } else {
        error.value = response.error || 'Failed to fetch portfolio history'
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
    }
  }

  const fetchTradeAnalysis = async (timeframe: 'day' | 'week' | 'month' | 'year' | 'all' = 'all') => {
    try {
      const response = await portfolioService.getTradeAnalysis(timeframe)
      
      if (response.success && response.data) {
        tradeAnalysis.value = response.data
      } else {
        error.value = response.error || 'Failed to fetch trade analysis'
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
    }
  }

  const fetchRiskMetrics = async (timeframe: 'day' | 'week' | 'month' | 'year' | 'all' = 'all') => {
    try {
      const response = await portfolioService.getRiskMetrics(timeframe)
      
      if (response.success && response.data) {
        riskMetrics.value = response.data
      } else {
        error.value = response.error || 'Failed to fetch risk metrics'
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
    }
  }

  const fetchPortfolioInsights = async () => {
    try {
      const response = await portfolioService.getPortfolioInsights()
      
      if (response.success && response.data) {
        insights.value = response.data
      } else {
        error.value = response.error || 'Failed to fetch portfolio insights'
      }
    } catch (err) {
      error.value = 'An unexpected error occurred'
    }
  }

  const exportPortfolio = async (format: 'csv' | 'json' | 'pdf', params?: {
    startDate?: string
    endDate?: string
    includeMetrics?: boolean
    includeHistory?: boolean
    includeTrades?: boolean
  }) => {
    loading.value = true
    error.value = null

    try {
      const response = await portfolioService.exportPortfolioData(format, params)
      
      if (response.success && response.data) {
        // Trigger download
        const link = document.createElement('a')
        link.href = response.data.downloadUrl
        link.download = `portfolio-export.${format}`
        link.click()
        
        return true
      } else {
        error.value = response.error || 'Failed to export portfolio'
        return false
      }
    } catch (err) {
      error.value = 'An unexpected error occurred during export'
      return false
    } finally {
      loading.value = false
    }
  }

  const refreshAllData = async (timeframe: 'day' | 'week' | 'month' | 'year' | 'all' = 'all') => {
    await Promise.all([
      fetchPortfolioMetrics(timeframe),
      fetchAssetAllocation(),
      fetchPortfolioHistory(),
      fetchTradeAnalysis(timeframe),
      fetchRiskMetrics(timeframe),
      fetchPortfolioInsights(),
    ])
  }

  const clearError = () => {
    error.value = null
  }

  return {
    // State
    metrics,
    allocation,
    history,
    tradeAnalysis,
    riskMetrics,
    insights,
    loading,
    error,
    // Getters
    totalValue,
    totalPnL,
    totalPnLPercent,
    dailyPnL,
    dailyPnLPercent,
    topAssets,
    topGainers,
    topLosers,
    portfolioPerformance,
    isPortfolioHealthy,
    riskLevel,
    // Actions
    fetchPortfolioMetrics,
    fetchAssetAllocation,
    fetchPortfolioHistory,
    fetchTradeAnalysis,
    fetchRiskMetrics,
    fetchPortfolioInsights,
    exportPortfolio,
    refreshAllData,
    clearError,
  }
})