const express = require('express');
const Joi = require('joi');
const { authenticateToken: auth } = require('../middleware/auth');
const advancedOrderService = require('../services/trading/advancedOrderService');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const ocoOrderSchema = Joi.object({
  symbol: Joi.string().required().pattern(/^[A-Z]+\/[A-Z]+$/),
  side: Joi.string().valid('buy', 'sell').required(),
  amount: Joi.number().positive().required(),
  price: Joi.number().positive().required(),
  stopPrice: Joi.number().positive().required(),
  stopLimitPrice: Joi.number().positive().optional(),
  exchangeName: Joi.string().valid('binance', 'coinbase', 'kraken', 'paper_trading').default('paper_trading')
});

const trailingStopSchema = Joi.object({
  symbol: Joi.string().required().pattern(/^[A-Z]+\/[A-Z]+$/),
  side: Joi.string().valid('buy', 'sell').required(),
  amount: Joi.number().positive().required(),
  trailingAmount: Joi.number().positive().optional(),
  trailingPercent: Joi.number().min(0.01).max(99.99).optional(),
  activationPrice: Joi.number().positive().optional(),
  exchangeName: Joi.string().valid('binance', 'coinbase', 'kraken', 'paper_trading').default('paper_trading')
}).xor('trailingAmount', 'trailingPercent');

const icebergOrderSchema = Joi.object({
  symbol: Joi.string().required().pattern(/^[A-Z]+\/[A-Z]+$/),
  side: Joi.string().valid('buy', 'sell').required(),
  type: Joi.string().valid('limit', 'market').default('limit'),
  totalAmount: Joi.number().positive().required(),
  visibleSize: Joi.number().positive().required().less(Joi.ref('totalAmount')),
  price: Joi.number().positive().when('type', {
    is: 'limit',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  exchangeName: Joi.string().valid('binance', 'coinbase', 'kraken', 'paper_trading').default('paper_trading')
});

/**
 * @route POST /api/advanced-orders/oco
 * @desc Place an OCO (One-Cancels-Other) order
 * @access Private
 */
router.post('/oco', auth, async (req, res) => {
  try {
    // Validate request body
    const { error, value } = ocoOrderSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OCO order parameters',
        errors: error.details.map(detail => detail.message)
      });
    }

    const result = await advancedOrderService.placeOCOOrder(req.user.userId, value);
    
    res.status(201).json({
      success: true,
      message: 'OCO order placed successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error placing OCO order:', error);
    
    if (error.message.includes('Invalid') || 
        error.message.includes('Missing') ||
        error.message.includes('must be')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to place OCO order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/advanced-orders/trailing-stop
 * @desc Place a trailing stop order
 * @access Private
 */
router.post('/trailing-stop', auth, async (req, res) => {
  try {
    // Validate request body
    const { error, value } = trailingStopSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid trailing stop order parameters',
        errors: error.details.map(detail => detail.message)
      });
    }

    const order = await advancedOrderService.placeTrailingStopOrder(req.user.userId, value);
    
    res.status(201).json({
      success: true,
      message: 'Trailing stop order placed successfully',
      data: { order }
    });
  } catch (error) {
    logger.error('Error placing trailing stop order:', error);
    
    if (error.message.includes('Invalid') || 
        error.message.includes('Missing') ||
        error.message.includes('must be')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to place trailing stop order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/advanced-orders/iceberg
 * @desc Place an iceberg order
 * @access Private
 */
router.post('/iceberg', auth, async (req, res) => {
  try {
    // Validate request body
    const { error, value } = icebergOrderSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid iceberg order parameters',
        errors: error.details.map(detail => detail.message)
      });
    }

    const order = await advancedOrderService.placeIcebergOrder(req.user.userId, value);
    
    res.status(201).json({
      success: true,
      message: 'Iceberg order placed successfully',
      data: { order }
    });
  } catch (error) {
    logger.error('Error placing iceberg order:', error);
    
    if (error.message.includes('Invalid') || 
        error.message.includes('Missing') ||
        error.message.includes('must be')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to place iceberg order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route DELETE /api/advanced-orders/oco/:orderId
 * @desc Cancel an OCO order
 * @access Private
 */
router.delete('/oco/:orderId', auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    const result = await advancedOrderService.cancelOCOOrder(req.user.userId, orderId);
    
    res.json({
      success: true,
      message: 'OCO order cancelled successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error cancelling OCO order:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to cancel OCO order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route DELETE /api/advanced-orders/trailing-stop/:orderId
 * @desc Cancel a trailing stop order
 * @access Private
 */
router.delete('/trailing-stop/:orderId', auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    const order = await advancedOrderService.cancelTrailingStopOrder(req.user.userId, orderId);
    
    res.json({
      success: true,
      message: 'Trailing stop order cancelled successfully',
      data: { order }
    });
  } catch (error) {
    logger.error('Error cancelling trailing stop order:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to cancel trailing stop order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/advanced-orders/active
 * @desc Get all active advanced orders for user
 * @access Private
 */
router.get('/active', auth, async (req, res) => {
  try {
    const { type } = req.query;
    
    const query = {
      userId: req.user.userId,
      status: { $in: ['open', 'pending'] }
    };
    
    if (type) {
      if (['oco', 'trailing_stop', 'iceberg'].includes(type)) {
        query.type = type;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid order type filter'
        });
      }
    } else {
      query.type = { $in: ['oco', 'trailing_stop', 'iceberg'] };
    }
    
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .populate('metadata.parentOrderId', 'type status')
      .populate('advancedOrderData.oco.linkedOrderId', 'type status symbol side amount price');
    
    res.json({
      success: true,
      data: { orders }
    });
  } catch (error) {
    logger.error('Error fetching active advanced orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active advanced orders',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/advanced-orders/:orderId
 * @desc Get specific advanced order details
 * @access Private
 */
router.get('/:orderId', auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }
    
    const order = await Order.findOne({
      _id: orderId,
      userId: req.user.userId,
      type: { $in: ['oco', 'trailing_stop', 'iceberg'] }
    })
    .populate('metadata.parentOrderId')
    .populate('advancedOrderData.oco.linkedOrderId')
    .populate('advancedOrderData.iceberg.childOrders.orderId');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Advanced order not found'
      });
    }
    
    res.json({
      success: true,
      data: { order }
    });
  } catch (error) {
    logger.error('Error fetching advanced order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch advanced order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/advanced-orders/history
 * @desc Get advanced orders history
 * @access Private
 */
router.get('/history', auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      symbol,
      status,
      startDate,
      endDate
    } = req.query;
    
    const query = {
      userId: req.user.userId,
      type: { $in: ['oco', 'trailing_stop', 'iceberg'] }
    };
    
    // Apply filters
    if (type && ['oco', 'trailing_stop', 'iceberg'].includes(type)) {
      query.type = type;
    }
    
    if (symbol) {
      query.symbol = symbol.toUpperCase();
    }
    
    if (status) {
      query.status = status;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('advancedOrderData.oco.linkedOrderId', 'type status symbol side amount price'),
      Order.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching advanced orders history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch advanced orders history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;