const exchangeManager = require('../src/services/exchanges/exchangeManager');

// Mock CCXT to avoid real API calls in tests
jest.mock('ccxt', () => {
  const mockExchange = {
    fetchBalance: jest.fn().mockResolvedValue({
      BTC: { free: 1.0, used: 0.5, total: 1.5 },
      ETH: { free: 10.0, used: 2.0, total: 12.0 },
      USDT: { free: 1000.0, used: 500.0, total: 1500.0 }
    }),
    fetchTime: jest.fn().mockResolvedValue(Date.now()),
    checkRequiredCredentials: jest.fn(),
    apiKey: 'test-key',
    secret: 'test-secret'
  };

  return {
    binance: jest.fn().mockImplementation(() => mockExchange),
    coinbase: jest.fn().mockImplementation(() => mockExchange),
    kraken: jest.fn().mockImplementation(() => mockExchange)
  };
});

// Mock LCX exchange adapter
jest.mock('../src/services/exchanges/adapters/lcxAdapter', () => {
  return jest.fn().mockImplementation(() => ({
    fetchBalance: jest.fn().mockResolvedValue({
      BTC: { free: 1.0, used: 0.5, total: 1.5 },
      ETH: { free: 10.0, used: 2.0, total: 12.0 },
      USDT: { free: 1000.0, used: 500.0, total: 1500.0 }
    }),
    fetchTime: jest.fn().mockResolvedValue(Date.now()),
    checkRequiredCredentials: jest.fn(),
    apiKey: 'test-key',
    secret: 'test-secret'
  }));
});

