const express = require('express');
const Joi = require('joi');
const { authenticateToken: auth } = require('../middleware/auth');
const performanceAnalyticsService = require('../services/analytics/performanceAnalyticsService');
const TradingPosition = require('../models/TradingPosition');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const analyticsOptionsSchema = Joi.object({
  timeframe: Joi.string().valid('7d', '30d', '90d', '365d', 'all').default('30d'),
  includeOpenPositions: Joi.boolean().default(true),
  includePaperTrading: Joi.boolean().default(true)
});

const positionFilterSchema = Joi.object({
  symbol: Joi.string().pattern(/^[A-Z]+\/[A-Z]+$/).optional(),
  status: Joi.string().valid('open', 'closed').optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

/**
 * @route GET /api/analytics/performance
 * @desc Get comprehensive performance analytics
 * @access Private
 */
router.get('/performance', auth, async (req, res) => {
  try {
    // Validate query parameters
    const { error, value } = analyticsOptionsSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid analytics options',
        errors: error.details.map(detail => detail.message)
      });
    }

    const analytics = await performanceAnalyticsService.getPerformanceAnalytics(
      req.user.userId, 
      value
    );
    
    res.json({
      success: true,
      data: { analytics }
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

/**
 * @route GET /api/analytics/portfolio
 * @desc Get portfolio metrics summary
 * @access Private
 */
router.get('/portfolio', auth, async (req, res) => {
  try {
    const portfolioMetrics = await performanceAnalyticsService.getPortfolioMetrics(req.user.userId);
    
    res.json({
      success: true,
      data: { portfolio: portfolioMetrics }
    });
  } catch (error) {
    logger.error('Error fetching portfolio metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch portfolio metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/analytics/pnl
 * @desc Get P&L analytics
 * @access Private
 */
router.get('/pnl', auth, async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    if (!['7d', '30d', '90d', '365d', 'all'].includes(timeframe)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid timeframe. Use: 7d, 30d, 90d, 365d, or all'
      });
    }

    const pnlAnalytics = await performanceAnalyticsService.getPnLAnalytics(
      req.user.userId, 
      timeframe
    );
    
    res.json({
      success: true,
      data: { pnl: pnlAnalytics }
    });
  } catch (error) {
    logger.error('Error fetching P&L analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch P&L analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/analytics/trading-stats
 * @desc Get trading statistics
 * @access Private
 */
router.get('/trading-stats', auth, async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    if (!['7d', '30d', '90d', '365d', 'all'].includes(timeframe)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid timeframe. Use: 7d, 30d, 90d, 365d, or all'
      });
    }

    const tradingStats = await performanceAnalyticsService.getTradingStatistics(
      req.user.userId, 
      timeframe
    );
    
    res.json({
      success: true,
      data: { tradingStats }
    });
  } catch (error) {
    logger.error('Error fetching trading statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trading statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/analytics/risk
 * @desc Get risk metrics
 * @access Private
 */
router.get('/risk', auth, async (req, res) => {
  try {
    const riskMetrics = await performanceAnalyticsService.getRiskMetrics(req.user.userId);
    
    res.json({
      success: true,
      data: { risk: riskMetrics }
    });
  } catch (error) {
    logger.error('Error fetching risk metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch risk metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/analytics/symbols
 * @desc Get performance by symbol/asset
 * @access Private
 */
router.get('/symbols', auth, async (req, res) => {
  try {
    const symbolPerformance = await performanceAnalyticsService.getSymbolPerformance(req.user.userId);
    
    res.json({
      success: true,
      data: { symbols: symbolPerformance }
    });
  } catch (error) {
    logger.error('Error fetching symbol performance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch symbol performance',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/analytics/time-based
 * @desc Get performance across different time periods
 * @access Private
 */
router.get('/time-based', auth, async (req, res) => {
  try {
    const timeBasedPerformance = await performanceAnalyticsService.getTimeBasedPerformance(req.user.userId);
    
    res.json({
      success: true,
      data: { timeBasedPerformance }
    });
  } catch (error) {
    logger.error('Error fetching time-based performance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch time-based performance',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/analytics/positions
 * @desc Get trading positions with analytics
 * @access Private
 */
router.get('/positions', auth, async (req, res) => {
  try {
    // Validate query parameters
    const { error, value } = positionFilterSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid position filter parameters',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { symbol, status, startDate, endDate, page, limit } = value;
    
    // Build query
    const query = { userId: req.user.userId };
    
    if (symbol) {
      query.symbol = symbol.toUpperCase();
    }
    
    if (status) {
      query.status = status;
    }
    
    if (startDate || endDate) {
      query.entryDate = {};
      if (startDate) query.entryDate.$gte = new Date(startDate);
      if (endDate) query.entryDate.$lte = new Date(endDate);
    }
    
    const skip = (page - 1) * limit;
    
    const [positions, total] = await Promise.all([
      TradingPosition.find(query)
        .sort({ entryDate: -1 })
        .skip(skip)
        .limit(limit)
        .populate('entryOrders.orderId', 'clientOrderId exchangeOrderId')
        .populate('exitOrders.orderId', 'clientOrderId exchangeOrderId'),
      TradingPosition.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        positions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching positions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch positions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/analytics/positions/:positionId
 * @desc Get specific position details with analytics
 * @access Private
 */
router.get('/positions/:positionId', auth, async (req, res) => {
  try {
    const { positionId } = req.params;
    
    if (!positionId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid position ID format'
      });
    }
    
    const position = await TradingPosition.findOne({
      _id: positionId,
      userId: req.user.userId
    })
    .populate('entryOrders.orderId')
    .populate('exitOrders.orderId');
    
    if (!position) {
      return res.status(404).json({
        success: false,
        message: 'Position not found'
      });
    }
    
    // Calculate additional analytics for this position
    const analytics = {
      duration: position.duration,
      isWinning: position.isWinning,
      roi: position.entryValue > 0 ? (position.netPnL / position.entryValue) * 100 : 0,
      riskRewardRatio: position.maxDrawdown.value !== 0 
        ? Math.abs(position.maxProfit.value / position.maxDrawdown.value) 
        : 0
    };
    
    res.json({
      success: true,
      data: {
        position,
        analytics
      }
    });
  } catch (error) {
    logger.error('Error fetching position details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch position details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/analytics/refresh
 * @desc Manually refresh performance data
 * @access Private
 */
router.post('/refresh', auth, async (req, res) => {
  try {
    // Update P&L for open positions
    await performanceAnalyticsService.updateOpenPositionsPnL();
    
    res.json({
      success: true,
      message: 'Performance data refreshed successfully'
    });
  } catch (error) {
    logger.error('Error refreshing performance data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh performance data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/analytics/export
 * @desc Export performance data
 * @access Private
 */
router.get('/export', auth, async (req, res) => {
  try {
    const { format = 'json', timeframe = '30d' } = req.query;
    
    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid export format. Use: json or csv'
      });
    }
    
    const analytics = await performanceAnalyticsService.getPerformanceAnalytics(
      req.user.userId,
      { timeframe, includeOpenPositions: true, includePaperTrading: true }
    );
    
    if (format === 'csv') {
      // Convert to CSV format (simplified)
      const csvData = `Date,Total PnL,Win Rate,Total Trades,Profit Factor
${analytics.pnlAnalytics.pnlTimeSeries.map(p => 
  `${p.date},${p.cumulativePnL},${analytics.tradingStats.winRate},${p.tradesCount},${analytics.tradingStats.profitFactor}`
).join('\n')}`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=performance-${timeframe}-${Date.now()}.csv`);
      res.send(csvData);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=performance-${timeframe}-${Date.now()}.json`);
      res.json({
        success: true,
        exportDate: new Date(),
        timeframe,
        data: analytics
      });
    }
  } catch (error) {
    logger.error('Error exporting performance data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export performance data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;