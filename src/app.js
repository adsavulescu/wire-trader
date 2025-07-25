const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import configuration and utilities
const config = require('./config');
const database = require('./config/database');
const logger = require('./utils/logger');
const websocketService = require('./services/websocket/websocketService');
const monitoringService = require('./services/monitoring/monitoringService');

// Import middleware
const { auditLog } = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/auth');
const exchangeRoutes = require('./routes/exchanges');
const tradingRoutes = require('./routes/trading');
const marketRoutes = require('./routes/market');
const paperTradingRoutes = require('./routes/paperTrading');
const advancedOrderRoutes = require('./routes/advancedOrders');
const analyticsRoutes = require('./routes/analytics');
const portfolioRoutes = require('./routes/portfolio');

/**
 * Wire-Trader Application
 * Multi-exchange cryptocurrency trading portal backend
 */
class WireTraderApp {
  constructor() {
    this.app = express();
    this.server = null;
  }

  /**
   * Initialize the application
   */
  async initialize() {
    try {
      // Connect to database
      await this.connectDatabase();

      // Initialize monitoring service
      this.initializeMonitoringService();

      // Setup middleware
      this.setupMiddleware();

      // Setup routes
      this.setupRoutes();

      // Setup error handling
      this.setupErrorHandling();

      logger.info('Wire-Trader application initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  /**
   * Connect to MongoDB database
   */
  async connectDatabase() {
    try {
      await database.connect();
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  /**
   * Initialize monitoring service
   */
  initializeMonitoringService() {
    try {
      monitoringService.start();
      logger.info('Monitoring service initialized successfully');
    } catch (error) {
      logger.error('Monitoring service initialization failed:', error);
      // Don't throw error - monitoring is not critical for core functionality
    }
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:']
          }
        },
        crossOriginEmbedderPolicy: false
      })
    );

    // CORS configuration
    this.app.use(
      cors({
        origin: config.server.corsOrigin,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
      })
    );

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
      },
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use(limiter);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      req.startTime = Date.now();
      next();
    });

    // Audit logging for API requests
    this.app.use('/api', auditLog);

    // Request/response logging middleware
    this.app.use((req, res, next) => {
      const originalSend = res.send;

      res.send = function (data) {
        const duration = Date.now() - req.startTime;
        logger.logHttpRequest(req, res, duration);
        originalSend.call(this, data);
      };

      next();
    });

    logger.info('Middleware setup completed');
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      try {
        const dbHealth = database.getHealthStatus();
        const healthStatus = await monitoringService.getHealthStatus();

        res.json({
          success: true,
          message: 'Wire-Trader API is healthy',
          data: {
            server: {
              status: healthStatus.status,
              score: healthStatus.score,
              uptime: process.uptime(),
              timestamp: new Date().toISOString(),
              version: '1.0.0',
              environment: config.server.nodeEnv
            },
            database: dbHealth,
            services: healthStatus.services,
            monitoring: {
              alerts: healthStatus.alerts,
              isRunning: monitoringService.getStats().isRunning
            }
          }
        });
      } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
          success: false,
          message: 'Service unhealthy',
          error: error.message
        });
      }
    });

    // Monitoring metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      try {
        const { startTime, endTime } = req.query;
        const start = startTime ? parseInt(startTime) : Date.now() - 3600000; // Default 1 hour
        const end = endTime ? parseInt(endTime) : Date.now();
        
        const metrics = monitoringService.getMetricsHistory(start, end);
        const alerts = monitoringService.getRecentAlerts(end - start);
        const stats = monitoringService.getStats();

        res.json({
          success: true,
          data: {
            metrics,
            alerts,
            stats,
            timeRange: { start, end }
          }
        });
      } catch (error) {
        logger.error('Failed to get metrics:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve metrics',
          error: error.message
        });
      }
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/exchanges', exchangeRoutes);
    this.app.use('/api/trading', tradingRoutes);
    this.app.use('/api/market', marketRoutes);
    this.app.use('/api/paper-trading', paperTradingRoutes);
    this.app.use('/api/advanced-orders', advancedOrderRoutes);
    this.app.use('/api/analytics', analyticsRoutes);
    this.app.use('/api/portfolio', portfolioRoutes);

    // API documentation endpoint
    this.app.get('/api', (req, res) => {
      res.json({
        success: true,
        message: 'Wire-Trader API v1.0',
        data: {
          name: 'Wire-Trader API',
          version: '1.0.0',
          description: 'Multi-exchange cryptocurrency trading portal API',
          endpoints: {
            health: 'GET /health',
            auth: {
              register: 'POST /api/auth/register',
              login: 'POST /api/auth/login',
              profile: 'GET /api/auth/me',
              updateProfile: 'PUT /api/auth/profile',
              changePassword: 'POST /api/auth/change-password',
              logout: 'POST /api/auth/logout',
              stats: 'GET /api/auth/stats'
            },
            exchanges: {
              list: 'GET /api/exchanges',
              connect: 'POST /api/exchanges/connect',
              connected: 'GET /api/exchanges/connected',
              disconnect: 'DELETE /api/exchanges/:exchangeName',
              status: 'GET /api/exchanges/:exchangeName/status',
              balances: 'GET /api/exchanges/balances',
              exchangeBalance: 'GET /api/exchanges/:exchangeName/balance',
              test: 'POST /api/exchanges/:exchangeName/test'
            },
            trading: {
              placeOrder: 'POST /api/trading/orders',
              orderHistory: 'GET /api/trading/orders',
              activeOrders: 'GET /api/trading/orders/active',
              getOrder: 'GET /api/trading/orders/:orderId',
              refreshOrder: 'PUT /api/trading/orders/:orderId/refresh',
              cancelOrder: 'DELETE /api/trading/orders/:orderId',
              stats: 'GET /api/trading/stats'
            },
            market: {
              ticker: 'GET /api/market/ticker/:exchange/:symbol',
              unifiedTicker: 'GET /api/market/ticker/:symbol',
              orderbook: 'GET /api/market/orderbook/:exchange/:symbol',
              unifiedOrderbook: 'GET /api/market/orderbook/:symbol',
              trades: 'GET /api/market/trades/:exchange/:symbol',
              candles: 'GET /api/market/candles/:exchange/:symbol',
              markets: 'GET /api/market/markets/:exchange',
              arbitrage: 'GET /api/market/arbitrage/:symbol',
              clearCache: 'POST /api/market/cache/clear',
              stats: 'GET /api/market/stats'
            },
            paperTrading: {
              account: 'GET /api/paper-trading/account',
              balance: 'GET /api/paper-trading/balance',
              portfolio: 'GET /api/paper-trading/portfolio',
              placeOrder: 'POST /api/paper-trading/orders',
              cancelOrder: 'DELETE /api/paper-trading/orders/:orderId',
              resetAccount: 'POST /api/paper-trading/account/reset',
              processOrders: 'POST /api/paper-trading/process-orders',
              performance: 'GET /api/paper-trading/performance'
            },
            advancedOrders: {
              placeOCO: 'POST /api/advanced-orders/oco',
              placeTrailingStop: 'POST /api/advanced-orders/trailing-stop',
              placeIceberg: 'POST /api/advanced-orders/iceberg',
              cancelOCO: 'DELETE /api/advanced-orders/oco/:orderId',
              cancelTrailingStop: 'DELETE /api/advanced-orders/trailing-stop/:orderId',
              getActive: 'GET /api/advanced-orders/active',
              getOrder: 'GET /api/advanced-orders/:orderId',
              getHistory: 'GET /api/advanced-orders/history'
            },
            analytics: {
              performance: 'GET /api/analytics/performance',
              portfolio: 'GET /api/analytics/portfolio',
              pnl: 'GET /api/analytics/pnl',
              tradingStats: 'GET /api/analytics/trading-stats',
              risk: 'GET /api/analytics/risk',
              symbols: 'GET /api/analytics/symbols',
              timeBased: 'GET /api/analytics/time-based',
              positions: 'GET /api/analytics/positions',
              positionDetails: 'GET /api/analytics/positions/:positionId',
              refresh: 'POST /api/analytics/refresh',
              export: 'GET /api/analytics/export'
            },
            portfolio: {
              summary: 'GET /api/portfolio',
              holdings: 'GET /api/portfolio/holdings',
              performance: 'GET /api/portfolio/performance',
              sync: 'POST /api/portfolio/sync',
              allocation: 'GET /api/portfolio/allocation',
              settings: 'PUT /api/portfolio/settings',
              metrics: 'GET /api/portfolio/metrics',
              assetDetails: 'GET /api/portfolio/asset/:asset',
              rebalance: 'GET /api/portfolio/rebalance',
              export: 'GET /api/portfolio/export'
            }
          },
          supportedExchanges: ['binance', 'coinbase', 'kraken', 'ftx', 'kucoin'],
          documentation: 'https://github.com/adsavulescu/wire-trader#readme'
        }
      });
    });

    // 404 handler for unknown routes
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        data: {
          method: req.method,
          path: req.originalUrl,
          availableEndpoints: [
            'GET /health',
            'GET /api',
            'POST /api/auth/register',
            'POST /api/auth/login',
            'GET /api/exchanges'
          ]
        }
      });
    });

    logger.info('Routes setup completed');
  }

  /**
   * Setup error handling middleware
   */
  setupErrorHandling() {
    // Global error handler
    this.app.use((error, req, res, _next) => {
      logger.error('Unhandled error:', error);

      // MongoDB validation errors
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validationErrors
        });
      }

      // MongoDB duplicate key errors
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        return res.status(409).json({
          success: false,
          message: `${field} already exists`
        });
      }

      // JWT errors
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }

      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      }

      // Default error response
      const statusCode = error.statusCode || error.status || 500;
      const message =
        config.server.nodeEnv === 'production' ? 'Internal server error' : error.message;

      res.status(statusCode).json({
        success: false,
        message,
        ...(config.server.nodeEnv !== 'production' && { stack: error.stack })
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // Close server gracefully
      this.gracefulShutdown('UNHANDLED_REJECTION');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', error => {
      logger.error('Uncaught Exception:', error);
      // Close server gracefully
      this.gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle process termination signals
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      this.gracefulShutdown('SIGTERM');
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      this.gracefulShutdown('SIGINT');
    });

    logger.info('Error handling setup completed');
  }

  /**
   * Start the server
   */
  async start() {
    try {
      const port = config.server.port;

      this.server = this.app.listen(port, () => {
        // Initialize WebSocket service
        websocketService.initialize(this.server);

        logger.info('Wire-Trader server started successfully', {
          port: port,
          environment: config.server.nodeEnv,
          processId: process.pid
        });

        // Log startup information
        console.log('\n🚀 Wire-Trader API Server Started');
        console.log(`📡 Server: http://localhost:${port}`);
        console.log(`🔌 WebSocket: ws://localhost:${port}`);
        console.log(`🏥 Health: http://localhost:${port}/health`);
        console.log(`📚 API Docs: http://localhost:${port}/api`);
        console.log(`🌍 Environment: ${config.server.nodeEnv}`);
        console.log(`📊 Database: ${database.getHealthStatus().status}`);
        console.log('═══════════════════════════════════════\n');
      });

      // Handle server errors
      this.server.on('error', error => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`Port ${port} is already in use`);
        } else {
          logger.error('Server error:', error);
        }
        process.exit(1);
      });

      return this.server;
    } catch (error) {
      logger.error('Failed to start server:', error);
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown(signal) {
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    // Close WebSocket service
    try {
      websocketService.disconnect();
      logger.info('WebSocket service closed');
    } catch (error) {
      logger.error('Error closing WebSocket service:', error);
    }

    // Stop monitoring service
    try {
      monitoringService.stop();
      logger.info('Monitoring service stopped');
    } catch (error) {
      logger.error('Error stopping monitoring service:', error);
    }

    // Close server
    if (this.server) {
      this.server.close(() => {
        logger.info('HTTP server closed');
      });
    }

    // Close database connection
    try {
      await database.disconnect();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection:', error);
    }

    // Exit process
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);

    logger.info('Graceful shutdown completed');
    process.exit(0);
  }

  /**
   * Get Express app instance
   */
  getApp() {
    return this.app;
  }
}

// Create and export application instance
const wireTraderApp = new WireTraderApp();

// Start server if this file is run directly
if (require.main === module) {
  (async () => {
    try {
      await wireTraderApp.initialize();
      await wireTraderApp.start();
    } catch (error) {
      logger.error('Failed to start Wire-Trader application:', error);
      process.exit(1);
    }
  })();
}

module.exports = wireTraderApp;
