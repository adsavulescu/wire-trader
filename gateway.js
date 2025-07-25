#!/usr/bin/env node

const apiGateway = require('./src/services/gateway/apiGateway');
const config = require('./src/config');
const logger = require('./src/utils/logger');

/**
 * API Gateway Entry Point
 * Starts the API Gateway server
 */
async function startGateway() {
  try {
    const gatewayPort = config.gateway?.port || 3001;
    
    logger.info('Starting Wire-Trader API Gateway...');
    
    const server = await apiGateway.start(gatewayPort);
    
    logger.info('🌐 Wire-Trader API Gateway Started', {
      port: gatewayPort,
      environment: config.server.nodeEnv,
      processId: process.pid
    });

    console.log('\n🌐 Wire-Trader API Gateway Started');
    console.log(`📡 Gateway: http://localhost:${gatewayPort}`);
    console.log(`📊 Status: http://localhost:${gatewayPort}/gateway/status`);
    console.log(`🌍 Environment: ${config.server.nodeEnv}`);
    console.log('═══════════════════════════════════════\n');

    // Handle graceful shutdown
    const gracefulShutdown = (signal) => {
      logger.info(`Received ${signal}, shutting down gateway gracefully...`);
      
      server.close(() => {
        logger.info('API Gateway server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start API Gateway:', error);
    process.exit(1);
  }
}

// Start gateway if this file is run directly
if (require.main === module) {
  startGateway();
}

module.exports = { startGateway };