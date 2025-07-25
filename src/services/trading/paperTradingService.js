const PaperTradingAccount = require('../../models/PaperTradingAccount');
const Order = require('../../models/Order');
const marketDataService = require('../market/marketDataService');
const logger = require('../../utils/logger');

/**
 * Paper Trading Service
 * Manages virtual trading operations with simulated order execution
 */
class PaperTradingService {
  constructor() {
    this.simulatedLatency = 100; // ms delay to simulate exchange latency
    this.slippageFactor = 0.0005; // 0.05% slippage on market orders
  }

  /**
   * Get or create paper trading account for user
   * @param {string} userId - User ID
   * @param {number} initialBalance - Initial virtual balance
   * @returns {Promise<Object>} Paper trading account
   */
  async getOrCreateAccount(userId, initialBalance = 100000) {
    try {
      let account = await PaperTradingAccount.findByUserId(userId);
      
      if (!account) {
        account = await PaperTradingAccount.createDefaultAccount(userId, initialBalance);
        logger.info(`Created paper trading account for user ${userId} with balance ${initialBalance}`);
      }
      
      return account;
    } catch (error) {
      logger.error('Error getting/creating paper trading account:', error);
      throw error;
    }
  }

  /**
   * Get account balance for specific asset
   * @param {string} userId - User ID
   * @param {string} asset - Asset symbol
   * @returns {Promise<Object>} Balance information
   */
  async getBalance(userId, asset = null) {
    try {
      const account = await this.getOrCreateAccount(userId);
      
      if (asset) {
        return {
          asset,
          total: account.getTotalBalance(asset),
          available: account.getAvailableBalance(asset),
          locked: account.virtualBalances.get(asset)?.locked || 0
        };
      }
      
      // Return all balances
      const balances = {};
      for (const [assetSymbol, balance] of account.virtualBalances) {
        if (balance.total > 0 || balance.available > 0 || balance.locked > 0) {
          balances[assetSymbol] = balance;
        }
      }
      
      return balances;
    } catch (error) {
      logger.error('Error getting paper trading balance:', error);
      throw error;
    }
  }

  /**
   * Place paper trading order
   * @param {string} userId - User ID
   * @param {Object} orderData - Order parameters
   * @returns {Promise<Object>} Created order
   */
  async placeOrder(userId, orderData) {
    try {
      const account = await this.getOrCreateAccount(userId);
      const { symbol, side, type, amount, price, stopPrice } = orderData;
      
      // Validate order parameters
      this.validateOrderParameters(orderData);
      
      // Parse symbol to get base and quote assets
      const [baseAsset, quoteAsset] = symbol.split('/');
      
      // Calculate required balance and validate
      const requiredAsset = side === 'buy' ? quoteAsset : baseAsset;
      const requiredAmount = side === 'buy' ? amount * (price || await this.getCurrentPrice(symbol)) : amount;
      
      if (account.getAvailableBalance(requiredAsset) < requiredAmount) {
        throw new Error(`Insufficient balance. Required: ${requiredAmount} ${requiredAsset}, Available: ${account.getAvailableBalance(requiredAsset)}`);
      }
      
      // Lock the required balance
      account.lockBalance(requiredAsset, requiredAmount);
      
      // Create order with paper trading flag
      const order = new Order({
        userId,
        exchangeName: 'paper_trading',
        symbol,
        side,
        type,
        amount,
        price,
        stopPrice,
        status: type === 'market' ? 'filled' : 'open',
        isPaperTrade: true,
        clientOrderId: this.generateClientOrderId(userId),
        exchangeOrderId: this.generateExchangeOrderId()
      });
      
      // For market orders, execute immediately
      if (type === 'market') {
        await this.executeMarketOrder(order, account);
      }
      
      await order.save();
      await account.save();
      
      logger.info(`Paper trading order placed: ${order.clientOrderId}`);
      return order;
      
    } catch (error) {
      logger.error('Error placing paper trading order:', error);
      throw error;
    }
  }

