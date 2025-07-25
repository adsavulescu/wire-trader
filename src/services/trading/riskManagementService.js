const User = require('../../models/User');
const Order = require('../../models/Order');
const TradingPosition = require('../../models/TradingPosition');
const Portfolio = require('../../models/Portfolio');
const marketDataService = require('../market/marketDataService');
const logger = require('../../utils/logger');

/**
 * Risk Management Service
 * Advanced risk controls and portfolio protection
 */
class RiskManagementService {
  constructor() {
    this.riskLimits = new Map();
    this.activeMonitoring = new Map();
    this.alertThresholds = {
      portfolioDrawdown: 0.10, // 10%
      positionSize: 0.05, // 5% of portfolio
      dailyLoss: 0.03, // 3% daily loss limit
      leverageRatio: 3.0, // Max 3x leverage
      correlationLimit: 0.7 // Max correlation between positions
    };
  }

  /**
   * Initialize risk management for user
   * @param {string} userId - User ID
   * @param {Object} riskProfile - User's risk profile
   */
  async initializeRiskProfile(userId, riskProfile = {}) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Set default risk limits based on user profile
      const defaultLimits = this.getDefaultRiskLimits(riskProfile);
      
      // Merge with user preferences
      const riskLimits = {
        ...defaultLimits,
        ...user.preferences?.trading?.riskManagement,
        ...riskProfile
      };

      // Store risk limits
      this.riskLimits.set(userId, riskLimits);

      // Initialize monitoring
      this.activeMonitoring.set(userId, {
        enabled: true,
        lastCheck: Date.now(),
        violations: [],
        warnings: []
      });

