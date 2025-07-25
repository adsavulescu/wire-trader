const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Create logs directory if it doesn't exist
const logsDir = path.dirname(config.logging.file);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Custom log format for better readability
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }

    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }

    return log;
  })
);

/**
 * Console format for development
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} ${level}: ${message}`;

    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta, null, 2)}`;
    }

    return log;
  })
);

/**
 * Create Winston logger instance
 */
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: 'wire-trader' },
  transports: [
    // File transport for all logs
    new winston.transports.File({
      filename: config.logging.file,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),

    // Error-specific file transport
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ],

  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 3
    })
  ],

  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 3
    })
  ]
});

// Add console transport for non-production environments
if (config.server.nodeEnv !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug'
    })
  );
}

/**
 * Create child logger with additional context
 * @param {Object} meta - Additional metadata for all logs
 * @returns {winston.Logger} Child logger instance
 */
logger.child = meta => {
  return logger.child(meta);
};

/**
 * Log HTTP requests (for Express middleware)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} duration - Request duration
 */
logger.logHttpRequest = (req, res, duration) => {
  const logData = {
    method: req.method,
    url: req.originalUrl || req.url,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress
  };

  if (res.statusCode >= 400) {
    logger.warn('HTTP Request', logData);
  } else {
    logger.info('HTTP Request', logData);
  }
};

/**
 * Log exchange API calls
 * @param {string} exchange - Exchange name
 * @param {string} method - API method called
 * @param {Object} params - API parameters
 * @param {number} duration - Call duration in ms
 * @param {boolean} success - Whether the call was successful
 * @param {string} error - Error message if failed
 */
logger.logExchangeCall = (exchange, method, params, duration, success, error) => {
  const logData = {
    exchange,
    method,
    params: JSON.stringify(params),
    duration: `${duration}ms`,
    success
  };

  if (error) {
    logData.error = error;
    logger.error('Exchange API Call Failed', logData);
  } else {
    logger.info('Exchange API Call', logData);
  }
};

/**
 * Log user authentication events
 * @param {string} userId - User ID
 * @param {string} action - Authentication action (login, logout, register, etc.)
 * @param {boolean} success - Whether the action was successful
 * @param {string} ip - User IP address
 * @param {string} userAgent - User agent string
 * @param {string} error - Error message if failed
 */
logger.logAuthEvent = (userId, action, success, ip, userAgent, error) => {
  const logData = {
    userId,
    action,
    success,
    ip,
    userAgent
  };

  if (error) {
    logData.error = error;
    logger.warn('Authentication Event Failed', logData);
  } else {
    logger.info('Authentication Event', logData);
  }
};

module.exports = logger;
