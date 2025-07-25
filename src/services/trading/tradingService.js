const Order = require('../../models/Order');
const exchangeManager = require('../exchanges/exchangeManager');
const logger = require('../../utils/logger');

class TradingService {
  constructor() {
    this.activeOrders = new Map();
    this.orderUpdateInterval = 5000; // 5 seconds
    this.startOrderMonitoring();
  }

  async placeOrder(userId, orderData) {
    try {
      const validatedOrder = await this.validateOrder(userId, orderData);

      const order = new Order({
        userId,
        exchangeName: orderData.exchangeName,
        symbol: orderData.symbol.toUpperCase(),
        type: orderData.type,
        side: orderData.side,
        amount: orderData.amount,
        price: orderData.price,
        stopPrice: orderData.stopPrice,
        timeInForce: orderData.timeInForce || 'GTC',
        reduceOnly: orderData.reduceOnly || false,
        postOnly: orderData.postOnly || false,
        metadata: {
          strategy: orderData.strategy,
          notes: orderData.notes
        }
      });

      await order.save();

      try {
        const exchangeOrder = await this.submitOrderToExchange(userId, order);

        order.updateFromExchange(exchangeOrder);
        order.status = 'open';
        order.timestamps.submitted = new Date();

        await order.save();

        if (order.isActive) {
          this.activeOrders.set(order._id.toString(), order);
        }

        logger.info('Order placed successfully', {
          userId,
          orderId: order._id,
          exchangeName: order.exchangeName,
          symbol: order.symbol,
          type: order.type,
          side: order.side,
          amount: order.amount,
          exchangeOrderId: order.exchangeOrderId
        });

        return order;
      } catch (exchangeError) {
        order.status = 'rejected';
        order.addError(exchangeError.message, exchangeError.code, 'exchange');
        await order.save();

        logger.error('Order rejected by exchange', {
          userId,
          orderId: order._id,
          error: exchangeError.message
        });

        throw exchangeError;
      }
    } catch (error) {
      logger.error('Failed to place order', {
        userId,
        orderData,
        error: error.message
      });
      throw error;
    }
  }

