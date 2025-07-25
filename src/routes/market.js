const express = require('express');
const Joi = require('joi');
const { authenticate } = require('../middleware/auth');
const marketDataService = require('../services/market/marketDataService');
const logger = require('../utils/logger');

const router = express.Router();

const symbolSchema = Joi.string()
  .pattern(/^[A-Z]+\/[A-Z]+$/)
  .required();
const exchangeSchema = Joi.string().valid('binance', 'coinbase', 'kraken').required();
const timeframeSchema = Joi.string()
  .valid('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w')
  .default('1h');
const limitSchema = Joi.number().integer().min(1).max(1000).default(100);

router.get('/ticker/:exchange/:symbol', authenticate, async (req, res) => {
  try {
    const { error: exchangeError } = exchangeSchema.validate(req.params.exchange);
    if (exchangeError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid exchange name',
        errors: exchangeError.details.map(detail => detail.message)
      });
    }

    const { error: symbolError } = symbolSchema.validate(req.params.symbol);
    if (symbolError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid symbol format',
        errors: symbolError.details.map(detail => detail.message)
      });
    }

    const ticker = await marketDataService.getTicker(req.params.exchange, req.params.symbol);

    res.json({
      success: true,
      message: 'Ticker data retrieved successfully',
      data: { ticker }
    });
  } catch (error) {
    logger.error('Failed to get ticker via API', {
      userId: req.user.userId,
      exchange: req.params.exchange,
      symbol: req.params.symbol,
      error: error.message
    });

    const statusCode = error.message.includes('not supported') ? 400 : 500;

    res.status(statusCode).json({
      success: false,
      message: 'Failed to retrieve ticker data',
      error: error.message
    });
  }
});

router.get('/ticker/:symbol', authenticate, async (req, res) => {
  try {
    const { error } = symbolSchema.validate(req.params.symbol);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid symbol format',
        errors: error.details.map(detail => detail.message)
      });
    }

    const unifiedTicker = await marketDataService.getUnifiedTicker(req.params.symbol);

    res.json({
      success: true,
      message: 'Unified ticker data retrieved successfully',
      data: unifiedTicker
    });
  } catch (error) {
    logger.error('Failed to get unified ticker via API', {
      userId: req.user.userId,
      symbol: req.params.symbol,
      error: error.message
    });

    const statusCode = error.message.includes('No price data') ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      message: 'Failed to retrieve unified ticker data',
      error: error.message
    });
  }
});

router.get('/orderbook/:exchange/:symbol', authenticate, async (req, res) => {
  try {
    const { error: exchangeError } = exchangeSchema.validate(req.params.exchange);
    if (exchangeError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid exchange name',
        errors: exchangeError.details.map(detail => detail.message)
      });
    }

    const { error: symbolError } = symbolSchema.validate(req.params.symbol);
    if (symbolError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid symbol format',
        errors: symbolError.details.map(detail => detail.message)
      });
    }

    const { error: limitError, value: limit } = limitSchema.validate(req.query.limit);
    if (limitError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid limit parameter',
        errors: limitError.details.map(detail => detail.message)
      });
    }

    const orderbook = await marketDataService.getOrderbook(
      req.params.exchange,
      req.params.symbol,
      limit
    );

    res.json({
      success: true,
      message: 'Orderbook data retrieved successfully',
      data: { orderbook }
    });
  } catch (error) {
    logger.error('Failed to get orderbook via API', {
      userId: req.user.userId,
      exchange: req.params.exchange,
      symbol: req.params.symbol,
      error: error.message
    });

    const statusCode = error.message.includes('not supported') ? 400 : 500;

    res.status(statusCode).json({
      success: false,
      message: 'Failed to retrieve orderbook data',
      error: error.message
    });
  }
});

router.get('/orderbook/:symbol', authenticate, async (req, res) => {
  try {
    const { error: symbolError } = symbolSchema.validate(req.params.symbol);
    if (symbolError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid symbol format',
        errors: symbolError.details.map(detail => detail.message)
      });
    }

    const { error: limitError, value: limit } = limitSchema.validate(req.query.limit);
    if (limitError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid limit parameter',
        errors: limitError.details.map(detail => detail.message)
      });
    }

    const unifiedOrderbook = await marketDataService.getUnifiedOrderbook(req.params.symbol, limit);

    res.json({
      success: true,
      message: 'Unified orderbook data retrieved successfully',
      data: unifiedOrderbook
    });
  } catch (error) {
    logger.error('Failed to get unified orderbook via API', {
      userId: req.user.userId,
      symbol: req.params.symbol,
      error: error.message
    });

    const statusCode = error.message.includes('No orderbook data') ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      message: 'Failed to retrieve unified orderbook data',
      error: error.message
    });
  }
});

