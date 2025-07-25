const express = require('express');
const Joi = require('joi');
const { authenticateToken: auth } = require('../middleware/auth');
const paperTradingService = require('../services/trading/paperTradingService');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const orderSchema = Joi.object({
  symbol: Joi.string().required().pattern(/^[A-Z]+\/[A-Z]+$/),
  side: Joi.string().valid('buy', 'sell').required(),
  type: Joi.string().valid('market', 'limit', 'stop', 'stop_limit', 'take_profit').required(),
  amount: Joi.number().positive().required(),
  price: Joi.number().positive().when('type', {
    is: Joi.string().valid('limit', 'stop_limit', 'take_profit'),
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  stopPrice: Joi.number().positive().when('type', {
    is: Joi.string().valid('stop', 'stop_limit'),
    then: Joi.required(),
    otherwise: Joi.optional()
  })
});

const resetAccountSchema = Joi.object({
  newBalance: Joi.number().min(1000).default(100000),
  reason: Joi.string().valid('manual_reset', 'performance_reset', 'strategy_change').default('manual_reset')
});

/**
 * @route GET /api/paper-trading/account
 * @desc Get paper trading account information
 * @access Private
 */
router.get('/account', auth, async (req, res) => {
  try {
    const account = await paperTradingService.getOrCreateAccount(req.user.userId);
    
    res.json({
      success: true,
      data: { account }
    });
  } catch (error) {
    logger.error('Error fetching paper trading account:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch account information',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/paper-trading/balance
 * @desc Get paper trading balance
 * @access Private
 */
router.get('/balance', auth, async (req, res) => {
  try {
    const { asset } = req.query;
    const balance = await paperTradingService.getBalance(req.user.userId, asset);
    
    res.json({
      success: true,
      data: { balance }
    });
  } catch (error) {
    logger.error('Error fetching paper trading balance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch balance information',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/paper-trading/portfolio
 * @desc Get paper trading portfolio summary
 * @access Private
 */
router.get('/portfolio', auth, async (req, res) => {
  try {
    const portfolio = await paperTradingService.getPortfolioSummary(req.user.userId);
    
    res.json({
      success: true,
      data: { portfolio }
    });
  } catch (error) {
    logger.error('Error fetching portfolio summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch portfolio information',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/paper-trading/orders
 * @desc Place a paper trading order
 * @access Private
 */
router.post('/orders', auth, async (req, res) => {
  try {
    // Validate request body
    const { error, value } = orderSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order parameters',
        errors: error.details.map(detail => detail.message)
      });
    }

    const order = await paperTradingService.placeOrder(req.user.userId, value);
    
    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: { order }
    });
  } catch (error) {
    logger.error('Error placing paper trading order:', error);
    
    if (error.message.includes('Insufficient balance') || 
        error.message.includes('Invalid order')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to place order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route DELETE /api/paper-trading/orders/:orderId
 * @desc Cancel a paper trading order
 * @access Private
 */
router.delete('/orders/:orderId', auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format'
      });
    }

    const order = await paperTradingService.cancelOrder(req.user.userId, orderId);
    
    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: { order }
    });
  } catch (error) {
    logger.error('Error cancelling paper trading order:', error);
    
    if (error.message.includes('not found') || 
        error.message.includes('cannot be cancelled')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/paper-trading/account/reset
 * @desc Reset paper trading account
 * @access Private
 */
router.post('/account/reset', auth, async (req, res) => {
  try {
    // Validate request body
    const { error, value } = resetAccountSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset parameters',
        errors: error.details.map(detail => detail.message)
      });
    }

    const account = await paperTradingService.resetAccount(
      req.user.userId, 
      value.newBalance, 
      value.reason
    );
    
    res.json({
      success: true,
      message: 'Account reset successfully',
      data: { account }
    });
  } catch (error) {
    logger.error('Error resetting paper trading account:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/paper-trading/process-orders
 * @desc Manually trigger processing of pending orders (for development/testing)
 * @access Private
 */
router.post('/process-orders', auth, async (req, res) => {
  try {
    await paperTradingService.processPendingOrders(req.user.userId);
    
    res.json({
      success: true,
      message: 'Pending orders processed successfully'
    });
  } catch (error) {
    logger.error('Error processing pending orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process pending orders',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/paper-trading/performance
 * @desc Get detailed performance analytics
 * @access Private
 */
router.get('/performance', auth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const portfolio = await paperTradingService.getPortfolioSummary(req.user.userId);
    
    // Filter daily stats based on requested days
    const daysNum = parseInt(days);
    const filteredStats = portfolio.dailyStats.slice(-daysNum);
    
    // Calculate additional performance metrics
    const performanceMetrics = {
      totalReturn: portfolio.totalPnLPercentage,
      totalReturnValue: portfolio.totalPnL,
      winRate: portfolio.performance.totalTrades > 0 
        ? (portfolio.performance.winningTrades / portfolio.performance.totalTrades) * 100 
        : 0,
      averageTradeSize: portfolio.performance.totalTrades > 0 
        ? portfolio.performance.totalVolume / portfolio.performance.totalTrades 
        : 0,
      maxDrawdown: portfolio.performance.maxDrawdown,
      highWaterMark: portfolio.performance.highWaterMark,
      dailyStats: filteredStats,
      sharpeRatio: 0, // Would need more sophisticated calculation
      volatility: 0   // Would need price history
    };
    
    res.json({
      success: true,
      data: { performance: performanceMetrics }
    });
  } catch (error) {
    logger.error('Error fetching performance analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;