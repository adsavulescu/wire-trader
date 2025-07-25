const Order = require('../../models/Order');
const marketDataService = require('../market/marketDataService');
const paperTradingService = require('./paperTradingService');
const logger = require('../../utils/logger');

/**
 * Advanced Order Service
 * Handles complex order types like OCO, Trailing Stop, and Iceberg orders
 */
class AdvancedOrderService {
  constructor() {
    this.activeTrailingStops = new Map(); // Track active trailing stop orders
    this.processingInterval = null;
    this.priceUpdateInterval = 60000; // Update prices every minute
  }

  /**
   * Initialize the service with background processing
   */
  initialize() {
    this.startPriceMonitoring();
    logger.info('Advanced Order Service initialized');
  }

  /**
   * Start background monitoring of trailing stops
   */
  startPriceMonitoring() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(async () => {
      try {
        await this.processTrailingStops();
      } catch (error) {
        logger.error('Error processing trailing stops:', error);
      }
    }, this.priceUpdateInterval);
  }

  /**
   * Stop background monitoring
   */
  stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Place an OCO (One-Cancels-Other) order
   * @param {string} userId - User ID
   * @param {Object} orderData - OCO order parameters
   * @returns {Promise<Object>} Created OCO orders
   */
  async placeOCOOrder(userId, orderData) {
    try {
      const {
        symbol,
        side,
        amount,
        price,        // Limit order price
        stopPrice,    // Stop order price
        stopLimitPrice, // Stop limit price (optional)
        exchangeName = 'paper_trading'
      } = orderData;

      this.validateOCOParameters(orderData);

      // Generate order list ID for linking
      const orderListId = this.generateOrderListId();

      // Create limit order
      const limitOrder = new Order({
        userId,
        exchangeName,
        symbol,
        side,
        type: 'limit',
        amount,
        price,
        isPaperTrade: exchangeName === 'paper_trading',
        advancedOrderData: {
          oco: {
            orderListId,
            contingencyType: 'OCO',
            listStatusType: 'RESPONSE',
            listOrderStatus: 'EXECUTING'
          }
        },
        metadata: {
          strategy: 'OCO'
        }
      });

      // Create stop order (market or limit)
      const stopOrderType = stopLimitPrice ? 'stop_limit' : 'stop';
      const stopOrder = new Order({
        userId,
        exchangeName,
        symbol,
        side,
        type: stopOrderType,
        amount,
        price: stopLimitPrice,
        stopPrice,
        isPaperTrade: exchangeName === 'paper_trading',
        advancedOrderData: {
          oco: {
            orderListId,
            contingencyType: 'OCO',
            listStatusType: 'RESPONSE',
            listOrderStatus: 'EXECUTING'
          }
        },
        metadata: {
          strategy: 'OCO'
        }
      });

      // Link the orders
      limitOrder.advancedOrderData.oco.linkedOrderId = stopOrder._id;
      stopOrder.advancedOrderData.oco.linkedOrderId = limitOrder._id;

      // Save both orders
      await limitOrder.save();
      await stopOrder.save();

      logger.info(`OCO order placed: ${orderListId} with orders ${limitOrder._id} and ${stopOrder._id}`);

      return {
        orderListId,
        orders: [limitOrder, stopOrder]
      };

    } catch (error) {
      logger.error('Error placing OCO order:', error);
      throw error;
    }
  }

  /**
   * Place a Trailing Stop order
   * @param {string} userId - User ID
   * @param {Object} orderData - Trailing stop parameters
   * @returns {Promise<Object>} Created trailing stop order
   */
  async placeTrailingStopOrder(userId, orderData) {
    try {
      const {
        symbol,
        side,
        amount,
        trailingAmount,
        trailingPercent,
        activationPrice,
        exchangeName = 'paper_trading'
      } = orderData;

      this.validateTrailingStopParameters(orderData);

      // Get current market price
      const currentPrice = await this.getCurrentPrice(symbol);

      // Calculate initial stop price
      let initialStopPrice;
      if (side === 'sell') {
        if (trailingAmount) {
          initialStopPrice = currentPrice - trailingAmount;
        } else {
          initialStopPrice = currentPrice * (1 - trailingPercent / 100);
        }
      } else { // buy
        if (trailingAmount) {
          initialStopPrice = currentPrice + trailingAmount;
        } else {
          initialStopPrice = currentPrice * (1 + trailingPercent / 100);
        }
      }

      const order = new Order({
        userId,
        exchangeName,
        symbol,
        side,
        type: 'trailing_stop',
        amount,
        stopPrice: initialStopPrice,
        isPaperTrade: exchangeName === 'paper_trading',
        advancedOrderData: {
          trailingStop: {
            trailingAmount,
            trailingPercent,
            activationPrice,
            currentStopPrice: initialStopPrice,
            highestPrice: side === 'sell' ? currentPrice : 0,
            lowestPrice: side === 'buy' ? currentPrice : Infinity,
            isActivated: activationPrice ? currentPrice >= activationPrice : true
          }
        },
        metadata: {
          strategy: 'TrailingStop'
        }
      });

      await order.save();

      // Add to active monitoring
      this.activeTrailingStops.set(order._id.toString(), order);

      logger.info(`Trailing stop order placed: ${order._id} for ${symbol}`);
      return order;

    } catch (error) {
      logger.error('Error placing trailing stop order:', error);
      throw error;
    }
  }

  /**
   * Place an Iceberg order
   * @param {string} userId - User ID
   * @param {Object} orderData - Iceberg order parameters
   * @returns {Promise<Object>} Created iceberg order
   */
  async placeIcebergOrder(userId, orderData) {
    try {
      const {
        symbol,
        side,
        type = 'limit',
        totalAmount,
        visibleSize,
        price,
        exchangeName = 'paper_trading'
      } = orderData;

      this.validateIcebergParameters(orderData);

      // Create parent iceberg order
      const parentOrder = new Order({
        userId,
        exchangeName,
        symbol,
        side,
        type: 'iceberg',
        amount: totalAmount,
        price,
        isPaperTrade: exchangeName === 'paper_trading',
        advancedOrderData: {
          iceberg: {
            visibleSize,
            totalSize: totalAmount,
            executedSize: 0,
            hiddenRemaining: totalAmount,
            childOrders: []
          }
        },
        metadata: {
          strategy: 'Iceberg'
        }
      });

      await parentOrder.save();

      // Create first visible child order
      const firstChildOrder = await this.createIcebergChildOrder(parentOrder, type);
      
      logger.info(`Iceberg order placed: ${parentOrder._id} with first child ${firstChildOrder._id}`);
      return parentOrder;

    } catch (error) {
      logger.error('Error placing iceberg order:', error);
      throw error;
    }
  }

  /**
   * Cancel an OCO order (cancels both linked orders)
   * @param {string} userId - User ID
   * @param {string} orderId - Order ID of either OCO order
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelOCOOrder(userId, orderId) {
    try {
      const order = await Order.findOne({
        _id: orderId,
        userId,
        'advancedOrderData.oco': { $exists: true }
      });

      if (!order) {
        throw new Error('OCO order not found');
      }

      const linkedOrderId = order.advancedOrderData.oco.linkedOrderId;
      const linkedOrder = await Order.findById(linkedOrderId);

      // Cancel both orders
      const cancelledOrders = [];

      if (order.status === 'open') {
        order.status = 'cancelled';
        order.cancelledAt = new Date();
        order.advancedOrderData.oco.listOrderStatus = 'ALL_DONE';
        await order.save();
        cancelledOrders.push(order);
      }

      if (linkedOrder && linkedOrder.status === 'open') {
        linkedOrder.status = 'cancelled';
        linkedOrder.cancelledAt = new Date();
        linkedOrder.advancedOrderData.oco.listOrderStatus = 'ALL_DONE';
        await linkedOrder.save();
        cancelledOrders.push(linkedOrder);
      }

      logger.info(`OCO order cancelled: ${order.advancedOrderData.oco.orderListId}`);
      return { cancelledOrders };

    } catch (error) {
      logger.error('Error cancelling OCO order:', error);
      throw error;
    }
  }

  /**
   * Cancel a trailing stop order
   * @param {string} userId - User ID
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Cancelled order
   */
  async cancelTrailingStopOrder(userId, orderId) {
    try {
      const order = await Order.findOne({
        _id: orderId,
        userId,
        type: 'trailing_stop'
      });

      if (!order) {
        throw new Error('Trailing stop order not found');
      }

      order.status = 'cancelled';
      order.cancelledAt = new Date();
      await order.save();

      // Remove from active monitoring
      this.activeTrailingStops.delete(orderId);

      logger.info(`Trailing stop order cancelled: ${orderId}`);
      return order;

    } catch (error) {
      logger.error('Error cancelling trailing stop order:', error);
      throw error;
    }
  }

  /**
   * Process active trailing stop orders
   */
  async processTrailingStops() {
    const activeOrders = await Order.find({
      type: 'trailing_stop',
      status: 'open',
      'advancedOrderData.trailingStop': { $exists: true }
    });

    for (const order of activeOrders) {
      try {
        await this.updateTrailingStop(order);
      } catch (error) {
        logger.error(`Error updating trailing stop ${order._id}:`, error);
      }
    }
  }

  /**
   * Update a specific trailing stop order
   * @param {Object} order - Trailing stop order
   */
  async updateTrailingStop(order) {
    try {
      const currentPrice = await this.getCurrentPrice(order.symbol);
      const trailingData = order.advancedOrderData.trailingStop;

      // Check if order should be activated
      if (!trailingData.isActivated && trailingData.activationPrice) {
        if ((order.side === 'sell' && currentPrice >= trailingData.activationPrice) ||
            (order.side === 'buy' && currentPrice <= trailingData.activationPrice)) {
          trailingData.isActivated = true;
        }
      }

      if (!trailingData.isActivated) {
        return; // Not activated yet
      }

      let shouldUpdateStop = false;
      let newStopPrice = trailingData.currentStopPrice;

      if (order.side === 'sell') {
        // For sell orders, trail up when price increases
        if (currentPrice > trailingData.highestPrice) {
          trailingData.highestPrice = currentPrice;
          
          if (trailingData.trailingAmount) {
            newStopPrice = currentPrice - trailingData.trailingAmount;
          } else {
            newStopPrice = currentPrice * (1 - trailingData.trailingPercent / 100);
          }
          
          if (newStopPrice > trailingData.currentStopPrice) {
            shouldUpdateStop = true;
          }
        }

        // Check if stop should trigger
        if (currentPrice <= trailingData.currentStopPrice) {
          await this.triggerTrailingStop(order, currentPrice);
          return;
        }
      } else {
        // For buy orders, trail down when price decreases
        if (currentPrice < trailingData.lowestPrice) {
          trailingData.lowestPrice = currentPrice;
          
          if (trailingData.trailingAmount) {
            newStopPrice = currentPrice + trailingData.trailingAmount;
          } else {
            newStopPrice = currentPrice * (1 + trailingData.trailingPercent / 100);
          }
          
          if (newStopPrice < trailingData.currentStopPrice) {
            shouldUpdateStop = true;
          }
        }

        // Check if stop should trigger
        if (currentPrice >= trailingData.currentStopPrice) {
          await this.triggerTrailingStop(order, currentPrice);
          return;
        }
      }

      if (shouldUpdateStop) {
        trailingData.currentStopPrice = newStopPrice;
        order.stopPrice = newStopPrice;
        order.markModified('advancedOrderData');
        await order.save();
        
        logger.debug(`Updated trailing stop for ${order._id}: new stop price ${newStopPrice}`);
      }

    } catch (error) {
      logger.error(`Error updating trailing stop ${order._id}:`, error);
    }
  }

  /**
   * Trigger a trailing stop order (convert to market order)
   * @param {Object} order - Trailing stop order
   * @param {number} triggerPrice - Price that triggered the stop
   */
  async triggerTrailingStop(order, triggerPrice) {
    try {
      // Convert to market order and execute
      order.type = 'market';
      order.status = 'filled';
      order.executedAt = new Date();
      order.averagePrice = triggerPrice;
      order.filled = order.amount;
      order.remaining = 0;

      await order.save();

      // Remove from active monitoring
      this.activeTrailingStops.delete(order._id.toString());

      // If it's a paper trade, update the paper trading account
      if (order.isPaperTrade) {
        // This would integrate with paper trading service to execute the trade
        // For now, we'll just log it
        logger.info(`Paper trading trailing stop executed: ${order._id} at price ${triggerPrice}`);
      }

      logger.info(`Trailing stop triggered: ${order._id} at price ${triggerPrice}`);

    } catch (error) {
      logger.error(`Error triggering trailing stop ${order._id}:`, error);
    }
  }

  /**
   * Create a child order for iceberg execution
   * @param {Object} parentOrder - Parent iceberg order
   * @param {string} orderType - Type of child order
   * @returns {Promise<Object>} Created child order
   */
  async createIcebergChildOrder(parentOrder, orderType = 'limit') {
    try {
      const icebergData = parentOrder.advancedOrderData.iceberg;
      const visibleAmount = Math.min(icebergData.visibleSize, icebergData.hiddenRemaining);

      const childOrder = new Order({
        userId: parentOrder.userId,
        exchangeName: parentOrder.exchangeName,
        symbol: parentOrder.symbol,
        side: parentOrder.side,
        type: orderType,
        amount: visibleAmount,
        price: parentOrder.price,
        isPaperTrade: parentOrder.isPaperTrade,
        metadata: {
          strategy: 'IcebergChild',
          parentOrderId: parentOrder._id
        }
      });

      await childOrder.save();

      // Update parent order
      icebergData.childOrders.push({
        orderId: childOrder._id,
        size: visibleAmount,
        status: childOrder.status,
        createdAt: new Date()
      });

      icebergData.hiddenRemaining -= visibleAmount;
      parentOrder.markModified('advancedOrderData');
      await parentOrder.save();

      return childOrder;

    } catch (error) {
      logger.error('Error creating iceberg child order:', error);
      throw error;
    }
  }

  // Helper methods
  validateOCOParameters(orderData) {
    const { symbol, side, amount, price, stopPrice } = orderData;
    
    if (!symbol || !side || !amount || !price || !stopPrice) {
      throw new Error('Missing required OCO parameters');
    }
    
    if (amount <= 0 || price <= 0 || stopPrice <= 0) {
      throw new Error('All amounts and prices must be positive');
    }
    
    if (side === 'sell' && stopPrice >= price) {
      throw new Error('For sell OCO, stop price must be less than limit price');
    }
    
    if (side === 'buy' && stopPrice <= price) {
      throw new Error('For buy OCO, stop price must be greater than limit price');
    }
  }

  validateTrailingStopParameters(orderData) {
    const { symbol, side, amount, trailingAmount, trailingPercent } = orderData;
    
    if (!symbol || !side || !amount) {
      throw new Error('Missing required trailing stop parameters');
    }
    
    if (!trailingAmount && !trailingPercent) {
      throw new Error('Either trailingAmount or trailingPercent must be specified');
    }
    
    if (trailingAmount && trailingAmount <= 0) {
      throw new Error('Trailing amount must be positive');
    }
    
    if (trailingPercent && (trailingPercent <= 0 || trailingPercent >= 100)) {
      throw new Error('Trailing percent must be between 0 and 100');
    }
  }

  validateIcebergParameters(orderData) {
    const { symbol, side, totalAmount, visibleSize } = orderData;
    
    if (!symbol || !side || !totalAmount || !visibleSize) {
      throw new Error('Missing required iceberg parameters');
    }
    
    if (totalAmount <= 0 || visibleSize <= 0) {
      throw new Error('Total amount and visible size must be positive');
    }
    
    if (visibleSize >= totalAmount) {
      throw new Error('Visible size must be less than total amount');
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

  generateOrderListId() {
    return `OCO_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }
}

// Export singleton instance
module.exports = new AdvancedOrderService();