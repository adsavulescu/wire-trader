const express = require('express');
const Joi = require('joi');
const exchangeManager = require('../services/exchanges/exchangeManager');
const ExchangeCredentials = require('../models/ExchangeCredentials');
const { authenticateToken, requirePermission, rateLimitByUser } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Input validation schemas
const connectExchangeSchema = Joi.object({
  exchangeName: Joi.string().valid('binance', 'coinbase', 'kraken').required().messages({
    'any.only': 'Exchange must be one of: binance, coinbase, kraken',
    'any.required': 'Exchange name is required'
  }),
  apiKey: Joi.string().required().messages({
    'any.required': 'API key is required'
  }),
  secret: Joi.string().required().messages({
    'any.required': 'Secret key is required'
  }),
  passphrase: Joi.string().when('exchangeName', {
    is: 'coinbase',
    then: Joi.required().messages({
      'any.required': 'Passphrase is required for Coinbase'
    }),
    otherwise: Joi.optional()
  }),
  sandbox: Joi.boolean().default(false)
});

/**
 * @route GET /api/exchanges
 * @desc Get list of supported exchanges
 * @access Public
 */
router.get('/', (req, res) => {
  try {
    const supportedExchanges = exchangeManager.getSupportedExchanges();

    res.json({
      success: true,
      data: {
        exchanges: supportedExchanges,
        total: supportedExchanges.length
      }
    });
  } catch (error) {
    logger.error('Get exchanges error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get exchanges'
    });
  }
});

/**
 * @route POST /api/exchanges/connect
 * @desc Connect to an exchange with API credentials
 * @access Private
 */
router.post('/connect', authenticateToken, requirePermission('manage_exchanges'), rateLimitByUser(10, 60 * 60 * 1000), async (req, res) => {
  try {
    // Validate input
    const { error, value } = connectExchangeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { exchangeName, apiKey, secret, passphrase, sandbox } = value;
    const userId = req.user.id;

    // Check if user already has credentials for this exchange
    const existingCredentials = await ExchangeCredentials.findByUserAndExchange(userId, exchangeName);
    if (existingCredentials) {
      return res.status(409).json({
        success: false,
        message: `You are already connected to ${exchangeName}. Please disconnect first to add new credentials.`
      });
    }

    // Test connection with the provided credentials
    await exchangeManager.createExchange(exchangeName, { apiKey, secret, passphrase }, sandbox);

    // Save encrypted credentials to database
    const credentials = await ExchangeCredentials.createWithEncryption({
      userId,
      exchangeName,
      apiKey,
      secret,
      passphrase,
      sandbox
    });

    // Add exchange to manager
    const exchangeId = await exchangeManager.addExchange(userId, exchangeName, { apiKey, secret, passphrase }, sandbox);

    // Update connection status
    await credentials.updateConnectionStatus('connected');

    // Update user's connected exchanges count
    const User = require('../models/User');
    const user = await User.findById(userId);
    await user.incrementExchangeCount();

    logger.info('Exchange connected successfully', {
      userId,
      exchangeName,
      exchangeId,
      sandbox
    });

    res.status(201).json({
      success: true,
      message: `Successfully connected to ${exchangeName}`,
      data: {
        exchange: {
          id: credentials._id,
          name: exchangeName,
          displayName: credentials.exchangeDisplayName,
          sandbox,
          connectionStatus: 'connected',
          connectedAt: credentials.createdAt
        }
      }
    });
  } catch (error) {
    logger.error('Exchange connection error:', error);
    
    if (error.message.includes('Invalid API credentials') || 
        error.message.includes('Invalid API key')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid API credentials. Please check your API key and secret.'
      });
    } else if (error.message.includes('IP address not whitelisted')) {
      return res.status(400).json({
        success: false,
        message: 'IP address not whitelisted. Please add your IP to the exchange API settings.'
      });
    } else if (error.message.includes('Insufficient API permissions')) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient API permissions. Please ensure your API key has read and trade permissions.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to connect to exchange'
    });
  }
});

/**
 * @route GET /api/exchanges/connected
 * @desc Get user's connected exchanges
 * @access Private
 */
router.get('/connected', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const userExchanges = exchangeManager.getUserExchanges(userId);

    res.json({
      success: true,
      data: {
        exchanges: userExchanges,
        total: userExchanges.length
      }
    });
  } catch (error) {
    logger.error('Get connected exchanges error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get connected exchanges'
    });
  }
});

/**
 * @route GET /api/exchanges/:exchangeName/status
 * @desc Get exchange connection health status
 * @access Private
 */
router.get('/:exchangeName/status', authenticateToken, async (req, res) => {
  try {
    const { exchangeName } = req.params;
    const userId = req.user.id;

    // Validate exchange name
    if (!['binance', 'coinbase', 'kraken'].includes(exchangeName)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid exchange name'
      });
    }

    const healthStatus = await exchangeManager.getExchangeHealth(userId, exchangeName);

    res.json({
      success: true,
      data: {
        exchange: exchangeName,
        health: healthStatus
      }
    });
  } catch (error) {
    logger.error('Get exchange status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get exchange status'
    });
  }
});

