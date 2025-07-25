const express = require('express');
const httpProxy = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * API Gateway Service
 * Handles request routing, rate limiting, caching, and authentication
 */
class ApiGateway {
  constructor() {
    this.app = express();
    this.services = new Map();
    this.rateLimiters = new Map();
    this.cache = new Map(); // In-memory cache
    this.setupMiddleware();
    this.registerServices();
  }

  /**
   * Setup gateway middleware
   */
  setupMiddleware() {
    // Enable trust proxy for rate limiting
    this.app.set('trust proxy', 1);

    // Request logging
    this.app.use((req, res, next) => {
      req.startTime = Date.now();
      logger.debug('Gateway request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });

    // Response logging
    this.app.use((req, res, next) => {
      const originalSend = res.send;
      res.send = function(data) {
        const duration = Date.now() - req.startTime;
        logger.debug('Gateway response', {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration: `${duration}ms`
        });
        originalSend.call(this, data);
      };
      next();
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      logger.error('Gateway error:', error);
      res.status(500).json({
        success: false,
        message: 'Gateway error',
        error: config.server.nodeEnv === 'development' ? error.message : undefined
      });
    });
  }

  /**
   * Register microservices
   */
  registerServices() {
    // Core API service (main application)
    this.registerService('api', {
      target: `http://localhost:${config.server.port}`,
      pathPattern: '/api/*',
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
      },
      caching: {
        enabled: true,
        ttl: 300, // 5 minutes
        paths: ['/api/market/*', '/api/analytics/*']
      }
    });

    // WebSocket service (if separate)
    this.registerService('websocket', {
      target: `http://localhost:${config.server.port}`,
      pathPattern: '/socket.io/*',
      upgrade: true,
      changeOrigin: true
    });

    // Health check service
    this.registerService('health', {
      target: `http://localhost:${config.server.port}`,
      pathPattern: '/health',
      rateLimit: {
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 10 // limit each IP to 10 requests per minute
      }
    });
  }

  /**
   * Register a microservice
   * @param {string} name - Service name
   * @param {Object} config - Service configuration
   */
  registerService(name, serviceConfig) {
    // Create rate limiter for this service
    if (serviceConfig.rateLimit) {
      const limiter = rateLimit({
        windowMs: serviceConfig.rateLimit.windowMs,
        max: serviceConfig.rateLimit.max,
        message: {
          success: false,
          message: `Too many requests to ${name} service`
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
          // Use user ID if authenticated, otherwise IP
          return req.user?.userId || req.ip;
        }
      });
      
      this.rateLimiters.set(name, limiter);
    }

    // Create proxy middleware
    const proxyOptions = {
      target: serviceConfig.target,
      changeOrigin: serviceConfig.changeOrigin || true,
      ws: serviceConfig.upgrade || false,
      pathRewrite: serviceConfig.pathRewrite,
      onProxyReq: (proxyReq, req, res) => {
        // Add gateway headers
        proxyReq.setHeader('X-Gateway-Service', name);
        proxyReq.setHeader('X-Gateway-Timestamp', Date.now());
        proxyReq.setHeader('X-Forwarded-For', req.ip);
        
        // Add user context if available
        if (req.user) {
          proxyReq.setHeader('X-User-ID', req.user.userId);
          proxyReq.setHeader('X-User-Role', req.user.role || 'user');
        }
      },
      onProxyRes: (proxyRes, req, res) => {
        // Add gateway response headers
        res.setHeader('X-Gateway-Service', name);
        res.setHeader('X-Response-Time', Date.now() - req.startTime);
      },
      onError: (err, req, res) => {
        logger.error(`Proxy error for service ${name}:`, err);
        res.status(503).json({
          success: false,
          message: `Service ${name} unavailable`,
          error: config.server.nodeEnv === 'development' ? err.message : undefined
        });
      }
    };

    const proxy = httpProxy.createProxyMiddleware(proxyOptions);

    // Setup route with middleware chain
    const middlewares = [];

    // Add rate limiting if configured
    if (this.rateLimiters.has(name)) {
      middlewares.push(this.rateLimiters.get(name));
    }

    // Add caching middleware if configured
    if (serviceConfig.caching?.enabled) {
      middlewares.push(this.createCacheMiddleware(serviceConfig.caching));
    }

    // Add authentication middleware for protected routes
    if (serviceConfig.requireAuth) {
      middlewares.push(this.createAuthMiddleware());
    }

    // Add proxy middleware
    middlewares.push(proxy);

    // Register the route
    this.app.use(serviceConfig.pathPattern, ...middlewares);
    
    this.services.set(name, {
      ...serviceConfig,
      proxy,
      registered: true,
      registeredAt: new Date()
    });

    logger.info(`Registered service: ${name}`, {
      target: serviceConfig.target,
      pathPattern: serviceConfig.pathPattern
    });
  }

  /**
   * Create cache middleware
   * @param {Object} cacheConfig - Cache configuration
   * @returns {Function} Cache middleware
   */
  createCacheMiddleware(cacheConfig) {
    return async (req, res, next) => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }

      // Check if path should be cached
      const shouldCache = cacheConfig.paths.some(pattern => {
        const regex = new RegExp(pattern.replace('*', '.*'));
        return regex.test(req.path);
      });

      if (!shouldCache) {
        return next();
      }

      // Generate cache key
      const userId = req.user?.userId || 'anonymous';
      const cacheKey = `gateway:${userId}:${req.method}:${req.originalUrl}`;

      try {
        // Try to get from in-memory cache
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cacheConfig.ttl * 1000) {
          res.setHeader('X-Cache', 'HIT');
          res.setHeader('X-Cache-TTL', cached.ttl);
          return res.json(cached.data);
        }

        // Cache miss - continue to service
        res.setHeader('X-Cache', 'MISS');
        
        // Intercept response to cache it
        const originalSend = res.send;
        res.send = function(data) {
          // Only cache successful responses
          if (res.statusCode === 200) {
            try {
              const parsed = JSON.parse(data);
              this.cache.set(cacheKey, {
                data: parsed,
                ttl: cacheConfig.ttl,
                timestamp: Date.now()
              });
            } catch (error) {
              logger.warn('Failed to cache response:', error);
            }
          }
          originalSend.call(this, data);
        }.bind(this);

        next();
      } catch (error) {
        logger.error('Cache middleware error:', error);
        next();
      }
    };
  }

  /**
   * Create authentication middleware
   * @returns {Function} Authentication middleware
   */
  createAuthMiddleware() {
    return (req, res, next) => {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. No token provided.'
        });
      }

      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, config.jwt.secret);
        req.user = decoded;
        next();
      } catch (error) {
        res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }
    };
  }

  /**
   * Get service registry
   * @returns {Array} Registered services
   */
  getServiceRegistry() {
    const services = [];
    for (const [name, serviceConfig] of this.services) {
      services.push({
        name,
        target: serviceConfig.target,
        pathPattern: serviceConfig.pathPattern,
        registered: serviceConfig.registered,
        registeredAt: serviceConfig.registeredAt,
        rateLimit: serviceConfig.rateLimit ? true : false,
        caching: serviceConfig.caching?.enabled || false,
        requireAuth: serviceConfig.requireAuth || false
      });
    }
    return services;
  }

  /**
   * Health check for all services
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    const health = {
      gateway: {
        status: 'healthy',
        timestamp: new Date(),
        services: {}
      }
    };

    for (const [name, serviceConfig] of this.services) {
      try {
        // Simple health check - attempt to connect to service
        const http = require('http');
        const url = new URL(serviceConfig.target);
        
        const healthStatus = await new Promise((resolve) => {
          const req = http.request({
            hostname: url.hostname,
            port: url.port,
            path: '/health',
            method: 'GET',
            timeout: 5000
          }, (res) => {
            resolve({
              status: res.statusCode === 200 ? 'healthy' : 'unhealthy',
              statusCode: res.statusCode
            });
          });
          
          req.on('error', () => {
            resolve({ status: 'unhealthy', error: 'Connection failed' });
          });
          
          req.on('timeout', () => {
            resolve({ status: 'unhealthy', error: 'Timeout' });
          });
          
          req.end();
        });

        health.gateway.services[name] = healthStatus;
      } catch (error) {
        health.gateway.services[name] = {
          status: 'unhealthy',
          error: error.message
        };
      }
    }

    return health;
  }

  /**
   * Get gateway statistics
   * @returns {Object} Gateway statistics
   */
  getStats() {
    return {
      services: this.services.size,
      rateLimiters: this.rateLimiters.size,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      serviceRegistry: this.getServiceRegistry()
    };
  }

  /**
   * Start the gateway server
   * @param {number} port - Port to listen on
   * @returns {Promise<void>}
   */
  async start(port = 3001) {
    return new Promise((resolve, reject) => {
      const server = this.app.listen(port, (error) => {
        if (error) {
          logger.error('Failed to start API Gateway:', error);
          reject(error);
        } else {
          logger.info(`API Gateway started on port ${port}`);
          
          // Add gateway status endpoint
          this.app.get('/gateway/status', async (req, res) => {
            try {
              const health = await this.healthCheck();
              const stats = this.getStats();
              
              res.json({
                success: true,
                data: {
                  ...health,
                  stats
                }
              });
            } catch (error) {
              res.status(500).json({
                success: false,
                message: 'Failed to get gateway status',
                error: error.message
              });
            }
          });
          
          resolve(server);
        }
      });
    });
  }

  /**
   * Get Express app instance
   * @returns {Object} Express app
   */
  getApp() {
    return this.app;
  }
}

module.exports = new ApiGateway();