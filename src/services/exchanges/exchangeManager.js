const ccxt = require('ccxt');
const LCXExchange = require('./adapters/lcxAdapter');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * Exchange Manager
 * Handles CCXT integration and manages multiple exchange connections
 */
class ExchangeManager {
  constructor() {
    this.exchanges = new Map();
    this.supportedExchanges = ['binance', 'coinbase', 'kraken', 'ftx', 'kucoin', 'lcx'];
    this.rateLimiters = new Map();
  }

  /**
   * Get list of supported exchanges
   * @returns {Array} List of supported exchange names
   */
  getSupportedExchanges() {
    return this.supportedExchanges.map(name => ({
      id: name,
      name: this.getExchangeDisplayName(name),
      enabled: config.exchanges[name]?.enabled || false,
      features: this.getExchangeFeatures(name)
    }));
  }

  /**
   * Create exchange instance with credentials
   * @param {string} exchangeName - Name of the exchange
   * @param {Object} credentials - API credentials
   * @param {boolean} sandbox - Use sandbox/testnet mode
   * @returns {Object} CCXT exchange instance
   */
  async createExchange(exchangeName, credentials, sandbox = false) {
    try {
      if (!this.supportedExchanges.includes(exchangeName)) {
        throw new Error(`Exchange ${exchangeName} is not supported`);
      }

      let ExchangeClass;
      if (exchangeName === 'lcx') {
        ExchangeClass = LCXExchange;
      } else {
        ExchangeClass = ccxt[exchangeName];
      }
      
      if (!ExchangeClass) {
        throw new Error(`Exchange class ${exchangeName} not found`);
      }

      const exchangeConfig = {
        apiKey: credentials.apiKey,
        secret: credentials.secret,
        sandbox: sandbox,
        enableRateLimit: true,
        rateLimit: config.exchanges[exchangeName]?.rateLimit || 1000
      };

      // Add exchange-specific configuration
      if (exchangeName === 'coinbase' && credentials.passphrase) {
        exchangeConfig.passphrase = credentials.passphrase;
      }

      const exchange = new ExchangeClass(exchangeConfig);

      // Test connection
      await this.testConnection(exchange);

      logger.info(`Successfully created ${exchangeName} exchange instance`, {
        exchange: exchangeName,
        sandbox
      });

      return exchange;
    } catch (error) {
      logger.error(`Failed to create ${exchangeName} exchange instance:`, error);
      throw error;
    }
  }

  /**
   * Test exchange connection
   * @param {Object} exchange - CCXT exchange instance
   * @returns {Promise<boolean>} Connection test result
   */
  async testConnection(exchange) {
    try {
      // Try to fetch account balance as a connection test
      await exchange.fetchBalance();
      return true;
    } catch (error) {
      if (error.message.includes('Invalid API key')) {
        throw new Error('Invalid API credentials');
      } else if (error.message.includes('IP')) {
        throw new Error('IP address not whitelisted');
      } else if (error.message.includes('permission')) {
        throw new Error('Insufficient API permissions');
      } else {
        throw new Error(`Connection test failed: ${error.message}`);
      }
    }
  }