/**
 * @route DELETE /api/exchanges/:exchangeName
 * @desc Disconnect from an exchange
 * @access Private
 */
router.delete('/:exchangeName', authenticateToken, requirePermission('manage_exchanges'), async (req, res) => {
  try {
    const { exchangeName } = req.params;
    const userId = req.user.id;

    // Validate exchange name
    if (!['binance', 'coinbase', 'kraken'].includes(exchangeName)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid exchange name'
      });
    }

    // Find and remove credentials from database
    const credentials = await ExchangeCredentials.findByUserAndExchange(userId, exchangeName);
    if (!credentials) {
      return res.status(404).json({
        success: false,
        message: `You are not connected to ${exchangeName}`
      });
    }

    // Remove from exchange manager
    exchangeManager.removeExchange(userId, exchangeName);

    // Deactivate credentials in database
    credentials.isActive = false;
    await credentials.save();

    // Update user's connected exchanges count
    const User = require('../models/User');
    const user = await User.findById(userId);
    await user.decrementExchangeCount();

    logger.info('Exchange disconnected successfully', {
      userId,
      exchangeName
    });

    res.json({
      success: true,
      message: `Successfully disconnected from ${exchangeName}`
    });
  } catch (error) {
    logger.error('Exchange disconnection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect from exchange'
    });
  }
});

/**
 * @route GET /api/exchanges/balances
 * @desc Get unified balance across all connected exchanges
 * @access Private
 */
router.get('/balances', authenticateToken, requirePermission('view_balance'), rateLimitByUser(30, 60 * 1000), async (req, res) => {
  try {
    const userId = req.user.id;
    const unifiedBalance = await exchangeManager.getUnifiedBalance(userId);

    res.json({
      success: true,
      data: unifiedBalance
    });
  } catch (error) {
    logger.error('Get balances error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get balances'
    });
  }
});

/**
 * @route GET /api/exchanges/:exchangeName/balance
 * @desc Get balance from a specific exchange
 * @access Private
 */
router.get('/:exchangeName/balance', authenticateToken, requirePermission('view_balance'), rateLimitByUser(60, 60 * 1000), async (req, res) => {
  try {
    const { exchangeName } = req.params;
    const userId = req.user.id;

    // Validate exchange name
    if (!['binance', 'coinbase', 'kraken'].includes(exchangeName)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid exchange name'
      });
    }

    // Get exchange instance
    const exchange = exchangeManager.getExchange(userId, exchangeName);
    if (!exchange) {
      return res.status(404).json({
        success: false,
        message: `You are not connected to ${exchangeName}`
      });
    }

    // Fetch balance
    const balance = await exchange.fetchBalance();

    res.json({
      success: true,
      data: {
        exchange: exchangeName,
        balance,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Get exchange balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get exchange balance'
    });
  }
});

/**
 * @route GET /api/exchanges/stats
 * @desc Get exchange manager statistics
 * @access Private
 */
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const stats = exchangeManager.getStats();

    res.json({
      success: true,
      data: {
        stats
      }
    });
  } catch (error) {
    logger.error('Get exchange stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get exchange statistics'
    });
  }
});

/**
 * @route POST /api/exchanges/:exchangeName/test
 * @desc Test connection to a specific exchange
 * @access Private
 */
router.post('/:exchangeName/test', authenticateToken, requirePermission('manage_exchanges'), rateLimitByUser(10, 60 * 1000), async (req, res) => {
  try {
    const { exchangeName } = req.params;
    const userId = req.user.id;

    // Validate exchange name
    if (!['binance', 'coinbase', 'kraken'].includes(exchangeName)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid exchange name'
      });
    }

    // Get exchange instance
    const exchange = exchangeManager.getExchange(userId, exchangeName);
    if (!exchange) {
      return res.status(404).json({
        success: false,
        message: `You are not connected to ${exchangeName}`
      });
    }

    // Test connection
    await exchangeManager.testConnection(exchange);

    // Update credentials status
    const credentials = await ExchangeCredentials.findByUserAndExchange(userId, exchangeName);
    if (credentials) {
      await credentials.updateConnectionStatus('connected');
    }

    res.json({
      success: true,
      message: `Connection to ${exchangeName} is healthy`,
      data: {
        exchange: exchangeName,
        status: 'connected',
        testedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Exchange connection test error:', error);

    // Update credentials status with error
    try {
      const credentials = await ExchangeCredentials.findByUserAndExchange(req.user.id, req.params.exchangeName);
      if (credentials) {
        await credentials.updateConnectionStatus('error', error.message);
      }
    } catch (updateError) {
      logger.error('Failed to update credentials status:', updateError);
    }

    res.status(400).json({
      success: false,
      message: `Connection test failed: ${error.message}`,
      data: {
        exchange: req.params.exchangeName,
        status: 'error',
        error: error.message,
        testedAt: new Date().toISOString()
      }
    });
  }
});

module.exports = router;