  /**
   * Execute market order immediately
   * @param {Object} order - Order document
   * @param {Object} account - Paper trading account
   */
  async executeMarketOrder(order, account) {
    try {
      // Simulate latency
      await new Promise(resolve => setTimeout(resolve, this.simulatedLatency));
      
      // Get current market price
      const currentPrice = await this.getCurrentPrice(order.symbol);
      
      // Apply slippage for market orders
      const executionPrice = this.applySlippage(currentPrice, order.side);
      
      // Calculate actual amounts after slippage
      const [baseAsset, quoteAsset] = order.symbol.split('/');
      
      let fromAsset, fromAmount, toAsset, toAmount;
      
      if (order.side === 'buy') {
        fromAsset = quoteAsset;
        fromAmount = order.amount * executionPrice;
        toAsset = baseAsset;
        toAmount = order.amount;
      } else {
        fromAsset = baseAsset;
        fromAmount = order.amount;
        toAsset = quoteAsset;
        toAmount = order.amount * executionPrice;
      }
      
      // Update account balances
      account.updateBalanceAfterTrade(fromAsset, fromAmount, toAsset, toAmount);
      
      // Update order with execution details
      order.status = 'filled';
      order.filled = order.amount;
      order.remaining = 0;
      order.averagePrice = executionPrice;
      order.executedAt = new Date();
      order.trades = [{
        price: executionPrice,
        amount: order.amount,
        timestamp: new Date(),
        fee: this.calculateTradingFee(order.amount * executionPrice)
      }];
      
      // Update account performance
      await this.updateAccountPerformance(account, order, executionPrice);
      
    } catch (error) {
      logger.error('Error executing market order:', error);
      throw error;
    }
  }

  /**
   * Cancel paper trading order
   * @param {string} userId - User ID
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Cancelled order
   */
  async cancelOrder(userId, orderId) {
    try {
      const order = await Order.findOne({ 
        _id: orderId, 
        userId, 
        isPaperTrade: true,
        status: { $in: ['open', 'partially_filled'] }
      });
      
      if (!order) {
        throw new Error('Order not found or cannot be cancelled');
      }
      
      const account = await this.getOrCreateAccount(userId);
      
      // Calculate amount to unlock
      const [baseAsset, quoteAsset] = order.symbol.split('/');
      const requiredAsset = order.side === 'buy' ? quoteAsset : baseAsset;
      const lockedAmount = order.side === 'buy' 
        ? (order.amount - order.filled) * order.price 
        : (order.amount - order.filled);
      
      // Unlock the balance
      account.unlockBalance(requiredAsset, lockedAmount);
      
      // Update order status
      order.status = 'cancelled';
      order.cancelledAt = new Date();
      
      await order.save();
      await account.save();
      
      logger.info(`Paper trading order cancelled: ${order.clientOrderId}`);
      return order;
      
    } catch (error) {
      logger.error('Error cancelling paper trading order:', error);
      throw error;
    }
  }

