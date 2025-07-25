const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

/**
 * Database connection class
 * Handles MongoDB connection with proper error handling and reconnection logic
 */
class Database {
  constructor() {
    this.isConnected = false;
    this.connectionOptions = {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferCommands: false, // Disable mongoose buffering
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
      family: 4 // Use IPv4, skip trying IPv6
    };
  }

  /**
   * Connect to MongoDB database
   * @returns {Promise<boolean>} Connection success status
   */
  async connect() {
    try {
      if (this.isConnected) {
        logger.info('Database already connected');
        return true;
      }

      logger.info('Connecting to MongoDB...', {
        uri: config.database.mongoUri.replace(/\/\/.*@/, '//***:***@')
      });

      await mongoose.connect(config.database.mongoUri, this.connectionOptions);

      this.isConnected = true;
      logger.info('Successfully connected to MongoDB');

      // Set up connection event listeners
      this.setupEventListeners();

      return true;
    } catch (error) {
      logger.error('MongoDB connection failed:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB database
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (!this.isConnected) {
        logger.info('Database not connected, skipping disconnect');
        return;
      }

      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('Disconnected from MongoDB');
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  /**
   * Check database connection health
   * @returns {Object} Connection health status
   */
  getHealthStatus() {
    const readyState = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    return {
      status: states[readyState] || 'unknown',
      readyState,
      isConnected: this.isConnected && readyState === 1,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    };
  }

  /**
   * Set up MongoDB connection event listeners
   * @private
   */
  setupEventListeners() {
    mongoose.connection.on('connected', () => {
      logger.info('Mongoose connected to MongoDB');
      this.isConnected = true;
    });

    mongoose.connection.on('error', error => {
      logger.error('Mongoose connection error:', error);
      this.isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('Mongoose disconnected from MongoDB');
      this.isConnected = false;
    });

    // Handle application termination
    process.on('SIGINT', async () => {
      logger.info('Application terminating, closing MongoDB connection...');
      await this.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Application terminating (SIGTERM), closing MongoDB connection...');
      await this.disconnect();
      process.exit(0);
    });
  }

  /**
   * Get MongoDB connection instance
   * @returns {mongoose.Connection} MongoDB connection
   */
  getConnection() {
    return mongoose.connection;
  }

  /**
   * Clear all collections (for testing purposes)
   * @returns {Promise<void>}
   */
  async clearDatabase() {
    if (config.server.nodeEnv !== 'test') {
      throw new Error('clearDatabase can only be used in test environment');
    }

    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }

    logger.info('Database cleared');
  }
}

// Create singleton instance
const database = new Database();

module.exports = database;
