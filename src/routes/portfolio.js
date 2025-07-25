const express = require('express');
const Joi = require('joi');
const { authenticateToken: auth } = require('../middleware/auth');
const portfolioService = require('../services/portfolio/portfolioService');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const portfolioSettingsSchema = Joi.object({
  autoRebalance: Joi.object({
    enabled: Joi.boolean(),
    threshold: Joi.number().min(1).max(50)
  }).optional(),
  riskManagement: Joi.object({
    maxAssetAllocation: Joi.number().min(5).max(100),
    maxExchangeAllocation: Joi.number().min(10).max(100),
    stopLossThreshold: Joi.number().min(1).max(50)
  }).optional(),
  notifications: Joi.object({
    dailyReport: Joi.boolean(),
    performanceAlerts: Joi.boolean(),
    rebalanceAlerts: Joi.boolean()
  }).optional()
});

const holdingsFilterSchema = Joi.object({
  minValue: Joi.number().min(0).optional(),
  asset: Joi.string().optional(),
  exchange: Joi.string().optional()
});

/**
 * @route GET /api/portfolio
 * @desc Get portfolio summary
 * @access Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const summary = await portfolioService.getPortfolioSummary(req.user.userId);
    
    res.json({
      success: true,
      data: { portfolio: summary }
    });
  } catch (error) {
    logger.error('Error fetching portfolio summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch portfolio summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/portfolio/holdings
 * @desc Get detailed portfolio holdings
 * @access Private
 */