describe('Exchange Manager', () => {
  const testUserId = 'test-user-123';
  const testCredentials = {
    apiKey: 'test-api-key',
    secret: 'test-secret-key'
  };

  afterEach(() => {
    // Clean up exchanges after each test
    exchangeManager.removeExchange(testUserId, 'binance');
    exchangeManager.removeExchange(testUserId, 'coinbase');
    exchangeManager.removeExchange(testUserId, 'kraken');
    exchangeManager.removeExchange(testUserId, 'lcx');
  });

  describe('Supported Exchanges', () => {
    test('should return list of supported exchanges', () => {
      const exchanges = exchangeManager.getSupportedExchanges();

      expect(Array.isArray(exchanges)).toBe(true);
      expect(exchanges.length).toBeGreaterThan(0);

      const exchangeNames = exchanges.map(ex => ex.id);
      expect(exchangeNames).toContain('binance');
      expect(exchangeNames).toContain('coinbase');
      expect(exchangeNames).toContain('kraken');
      expect(exchangeNames).toContain('lcx');
    });

    test('should include exchange features and display names', () => {
      const exchanges = exchangeManager.getSupportedExchanges();
      const binance = exchanges.find(ex => ex.id === 'binance');

      expect(binance).toHaveProperty('name');
      expect(binance).toHaveProperty('enabled');
      expect(binance).toHaveProperty('features');
      expect(binance.features).toHaveProperty('spot');
      expect(binance.features).toHaveProperty('futures');
    });
  });

  describe('Exchange Creation', () => {
    test('should create exchange instance successfully', async () => {
      const exchange = await exchangeManager.createExchange('binance', testCredentials, true);

      expect(exchange).toBeTruthy();
      expect(typeof exchange.fetchBalance).toBe('function');
    });

    test('should fail to create unsupported exchange', async () => {
      await expect(exchangeManager.createExchange('unsupported', testCredentials)).rejects.toThrow(
        'Exchange unsupported is not supported'
      );
    });

    test('should test connection during creation', async () => {
      // This test relies on the mocked fetchBalance method
      const exchange = await exchangeManager.createExchange('binance', testCredentials, true);

      expect(exchange.fetchBalance).toBeDefined();
    });
  });

  describe('Exchange Management', () => {
    test('should add exchange for user', async () => {
      const exchangeId = await exchangeManager.addExchange(
        testUserId,
        'binance',
        testCredentials,
        true
      );

      expect(exchangeId).toBe(`${testUserId}_binance`);

      const exchange = exchangeManager.getExchange(testUserId, 'binance');
      expect(exchange).toBeTruthy();
    });

    test('should get user exchanges', async () => {
      await exchangeManager.addExchange(testUserId, 'binance', testCredentials, true);
      await exchangeManager.addExchange(
        testUserId,
        'coinbase',
        { ...testCredentials, passphrase: 'test' },
        true
      );

      const userExchanges = exchangeManager.getUserExchanges(testUserId);

      expect(userExchanges).toHaveLength(2);
      expect(userExchanges.some(ex => ex.name === 'binance')).toBe(true);
      expect(userExchanges.some(ex => ex.name === 'coinbase')).toBe(true);
    });

    test('should remove exchange for user', async () => {
      await exchangeManager.addExchange(testUserId, 'binance', testCredentials, true);

      const removed = exchangeManager.removeExchange(testUserId, 'binance');
      expect(removed).toBe(true);

      const exchange = exchangeManager.getExchange(testUserId, 'binance');
      expect(exchange).toBe(null);
    });

    test('should return false when removing non-existent exchange', () => {
      const removed = exchangeManager.removeExchange(testUserId, 'nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('Exchange Health Monitoring', () => {
    test('should get exchange health status', async () => {
      await exchangeManager.addExchange(testUserId, 'binance', testCredentials, true);

      const health = await exchangeManager.getExchangeHealth(testUserId, 'binance');

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('latency');
      expect(health).toHaveProperty('serverTime');
      expect(health).toHaveProperty('lastCheck');
      expect(health.status).toBe('healthy');
    });

    test('should return not_connected for non-existent exchange', async () => {
      const health = await exchangeManager.getExchangeHealth(testUserId, 'nonexistent');

      expect(health.status).toBe('not_connected');
      expect(health.message).toBe('Exchange not found');
    });
  });

  describe('Unified Balance', () => {
    test('should get unified balance across exchanges', async () => {
      await exchangeManager.addExchange(testUserId, 'binance', testCredentials, true);
      await exchangeManager.addExchange(
        testUserId,
        'coinbase',
        { ...testCredentials, passphrase: 'test' },
        true
      );

      const unifiedBalance = await exchangeManager.getUnifiedBalance(testUserId);

      expect(unifiedBalance).toHaveProperty('unified');
      expect(unifiedBalance).toHaveProperty('byExchange');
      expect(unifiedBalance).toHaveProperty('timestamp');

      // Check if balances are aggregated
      expect(unifiedBalance.unified.BTC).toBeDefined();
      expect(unifiedBalance.unified.BTC.total).toBe(3.0); // 1.5 from each exchange
      expect(unifiedBalance.unified.BTC.exchanges).toHaveProperty('binance');
      expect(unifiedBalance.unified.BTC.exchanges).toHaveProperty('coinbase');
    });

    test('should handle empty exchanges list', async () => {
      const unifiedBalance = await exchangeManager.getUnifiedBalance(testUserId);

      expect(unifiedBalance.unified).toEqual({});
      expect(unifiedBalance.byExchange).toEqual({});
    });
  });

  describe('Display Names and Features', () => {
    test('should get correct display names', () => {
      expect(exchangeManager.getExchangeDisplayName('binance')).toBe('Binance');
      expect(exchangeManager.getExchangeDisplayName('coinbase')).toBe('Coinbase Pro');
      expect(exchangeManager.getExchangeDisplayName('kraken')).toBe('Kraken');
      expect(exchangeManager.getExchangeDisplayName('lcx')).toBe('LCX');
      expect(exchangeManager.getExchangeDisplayName('unknown')).toBe('unknown');
    });

    test('should get exchange features', () => {
      const binanceFeatures = exchangeManager.getExchangeFeatures('binance');

      expect(binanceFeatures).toHaveProperty('spot');
      expect(binanceFeatures).toHaveProperty('futures');
      expect(binanceFeatures).toHaveProperty('margin');
      expect(binanceFeatures).toHaveProperty('websocket');
      expect(binanceFeatures.spot).toBe(true);
    });
  });

  describe('Statistics', () => {
    test('should get manager statistics', async () => {
      await exchangeManager.addExchange(testUserId, 'binance', testCredentials, true);
      await exchangeManager.addExchange(
        'another-user',
        'coinbase',
        { ...testCredentials, passphrase: 'test' },
        true
      );

      const stats = exchangeManager.getStats();

      expect(stats).toHaveProperty('totalExchanges');
      expect(stats).toHaveProperty('byExchange');
      expect(stats).toHaveProperty('byUser');
      expect(stats.totalExchanges).toBeGreaterThan(0);
      expect(stats.byUser[testUserId]).toBe(1);

      // Cleanup
      exchangeManager.removeExchange('another-user', 'coinbase');
    });
  });

  describe('Cleanup', () => {
    test('should cleanup inactive exchanges', async () => {
      await exchangeManager.addExchange(testUserId, 'binance', testCredentials, true);

      // Manually set lastUsed to past time for testing
      const exchangeData = exchangeManager.exchanges.get(`${testUserId}_binance`);
      if (exchangeData) {
        exchangeData.lastUsed = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      }

      exchangeManager.cleanupInactiveExchanges(24); // 24 hours

      const exchange = exchangeManager.getExchange(testUserId, 'binance');
      expect(exchange).toBe(null);
    });
  });
});
