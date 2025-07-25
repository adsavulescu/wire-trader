const express = require('express');
const Joi = require('joi');
const { authenticateToken: authenticate } = require('../middleware/auth');
const tradingService = require('../services/trading/tradingService');
const logger = require('../utils/logger');

const router = express.Router();

const orderSchema = Joi.object({
  exchangeName: Joi.string().valid('binance', 'coinbase', 'kraken', 'kucoin', 'lcx').required(),
  symbol: Joi.string()
    .pattern(/^[A-Z]+\/[A-Z]+$/)
    .required(),
  type: Joi.string().valid('market', 'limit', 'stop', 'stop_limit', 'take_profit').required(),
  side: Joi.string().valid('buy', 'sell').required(),
  amount: Joi.number().positive().required(),
  price: Joi.number()
    .positive()
    .when('type', {
      is: Joi.string().valid('limit', 'stop_limit', 'take_profit'),
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
  stopPrice: Joi.number()
    .positive()
    .when('type', {
      is: Joi.string().valid('stop', 'stop_limit'),
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
  timeInForce: Joi.string().valid('GTC', 'IOC', 'FOK').optional(),
  reduceOnly: Joi.boolean().optional(),
  postOnly: Joi.boolean().optional(),
  strategy: Joi.string().max(100).optional(),
  notes: Joi.string().max(500).optional()
});

const orderHistorySchema = Joi.object({
  exchangeName: Joi.string().valid('binance', 'coinbase', 'kraken', 'kucoin', 'lcx').optional(),
  symbol: Joi.string()
    .pattern(/^[A-Z]+\/[A-Z]+$/)
    .optional(),
  status: Joi.string()
    .valid('pending', 'open', 'closed', 'canceled', 'expired', 'rejected')
    .optional(),
  side: Joi.string().valid('buy', 'sell').optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
  limit: Joi.number().integer().min(1).max(500).default(100),
  offset: Joi.number().integer().min(0).default(0)
});

router.post('/orders', authenticate, async (req, res) => {
  try {
    const { error, value } = orderSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const order = await tradingService.placeOrder(req.user.userId, value);

    logger.info('Order placed via API', {
      userId: req.user.userId,
      orderId: order._id,
      exchangeName: order.exchangeName,
      symbol: order.symbol
    });

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: {
        order: {
          id: order._id,
          exchangeName: order.exchangeName,
          symbol: order.symbol,
          type: order.type,
          side: order.side,
          amount: order.amount,
          price: order.price,
          stopPrice: order.stopPrice,
          status: order.status,
          filled: order.filled,
          remaining: order.remaining,
          cost: order.cost,
          fee: order.fee,
          exchangeOrderId: order.exchangeOrderId,
          clientOrderId: order.clientOrderId,
          timeInForce: order.timeInForce,
          timestamps: order.timestamps,
          metadata: order.metadata
        }
      }
    });
  } catch (error) {
    logger.error('Order placement failed via API', {
      userId: req.user.userId,
      error: error.message,
      orderData: req.body
    });

    const statusCode = error.message.includes('Insufficient')
      ? 400
      : error.message.includes('not supported')
        ? 400
        : error.message.includes('not connected')
          ? 400
          : error.message.includes('Invalid')
            ? 400
            : 500;

    res.status(statusCode).json({
      success: false,
      message: 'Failed to place order',
      error: error.message
    });
  }
});

router.get('/orders', authenticate, async (req, res) => {
  try {
    const { error, value } = orderHistorySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const orders = await tradingService.getOrderHistory(req.user.userId, value);

    res.json({
      success: true,
      message: 'Order history retrieved successfully',
      data: {
        orders: orders.map(order => ({
          id: order._id,
          exchangeName: order.exchangeName,
          symbol: order.symbol,
          type: order.type,
          side: order.side,
          amount: order.amount,
          price: order.price,
          stopPrice: order.stopPrice,
          status: order.status,
          filled: order.filled,
          remaining: order.remaining,
          cost: order.cost,
          averagePrice: order.averagePrice,
          fillPercentage: order.fillPercentage,
          fee: order.fee,
          exchangeOrderId: order.exchangeOrderId,
          clientOrderId: order.clientOrderId,
          timeInForce: order.timeInForce,
          timestamps: order.timestamps,
          metadata: order.metadata,
          trades: order.trades
        })),
        pagination: {
          limit: value.limit,
          offset: value.offset,
          total: orders.length
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get order history via API', {
      userId: req.user.userId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve order history',
      error: error.message
    });
  }
});

router.get('/orders/active', authenticate, async (req, res) => {
  try {
    const { exchangeName } = req.query;

    if (exchangeName && !['binance', 'coinbase', 'kraken', 'kucoin', 'lcx'].includes(exchangeName)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid exchange name'
      });
    }

    const orders = await tradingService.getActiveOrders(req.user.userId, exchangeName);

    res.json({
      success: true,
      message: 'Active orders retrieved successfully',
      data: {
        orders: orders.map(order => ({
          id: order._id,
          exchangeName: order.exchangeName,
          symbol: order.symbol,
          type: order.type,
          side: order.side,
          amount: order.amount,
          price: order.price,
          stopPrice: order.stopPrice,
          status: order.status,
          filled: order.filled,
          remaining: order.remaining,
          cost: order.cost,
          averagePrice: order.averagePrice,
          fillPercentage: order.fillPercentage,
          fee: order.fee,
          exchangeOrderId: order.exchangeOrderId,
          clientOrderId: order.clientOrderId,
          timeInForce: order.timeInForce,
          timestamps: order.timestamps,
          metadata: order.metadata
        })),
        count: orders.length
      }
    });
  } catch (error) {
    logger.error('Failed to get active orders via API', {
      userId: req.user.userId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve active orders',
      error: error.message
    });
  }
});

router.get('/orders/:orderId', authenticate, async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    const order = await tradingService.getOrderById(req.user.userId, orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      message: 'Order retrieved successfully',
      data: {
        order: {
          id: order._id,
          exchangeName: order.exchangeName,
          symbol: order.symbol,
          type: order.type,
          side: order.side,
          amount: order.amount,
          price: order.price,
          stopPrice: order.stopPrice,
          status: order.status,
          filled: order.filled,
          remaining: order.remaining,
          cost: order.cost,
          averagePrice: order.averagePrice,
          fillPercentage: order.fillPercentage,
          fee: order.fee,
          exchangeOrderId: order.exchangeOrderId,
          clientOrderId: order.clientOrderId,
          timeInForce: order.timeInForce,
          timestamps: order.timestamps,
          metadata: order.metadata,
          trades: order.trades,
          errors: order.orderErrors
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get order by ID via API', {
      userId: req.user.userId,
      orderId: req.params.orderId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve order',
      error: error.message
    });
  }
});

router.put('/orders/:orderId/refresh', authenticate, async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    const order = await tradingService.updateOrderStatus(req.user.userId, orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: {
        order: {
          id: order._id,
          status: order.status,
          filled: order.filled,
          remaining: order.remaining,
          cost: order.cost,
          averagePrice: order.averagePrice,
          fillPercentage: order.fillPercentage,
          fee: order.fee,
          timestamps: order.timestamps,
          trades: order.trades
        }
      }
    });
  } catch (error) {
    logger.error('Failed to refresh order status via API', {
      userId: req.user.userId,
      orderId: req.params.orderId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to refresh order status',
      error: error.message
    });
  }
});