  /**
   * Get paper trading portfolio summary
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Portfolio summary
   */
  async getPortfolioSummary(userId) {
    try {
      const account = await this.getOrCreateAccount(userId);
      
      // Calculate current portfolio value
      let totalValue = 0;
      const holdings = [];
      
      for (const [asset, balance] of account.virtualBalances) {
        if (balance.total > 0) {
          let assetValue;
          if (asset === account.baseCurrency) {
            assetValue = balance.total;
          } else {
            // Get current price for conversion
            const symbol = `${asset}/${account.baseCurrency}`;
            try {
              const price = await this.getCurrentPrice(symbol);
              assetValue = balance.total * price;
            } catch (error) {
              assetValue = 0; // If price not available
            }
          }
          
          totalValue += assetValue;
          holdings.push({
            asset,
            amount: balance.total,
            available: balance.available,
            locked: balance.locked,
            value: assetValue,
            percentage: 0 // Will be calculated after totalValue is known
          });
        }
      }
      
      // Calculate percentages
      holdings.forEach(holding => {
        holding.percentage = totalValue > 0 ? (holding.value / totalValue) * 100 : 0;
      });
      
      // Calculate performance metrics
      const totalPnL = totalValue - account.initialBalance;
      const totalPnLPercentage = (totalPnL / account.initialBalance) * 100;
      
      return {
        accountId: account._id,
        totalValue,
        initialBalance: account.initialBalance,
        totalPnL,
        totalPnLPercentage,
        holdings,
        performance: account.performance,
        riskSettings: account.riskSettings,
        dailyStats: account.dailyStats.slice(-30), // Last 30 days
        isActive: account.isActive
      };
      
    } catch (error) {
      logger.error('Error getting portfolio summary:', error);
      throw error;
    }
  }

  /**
   * Reset paper trading account
   * @param {string} userId - User ID
   * @param {number} newBalance - New starting balance
   * @param {string} reason - Reset reason
   * @returns {Promise<Object>} Reset account
   */
  async resetAccount(userId, newBalance = 100000, reason = 'manual_reset') {
    try {
      const account = await this.getOrCreateAccount(userId);
      
      // Cancel all open orders first
      await Order.updateMany(
        { 
          userId, 
          isPaperTrade: true, 
          status: { $in: ['open', 'partially_filled'] } 
        },
        { 
          status: 'cancelled',
          cancelledAt: new Date()
        }
      );
      
      // Reset the account
      account.resetAccount(newBalance, reason);
      await account.save();
      
      logger.info(`Paper trading account reset for user ${userId}, new balance: ${newBalance}`);
      return account;
      
    } catch (error) {
      logger.error('Error resetting paper trading account:', error);
      throw error;
    }
  }

  /**
   * Process pending limit orders (called periodically)
   * @param {string} userId - User ID (optional, if not provided, processes all users)
   */
  async processPendingOrders(userId = null) {
    try {
      const query = { 
        isPaperTrade: true, 
        status: { $in: ['open', 'partially_filled'] },
        type: { $in: ['limit', 'stop', 'stop_limit', 'take_profit'] }
      };
      
      if (userId) {
        query.userId = userId;
      }
      
      const orders = await Order.find(query);
      
      for (const order of orders) {
        await this.checkAndExecuteLimitOrder(order);
      }
      
    } catch (error) {
      logger.error('Error processing pending orders:', error);
      throw error;
    }
  }

  /**
   * Check and execute limit order if conditions are met
   * @param {Object} order - Order document
   */
  async checkAndExecuteLimitOrder(order) {
    try {
      const currentPrice = await this.getCurrentPrice(order.symbol);
      const account = await this.getOrCreateAccount(order.userId);
      
      let shouldExecute = false;
      
      switch (order.type) {
        case 'limit':
          shouldExecute = (order.side === 'buy' && currentPrice <= order.price) ||
                         (order.side === 'sell' && currentPrice >= order.price);
          break;
        case 'stop':
          shouldExecute = (order.side === 'buy' && currentPrice >= order.stopPrice) ||
                         (order.side === 'sell' && currentPrice <= order.stopPrice);
          break;
        case 'stop_limit':
          shouldExecute = (order.side === 'buy' && currentPrice >= order.stopPrice) ||
                         (order.side === 'sell' && currentPrice <= order.stopPrice);
          break;
        case 'take_profit':
          shouldExecute = (order.side === 'buy' && currentPrice <= order.price) ||
                         (order.side === 'sell' && currentPrice >= order.price);
          break;
      }
      
      if (shouldExecute) {
        const executionPrice = order.type === 'stop' ? currentPrice : order.price;
        await this.executeLimitOrder(order, account, executionPrice);
      }
      
    } catch (error) {
      logger.error(`Error checking limit order ${order._id}:`, error);
    }
  }