router.get('/trades/:exchange/:symbol', authenticate, async (req, res) => {
  try {
    const { error: exchangeError } = exchangeSchema.validate(req.params.exchange);
    if (exchangeError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid exchange name',
        errors: exchangeError.details.map(detail => detail.message)
      });
    }

    const { error: symbolError } = symbolSchema.validate(req.params.symbol);
    if (symbolError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid symbol format',
        errors: symbolError.details.map(detail => detail.message)
      });
    }

    const { error: limitError, value: limit } = Joi.number()
      .integer()
      .min(1)
      .max(500)
      .default(50)
      .validate(req.query.limit);
    if (limitError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid limit parameter',
        errors: limitError.details.map(detail => detail.message)
      });
    }

    const trades = await marketDataService.getRecentTrades(
      req.params.exchange,
      req.params.symbol,
      limit
    );

    res.json({
      success: true,
      message: 'Recent trades retrieved successfully',
      data: trades
    });
  } catch (error) {
    logger.error('Failed to get recent trades via API', {
      userId: req.user.userId,
      exchange: req.params.exchange,
      symbol: req.params.symbol,
      error: error.message
    });

    const statusCode = error.message.includes('not supported') ? 400 : 500;

    res.status(statusCode).json({
      success: false,
      message: 'Failed to retrieve recent trades',
      error: error.message
    });
  }
});

router.get('/candles/:exchange/:symbol', authenticate, async (req, res) => {
  try {
    const { error: exchangeError } = exchangeSchema.validate(req.params.exchange);
    if (exchangeError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid exchange name',
        errors: exchangeError.details.map(detail => detail.message)
      });
    }

    const { error: symbolError } = symbolSchema.validate(req.params.symbol);
    if (symbolError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid symbol format',
        errors: symbolError.details.map(detail => detail.message)
      });
    }

    const { error: timeframeError, value: timeframe } = timeframeSchema.validate(
      req.query.timeframe
    );
    if (timeframeError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid timeframe parameter',
        errors: timeframeError.details.map(detail => detail.message)
      });
    }

    const { error: limitError, value: limit } = limitSchema.validate(req.query.limit);
    if (limitError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid limit parameter',
        errors: limitError.details.map(detail => detail.message)
      });
    }

    const candles = await marketDataService.getCandles(
      req.params.exchange,
      req.params.symbol,
      timeframe,
      limit
    );

    res.json({
      success: true,
      message: 'Candle data retrieved successfully',
      data: candles
    });
  } catch (error) {
    logger.error('Failed to get candles via API', {
      userId: req.user.userId,
      exchange: req.params.exchange,
      symbol: req.params.symbol,
      error: error.message
    });

    const statusCode = error.message.includes('does not support') ? 400 : 500;

    res.status(statusCode).json({
      success: false,
      message: 'Failed to retrieve candle data',
      error: error.message
    });
  }
});

router.get('/markets/:exchange', authenticate, async (req, res) => {
  try {
    const { error } = exchangeSchema.validate(req.params.exchange);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid exchange name',
        errors: error.details.map(detail => detail.message)
      });
    }

    const markets = await marketDataService.getMarkets(req.params.exchange);

    res.json({
      success: true,
      message: 'Markets data retrieved successfully',
      data: {
        exchange: req.params.exchange,
        markets,
        count: markets.length
      }
    });
  } catch (error) {
    logger.error('Failed to get markets via API', {
      userId: req.user.userId,
      exchange: req.params.exchange,
      error: error.message
    });

    const statusCode = error.message.includes('not supported') ? 400 : 500;

    res.status(statusCode).json({
      success: false,
      message: 'Failed to retrieve markets data',
      error: error.message
    });
  }
});

router.get('/arbitrage/:symbol', authenticate, async (req, res) => {
  try {
    const { error: symbolError } = symbolSchema.validate(req.params.symbol);
    if (symbolError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid symbol format',
        errors: symbolError.details.map(detail => detail.message)
      });
    }

    const minProfitPercentage = parseFloat(req.query.minProfit) || 0.5;

    if (minProfitPercentage < 0 || minProfitPercentage > 10) {
      return res.status(400).json({
        success: false,
        message: 'Minimum profit percentage must be between 0 and 10'
      });
    }

    const opportunities = await marketDataService.getArbitrageOpportunities(
      req.params.symbol,
      minProfitPercentage
    );

    res.json({
      success: true,
      message: 'Arbitrage opportunities retrieved successfully',
      data: opportunities
    });
  } catch (error) {
    logger.error('Failed to get arbitrage opportunities via API', {
      userId: req.user.userId,
      symbol: req.params.symbol,
      error: error.message
    });

    const statusCode = error.message.includes('No price data') ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      message: 'Failed to retrieve arbitrage opportunities',
      error: error.message
    });
  }
});

router.post('/cache/clear', authenticate, async (req, res) => {
  try {
    // Only allow admins to clear cache (you may want to add admin check here)
    marketDataService.clearCache();

    logger.info('Market data cache cleared via API', {
      userId: req.user.userId
    });

    res.json({
      success: true,
      message: 'Market data cache cleared successfully'
    });
  } catch (error) {
    logger.error('Failed to clear cache via API', {
      userId: req.user.userId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to clear cache',
      error: error.message
    });
  }
});

router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = marketDataService.getStats();

    res.json({
      success: true,
      message: 'Market data statistics retrieved successfully',
      data: {
        ...stats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get market data stats via API', {
      userId: req.user.userId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve market data statistics',
      error: error.message
    });
  }
});

module.exports = router;