router.delete('/orders/:orderId', authenticate, async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    const order = await tradingService.cancelOrder(req.user.userId, orderId);

    logger.info('Order canceled via API', {
      userId: req.user.userId,
      orderId: order._id,
      exchangeOrderId: order.exchangeOrderId
    });

    res.json({
      success: true,
      message: 'Order canceled successfully',
      data: {
        order: {
          id: order._id,
          status: order.status,
          timestamps: order.timestamps
        }
      }
    });
  } catch (error) {
    logger.error('Failed to cancel order via API', {
      userId: req.user.userId,
      orderId: req.params.orderId,
      error: error.message
    });

    const statusCode = error.message.includes('not found')
      ? 404
      : error.message.includes('Cannot cancel')
        ? 400
        : error.message.includes('not connected')
          ? 400
          : 500;

    res.status(statusCode).json({
      success: false,
      message: 'Failed to cancel order',
      error: error.message
    });
  }
});

router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = tradingService.getStats();

    res.json({
      success: true,
      message: 'Trading statistics retrieved successfully',
      data: {
        activeOrdersCount: stats.activeOrdersCount,
        monitoringInterval: stats.monitoringInterval,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get trading stats via API', {
      userId: req.user.userId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve trading statistics',
      error: error.message
    });
  }
});

module.exports = router;