  /**
   * Execute limit order
   * @param {Object} order - Order document
   * @param {Object} account - Paper trading account
   * @param {number} executionPrice - Execution price
   */
  async executeLimitOrder(order, account, executionPrice) {
    try {
      const [baseAsset, quoteAsset] = order.symbol.split('/');
      
      let fromAsset, fromAmount, toAsset, toAmount;
      
      if (order.side === 'buy') {
        fromAsset = quoteAsset;
        fromAmount = order.amount * executionPrice;
        toAsset = baseAsset;
        toAmount = order.amount;
      } else {
        fromAsset = baseAsset;
        fromAmount = order.amount;
        toAsset = quoteAsset;
        toAmount = order.amount * executionPrice;
      }
      
      // Update account balances
      account.updateBalanceAfterTrade(fromAsset, fromAmount, toAsset, toAmount);
      
      // Update order
      order.status = 'filled';
      order.filled = order.amount;
      order.remaining = 0;
      order.averagePrice = executionPrice;
      order.executedAt = new Date();
      order.trades = [{
        price: executionPrice,
        amount: order.amount,
        timestamp: new Date(),
        fee: this.calculateTradingFee(order.amount * executionPrice)
      }];
      
      await order.save();
      await this.updateAccountPerformance(account, order, executionPrice);
      await account.save();
      
      logger.info(`Limit order executed: ${order.clientOrderId} at price ${executionPrice}`);
      
    } catch (error) {
      logger.error('Error executing limit order:', error);
      throw error;
    }
  }

  // Helper methods
  validateOrderParameters(orderData) {
    const { symbol, side, type, amount, price, stopPrice } = orderData;
    
    if (!symbol || !side || !type || !amount) {
      throw new Error('Missing required order parameters');
    }
    
    if (!['buy', 'sell'].includes(side)) {
      throw new Error('Invalid order side');
    }
    
    if (!['market', 'limit', 'stop', 'stop_limit', 'take_profit'].includes(type)) {
      throw new Error('Invalid order type');
    }
    
    if (amount <= 0) {
      throw new Error('Order amount must be positive');
    }
    
    if (['limit', 'stop_limit', 'take_profit'].includes(type) && (!price || price <= 0)) {
      throw new Error('Price is required for limit orders');
    }
    
    if (['stop', 'stop_limit'].includes(type) && (!stopPrice || stopPrice <= 0)) {
      throw new Error('Stop price is required for stop orders');
    }
  }

  async getCurrentPrice(symbol) {
    try {
      const ticker = await marketDataService.getTicker(symbol);
      return ticker.data.unified ? ticker.data.unified.averagePrice : ticker.data.byExchange[0].last;
    } catch (error) {
      throw new Error(`Unable to get current price for ${symbol}`);
    }
  }

  applySlippage(price, side) {
    const slippage = side === 'buy' ? this.slippageFactor : -this.slippageFactor;
    return price * (1 + slippage);
  }

  calculateTradingFee(value) {
    const feeRate = 0.001; // 0.1% trading fee
    return value * feeRate;
  }

  generateClientOrderId(userId) {
    return `WRT_PAPER_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  generateExchangeOrderId() {
    return `PAPER_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  async updateAccountPerformance(account, order, executionPrice) {
    // Update basic stats
    account.performance.totalTrades += 1;
    account.performance.totalVolume += order.amount * executionPrice;
    
    // For now, we'll calculate basic metrics
    // More sophisticated P&L tracking would require position tracking
    const tradeFee = this.calculateTradingFee(order.amount * executionPrice);
    account.performance.realizedPnL -= tradeFee; // Subtract fees
    
    // Update daily stats
    account.updateDailyStats(1, -tradeFee, order.amount * executionPrice);
  }
}

// Export singleton instance
module.exports = new PaperTradingService();