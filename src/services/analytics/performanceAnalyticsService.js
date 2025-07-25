const TradingPosition = require('../../models/TradingPosition');
const Order = require('../../models/Order');
const PaperTradingAccount = require('../../models/PaperTradingAccount');
const marketDataService = require('../market/marketDataService');
const logger = require('../../utils/logger');

/**
 * Performance Analytics Service
 * Comprehensive trading performance tracking and analysis
 */
class PerformanceAnalyticsService {
  constructor() {
    this.updateInterval = null;
    this.priceUpdateFrequency = 300000; // Update every 5 minutes
  }

  /**
   * Initialize the service
   */
  initialize() {
    this.startPerformanceUpdates();
    logger.info('Performance Analytics Service initialized');
  }

  /**
   * Start background performance updates
   */
  startPerformanceUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(async () => {
      try {
        await this.updateOpenPositionsPnL();
      } catch (error) {
        logger.error('Error updating performance metrics:', error);
      }
    }, this.priceUpdateFrequency);
  }

  /**
   * Stop background updates
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Get comprehensive performance analytics for a user
   * @param {string} userId - User ID
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Performance analytics
   */
  async getPerformanceAnalytics(userId, options = {}) {
    try {
      const {
        timeframe = '30d',
        includeOpenPositions = true,
        includePaperTrading = true
      } = options;

      // Get base portfolio metrics
      const portfolioMetrics = await this.getPortfolioMetrics(userId);
      
      // Get P&L analytics
      const pnlAnalytics = await this.getPnLAnalytics(userId, timeframe);
      
      // Get trading statistics
      const tradingStats = await this.getTradingStatistics(userId, timeframe);
      
      // Get risk metrics
      const riskMetrics = await this.getRiskMetrics(userId);
      
      // Get performance by time periods
      const timeBasedPerformance = await this.getTimeBasedPerformance(userId);
      
      // Get symbol performance
      const symbolPerformance = await this.getSymbolPerformance(userId);
      
      // Get paper trading performance if included
      let paperTradingPerformance = null;
      if (includePaperTrading) {
        paperTradingPerformance = await this.getPaperTradingPerformance(userId);
      }

      return {
        portfolioMetrics,
        pnlAnalytics,
        tradingStats,
        riskMetrics,
        timeBasedPerformance,
        symbolPerformance,
        paperTradingPerformance,
        lastUpdated: new Date(),
        timeframe
      };

    } catch (error) {
      logger.error('Error getting performance analytics:', error);
      throw error;
    }
  }

  /**
   * Get portfolio metrics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Portfolio metrics
   */
  async getPortfolioMetrics(userId) {
    try {
      const metrics = await TradingPosition.calculatePortfolioMetrics(userId);
      
      // Calculate additional metrics
      const winRate = metrics.closedPositions > 0 
        ? (metrics.winningTrades / metrics.closedPositions) * 100 
        : 0;
      
      const lossRate = metrics.closedPositions > 0 
        ? (metrics.losingTrades / metrics.closedPositions) * 100 
        : 0;
      
      const totalPnL = (metrics.totalRealizedPnL || 0) + (metrics.totalUnrealizedPnL || 0);
      
      return {
        totalPositions: metrics.totalPositions || 0,
        openPositions: metrics.openPositions || 0,
        closedPositions: metrics.closedPositions || 0,
        winningTrades: metrics.winningTrades || 0,
        losingTrades: metrics.losingTrades || 0,
        winRate,
        lossRate,
        totalRealizedPnL: metrics.totalRealizedPnL || 0,
        totalUnrealizedPnL: metrics.totalUnrealizedPnL || 0,
        totalPnL,
        totalFees: metrics.totalFees || 0,
        netPnL: totalPnL - (metrics.totalFees || 0),
        averageHoldingPeriod: metrics.averageHoldingPeriod || 0,
        maxDrawdown: metrics.maxDrawdown || 0,
        maxProfit: metrics.maxProfit || 0
      };

    } catch (error) {
      logger.error('Error calculating portfolio metrics:', error);
      throw error;
    }
  }

  /**
   * Get P&L analytics with detailed breakdown
   * @param {string} userId - User ID
   * @param {string} timeframe - Time period for analysis
   * @returns {Promise<Object>} P&L analytics
   */
  async getPnLAnalytics(userId, timeframe = '30d') {
    try {
      const days = this.parseTimeframe(timeframe);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const pipeline = [
        {
          $match: {
            userId: new require('mongoose').Types.ObjectId(userId),
            entryDate: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: { $ifNull: ['$exitDate', '$entryDate'] }
              }
            },
            dailyPnL: {
              $sum: {
                $cond: [
                  { $eq: ['$status', 'closed'] },
                  '$netPnL',
                  '$unrealizedPnL'
                ]
              }
            },
            tradesCount: { $sum: 1 },
            volume: { $sum: '$entryValue' }
          }
        },
        { $sort: { _id: 1 } }
      ];

      const dailyPnL = await TradingPosition.aggregate(pipeline);
      
      // Calculate cumulative P&L
      let cumulativePnL = 0;
      const pnlTimeSeries = dailyPnL.map(day => {
        cumulativePnL += day.dailyPnL;
        return {
          date: day._id,
          dailyPnL: day.dailyPnL,
          cumulativePnL,
          tradesCount: day.tradesCount,
          volume: day.volume
        };
      });

      // Calculate additional P&L metrics
      const totalPnL = cumulativePnL;
      const bestDay = dailyPnL.reduce((max, day) => 
        day.dailyPnL > max.dailyPnL ? day : max, { dailyPnL: -Infinity });
      const worstDay = dailyPnL.reduce((min, day) => 
        day.dailyPnL < min.dailyPnL ? day : min, { dailyPnL: Infinity });

      return {
        timeframe,
        totalPnL,
        averageDailyPnL: dailyPnL.length > 0 ? totalPnL / dailyPnL.length : 0,
        bestDay: bestDay.dailyPnL !== -Infinity ? bestDay : null,
        worstDay: worstDay.dailyPnL !== Infinity ? worstDay : null,
        pnlTimeSeries,
        volatility: this.calculateVolatility(dailyPnL.map(d => d.dailyPnL)),
        sharpeRatio: this.calculateSharpeRatio(dailyPnL.map(d => d.dailyPnL))
      };

    } catch (error) {
      logger.error('Error calculating P&L analytics:', error);
      throw error;
    }
  }

  /**
   * Get detailed trading statistics
   * @param {string} userId - User ID
   * @param {string} timeframe - Time period for analysis
   * @returns {Promise<Object>} Trading statistics
   */
  async getTradingStatistics(userId, timeframe = '30d') {
    try {
      const days = this.parseTimeframe(timeframe);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const closedPositions = await TradingPosition.find({
        userId,
        status: 'closed',
        exitDate: { $gte: startDate }
      });

      if (closedPositions.length === 0) {
        return this.getEmptyTradingStats();
      }

      // Calculate statistics
      const wins = closedPositions.filter(p => p.netPnL > 0);
      const losses = closedPositions.filter(p => p.netPnL < 0);
      
      const winRate = (wins.length / closedPositions.length) * 100;
      const averageWin = wins.length > 0 
        ? wins.reduce((sum, p) => sum + p.netPnL, 0) / wins.length 
        : 0;
      const averageLoss = losses.length > 0 
        ? Math.abs(losses.reduce((sum, p) => sum + p.netPnL, 0) / losses.length)
        : 0;
      
      const profitFactor = averageLoss > 0 ? (averageWin * wins.length) / (averageLoss * losses.length) : 0;
      
      const holdingPeriods = closedPositions.map(p => {
        const duration = p.exitDate - p.entryDate;
        return duration / (1000 * 60 * 60 * 24); // Convert to days
      });
      
      const averageHoldingPeriod = holdingPeriods.reduce((sum, period) => sum + period, 0) / holdingPeriods.length;
      
      // Calculate consecutive wins/losses
      const { maxConsecutiveWins, maxConsecutiveLosses } = this.calculateConsecutiveWinLoss(closedPositions);

      return {
        totalTrades: closedPositions.length,
        winningTrades: wins.length,
        losingTrades: losses.length,
        winRate,
        lossRate: 100 - winRate,
        averageWin,
        averageLoss,
        profitFactor,
        averageHoldingPeriod,
        maxConsecutiveWins,
        maxConsecutiveLosses,
        largestWin: wins.length > 0 ? Math.max(...wins.map(p => p.netPnL)) : 0,
        largestLoss: losses.length > 0 ? Math.min(...losses.map(p => p.netPnL)) : 0,
        totalVolume: closedPositions.reduce((sum, p) => sum + p.entryValue, 0),
        averageTradeSize: closedPositions.reduce((sum, p) => sum + p.entryValue, 0) / closedPositions.length
      };

    } catch (error) {
      logger.error('Error calculating trading statistics:', error);
      throw error;
    }
  }

  /**
   * Get risk metrics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Risk metrics
   */
  async getRiskMetrics(userId) {
    try {
      const openPositions = await TradingPosition.findOpenPositions(userId);
      const closedPositions = await TradingPosition.findClosedPositions(userId);
      
      let totalExposure = 0;
      let totalUnrealizedPnL = 0;
      let maxSinglePositionSize = 0;
      
      // Calculate exposure and risk for open positions
      for (const position of openPositions) {
        totalExposure += position.entryValue;
        totalUnrealizedPnL += position.unrealizedPnL;
        maxSinglePositionSize = Math.max(maxSinglePositionSize, position.entryValue);
      }
      
      // Calculate historical drawdown
      const historicalDrawdown = this.calculateMaxDrawdown(closedPositions);
      
      // Calculate Value at Risk (simplified)
      const dailyReturns = closedPositions.map(p => p.pnlPercentage);
      const var95 = this.calculateVaR(dailyReturns, 0.95);
      const var99 = this.calculateVaR(dailyReturns, 0.99);

      return {
        totalExposure,
        totalUnrealizedPnL,
        maxSinglePositionSize,
        positionCount: openPositions.length,
        averagePositionSize: openPositions.length > 0 ? totalExposure / openPositions.length : 0,
        concentrationRisk: maxSinglePositionSize / Math.max(totalExposure, 1),
        historicalDrawdown,
        currentDrawdown: Math.min(0, totalUnrealizedPnL),
        valueAtRisk: {
          var95,
          var99
        }
      };

    } catch (error) {
      logger.error('Error calculating risk metrics:', error);
      throw error;
    }
  }

  /**
   * Get performance by time periods
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Time-based performance
   */
  async getTimeBasedPerformance(userId) {
    try {
      const timeframes = ['7d', '30d', '90d', '365d', 'all'];
      const performance = {};

      for (const timeframe of timeframes) {
        const pnlAnalytics = await this.getPnLAnalytics(userId, timeframe);
        const tradingStats = await this.getTradingStatistics(userId, timeframe);
        
        performance[timeframe] = {
          totalPnL: pnlAnalytics.totalPnL,
          winRate: tradingStats.winRate,
          totalTrades: tradingStats.totalTrades,
          profitFactor: tradingStats.profitFactor,
          sharpeRatio: pnlAnalytics.sharpeRatio
        };
      }

      return performance;

    } catch (error) {
      logger.error('Error calculating time-based performance:', error);
      throw error;
    }
  }

  /**
   * Get performance by symbol/asset
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Symbol performance
   */
  async getSymbolPerformance(userId) {
    try {
      const pipeline = [
        { $match: { userId: new require('mongoose').Types.ObjectId(userId) } },
        {
          $group: {
            _id: '$symbol',
            totalTrades: { $sum: 1 },
            closedTrades: {
              $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] }
            },
            winningTrades: {
              $sum: { $cond: [{ $and: [{ $eq: ['$status', 'closed'] }, { $gt: ['$netPnL', 0] }] }, 1, 0] }
            },
            totalPnL: {
              $sum: {
                $cond: [
                  { $eq: ['$status', 'closed'] },
                  '$netPnL',
                  '$unrealizedPnL'
                ]
              }
            },
            totalVolume: { $sum: '$entryValue' },
            averageHoldingPeriod: {
              $avg: {
                $cond: [
                  { $eq: ['$status', 'closed'] },
                  { $divide: [{ $subtract: ['$exitDate', '$entryDate'] }, 1000 * 60 * 60 * 24] },
                  null
                ]
              }
            }
          }
        },
        { $sort: { totalPnL: -1 } }
      ];

      const symbolStats = await TradingPosition.aggregate(pipeline);
      
      return symbolStats.map(stat => ({
        symbol: stat._id,
        totalTrades: stat.totalTrades,
        closedTrades: stat.closedTrades,
        winRate: stat.closedTrades > 0 ? (stat.winningTrades / stat.closedTrades) * 100 : 0,
        totalPnL: stat.totalPnL,
        totalVolume: stat.totalVolume,
        averageHoldingPeriod: stat.averageHoldingPeriod || 0,
        profitability: stat.totalVolume > 0 ? (stat.totalPnL / stat.totalVolume) * 100 : 0
      }));

    } catch (error) {
      logger.error('Error calculating symbol performance:', error);
      throw error;
    }
  }

  /**
   * Get paper trading performance
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Paper trading performance
   */
  async getPaperTradingPerformance(userId) {
    try {
      const account = await PaperTradingAccount.findByUserId(userId);
      if (!account) return null;

      const paperOrders = await Order.find({
        userId,
        isPaperTrade: true,
        status: 'filled'
      }).sort({ createdAt: -1 });

      // Calculate paper trading specific metrics
      const winningOrders = paperOrders.filter(order => {
        // This is simplified - would need more sophisticated P&L calculation
        return order.side === 'sell'; // Assuming sell orders close positions
      });

      return {
        accountId: account._id,
        initialBalance: account.initialBalance,
        currentBalance: account.getTotalBalance(account.baseCurrency),
        totalPnL: account.performance.totalPnL,
        totalTrades: account.performance.totalTrades,
        winningTrades: account.performance.winningTrades,
        winRate: account.winRate,
        totalVolume: account.performance.totalVolume,
        maxDrawdown: account.performance.maxDrawdown,
        highWaterMark: account.performance.highWaterMark,
        dailyStats: account.dailyStats.slice(-30) // Last 30 days
      };

    } catch (error) {
      logger.error('Error getting paper trading performance:', error);
      return null;
    }
  }

  /**
   * Update unrealized P&L for all open positions
   */
  async updateOpenPositionsPnL() {
    try {
      const openPositions = await TradingPosition.find({ status: 'open' });
      const uniqueSymbols = [...new Set(openPositions.map(p => p.symbol))];
      
      // Get current prices for all symbols
      const pricePromises = uniqueSymbols.map(async symbol => {
        try {
          const ticker = await marketDataService.getTicker(symbol);
          const price = ticker.data.unified 
            ? ticker.data.unified.averagePrice 
            : ticker.data.byExchange[0]?.last;
          return { symbol, price };
        } catch (error) {
          logger.warn(`Failed to get price for ${symbol}:`, error.message);
          return { symbol, price: null };
        }
      });

      const prices = await Promise.all(pricePromises);
      const priceMap = new Map(prices.map(p => [p.symbol, p.price]));

      // Update each position
      for (const position of openPositions) {
        const currentPrice = priceMap.get(position.symbol);
        if (currentPrice) {
          position.updateUnrealizedPnL(currentPrice);
          await position.save();
        }
      }

      logger.debug(`Updated P&L for ${openPositions.length} open positions`);

    } catch (error) {
      logger.error('Error updating open positions P&L:', error);
    }
  }

  // Helper methods
  parseTimeframe(timeframe) {
    const timeframes = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '365d': 365,
      'all': 9999
    };
    return timeframes[timeframe] || 30;
  }

  getEmptyTradingStats() {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      lossRate: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
      averageHoldingPeriod: 0,
      maxConsecutiveWins: 0,
      maxConsecutiveLosses: 0,
      largestWin: 0,
      largestLoss: 0,
      totalVolume: 0,
      averageTradeSize: 0
    };
  }

  calculateConsecutiveWinLoss(positions) {
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;

    positions.sort((a, b) => a.exitDate - b.exitDate);

    for (const position of positions) {
      if (position.netPnL > 0) {
        currentWins++;
        currentLosses = 0;
        maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
      } else {
        currentLosses++;
        currentWins = 0;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
      }
    }

    return { maxConsecutiveWins, maxConsecutiveLosses };
  }

  calculateMaxDrawdown(positions) {
    if (positions.length === 0) return { value: 0, percentage: 0 };

    let peak = 0;
    let maxDrawdown = 0;
    let cumulativePnL = 0;

    positions.sort((a, b) => a.exitDate - b.exitDate);

    for (const position of positions) {
      cumulativePnL += position.netPnL;
      peak = Math.max(peak, cumulativePnL);
      const drawdown = peak - cumulativePnL;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    return {
      value: maxDrawdown,
      percentage: peak > 0 ? (maxDrawdown / peak) * 100 : 0
    };
  }

  calculateVolatility(returns) {
    if (returns.length < 2) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    return Math.sqrt(variance);
  }

  calculateSharpeRatio(returns, riskFreeRate = 0.02) {
    if (returns.length === 0) return 0;
    
    const averageReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = this.calculateVolatility(returns);
    
    return volatility > 0 ? (averageReturn - riskFreeRate) / volatility : 0;
  }

  calculateVaR(returns, confidence) {
    if (returns.length === 0) return 0;
    
    const sortedReturns = returns.sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sortedReturns.length);
    return sortedReturns[index] || 0;
  }
}

// Export singleton instance
module.exports = new PerformanceAnalyticsService();