router.get('/holdings', auth, async (req, res) => {
  try {
    // Validate query parameters
    const { error, value } = holdingsFilterSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filter parameters',
        errors: error.details.map(detail => detail.message)
      });
    }

    const holdings = await portfolioService.getPortfolioHoldings(req.user.userId, value);
    
    res.json({
      success: true,
      data: { holdings }
    });
  } catch (error) {
    logger.error('Error fetching portfolio holdings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch portfolio holdings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/portfolio/performance
 * @desc Get portfolio performance history
 * @access Private
 */
router.get('/performance', auth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const daysNum = parseInt(days);
    
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
      return res.status(400).json({
        success: false,
        message: 'Days parameter must be between 1 and 365'
      });
    }

    const performance = await portfolioService.getPortfolioPerformanceHistory(req.user.userId, daysNum);
    
    res.json({
      success: true,
      data: { 
        performance,
        timeframe: `${daysNum}d`,
        recordCount: performance.length
      }
    });
  } catch (error) {
    logger.error('Error fetching portfolio performance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch portfolio performance',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/portfolio/sync
 * @desc Manually sync portfolio balances from exchanges
 * @access Private
 */
router.post('/sync', auth, async (req, res) => {
  try {
    const portfolio = await portfolioService.syncPortfolioBalances(req.user.userId);
    
    res.json({
      success: true,
      message: 'Portfolio synchronized successfully',
      data: { 
        portfolio: {
          totalValue: portfolio.totalValue,
          lastSyncDate: portfolio.lastSyncDate,
          syncStatus: portfolio.syncStatus,
          assetCount: portfolio.assetCount
        }
      }
    });
  } catch (error) {
    logger.error('Error syncing portfolio:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync portfolio',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/portfolio/allocation
 * @desc Get portfolio allocation breakdown
 * @access Private
 */
router.get('/allocation', auth, async (req, res) => {
  try {
    const summary = await portfolioService.getPortfolioSummary(req.user.userId);
    
    res.json({
      success: true,
      data: { 
        allocation: summary.allocation,
        diversificationScore: summary.diversificationScore,
        totalValue: summary.totalValue.current
      }
    });
  } catch (error) {
    logger.error('Error fetching portfolio allocation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch portfolio allocation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route PUT /api/portfolio/settings
 * @desc Update portfolio settings
 * @access Private
 */
router.put('/settings', auth, async (req, res) => {
  try {
    // Validate request body
    const { error, value } = portfolioSettingsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid settings parameters',
        errors: error.details.map(detail => detail.message)
      });
    }

    const portfolio = await portfolioService.updatePortfolioSettings(req.user.userId, value);
    
    res.json({
      success: true,
      message: 'Portfolio settings updated successfully',
      data: { settings: portfolio.settings }
    });
  } catch (error) {
    logger.error('Error updating portfolio settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update portfolio settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/portfolio/metrics
 * @desc Get detailed portfolio metrics
 * @access Private
 */
router.get('/metrics', auth, async (req, res) => {
  try {
    const summary = await portfolioService.getPortfolioSummary(req.user.userId);
    
    // Calculate additional metrics
    const metrics = {
      overview: {
        totalValue: summary.totalValue.current,
        totalPnL: summary.performance.totalPnL.total,
        totalPnLPercentage: summary.performance.totalPnLPercentage,
        costBasis: summary.totalValue.costBasis,
        assetCount: summary.assetCount,
        diversificationScore: summary.diversificationScore
      },
      performance: {
        realizedPnL: summary.performance.totalPnL.realized,
        unrealizedPnL: summary.performance.totalPnL.unrealized,
        bestPerformingAsset: summary.performance.bestPerformingAsset,
        worstPerformingAsset: summary.performance.worstPerformingAsset,
        volatility: summary.performance.volatility,
        sharpeRatio: summary.performance.sharpeRatio
      },
      risk: {
        highWaterMark: summary.performance.highWaterMark,
        maxDrawdown: summary.performance.maxDrawdown,
        currentDrawdown: summary.performance.highWaterMark.value - summary.totalValue.current
      },
      allocation: {
        byType: summary.allocation.byType,
        topHoldings: Array.from(summary.holdings)
          .filter(([, holding]) => holding.totalAmount > 0)
          .sort(([, a], [, b]) => b.currentValue - a.currentValue)
          .slice(0, 5)
          .map(([asset, holding]) => ({
            asset,
            value: holding.currentValue,
            percentage: summary.totalValue.current > 0 
              ? (holding.currentValue / summary.totalValue.current) * 100 
              : 0,
            pnlPercentage: holding.unrealizedPnLPercentage
          }))
      }
    };
    
    res.json({
      success: true,
      data: { metrics }
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
 * @route GET /api/portfolio/asset/:asset
 * @desc Get detailed information for a specific asset
 * @access Private
 */
router.get('/asset/:asset', auth, async (req, res) => {
  try {
    const { asset } = req.params;
    const assetSymbol = asset.toUpperCase();
    
    const summary = await portfolioService.getPortfolioSummary(req.user.userId);
    const holding = summary.holdings[assetSymbol];
    
    if (!holding || holding.totalAmount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found in portfolio'
      });
    }
    
    // Calculate asset-specific metrics
    const assetDetails = {
      asset: assetSymbol,
      ...holding,
      exchanges: Object.fromEntries(holding.exchanges || new Map()),
      portfolioPercentage: summary.totalValue.current > 0 
        ? (holding.currentValue / summary.totalValue.current) * 100 
        : 0,
      profitLoss: {
        realized: holding.realizedPnL,
        unrealized: holding.unrealizedPnL,
        unrealizedPercentage: holding.unrealizedPnLPercentage,
        total: holding.realizedPnL + holding.unrealizedPnL
      }
    };
    
    res.json({
      success: true,
      data: { asset: assetDetails }
    });
  } catch (error) {
    logger.error('Error fetching asset details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch asset details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/portfolio/rebalance
 * @desc Get rebalancing recommendations
 * @access Private
 */
router.get('/rebalance', auth, async (req, res) => {
  try {
    const summary = await portfolioService.getPortfolioSummary(req.user.userId);
    const recommendations = [];
    
    // Simple rebalancing logic based on target allocations
    for (const [asset, allocation] of summary.allocation.byAsset) {
      if (allocation.targetPercentage > 0) {
        const currentPercentage = allocation.percentage;
        const targetPercentage = allocation.targetPercentage;
        const deviation = Math.abs(currentPercentage - targetPercentage);
        
        if (deviation > summary.settings.autoRebalance.threshold) {
          const action = currentPercentage > targetPercentage ? 'SELL' : 'BUY';
          const amount = (Math.abs(currentPercentage - targetPercentage) / 100) * summary.totalValue.current;
          
          recommendations.push({
            asset,
            action,
            currentPercentage,
            targetPercentage,
            deviation,
            recommendedAmount: amount,
            priority: deviation > 10 ? 'HIGH' : deviation > 5 ? 'MEDIUM' : 'LOW'
          });
        }
      }
    }
    
    // Sort by deviation (highest first)
    recommendations.sort((a, b) => b.deviation - a.deviation);
    
    res.json({
      success: true,
      data: { 
        recommendations,
        needsRebalancing: recommendations.length > 0,
        threshold: summary.settings.autoRebalance.threshold
      }
    });
  } catch (error) {
    logger.error('Error generating rebalance recommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate rebalance recommendations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/portfolio/export
 * @desc Export portfolio data
 * @access Private
 */
router.get('/export', auth, async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    
    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid export format. Use: json or csv'
      });
    }
    
    const summary = await portfolioService.getPortfolioSummary(req.user.userId);
    const holdings = await portfolioService.getPortfolioHoldings(req.user.userId);
    
    const exportData = {
      exportDate: new Date(),
      portfolio: summary,
      holdings,
      metadata: {
        baseCurrency: summary.settings?.baseCurrency || 'USDT',
        totalAssets: holdings.length,
        exportFormat: format
      }
    };
    
    if (format === 'csv') {
      // Simple CSV conversion (would need proper CSV library for production)
      const csvHeaders = 'Asset,Amount,Value,Price,PnL,PnL%,Percentage\n';
      const csvRows = holdings.map(holding => 
        `${holding.asset},${holding.totalAmount},${holding.currentValue},${holding.currentPrice},${holding.unrealizedPnL},${holding.unrealizedPnLPercentage},${holding.percentage}`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=portfolio-${Date.now()}.csv`);
      res.send(csvHeaders + csvRows);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=portfolio-${Date.now()}.json`);
      res.json({
        success: true,
        data: exportData
      });
    }
  } catch (error) {
    logger.error('Error exporting portfolio:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export portfolio',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;