const exchangeManager = require('../src/services/exchanges/exchangeManager');

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

describe('LCX Exchange Integration', () => {
  const testUserId = 'test-user-123';
  const testCredentials = {
    apiKey: 'test-api-key',
    secret: 'test-secret-key'
  };

  afterEach(() => {
    exchangeManager.removeExchange(testUserId, 'lcx');
  });

  test('should include LCX in supported exchanges', () => {
    const exchanges = exchangeManager.getSupportedExchanges();
    const lcx = exchanges.find(ex => ex.id === 'lcx');
    
    expect(lcx).toBeDefined();
    expect(lcx.name).toBe('LCX');
    expect(lcx.features).toBeDefined();
    expect(lcx.features.spot).toBe(true);
    expect(lcx.features.futures).toBe(false);
  });

  test('should verify LCX adapter can be required', () => {
    // Test that LCXExchange class can be required without errors
    const LCXExchange = require('../src/services/exchanges/adapters/lcxAdapter');
    expect(LCXExchange).toBeDefined();
    expect(typeof LCXExchange).toBe('function');
  });

  test('should be recognized by exchange manager', () => {
    // Test that exchange manager recognizes LCX as a valid exchange
    const supportedExchanges = exchangeManager.getSupportedExchanges();
    const lcxExchange = supportedExchanges.find(ex => ex.id === 'lcx');
    
    expect(lcxExchange).toBeDefined();
    expect(lcxExchange.enabled).toBe(true);
  });

  test('should get LCX display name correctly', () => {
    expect(exchangeManager.getExchangeDisplayName('lcx')).toBe('LCX');
  });

  test('should get LCX features correctly', () => {
    const features = exchangeManager.getExchangeFeatures('lcx');
    
    expect(features.spot).toBe(true);
    expect(features.futures).toBe(false);
    expect(features.margin).toBe(false);
    expect(features.options).toBe(false);
    expect(features.websocket).toBe(false);
  });
});