      logger.info(`Risk management initialized for user ${userId}`, { riskLimits });
      return riskLimits;

    } catch (error) {
      logger.error('Error initializing risk profile:', error);
      throw error;
    }
  }

  /**
   * Get default risk limits based on risk profile
   * @param {Object} profile - Risk profile
   * @returns {Object} Default limits
   */
  getDefaultRiskLimits(profile) {
    const riskLevel = profile.riskLevel || 'moderate';
    
    const limits = {
      conservative: {
        maxPositionSize: 0.02, // 2% of portfolio
        maxDailyLoss: 0.01, // 1% daily loss
        maxDrawdown: 0.05, // 5% max drawdown
        maxLeverage: 1.0, // No leverage
        maxOpenPositions: 3,
        stopLossRequired: true,
        minStopLossDistance: 0.05, // 5%
        maxCorrelation: 0.5,
        allowedAssetClasses: ['crypto', 'stablecoin'],
        requiredDiversification: 0.8
      },
      moderate: {
        maxPositionSize: 0.05, // 5% of portfolio
        maxDailyLoss: 0.03, // 3% daily loss
        maxDrawdown: 0.10, // 10% max drawdown
        maxLeverage: 2.0, // 2x leverage max
        maxOpenPositions: 5,
        stopLossRequired: false,
        minStopLossDistance: 0.03, // 3%
        maxCorrelation: 0.7,
        allowedAssetClasses: ['crypto', 'stablecoin', 'defi'],
        requiredDiversification: 0.6
      },
      aggressive: {
        maxPositionSize: 0.10, // 10% of portfolio
        maxDailyLoss: 0.05, // 5% daily loss
        maxDrawdown: 0.20, // 20% max drawdown
        maxLeverage: 5.0, // 5x leverage max
        maxOpenPositions: 10,
        stopLossRequired: false,
        minStopLossDistance: 0.02, // 2%
        maxCorrelation: 0.9,
        allowedAssetClasses: ['crypto', 'stablecoin', 'defi', 'derivatives'],
        requiredDiversification: 0.4
      }
    };

    return limits[riskLevel] || limits.moderate;
  }

  /**
   * Validate order against risk limits
   * @param {string} userId - User ID
   * @param {Object} orderData - Order data
   * @returns {Promise<Object>} Validation result
   */
  async validateOrder(userId, orderData) {
    try {
      const riskLimits = this.riskLimits.get(userId);
      if (!riskLimits) {
        await this.initializeRiskProfile(userId);
      }

      const validationResult = {
        allowed: true,
        warnings: [],
        violations: [],
        adjustments: {}
      };

      // Get current portfolio and positions
      const portfolio = await Portfolio.findByUserId(userId);
      const openPositions = await TradingPosition.findOpenPositions(userId);
      
      // Validate position size
      await this.validatePositionSize(userId, orderData, portfolio, validationResult);
      
      // Validate portfolio concentration
      await this.validateConcentration(userId, orderData, portfolio, validationResult);
      
      // Validate correlation limits
      await this.validateCorrelation(userId, orderData, openPositions, validationResult);
      
      // Validate daily loss limits
      await this.validateDailyLoss(userId, orderData, portfolio, validationResult);
      
      // Validate leverage limits
      await this.validateLeverage(userId, orderData, portfolio, validationResult);
      
      // Validate asset class restrictions
      await this.validateAssetClass(userId, orderData, validationResult);
      
      // Check for required stop loss
      await this.validateStopLoss(userId, orderData, validationResult);

      // Determine if order should be allowed
      validationResult.allowed = validationResult.violations.length === 0;

      return validationResult;

    } catch (error) {
      logger.error('Error validating order against risk limits:', error);
      return {
        allowed: false,
        violations: ['Risk validation failed'],
        warnings: [],
        adjustments: {}
      };
    }
  }

  /**
   * Validate position size against limits
   */
  async validatePositionSize(userId, orderData, portfolio, result) {
    const limits = this.riskLimits.get(userId);
    const portfolioValue = portfolio?.totalValue?.current || 100000; // Default for new users
    
    // Calculate order value
    const orderValue = orderData.amount * (orderData.price || await this.getCurrentPrice(orderData.symbol));
    const positionPercentage = orderValue / portfolioValue;

    if (positionPercentage > limits.maxPositionSize) {
      result.violations.push(`Position size ${(positionPercentage * 100).toFixed(2)}% exceeds limit of ${(limits.maxPositionSize * 100).toFixed(2)}%`);
      
      // Suggest adjustment
      const maxAmount = (portfolioValue * limits.maxPositionSize) / (orderData.price || 1);
      result.adjustments.suggestedAmount = Math.floor(maxAmount * 100) / 100;
    } else if (positionPercentage > limits.maxPositionSize * 0.8) {
      result.warnings.push(`Position size ${(positionPercentage * 100).toFixed(2)}% approaching limit of ${(limits.maxPositionSize * 100).toFixed(2)}%`);
    }
  }

  /**
   * Validate portfolio concentration
   */
  async validateConcentration(userId, orderData, portfolio, result) {
    if (!portfolio) return;

    const limits = this.riskLimits.get(userId);
    const [baseAsset] = orderData.symbol.split('/');
    
    // Get current holding of this asset
    const currentHolding = portfolio.holdings.get(baseAsset);
    const currentPercentage = currentHolding ? 
      (currentHolding.currentValue / portfolio.totalValue.current) : 0;
    
    // Calculate new percentage after order
    const orderValue = orderData.amount * (orderData.price || await this.getCurrentPrice(orderData.symbol));
    const newValue = (currentHolding?.currentValue || 0) + 
      (orderData.side === 'buy' ? orderValue : -orderValue);
    const newPercentage = newValue / portfolio.totalValue.current;

    if (newPercentage > limits.maxPositionSize * 1.5) {
      result.violations.push(`Asset concentration ${(newPercentage * 100).toFixed(2)}% would be too high`);
    }
  }

  /**
   * Validate correlation limits
   */
  async validateCorrelation(userId, orderData, positions, result) {
    const limits = this.riskLimits.get(userId);
    const [baseAsset] = orderData.symbol.split('/');
    
    // Calculate correlation with existing positions
    for (const position of positions) {
      const correlation = await this.calculateAssetCorrelation(baseAsset, position.symbol);
      
      if (correlation > limits.maxCorrelation) {
        result.warnings.push(`High correlation (${(correlation * 100).toFixed(1)}%) with existing ${position.symbol} position`);
      }
    }
  }

  /**
   * Validate daily loss limits
   */
  async validateDailyLoss(userId, orderData, portfolio, result) {
    const limits = this.riskLimits.get(userId);
    
    // Get today's P&L
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayPositions = await TradingPosition.find({
      userId,
      exitDate: { $gte: today },
      netPnL: { $lt: 0 }
    });

    const todayLoss = todayPositions.reduce((sum, pos) => sum + Math.abs(pos.netPnL), 0);
    const portfolioValue = portfolio?.totalValue?.current || 100000;
    const lossPercentage = todayLoss / portfolioValue;

    if (lossPercentage > limits.maxDailyLoss) {
      result.violations.push(`Daily loss limit ${(limits.maxDailyLoss * 100).toFixed(2)}% already exceeded`);
    } else if (lossPercentage > limits.maxDailyLoss * 0.8) {
      result.warnings.push(`Approaching daily loss limit: ${(lossPercentage * 100).toFixed(2)}%`);
    }
  }

  /**
   * Validate leverage limits
   */
  async validateLeverage(userId, orderData, portfolio, result) {
    const limits = this.riskLimits.get(userId);
    
    // For now, assume spot trading (no leverage)
    // This would be enhanced for margin/futures trading
    if (orderData.leverage && orderData.leverage > limits.maxLeverage) {
      result.violations.push(`Leverage ${orderData.leverage}x exceeds limit of ${limits.maxLeverage}x`);
    }
  }

  /**
   * Validate asset class restrictions
   */
  async validateAssetClass(userId, orderData, result) {
    const limits = this.riskLimits.get(userId);
    const assetClass = this.getAssetClass(orderData.symbol);
    
    if (!limits.allowedAssetClasses.includes(assetClass)) {
      result.violations.push(`Asset class '${assetClass}' not allowed in risk profile`);
    }
  }

  /**
   * Validate stop loss requirements
   */
  async validateStopLoss(userId, orderData, result) {
    const limits = this.riskLimits.get(userId);
    
    if (limits.stopLossRequired && orderData.side === 'buy' && !orderData.stopPrice) {
      result.violations.push('Stop loss is required for buy orders');
      
      // Suggest stop loss price
      const currentPrice = await this.getCurrentPrice(orderData.symbol);
      const suggestedStopPrice = currentPrice * (1 - limits.minStopLossDistance);
      result.adjustments.suggestedStopPrice = Math.floor(suggestedStopPrice * 100) / 100;
    }
  }

  /**
   * Monitor portfolio risk in real-time
   * @param {string} userId - User ID
   */
  async monitorPortfolioRisk(userId) {
    try {
      const monitoring = this.activeMonitoring.get(userId);
      if (!monitoring || !monitoring.enabled) return;

      const portfolio = await Portfolio.findByUserId(userId);
      if (!portfolio) return;

      const riskMetrics = await this.calculateRiskMetrics(userId, portfolio);
      const alerts = this.checkRiskAlerts(userId, riskMetrics);

      if (alerts.length > 0) {
        await this.sendRiskAlerts(userId, alerts);
      }

      // Update monitoring timestamp
      monitoring.lastCheck = Date.now();
      this.activeMonitoring.set(userId, monitoring);

    } catch (error) {
      logger.error(`Error monitoring portfolio risk for user ${userId}:`, error);
    }
  }

  /**
   * Calculate comprehensive risk metrics
   * @param {string} userId - User ID
   * @param {Object} portfolio - Portfolio data
   * @returns {Promise<Object>} Risk metrics
   */
  async calculateRiskMetrics(userId, portfolio) {
    const positions = await TradingPosition.findOpenPositions(userId);
    const limits = this.riskLimits.get(userId);

    // Value at Risk (VaR) calculation
    const var95 = await this.calculateVaR(positions, 0.95);
    const var99 = await this.calculateVaR(positions, 0.99);

    // Portfolio beta (market correlation)
    const beta = await this.calculatePortfolioBeta(positions);

    // Concentration risk
    const concentrationRisk = this.calculateConcentrationRisk(portfolio);

    // Leverage utilization
    const leverageUtilization = this.calculateLeverageUtilization(positions, limits);

    // Diversification score
    const diversificationScore = this.calculateDiversificationScore(portfolio);

    return {
      var95,
      var99,
      beta,
      concentrationRisk,
      leverageUtilization,
      diversificationScore,
      totalExposure: positions.reduce((sum, pos) => sum + pos.entryValue, 0),
      openPositions: positions.length,
      timestamp: Date.now()
    };
  }

  /**
   * Check for risk alerts
   * @param {string} userId - User ID
   * @param {Object} metrics - Risk metrics
   * @returns {Array} Risk alerts
   */
  checkRiskAlerts(userId, metrics) {
    const alerts = [];
    const limits = this.riskLimits.get(userId);

    // Check drawdown
    if (metrics.drawdown > limits.maxDrawdown) {
      alerts.push({
        type: 'drawdown',
        severity: 'high',
        message: `Portfolio drawdown ${(metrics.drawdown * 100).toFixed(2)}% exceeds limit`,
        action: 'Consider reducing position sizes'
      });
    }

    // Check concentration
    if (metrics.concentrationRisk > 0.8) {
      alerts.push({
        type: 'concentration',
        severity: 'medium',
        message: 'High portfolio concentration detected',
        action: 'Consider diversifying holdings'
      });
    }

    // Check VaR
    if (metrics.var95 > limits.maxDailyLoss * portfolio?.totalValue?.current) {
      alerts.push({
        type: 'var',
        severity: 'high',
        message: 'Value at Risk exceeds daily loss limit',
        action: 'Reduce position sizes or hedge exposure'
      });
    }

    return alerts;
  }

  /**
   * Send risk alerts to user
   * @param {string} userId - User ID
   * @param {Array} alerts - Risk alerts
   */
  async sendRiskAlerts(userId, alerts) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.preferences.notifications.email.enabled) return;

      for (const alert of alerts) {
        logger.warn(`Risk alert for user ${userId}:`, alert);
        
        // Store alert in monitoring data
        const monitoring = this.activeMonitoring.get(userId);
        if (monitoring) {
          monitoring.warnings.push({
            ...alert,
            timestamp: Date.now()
          });
          this.activeMonitoring.set(userId, monitoring);
        }

        // Send notification (email, push, etc.)
        // Implementation would depend on notification service
      }

    } catch (error) {
      logger.error('Error sending risk alerts:', error);
    }
  }

  // Helper methods
  async getCurrentPrice(symbol) {
    try {
      // Try to get unified price from multiple exchanges
      const ticker = await marketDataService.getTicker(symbol);
      return ticker.data?.unified?.averagePrice || ticker.data?.byExchange?.[0]?.last || 0;
    } catch (error) {
      logger.warn(`Could not get price for ${symbol}:`, error);
      return 0;
    }
  }

  async calculateAssetCorrelation(asset1, asset2) {
    // Simplified correlation calculation
    // In production, this would use historical price data
    if (asset1 === asset2) return 1.0;
    
    const correlationMap = {
      'BTC': { 'ETH': 0.8, 'LTC': 0.7, 'BCH': 0.6 },
      'ETH': { 'BTC': 0.8, 'LTC': 0.6, 'BCH': 0.5 }
    };
    
    return correlationMap[asset1]?.[asset2] || 0.3; // Default low correlation
  }

  getAssetClass(symbol) {
    const [base] = symbol.split('/');
    
    const stablecoins = ['USDT', 'USDC', 'BUSD', 'DAI'];
    const majors = ['BTC', 'ETH'];
    const defi = ['UNI', 'SUSHI', 'COMP', 'AAVE'];
    
    if (stablecoins.includes(base)) return 'stablecoin';
    if (majors.includes(base)) return 'crypto';
    if (defi.includes(base)) return 'defi';
    
    return 'crypto';
  }

  calculateConcentrationRisk(portfolio) {
    if (!portfolio || !portfolio.holdings) return 0;
    
    let maxHolding = 0;
    for (const [asset, holding] of portfolio.holdings) {
      const percentage = holding.currentValue / portfolio.totalValue.current;
      maxHolding = Math.max(maxHolding, percentage);
    }
    
    return maxHolding;
  }

  calculateDiversificationScore(portfolio) {
    if (!portfolio || !portfolio.holdings) return 0;
    
    const holdings = Array.from(portfolio.holdings.values());
    const totalValue = portfolio.totalValue.current;
    
    // Calculate Herfindahl-Hirschman Index
    const hhi = holdings.reduce((sum, holding) => {
      const share = holding.currentValue / totalValue;
      return sum + (share * share);
    }, 0);
    
    // Convert to diversification score (0-1, higher is better)
    return Math.max(0, 1 - hhi);
  }

  async calculateVaR(positions, confidence) {
    // Simplified VaR calculation
    // Production version would use historical simulation or Monte Carlo
    const portfolioValue = positions.reduce((sum, pos) => sum + pos.entryValue, 0);
    const volatility = 0.02; // Assume 2% daily volatility
    
    // Normal distribution approximation
    const zScore = confidence === 0.95 ? 1.645 : 2.326; // 95% or 99%
    return portfolioValue * volatility * zScore;
  }

  async calculatePortfolioBeta(positions) {
    // Simplified beta calculation against BTC as market proxy
    // Production version would use regression analysis
    return 1.0; // Placeholder
  }

  calculateLeverageUtilization(positions, limits) {
    // Calculate current leverage usage vs limits
    const totalLeverage = positions.reduce((sum, pos) => 
      sum + (pos.leverage || 1.0) * pos.entryValue, 0);
    const totalValue = positions.reduce((sum, pos) => sum + pos.entryValue, 0);
    
    const avgLeverage = totalValue > 0 ? totalLeverage / totalValue : 1.0;
    return avgLeverage / limits.maxLeverage;
  }

  /**
   * Get risk management statistics
   * @param {string} userId - User ID
   * @returns {Object} Risk management stats
   */
  getRiskStats(userId) {
    const limits = this.riskLimits.get(userId);
    const monitoring = this.activeMonitoring.get(userId);
    
    return {
      limitsConfigured: !!limits,
      monitoringActive: monitoring?.enabled || false,
      lastCheck: monitoring?.lastCheck,
      recentViolations: monitoring?.violations?.slice(-5) || [],
      recentWarnings: monitoring?.warnings?.slice(-5) || [],
      riskProfile: limits ? this.getRiskProfileSummary(limits) : null
    };
  }

  getRiskProfileSummary(limits) {
    return {
      maxPositionSize: `${(limits.maxPositionSize * 100).toFixed(1)}%`,
      maxDailyLoss: `${(limits.maxDailyLoss * 100).toFixed(1)}%`,
      maxDrawdown: `${(limits.maxDrawdown * 100).toFixed(1)}%`,
      maxLeverage: `${limits.maxLeverage}x`,
      stopLossRequired: limits.stopLossRequired,
      allowedAssetClasses: limits.allowedAssetClasses.join(', ')
    };
  }
}

// Export singleton instance
module.exports = new RiskManagementService();