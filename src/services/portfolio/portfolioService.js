const Portfolio = require('../../models/Portfolio');
const TradingPosition = require('../../models/TradingPosition');
const PaperTradingAccount = require('../../models/PaperTradingAccount');
const Order = require('../../models/Order');
const marketDataService = require('../market/marketDataService');
const exchangeManager = require('../exchanges/exchangeManager');
const logger = require('../../utils/logger');

/**
 * Portfolio Service
 * Comprehensive portfolio management and tracking
 */
class PortfolioService {
  constructor() {
    this.syncInterval = null;
    this.syncFrequency = 600000; // Sync every 10 minutes
    this.stablecoins = new Set(['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP']);
  }

  /**
   * Initialize the service
   */
  initialize() {
    this.startPortfolioSync();
    logger.info('Portfolio Service initialized');
  }

  /**
   * Start background portfolio synchronization
   */
  startPortfolioSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      try {
        await this.syncAllPortfolios();
      } catch (error) {
        logger.error('Error syncing portfolios:', error);
      }
    }, this.syncFrequency);
  }

  /**
   * Stop background synchronization
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Get or create portfolio for user
   * @param {string} userId - User ID
   * @param {string} baseCurrency - Base currency
   * @returns {Promise<Object>} Portfolio
   */
  async getOrCreatePortfolio(userId, baseCurrency = 'USDT') {
    try {
      let portfolio = await Portfolio.findByUserId(userId);
      
      if (!portfolio) {
        portfolio = await Portfolio.createDefaultPortfolio(userId, baseCurrency);
        logger.info(`Created portfolio for user ${userId} with base currency ${baseCurrency}`);
      }
      
      return portfolio;
    } catch (error) {
      logger.error('Error getting/creating portfolio:', error);
      throw error;
    }
  }

  /**
   * Sync portfolio balances from all connected exchanges
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated portfolio
   */
  async syncPortfolioBalances(userId) {
    try {
      const portfolio = await this.getOrCreatePortfolio(userId);
      portfolio.syncStatus = 'syncing';
      await portfolio.save();

      // Get connected exchanges for user
      const connectedExchanges = await exchangeManager.getConnectedExchanges(userId);
      
      // Sync balances from each exchange
      for (const exchangeName of connectedExchanges) {
        try {
          await this.syncExchangeBalances(portfolio, exchangeName);
        } catch (error) {
          logger.error(`Error syncing ${exchangeName} for user ${userId}:`, error);
          portfolio.syncErrors.push({
            exchange: exchangeName,
            error: error.message,
            timestamp: new Date()
          });
        }
      }

      // Include paper trading account if exists
      await this.syncPaperTradingBalances(portfolio);

      // Update portfolio calculations
      await this.updatePortfolioValues(portfolio);
      
      portfolio.syncStatus = 'synced';
      portfolio.lastSyncDate = new Date();
      await portfolio.save();

      logger.info(`Portfolio synced for user ${userId}`);
      return portfolio;

    } catch (error) {
      logger.error('Error syncing portfolio balances:', error);
      
      // Update sync status to error
      const portfolio = await Portfolio.findByUserId(userId);
      if (portfolio) {
        portfolio.syncStatus = 'error';
        await portfolio.save();
      }
      
      throw error;
    }
  }

  /**
   * Sync balances from a specific exchange
   * @param {Object} portfolio - Portfolio document
   * @param {string} exchangeName - Exchange name
   */
  async syncExchangeBalances(portfolio, exchangeName) {
    try {
      const balances = await exchangeManager.getBalances(portfolio.userId, exchangeName);
      
      for (const [asset, balance] of Object.entries(balances)) {
        if (balance.total > 0) {
          // Get current price
          let currentPrice = 1;
          if (asset !== portfolio.baseCurrency && !this.stablecoins.has(asset)) {
            try {
              const symbol = `${asset}/${portfolio.baseCurrency}`;
              const ticker = await marketDataService.getTicker(symbol);
              currentPrice = ticker.data.unified 
                ? ticker.data.unified.averagePrice 
                : ticker.data.byExchange[0]?.last || 1;
            } catch (priceError) {
              logger.warn(`Could not get price for ${asset}:`, priceError.message);
              currentPrice = 1; // Default to 1 if price unavailable
            }
          }

          portfolio.updateHolding(
            asset,
            exchangeName,
            balance.total,
            currentPrice,
            balance.free,
            balance.used
          );
        }
      }
    } catch (error) {
      logger.error(`Error syncing balances from ${exchangeName}:`, error);
      throw error;
    }
  }

  /**
   * Sync paper trading balances
   * @param {Object} portfolio - Portfolio document
   */
  async syncPaperTradingBalances(portfolio) {
    try {
      const paperAccount = await PaperTradingAccount.findByUserId(portfolio.userId);
      if (!paperAccount) return;

      for (const [asset, balance] of paperAccount.virtualBalances) {
        if (balance.total > 0) {
          // Get current price
          let currentPrice = 1;
          if (asset !== portfolio.baseCurrency && !this.stablecoins.has(asset)) {
            try {
              const symbol = `${asset}/${portfolio.baseCurrency}`;
              const ticker = await marketDataService.getTicker(symbol);
              currentPrice = ticker.data.unified 
                ? ticker.data.unified.averagePrice 
                : ticker.data.byExchange[0]?.last || 1;
            } catch (priceError) {
              logger.warn(`Could not get price for ${asset} in paper trading:`, priceError.message);
              currentPrice = 1;
            }
          }

          portfolio.updateHolding(
            asset,
            'paper_trading',
            balance.total,
            currentPrice,
            balance.available,
            balance.locked
          );
        }
      }
    } catch (error) {
      logger.error('Error syncing paper trading balances:', error);
    }
  }

  /**
   * Update portfolio values and calculations
   * @param {Object} portfolio - Portfolio document
   */
  async updatePortfolioValues(portfolio) {
    try {
      // Update current prices for all holdings
      for (const [asset, holding] of portfolio.holdings) {
        if (holding.totalAmount > 0 && asset !== portfolio.baseCurrency && !this.stablecoins.has(asset)) {
          try {
            const symbol = `${asset}/${portfolio.baseCurrency}`;
            const ticker = await marketDataService.getTicker(symbol);
            const currentPrice = ticker.data.unified 
              ? ticker.data.unified.averagePrice 
              : ticker.data.byExchange[0]?.last;
            
            holding.currentPrice = currentPrice;
            holding.currentValue = holding.totalAmount * currentPrice;
            
            // Update unrealized P&L
            if (holding.costBasis > 0) {
              holding.unrealizedPnL = holding.currentValue - holding.costBasis;
              holding.unrealizedPnLPercentage = (holding.unrealizedPnL / holding.costBasis) * 100;
            }
          } catch (priceError) {
            logger.warn(`Could not update price for ${asset}:`, priceError.message);
          }
        }
      }

      // Recalculate portfolio totals and allocations
      portfolio.recalculatePortfolio();
      
      // Add daily performance record
      portfolio.addDailyPerformance();

      // Update asset type allocations
      this.updateAssetTypeAllocations(portfolio);

    } catch (error) {
      logger.error('Error updating portfolio values:', error);
      throw error;
    }
  }

  /**
   * Update asset type allocations (crypto, stablecoin, fiat)
   * @param {Object} portfolio - Portfolio document
   */
  updateAssetTypeAllocations(portfolio) {
    let cryptoValue = 0;
    let stablecoinValue = 0;
    let fiatValue = 0;

    for (const [asset, holding] of portfolio.holdings) {
      if (holding.totalAmount > 0) {
        if (this.stablecoins.has(asset) || asset === portfolio.baseCurrency) {
          stablecoinValue += holding.currentValue;
        } else if (asset.endsWith('USD') || asset.endsWith('EUR')) {
          fiatValue += holding.currentValue;
        } else {
          cryptoValue += holding.currentValue;
        }
      }
    }

    const totalValue = portfolio.totalValue.current;

    portfolio.allocation.byType = {
      crypto: {
        percentage: totalValue > 0 ? (cryptoValue / totalValue) * 100 : 0,
        value: cryptoValue
      },
      stablecoin: {
        percentage: totalValue > 0 ? (stablecoinValue / totalValue) * 100 : 0,
        value: stablecoinValue
      },
      fiat: {
        percentage: totalValue > 0 ? (fiatValue / totalValue) * 100 : 0,
        value: fiatValue
      }
    };
  }

  /**
   * Process a completed order to update portfolio
   * @param {Object} order - Order document
   */
  async processOrderForPortfolio(order) {
    try {
      if (order.status !== 'filled' && order.status !== 'closed') {
        return; // Only process filled orders
      }

      const portfolio = await this.getOrCreatePortfolio(order.userId);
      const [baseAsset, quoteAsset] = order.symbol.split('/');
      
      // Calculate effective price including fees
      const averagePrice = order.averagePrice || order.price;
      const totalFee = order.fee?.cost || 0;

      if (order.side === 'buy') {
        // Add to base asset, subtract from quote asset
        portfolio.addTrade(baseAsset, 'buy', order.filled, averagePrice, totalFee);
        
        // Update quote asset (subtract cost + fees)
        const totalCost = order.filled * averagePrice + totalFee;
        const quoteHolding = portfolio.holdings.get(quoteAsset);
        if (quoteHolding) {
          quoteHolding.totalAmount -= totalCost;
          quoteHolding.availableAmount -= totalCost;
          quoteHolding.currentValue = quoteHolding.totalAmount * quoteHolding.currentPrice;
          portfolio.holdings.set(quoteAsset, quoteHolding);
        }
      } else {
        // Sell: subtract from base asset, add to quote asset
        portfolio.addTrade(baseAsset, 'sell', order.filled, averagePrice, totalFee);
        
        // Update quote asset (add proceeds - fees)
        const proceeds = order.filled * averagePrice - totalFee;
        portfolio.addTrade(quoteAsset, 'buy', proceeds / averagePrice, averagePrice, 0);
      }

      // Update portfolio calculations
      await this.updatePortfolioValues(portfolio);
      await portfolio.save();

      logger.info(`Portfolio updated for order ${order._id}`);

    } catch (error) {
      logger.error('Error processing order for portfolio:', error);
      throw error;
    }
  }

  /**
   * Get portfolio summary with key metrics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Portfolio summary
   */
  async getPortfolioSummary(userId) {
    try {
      const portfolio = await this.getOrCreatePortfolio(userId);
      
      // Calculate additional metrics
      const recentPerformance = portfolio.performance.dailyValues.slice(-30);
      const volatility = this.calculateVolatility(recentPerformance.map(d => d.pnlPercentage));
      const sharpeRatio = this.calculateSharpeRatio(recentPerformance.map(d => d.pnlPercentage));

      return {
        portfolioId: portfolio._id,
        totalValue: portfolio.totalValue,
        performance: {
          ...portfolio.performance.toObject(),
          volatility,
          sharpeRatio
        },
        allocation: portfolio.allocation,
        holdings: Object.fromEntries(portfolio.holdings),
        assetCount: portfolio.assetCount,
        diversificationScore: portfolio.diversificationScore,
        lastSyncDate: portfolio.lastSyncDate,
        syncStatus: portfolio.syncStatus,
        settings: portfolio.settings
      };

    } catch (error) {
      logger.error('Error getting portfolio summary:', error);
      throw error;
    }
  }

  /**
   * Get detailed portfolio holdings
   * @param {string} userId - User ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Holdings array
   */
  async getPortfolioHoldings(userId, filters = {}) {
    try {
      const portfolio = await this.getOrCreatePortfolio(userId);
      const holdings = [];

      for (const [asset, holding] of portfolio.holdings) {
        if (holding.totalAmount > 0) {
          // Apply filters
          if (filters.minValue && holding.currentValue < filters.minValue) continue;
          if (filters.asset && !asset.toLowerCase().includes(filters.asset.toLowerCase())) continue;

          holdings.push({
            asset,
            ...holding,
            exchanges: Object.fromEntries(holding.exchanges),
            percentage: portfolio.totalValue.current > 0 
              ? (holding.currentValue / portfolio.totalValue.current) * 100 
              : 0
          });
        }
      }

      // Sort by value (descending)
      holdings.sort((a, b) => b.currentValue - a.currentValue);

      return holdings;

    } catch (error) {
      logger.error('Error getting portfolio holdings:', error);
      throw error;
    }
  }

  /**
   * Get portfolio performance history
   * @param {string} userId - User ID
   * @param {number} days - Number of days to retrieve
   * @returns {Promise<Array>} Performance history
   */
  async getPortfolioPerformanceHistory(userId, days = 30) {
    try {
      const portfolio = await this.getOrCreatePortfolio(userId);
      return portfolio.performance.dailyValues.slice(-days);
    } catch (error) {
      logger.error('Error getting portfolio performance history:', error);
      throw error;
    }
  }

  /**
   * Update portfolio settings
   * @param {string} userId - User ID
   * @param {Object} settings - New settings
   * @returns {Promise<Object>} Updated portfolio
   */
  async updatePortfolioSettings(userId, settings) {
    try {
      const portfolio = await this.getOrCreatePortfolio(userId);
      
      // Merge settings
      if (settings.autoRebalance) {
        portfolio.settings.autoRebalance = { ...portfolio.settings.autoRebalance, ...settings.autoRebalance };
      }
      if (settings.riskManagement) {
        portfolio.settings.riskManagement = { ...portfolio.settings.riskManagement, ...settings.riskManagement };
      }
      if (settings.notifications) {
        portfolio.settings.notifications = { ...portfolio.settings.notifications, ...settings.notifications };
      }

      await portfolio.save();
      return portfolio;

    } catch (error) {
      logger.error('Error updating portfolio settings:', error);
      throw error;
    }
  }

  /**
   * Sync all portfolios (background task)
   */
  async syncAllPortfolios() {
    try {
      const portfolios = await Portfolio.find({ syncStatus: { $ne: 'syncing' } }).limit(10);
      
      for (const portfolio of portfolios) {
        try {
          await this.syncPortfolioBalances(portfolio.userId);
        } catch (error) {
          logger.error(`Error syncing portfolio for user ${portfolio.userId}:`, error);
        }
      }

      logger.debug(`Synced ${portfolios.length} portfolios`);

    } catch (error) {
      logger.error('Error in background portfolio sync:', error);
    }
  }

  // Helper methods
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
}

// Export singleton instance
module.exports = new PortfolioService();