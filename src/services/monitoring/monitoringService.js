const os = require('os');
const process = require('process');
const logger = require('../../utils/logger');

/**
 * Comprehensive Monitoring Service
 * System health, performance metrics, and alerting
 */
class MonitoringService {
  constructor() {
    this.metrics = new Map();
    this.alerts = [];
    this.thresholds = {
      cpu: 80, // CPU usage %
      memory: 85, // Memory usage %
      diskSpace: 90, // Disk usage %
      responseTime: 5000, // Response time in ms
      errorRate: 0.05, // 5% error rate
      activeConnections: 1000
    };
    this.monitoringInterval = null;
    this.collectionInterval = 30000; // 30 seconds
    this.isRunning = false;
  }

  /**
   * Start monitoring service
   */
  start() {
    if (this.isRunning) {
      logger.warn('Monitoring service already running');
      return;
    }

    this.isRunning = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.collectionInterval);

    logger.info('Monitoring service started', {
      interval: this.collectionInterval,
      thresholds: this.thresholds
    });
  }

  /**
   * Stop monitoring service
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isRunning = false;
    logger.info('Monitoring service stopped');
  }

  /**
   * Collect system and application metrics
   */
  async collectMetrics() {
    try {
      const timestamp = Date.now();
      const metrics = {
        timestamp,
        system: await this.collectSystemMetrics(),
        application: await this.collectApplicationMetrics(),
        database: await this.collectDatabaseMetrics(),
        cache: await this.collectCacheMetrics(),
        trading: await this.collectTradingMetrics()
      };

      // Store metrics
      this.storeMetrics(metrics);

      // Check for alerts
      await this.checkAlerts(metrics);

      // Log high-level metrics
      logger.debug('Metrics collected', {
        cpu: metrics.system.cpu.usage,
        memory: metrics.system.memory.usagePercent,
        activeConnections: metrics.application.connections,
        responseTime: metrics.application.averageResponseTime
      });

    } catch (error) {
      logger.error('Error collecting metrics:', error);
    }
  }

  /**
   * Collect system-level metrics
   */
  async collectSystemMetrics() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    // Calculate CPU usage
    const cpuUsage = await this.calculateCpuUsage();

    return {
      cpu: {
        cores: cpus.length,
        model: cpus[0].model,
        usage: cpuUsage,
        loadAverage: os.loadavg()
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usagePercent: (usedMem / totalMem) * 100
      },
      uptime: os.uptime(),
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      networkInterfaces: Object.keys(os.networkInterfaces()).length
    };
  }

  /**
   * Collect application-level metrics
   */
  async collectApplicationMetrics() {
    const memUsage = process.memoryUsage();
    
    return {
      pid: process.pid,
      uptime: process.uptime(),
      version: process.version,
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers
      },
      cpu: process.cpuUsage(),
      eventLoop: {
        delay: await this.measureEventLoopDelay(),
        utilization: await this.measureEventLoopUtilization()
      },
      connections: this.getActiveConnections(),
      requests: this.getRequestMetrics(),
      errors: this.getErrorMetrics(),
      averageResponseTime: this.getAverageResponseTime()
    };
  }

  /**
   * Collect database metrics
   */
  async collectDatabaseMetrics() {
    try {
      const mongoose = require('mongoose');
      const connection = mongoose.connection;
      
      return {
        state: connection.readyState,
        host: connection.host,
        port: connection.port,
        name: connection.name,
        collections: Object.keys(connection.collections).length,
        // Add more MongoDB-specific metrics as needed
      };
    } catch (error) {
      return {
        state: 'unknown',
        error: error.message
      };
    }
  }

  /**
   * Collect cache metrics
   */
  async collectCacheMetrics() {
    // No external cache service - using in-memory caching
    return {
      connected: true,
      type: 'memory',
      status: 'in_memory_only'
    };
  }

  /**
   * Collect trading-specific metrics
   */
  async collectTradingMetrics() {
    try {
      const Order = require('../../models/Order');
      const TradingPosition = require('../../models/TradingPosition');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        totalOrders,
        todayOrders,
        activeOrders,
        totalPositions,
        openPositions
      ] = await Promise.all([
        Order.countDocuments(),
        Order.countDocuments({ 'timestamps.created': { $gte: today } }),
        Order.countDocuments({ status: { $in: ['pending', 'open'] } }),
        TradingPosition.countDocuments(),
        TradingPosition.countDocuments({ status: 'open' })
      ]);

      return {
        orders: {
          total: totalOrders,
          today: todayOrders,
          active: activeOrders
        },
        positions: {
          total: totalPositions,
          open: openPositions
        }
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  }

  /**
   * Store metrics for historical analysis
   */
  storeMetrics(metrics) {
    const key = `metrics_${Date.now()}`;
    this.metrics.set(key, metrics);

    // Keep only last 1000 metric entries
    if (this.metrics.size > 1000) {
      const oldestKey = this.metrics.keys().next().value;
      this.metrics.delete(oldestKey);
    }

    // Store in memory only
  }

  /**
   * Check for alert conditions
   */
  async checkAlerts(metrics) {
    const alerts = [];

    // CPU usage alert
    if (metrics.system.cpu.usage > this.thresholds.cpu) {
      alerts.push({
        type: 'cpu_high',
        severity: 'warning',
        message: `High CPU usage: ${metrics.system.cpu.usage.toFixed(1)}%`,
        threshold: this.thresholds.cpu,
        current: metrics.system.cpu.usage,
        timestamp: metrics.timestamp
      });
    }

    // Memory usage alert
    if (metrics.system.memory.usagePercent > this.thresholds.memory) {
      alerts.push({
        type: 'memory_high',
        severity: 'warning',
        message: `High memory usage: ${metrics.system.memory.usagePercent.toFixed(1)}%`,
        threshold: this.thresholds.memory,
        current: metrics.system.memory.usagePercent,
        timestamp: metrics.timestamp
      });
    }

    // Response time alert
    if (metrics.application.averageResponseTime > this.thresholds.responseTime) {
      alerts.push({
        type: 'response_time_high',
        severity: 'warning',
        message: `High response time: ${metrics.application.averageResponseTime}ms`,
        threshold: this.thresholds.responseTime,
        current: metrics.application.averageResponseTime,
        timestamp: metrics.timestamp
      });
    }

    // Database connection alert
    if (metrics.database.state !== 1) { // 1 = connected in mongoose
      alerts.push({
        type: 'database_disconnected',
        severity: 'critical',
        message: 'Database connection lost',
        timestamp: metrics.timestamp
      });
    }

    // Cache is always in-memory, so no connection issues

    // Process alerts
    if (alerts.length > 0) {
      await this.processAlerts(alerts);
    }
  }

  /**
   * Process and handle alerts
   */
  async processAlerts(alerts) {
    for (const alert of alerts) {
      // Store alert
      this.alerts.push(alert);
      
      // Keep only last 100 alerts
      if (this.alerts.length > 100) {
        this.alerts.shift();
      }

      // Log alert
      const logLevel = alert.severity === 'critical' ? 'error' : 
                      alert.severity === 'warning' ? 'warn' : 'info';
      
      logger[logLevel]('Monitoring alert', alert);

      // Send notifications if configured
      await this.sendAlert(alert);
    }
  }

  /**
   * Send alert notifications
   */
  async sendAlert(alert) {
    try {
      // Store alert in memory only for now
      // Here you could integrate with:
      // - Email notifications
      // - Slack webhooks
      // - PagerDuty
      // - SMS services
      // - etc.

    } catch (error) {
      logger.error('Error sending alert:', error);
    }
  }

  /**
   * Get current system health status
   */
  async getHealthStatus() {
    try {
      const currentMetrics = await this.getCurrentMetrics();
      const recentAlerts = this.getRecentAlerts(300000); // Last 5 minutes
      
      // Determine overall health
      let status = 'healthy';
      let score = 100;

      // Check critical alerts
      const criticalAlerts = recentAlerts.filter(a => a.severity === 'critical');
      if (criticalAlerts.length > 0) {
        status = 'critical';
        score = 0;
      } else {
        // Check warning alerts and metrics
        const warningAlerts = recentAlerts.filter(a => a.severity === 'warning');
        score -= warningAlerts.length * 10;
        
        if (currentMetrics.system.cpu.usage > this.thresholds.cpu * 0.8) score -= 10;
        if (currentMetrics.system.memory.usagePercent > this.thresholds.memory * 0.8) score -= 10;
        if (currentMetrics.application.averageResponseTime > this.thresholds.responseTime * 0.8) score -= 10;
        
        if (score < 70) status = 'degraded';
        else if (score < 90) status = 'warning';
      }

      return {
        status,
        score: Math.max(0, score),
        uptime: process.uptime(),
        timestamp: Date.now(),
        metrics: currentMetrics,
        alerts: recentAlerts.length,
        services: {
          database: currentMetrics.database.state === 1 ? 'healthy' : 'unhealthy',
          cache: 'healthy', // Always healthy with in-memory cache
          api: status
        }
      };
    } catch (error) {
      logger.error('Error getting health status:', error);
      return {
        status: 'unhealthy',
        score: 0,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get metrics for a time range
   */
  getMetricsHistory(startTime, endTime) {
    const history = [];
    
    for (const [key, metrics] of this.metrics) {
      if (metrics.timestamp >= startTime && metrics.timestamp <= endTime) {
        history.push(metrics);
      }
    }
    
    return history.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(timeWindow = 3600000) { // Default 1 hour
    const cutoff = Date.now() - timeWindow;
    return this.alerts.filter(alert => alert.timestamp >= cutoff);
  }

  /**
   * Get monitoring statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      interval: this.collectionInterval,
      metricsCollected: this.metrics.size,
      totalAlerts: this.alerts.length,
      recentAlerts: this.getRecentAlerts().length,
      thresholds: this.thresholds,
      uptime: process.uptime()
    };
  }

  // Helper methods
  async getCurrentMetrics() {
    return {
      timestamp: Date.now(),
      system: await this.collectSystemMetrics(),
      application: await this.collectApplicationMetrics(),
      database: await this.collectDatabaseMetrics(),
      cache: await this.collectCacheMetrics(),
      trading: await this.collectTradingMetrics()
    };
  }

  async calculateCpuUsage() {
    return new Promise((resolve) => {
      const start = process.cpuUsage();
      setTimeout(() => {
        const end = process.cpuUsage(start);
        const total = end.user + end.system;
        const usage = (total / 1000000) * 100; // Convert to percentage
        resolve(Math.min(100, usage));
      }, 100);
    });
  }

  async measureEventLoopDelay() {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
        resolve(delay);
      });
    });
  }

  async measureEventLoopUtilization() {
    // This would require the perf_hooks module in newer Node.js versions
    // For now, return a placeholder
    return 0;
  }

  getActiveConnections() {
    // This would need to be implemented based on your server setup
    // For Express.js, you might track this in middleware
    return 0; // Placeholder
  }

  getRequestMetrics() {
    // This would track request counts, response times, etc.
    // Implementation would depend on your middleware setup
    return {
      total: 0,
      success: 0,
      errors: 0,
      rate: 0
    };
  }

  getErrorMetrics() {
    // Track error rates and types
    return {
      count: 0,
      rate: 0,
      types: {}
    };
  }

  getAverageResponseTime() {
    // Calculate average response time
    return 0; // Placeholder
  }

  /**
   * Set custom thresholds
   */
  setThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info('Monitoring thresholds updated', this.thresholds);
  }

  /**
   * Add custom metric
   */
  addCustomMetric(name, value, tags = {}) {
    const metric = {
      name,
      value,
      tags,
      timestamp: Date.now()
    };
    
    // Store in memory only
    logger.debug('Custom metric recorded', metric);
  }
}

// Export singleton instance
module.exports = new MonitoringService();