  /**
   * Add exchange to manager
   * @param {string} userId - User ID
   * @param {string} exchangeName - Exchange name
   * @param {Object} credentials - API credentials
   * @param {boolean} sandbox - Use sandbox mode
   * @returns {Promise<string>} Exchange instance ID
   */
  async addExchange(userId, exchangeName, credentials, sandbox = false) {
    try {
      const exchange = await this.createExchange(exchangeName, credentials, sandbox);
      const exchangeId = `${userId}_${exchangeName}`;

      this.exchanges.set(exchangeId, {
        exchange,
        userId,
        exchangeName,
        sandbox,
        createdAt: new Date(),
        lastUsed: new Date()
      });

      logger.info('Added exchange for user', {
        userId,
        exchangeName,
        exchangeId,
        sandbox
      });

      return exchangeId;
    } catch (error) {
      logger.error('Failed to add exchange for user', {
        userId,
        exchangeName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get exchange instance for user
   * @param {string} userId - User ID
   * @param {string} exchangeName - Exchange name
   * @returns {Object|null} Exchange instance or null if not found
   */
  getExchange(userId, exchangeName) {
    const exchangeId = `${userId}_${exchangeName}`;
    const exchangeData = this.exchanges.get(exchangeId);

    if (exchangeData) {
      exchangeData.lastUsed = new Date();
      return exchangeData.exchange;
    }

    return null;
  }

  /**
   * Remove exchange for user
   * @param {string} userId - User ID
   * @param {string} exchangeName - Exchange name
   * @returns {boolean} Success status
   */
  removeExchange(userId, exchangeName) {
    const exchangeId = `${userId}_${exchangeName}`;
    const deleted = this.exchanges.delete(exchangeId);

    if (deleted) {
      logger.info('Removed exchange for user', {
        userId,
        exchangeName,
        exchangeId
      });
    }

    return deleted;
  }

  /**
   * Get all exchanges for user
   * @param {string} userId - User ID
   * @returns {Array} List of user's exchanges
   */
  getUserExchanges(userId) {
    const userExchanges = [];

    for (const [exchangeId, exchangeData] of this.exchanges) {
      if (exchangeData.userId === userId) {
        userExchanges.push({
          id: exchangeId,
          name: exchangeData.exchangeName,
          displayName: this.getExchangeDisplayName(exchangeData.exchangeName),
          sandbox: exchangeData.sandbox,
          createdAt: exchangeData.createdAt,
          lastUsed: exchangeData.lastUsed,
          status: 'connected'
        });
      }
    }

    return userExchanges;
  }

  /**
   * Get exchange health status
   * @param {string} userId - User ID
   * @param {string} exchangeName - Exchange name
   * @returns {Promise<Object>} Health status
   */
  async getExchangeHealth(userId, exchangeName) {
    try {
      const exchange = this.getExchange(userId, exchangeName);
      if (!exchange) {
        return { status: 'not_connected', message: 'Exchange not found' };
      }

      // Test connection by fetching server time
      const serverTime = await exchange.fetchTime();
      const latency = Date.now() - serverTime;

      return {
        status: 'healthy',
        latency: `${latency}ms`,
        serverTime: new Date(serverTime).toISOString(),
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Health check failed for ${exchangeName}:`, error);
      return {
        status: 'unhealthy',
        error: error.message,
        lastCheck: new Date().toISOString()
      };
    }
  }

  /**
   * Fetch unified balance across all user exchanges
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Unified balance
   */
  async getUnifiedBalance(userId) {
    const userExchanges = this.getUserExchanges(userId);
    const unifiedBalance = {};
    const exchangeBalances = {};

    for (const exchangeInfo of userExchanges) {
      try {
        const exchange = this.getExchange(userId, exchangeInfo.name);
        const balance = await exchange.fetchBalance();

        exchangeBalances[exchangeInfo.name] = balance;

        // Aggregate balances by currency
        for (const [currency, amounts] of Object.entries(balance)) {
          if (currency === 'info') {
            continue;
          }

          if (!unifiedBalance[currency]) {
            unifiedBalance[currency] = {
              free: 0,
              used: 0,
              total: 0,
              exchanges: {}
            };
          }

          unifiedBalance[currency].free += amounts.free || 0;
          unifiedBalance[currency].used += amounts.used || 0;
          unifiedBalance[currency].total += amounts.total || 0;
          unifiedBalance[currency].exchanges[exchangeInfo.name] = amounts;
        }
      } catch (error) {
        logger.error(`Failed to fetch balance from ${exchangeInfo.name}:`, error);
        exchangeBalances[exchangeInfo.name] = { error: error.message };
      }
    }

    return {
      unified: unifiedBalance,
      byExchange: exchangeBalances,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get exchange display name
   * @param {string} exchangeName - Exchange name
   * @returns {string} Display name
   */
  getExchangeDisplayName(exchangeName) {
    const displayNames = {
      binance: 'Binance',
      coinbase: 'Coinbase Pro',
      kraken: 'Kraken',
      ftx: 'FTX',
      kucoin: 'KuCoin',
      lcx: 'LCX'
    };
    return displayNames[exchangeName] || exchangeName;
  }

  /**
   * Get exchange features
   * @param {string} exchangeName - Exchange name
   * @returns {Object} Exchange features
   */
  getExchangeFeatures(exchangeName) {
    const features = {
      binance: {
        spot: true,
        futures: true,
        margin: true,
        options: false,
        websocket: true
      },
      coinbase: {
        spot: true,
        futures: false,
        margin: true,
        options: false,
        websocket: true
      },
      kraken: {
        spot: true,
        futures: true,
        margin: true,
        options: false,
        websocket: true
      },
      ftx: {
        spot: true,
        futures: true,
        margin: true,
        options: true,
        websocket: true
      },
      kucoin: {
        spot: true,
        futures: true,
        margin: true,
        options: false,
        websocket: true
      },
      lcx: {
        spot: true,
        futures: false,
        margin: false,
        options: false,
        websocket: false
      }
    };

    return features[exchangeName] || {};
  }

  /**
   * Cleanup inactive exchanges
   * @param {number} maxInactiveHours - Maximum inactive hours before cleanup
   */
  cleanupInactiveExchanges(maxInactiveHours = 24) {
    const cutoffTime = new Date(Date.now() - maxInactiveHours * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [exchangeId, exchangeData] of this.exchanges) {
      if (exchangeData.lastUsed < cutoffTime) {
        this.exchanges.delete(exchangeId);
        cleanedCount++;
        logger.info('Cleaned up inactive exchange', {
          exchangeId,
          lastUsed: exchangeData.lastUsed
        });
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} inactive exchanges`);
    }
  }

  /**
   * Get manager statistics
   * @returns {Object} Manager statistics
   */
  getStats() {
    const stats = {
      totalExchanges: this.exchanges.size,
      byExchange: {},
      byUser: {}
    };

    for (const [_exchangeId, exchangeData] of this.exchanges) {
      // Count by exchange
      if (!stats.byExchange[exchangeData.exchangeName]) {
        stats.byExchange[exchangeData.exchangeName] = 0;
      }
      stats.byExchange[exchangeData.exchangeName]++;

      // Count by user
      if (!stats.byUser[exchangeData.userId]) {
        stats.byUser[exchangeData.userId] = 0;
      }
      stats.byUser[exchangeData.userId]++;
    }

    return stats;
  }
}

// Create singleton instance
const exchangeManager = new ExchangeManager();

module.exports = exchangeManager;