  async validateOrder(userId, orderData) {
    const requiredFields = ['exchangeName', 'symbol', 'type', 'side', 'amount'];
    const missingFields = requiredFields.filter(field => !orderData[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    if (
      !exchangeManager
        .getSupportedExchanges()
        .map(e => e.id)
        .includes(orderData.exchangeName)
    ) {
      throw new Error(`Exchange ${orderData.exchangeName} is not supported`);
    }

    if (!['buy', 'sell'].includes(orderData.side)) {
      throw new Error('Side must be either "buy" or "sell"');
    }

    if (!['market', 'limit', 'stop', 'stop_limit', 'take_profit'].includes(orderData.type)) {
      throw new Error('Invalid order type');
    }

    if (orderData.amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    if (['limit', 'stop_limit', 'take_profit'].includes(orderData.type) && !orderData.price) {
      throw new Error(`Price is required for ${orderData.type} orders`);
    }

    if (['stop', 'stop_limit'].includes(orderData.type) && !orderData.stopPrice) {
      throw new Error(`Stop price is required for ${orderData.type} orders`);
    }

    const exchange = exchangeManager.getExchange(userId, orderData.exchangeName);
    if (!exchange) {
      throw new Error(`Exchange ${orderData.exchangeName} is not connected for this user`);
    }

    await this.validateBalance(userId, orderData);
    await this.validateSymbol(userId, orderData);

    return orderData;
  }

  async validateBalance(userId, orderData) {
    try {
      const exchange = exchangeManager.getExchange(userId, orderData.exchangeName);
      const balance = await exchange.fetchBalance();

      const [base, quote] = orderData.symbol.split('/');
      const requiredCurrency = orderData.side === 'buy' ? quote : base;

      let requiredAmount;
      if (orderData.side === 'buy') {
        if (orderData.type === 'market') {
          const ticker = await exchange.fetchTicker(orderData.symbol);
          requiredAmount = orderData.amount * ticker.last;
        } else {
          requiredAmount = orderData.amount * orderData.price;
        }
      } else {
        requiredAmount = orderData.amount;
      }

      const availableBalance = balance[requiredCurrency]?.free || 0;

      if (availableBalance < requiredAmount) {
        throw new Error(
          `Insufficient ${requiredCurrency} balance. Required: ${requiredAmount}, Available: ${availableBalance}`
        );
      }
    } catch (error) {
      logger.error('Balance validation failed', {
        userId,
        orderData,
        error: error.message
      });
      throw error;
    }
  }

  async validateSymbol(userId, orderData) {
    try {
      const exchange = exchangeManager.getExchange(userId, orderData.exchangeName);
      const markets = await exchange.loadMarkets();

      if (!markets[orderData.symbol]) {
        throw new Error(`Symbol ${orderData.symbol} is not available on ${orderData.exchangeName}`);
      }

      const market = markets[orderData.symbol];

      if (orderData.amount < market.limits.amount.min) {
        throw new Error(
          `Amount ${orderData.amount} is below minimum ${market.limits.amount.min} for ${orderData.symbol}`
        );
      }

      if (market.limits.amount.max && orderData.amount > market.limits.amount.max) {
        throw new Error(
          `Amount ${orderData.amount} exceeds maximum ${market.limits.amount.max} for ${orderData.symbol}`
        );
      }

      if (orderData.price && market.limits.price.min && orderData.price < market.limits.price.min) {
        throw new Error(
          `Price ${orderData.price} is below minimum ${market.limits.price.min} for ${orderData.symbol}`
        );
      }

      if (orderData.price && market.limits.price.max && orderData.price > market.limits.price.max) {
        throw new Error(
          `Price ${orderData.price} exceeds maximum ${market.limits.price.max} for ${orderData.symbol}`
        );
      }
    } catch (error) {
      logger.error('Symbol validation failed', {
        userId,
        orderData,
        error: error.message
      });
      throw error;
    }
  }

  async submitOrderToExchange(userId, order) {
    const exchange = exchangeManager.getExchange(userId, order.exchangeName);

    const orderParams = {
      symbol: order.symbol,
      type: order.type,
      side: order.side,
      amount: order.amount
    };

    if (['limit', 'stop_limit', 'take_profit'].includes(order.type)) {
      orderParams.price = order.price;
    }

    if (['stop', 'stop_limit'].includes(order.type)) {
      orderParams.stopPrice = order.stopPrice;
    }

    if (order.clientOrderId) {
      orderParams.clientOrderId = order.clientOrderId;
    }

    const extraParams = {};
    if (order.timeInForce !== 'GTC') {
      extraParams.timeInForce = order.timeInForce;
    }
    if (order.reduceOnly) {
      extraParams.reduceOnly = order.reduceOnly;
    }
    if (order.postOnly) {
      extraParams.postOnly = order.postOnly;
    }

    return await exchange.createOrder(
      orderParams.symbol,
      orderParams.type,
      orderParams.side,
      orderParams.amount,
      orderParams.price,
      extraParams
    );
  }

  async cancelOrder(userId, orderId) {
    try {
      const order = await Order.findOne({ _id: orderId, userId });

      if (!order) {
        throw new Error('Order not found');
      }

      if (order.isComplete) {
        throw new Error('Cannot cancel completed order');
      }

      const exchange = exchangeManager.getExchange(userId, order.exchangeName);
      if (!exchange) {
        throw new Error(`Exchange ${order.exchangeName} is not connected`);
      }

      await exchange.cancelOrder(order.exchangeOrderId, order.symbol);

      order.status = 'canceled';
      order.timestamps.canceled = new Date();
      await order.save();

      this.activeOrders.delete(orderId);

      logger.info('Order canceled successfully', {
        userId,
        orderId,
        exchangeOrderId: order.exchangeOrderId
      });

      return order;
    } catch (error) {
      logger.error('Failed to cancel order', {
        userId,
        orderId,
        error: error.message
      });
      throw error;
    }
  }

  async getOrderHistory(userId, filters = {}) {
    try {
      const query = { userId };

      if (filters.exchangeName) {
        query.exchangeName = filters.exchangeName;
      }

      if (filters.symbol) {
        query.symbol = filters.symbol.toUpperCase();
      }

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.side) {
        query.side = filters.side;
      }

      if (filters.startDate || filters.endDate) {
        query['timestamps.created'] = {};
        if (filters.startDate) {
          query['timestamps.created'].$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query['timestamps.created'].$lte = new Date(filters.endDate);
        }
      }

      const orders = await Order.find(query)
        .sort({ 'timestamps.created': -1 })
        .limit(filters.limit || 100)
        .skip(filters.offset || 0);

      return orders;
    } catch (error) {
      logger.error('Failed to get order history', {
        userId,
        filters,
        error: error.message
      });
      throw error;
    }
  }

  async getActiveOrders(userId, exchangeName = null) {
    try {
      const query = {
        userId,
        status: { $in: ['pending', 'open'] }
      };

      if (exchangeName) {
        query.exchangeName = exchangeName;
      }

      const orders = await Order.find(query).sort({ 'timestamps.created': -1 });
      return orders;
    } catch (error) {
      logger.error('Failed to get active orders', {
        userId,
        exchangeName,
        error: error.message
      });
      throw error;
    }
  }

  async updateOrderStatus(userId, orderId) {
    try {
      const order = await Order.findOne({ _id: orderId, userId });

      if (!order || order.isComplete) {
        return order;
      }

      const exchange = exchangeManager.getExchange(userId, order.exchangeName);
      if (!exchange) {
        return order;
      }

      const exchangeOrder = await exchange.fetchOrder(order.exchangeOrderId, order.symbol);
      order.updateFromExchange(exchangeOrder);
      await order.save();

      if (order.isComplete) {
        this.activeOrders.delete(orderId);
      }

      return order;
    } catch (error) {
      logger.error('Failed to update order status', {
        userId,
        orderId,
        error: error.message
      });
      return null;
    }
  }

  startOrderMonitoring() {
    setInterval(async () => {
      try {
        await this.updateActiveOrders();
      } catch (error) {
        logger.error('Order monitoring error', error);
      }
    }, this.orderUpdateInterval);
  }

  async updateActiveOrders() {
    const activeOrderIds = Array.from(this.activeOrders.keys());

    for (const orderId of activeOrderIds) {
      try {
        const order = this.activeOrders.get(orderId);
        if (order) {
          await this.updateOrderStatus(order.userId, orderId);
        }
      } catch (error) {
        logger.error('Failed to update active order', {
          orderId,
          error: error.message
        });
      }
    }
  }

  async getOrderById(userId, orderId) {
    try {
      const order = await Order.findOne({ _id: orderId, userId });
      return order;
    } catch (error) {
      logger.error('Failed to get order by ID', {
        userId,
        orderId,
        error: error.message
      });
      throw error;
    }
  }

  getStats() {
    return {
      activeOrdersCount: this.activeOrders.size,
      monitoringInterval: this.orderUpdateInterval
    };
  }
}

const tradingService = new TradingService();

module.exports = tradingService;
