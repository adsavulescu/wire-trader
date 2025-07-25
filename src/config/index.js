const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

/**
 * Application configuration object
 * Centralizes all environment-based configuration
 */
const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3001'
  },

  // Database configuration
  database: {
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/wire-trader',
    dbName: process.env.DB_NAME || 'wire_trader'
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    expire: process.env.JWT_EXPIRE || '24h',
    refreshExpire: process.env.JWT_REFRESH_EXPIRE || '7d'
  },

  // Encryption configuration
  encryption: {
    key: process.env.ENCRYPTION_KEY || 'default-32-char-key-change-prod!!!'
  },

  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/wire-trader.log'
  },

  // Exchange configurations
  exchanges: {
    binance: {
      apiKey: process.env.BINANCE_API_KEY,
      secret: process.env.BINANCE_SECRET_KEY,
      sandbox: process.env.BINANCE_SANDBOX === 'true',
      rateLimit: 1200, // requests per minute
      enabled: true
    },
    coinbase: {
      apiKey: process.env.COINBASE_API_KEY,
      secret: process.env.COINBASE_SECRET_KEY,
      passphrase: process.env.COINBASE_PASSPHRASE,
      sandbox: process.env.COINBASE_SANDBOX === 'true',
      rateLimit: 10, // requests per second
      enabled: true
    },
    kraken: {
      apiKey: process.env.KRAKEN_API_KEY,
      secret: process.env.KRAKEN_SECRET_KEY,
      rateLimit: 15, // requests per second
      enabled: true
    }
  },

  // Redis configuration (for future caching)
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: parseInt(process.env.REDIS_TTL) || 3600
  },

  // Security configuration
  security: {
    sessionSecret: process.env.SESSION_SECRET || 'default-session-secret'
  }
};

/**
 * Validates required configuration values
 * @throws {Error} If required configuration is missing
 */
function validateConfig() {
  const requiredEnvVars = ['JWT_SECRET', 'ENCRYPTION_KEY', 'MONGODB_URI'];

  if (config.server.nodeEnv === 'production') {
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Validate encryption key length
    if (config.encryption.key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be exactly 32 characters long');
    }
  }
}

// Validate configuration on load
try {
  validateConfig();
} catch (error) {
  console.error('Configuration validation failed:', error.message);
  if (config.server.nodeEnv === 'production') {
    process.exit(1);
  }
}

module.exports = config;
