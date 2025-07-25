const authService = require('../services/auth/authService');
const logger = require('../utils/logger');

/**
 * JWT Authentication Middleware
 * Verifies JWT token and adds user info to request object
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    // Verify the token
    const decoded = authService.verifyToken(token);

    // Get user profile
    const userProfile = await authService.getUserProfile(decoded.userId);

    // Add user info to request object
    req.user = userProfile;

    next();
  } catch (error) {
    logger.error('Authentication failed:', error);

    if (error.message === 'Token has expired') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    } else if (error.message === 'Invalid token') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    } else {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed'
      });
    }
  }
};

/**
 * Optional Authentication Middleware
 * Same as authenticateToken but doesn't fail if no token provided
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = authService.verifyToken(token);
      const userProfile = await authService.getUserProfile(decoded.userId);
      req.user = userProfile;
    }

    next();
  } catch (error) {
    // Don't fail for optional auth, just continue without user
    logger.warn('Optional authentication failed:', error);
    next();
  }
};

/**
 * Permission Check Middleware
 * Requires authentication and checks user permissions
 */
const requirePermission = permission => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const hasPermission = await authService.hasPermission(req.user.id, permission);

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Permission '${permission}' required`
        });
      }

      next();
    } catch (error) {
      logger.error('Permission check failed:', error);
      return res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
};

/**
 * Rate Limiting Middleware
 * Implements basic rate limiting per user
 */
const rateLimitByUser = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map();

  return (req, res, next) => {
    const userId = req.user ? req.user.id : req.ip;
    const now = Date.now();

    // Clean up old entries
    const cutoffTime = now - windowMs;
    for (const [key, data] of userRequests.entries()) {
      if (data.resetTime < cutoffTime) {
        userRequests.delete(key);
      }
    }

    // Get or create user entry
    let userEntry = userRequests.get(userId);
    if (!userEntry || userEntry.resetTime < cutoffTime) {
      userEntry = {
        count: 0,
        resetTime: now + windowMs
      };
    }

    // Check rate limit
    if (userEntry.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests',
        retryAfter: Math.ceil((userEntry.resetTime - now) / 1000)
      });
    }

    // Increment counter
    userEntry.count++;
    userRequests.set(userId, userEntry);

    next();
  };
};

/**
 * Admin Only Middleware
 * Restricts access to admin users only
 */
const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Add admin check logic here when user roles are implemented
  // For now, check if user is a specific admin email or has admin flag
  const adminEmails = ['admin@wire-trader.com']; // Configure as needed

  if (!adminEmails.includes(req.user.email)) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  next();
};

/**
 * Request Logging Middleware
 * Logs authenticated requests for audit purposes
 */
const auditLog = (req, res, next) => {
  const originalSend = res.send;

  res.send = function (data) {
    // Log the request after response is sent
    logger.info('API Request', {
      userId: req.user ? req.user.id : null,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      responseTime: Date.now() - req.startTime
    });

    originalSend.call(this, data);
  };

  req.startTime = Date.now();
  next();
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requirePermission,
  rateLimitByUser,
  adminOnly,
  auditLog
};
