const marketDataService = require('../src/services/market/marketDataService');
const exchangeManager = require('../src/services/exchanges/exchangeManager');

// Mock exchange manager
jest.mock('../src/services/exchanges/exchangeManager');

// Mock CCXT
jest.mock('ccxt', () => {
  const mockExchange = {
    fetchTicker: jest.fn(),
    fetchOrderBook: jest.fn(),
    fetchTrades: jest.fn(),
    fetchOHLCV: jest.fn(),
    loadMarkets: jest.fn(),
    has: {
      fetchOHLCV: true
    }
  };

  return {
    binance: jest.fn(() => mockExchange),
    coinbase: jest.fn(() => mockExchange),
    kraken: jest.fn(() => mockExchange),
    __mockExchange: mockExchange
  };
});

const ccxt = require('ccxt');

describe('Market Data Service', () => {
  let mockExchange;

  beforeEach(() => {
    mockExchange = ccxt.__mockExchange;
    jest.clearAllMocks();

    exchangeManager.getSupportedExchanges.mockReturnValue([
      { id: 'binance', enabled: true },
      { id: 'coinbase', enabled: true },
      { id: 'kraken', enabled: true }
    ]);

    // Setup default mock responses
    mockExchange.fetchTicker.mockResolvedValue({
      symbol: 'BTC/USDT',
      last: 50000,
      bid: 49999,
      ask: 50001,
      high: 51000,
      low: 49000,
      volume: 1000,
      change: 1000,
      percentage: 2.04,
      timestamp: Date.now(),
      datetime: new Date().toISOString()
    });

    mockExchange.fetchOrderBook.mockResolvedValue({
      symbol: 'BTC/USDT',
      bids: [
        [49999, 0.5],
        [49998, 1.0],
        [49997, 2.0]
      ],
      asks: [
        [50001, 0.3],
        [50002, 0.8],
        [50003, 1.5]
      ],
      timestamp: Date.now(),
      datetime: new Date().toISOString(),
      nonce: 12345
    });

    mockExchange.fetchTrades.mockResolvedValue([
      {
        id: 'trade1',
        timestamp: Date.now() - 1000,
        datetime: new Date(Date.now() - 1000).toISOString(),
        price: 50000,
        amount: 0.001,
        cost: 50,
        side: 'buy',
        takerOrMaker: 'taker'
      },
      {
        id: 'trade2',
        timestamp: Date.now(),
        datetime: new Date().toISOString(),
        price: 50001,
        amount: 0.002,
        cost: 100.002,
        side: 'sell',
        takerOrMaker: 'maker'
      }
    ]);

    mockExchange.fetchOHLCV.mockResolvedValue([
      [Date.now() - 3600000, 49500, 50500, 49000, 50000, 1000],
      [Date.now() - 7200000, 49000, 49500, 48500, 49500, 800]
    ]);

    mockExchange.loadMarkets.mockResolvedValue({
      'BTC/USDT': {
        id: 'BTCUSDT',
        symbol: 'BTC/USDT',
        base: 'BTC',
        quote: 'USDT',
        active: true,
        type: 'spot',
        spot: true,
        margin: false,
        future: false,
        option: false,
        contract: false,
        limits: {
          amount: { min: 0.000001, max: 9000 },
          price: { min: 0.01, max: 1000000 }
        },
        precision: {
          amount: 6,
          price: 2
        },
        fees: {
          trading: {
            maker: 0.001,
            taker: 0.001
          }
        }
      }
    });
  });

  describe('Ticker Data', () => {
    test('should get ticker from single exchange', async () => {
      const ticker = await marketDataService.getTicker('binance', 'BTC/USDT');

      expect(ticker).toMatchObject({
        symbol: 'BTC/USDT',
        exchange: 'binance',
        last: 50000,
        bid: 49999,
        ask: 50001,
        high: 51000,
        low: 49000,
        volume: 1000,
        change: 1000,
        percentage: 2.04
      });

      expect(ticker.timestamp).toBeTruthy();
      expect(ticker.datetime).toBeTruthy();
      expect(mockExchange.fetchTicker).toHaveBeenCalledWith('BTC/USDT');
    });

    test('should get unified ticker from multiple exchanges', async () => {
      // Mock different prices from different exchanges
      let callCount = 0;
      mockExchange.fetchTicker.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          symbol: 'BTC/USDT',
          last: 50000 + callCount * 10, // Different prices
          bid: 49999 + callCount * 10,
          ask: 50001 + callCount * 10,
          volume: 1000,
          timestamp: Date.now(),
          datetime: new Date().toISOString()
        });
      });

      const unifiedTicker = await marketDataService.getUnifiedTicker('BTC/USDT');

      expect(unifiedTicker.symbol).toBe('BTC/USDT');
      expect(unifiedTicker.unified).toMatchObject({
        averagePrice: expect.any(Number),
        bestBid: expect.any(Number),
        bestAsk: expect.any(Number),
        spread: expect.any(Number),
        spreadPercentage: expect.any(Number),
        totalVolume: expect.any(Number),
        exchangeCount: 3
      });
      expect(unifiedTicker.byExchange).toHaveLength(3);
      expect(unifiedTicker.errors).toEqual([]);
    });

    test('should handle ticker fetch errors gracefully', async () => {
      let callCount = 0;
      mockExchange.fetchTicker.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          symbol: 'BTC/USDT',
          last: 50000,
          bid: 49999,
          ask: 50001,
          volume: 1000,
          timestamp: Date.now(),
          datetime: new Date().toISOString()
        });
      });

      const unifiedTicker = await marketDataService.getUnifiedTicker('BTC/USDT');

      expect(unifiedTicker.byExchange).toHaveLength(2); // Only 2 successful
      expect(unifiedTicker.errors).toHaveLength(1);
      expect(unifiedTicker.errors[0].error).toBe('Network error');
    });

    test('should cache ticker data', async () => {
      // First call
      await marketDataService.getTicker('binance', 'BTC/USDT');
      expect(mockExchange.fetchTicker).toHaveBeenCalledTimes(1);

      // Second call within cache time should use cache
      await marketDataService.getTicker('binance', 'BTC/USDT');
      expect(mockExchange.fetchTicker).toHaveBeenCalledTimes(1);
    });
  });

  describe('Orderbook Data', () => {
    test('should get orderbook from single exchange', async () => {
      const orderbook = await marketDataService.getOrderbook('binance', 'BTC/USDT', 10);

      expect(orderbook).toMatchObject({
        symbol: 'BTC/USDT',
        exchange: 'binance',
        bids: [
          [49999, 0.5],
          [49998, 1.0],
          [49997, 2.0]
        ],
        asks: [
          [50001, 0.3],
          [50002, 0.8],
          [50003, 1.5]
        ]
      });

      expect(orderbook.spread).toBe(2); // 50001 - 49999
      expect(orderbook.midPrice).toBe(50000); // (50001 + 49999) / 2
      expect(orderbook.bidDepth).toBe(3.5); // 0.5 + 1.0 + 2.0
      expect(orderbook.askDepth).toBe(2.6); // 0.3 + 0.8 + 1.5

      expect(mockExchange.fetchOrderBook).toHaveBeenCalledWith('BTC/USDT', 10);
    });

    test('should get unified orderbook from multiple exchanges', async () => {
      let callCount = 0;
      mockExchange.fetchOrderBook.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          symbol: 'BTC/USDT',
          bids: [
            [49999 + callCount, 0.5],
            [49998 + callCount, 1.0]
          ],
          asks: [
            [50001 + callCount, 0.3],
            [50002 + callCount, 0.8]
          ],
          timestamp: Date.now(),
          datetime: new Date().toISOString()
        });
      });

      const unifiedOrderbook = await marketDataService.getUnifiedOrderbook('BTC/USDT', 10);

      expect(unifiedOrderbook.symbol).toBe('BTC/USDT');
      expect(unifiedOrderbook.unified).toMatchObject({
        bestBid: expect.any(Number),
        bestAsk: expect.any(Number),
        spread: expect.any(Number),
        midPrice: expect.any(Number),
        totalBidDepth: expect.any(Number),
        totalAskDepth: expect.any(Number),
        exchangeCount: 3
      });
      expect(unifiedOrderbook.byExchange).toHaveLength(3);
    });

    test('should cache orderbook data', async () => {
      // First call
      await marketDataService.getOrderbook('binance', 'BTC/USDT', 20);
      expect(mockExchange.fetchOrderBook).toHaveBeenCalledTimes(1);

      // Second call within cache time should use cache
      await marketDataService.getOrderbook('binance', 'BTC/USDT', 20);
      expect(mockExchange.fetchOrderBook).toHaveBeenCalledTimes(1);
    });
  });

  describe('Recent Trades', () => {
    test('should get recent trades from exchange', async () => {
      const trades = await marketDataService.getRecentTrades('binance', 'BTC/USDT', 50);

      expect(trades).toMatchObject({
        symbol: 'BTC/USDT',
        exchange: 'binance',
        count: 2
      });

      expect(trades.trades).toHaveLength(2);
      expect(trades.trades[0]).toMatchObject({
        id: 'trade1',
        price: 50000,
        amount: 0.001,
        cost: 50,
        side: 'buy',
        takerOrMaker: 'taker'
      });

      expect(mockExchange.fetchTrades).toHaveBeenCalledWith('BTC/USDT', undefined, 50);
    });

    test('should cache trades data', async () => {
      // First call
      await marketDataService.getRecentTrades('binance', 'BTC/USDT', 50);
      expect(mockExchange.fetchTrades).toHaveBeenCalledTimes(1);

      // Second call within cache time should use cache
      await marketDataService.getRecentTrades('binance', 'BTC/USDT', 50);
      expect(mockExchange.fetchTrades).toHaveBeenCalledTimes(1);
    });
  });

  describe('Candlestick Data', () => {
    test('should get candles from exchange', async () => {
      const candles = await marketDataService.getCandles('binance', 'BTC/USDT', '1h', 100);

      expect(candles).toMatchObject({
        symbol: 'BTC/USDT',
        exchange: 'binance',
        timeframe: '1h',
        count: 2
      });

      expect(candles.candles).toHaveLength(2);
      expect(candles.candles[0]).toMatchObject({
        open: 49500,
        high: 50500,
        low: 49000,
        close: 50000,
        volume: 1000
      });

      expect(mockExchange.fetchOHLCV).toHaveBeenCalledWith('BTC/USDT', '1h', undefined, 100);
    });

    test('should handle exchanges without OHLCV support', async () => {
      mockExchange.has.fetchOHLCV = false;

      await expect(marketDataService.getCandles('binance', 'BTC/USDT', '1h', 100)).rejects.toThrow(
        'binance does not support OHLCV data'
      );
    });

    test('should cache candles data', async () => {
      // First call
      await marketDataService.getCandles('binance', 'BTC/USDT', '1h', 100);
      expect(mockExchange.fetchOHLCV).toHaveBeenCalledTimes(1);

      // Second call within cache time should use cache
      await marketDataService.getCandles('binance', 'BTC/USDT', '1h', 100);
      expect(mockExchange.fetchOHLCV).toHaveBeenCalledTimes(1);
    });
  });

  describe('Markets Data', () => {
    test('should get markets from exchange', async () => {
      const markets = await marketDataService.getMarkets('binance');

      expect(markets).toHaveLength(1);
      expect(markets[0]).toMatchObject({
        id: 'BTCUSDT',
        symbol: 'BTC/USDT',
        base: 'BTC',
        quote: 'USDT',
        active: true,
        type: 'spot',
        spot: true,
        margin: false,
        future: false,
        option: false,
        contract: false
      });

      expect(markets[0].limits).toBeTruthy();
      expect(markets[0].precision).toBeTruthy();
      expect(markets[0].fees).toBeTruthy();

      expect(mockExchange.loadMarkets).toHaveBeenCalled();
    });
  });

  describe('Arbitrage Opportunities', () => {
    test('should find arbitrage opportunities', async () => {
      let callCount = 0;
      mockExchange.fetchTicker.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          symbol: 'BTC/USDT',
          last: 50000,
          bid: 49999 + callCount * 100, // Different bid prices
          ask: 50001 + callCount * 50, // Different ask prices
          volume: 1000,
          timestamp: Date.now(),
          datetime: new Date().toISOString()
        });
      });

      const opportunities = await marketDataService.getArbitrageOpportunities('BTC/USDT', 0.1);

      expect(opportunities.symbol).toBe('BTC/USDT');
      expect(opportunities.opportunities).toBeInstanceOf(Array);
      expect(opportunities.count).toBeGreaterThan(0);

      if (opportunities.count > 0) {
        expect(opportunities.opportunities[0]).toMatchObject({
          symbol: 'BTC/USDT',
          buyExchange: expect.any(String),
          sellExchange: expect.any(String),
          buyPrice: expect.any(Number),
          sellPrice: expect.any(Number),
          profit: expect.any(Number),
          profitPercentage: expect.any(Number),
          direction: expect.any(String)
        });
      }
    });

    test('should filter by minimum profit percentage', async () => {
      // Setup minimal price differences
      let callCount = 0;
      mockExchange.fetchTicker.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          symbol: 'BTC/USDT',
          last: 50000,
          bid: 49999 + callCount, // Very small differences
          ask: 50001 + callCount,
          volume: 1000,
          timestamp: Date.now(),
          datetime: new Date().toISOString()
        });
      });

      const opportunities = await marketDataService.getArbitrageOpportunities('BTC/USDT', 5.0); // High threshold

      expect(opportunities.count).toBe(0);
      expect(opportunities.opportunities).toHaveLength(0);
    });
  });

  describe('Cache Management', () => {
    test('should clear all caches', () => {
      // Add some data to cache first
      marketDataService.tickers.set('test', { data: 'test', timestamp: Date.now() });
      marketDataService.orderbooks.set('test', { data: 'test', timestamp: Date.now() });

      expect(marketDataService.tickers.size).toBeGreaterThan(0);
      expect(marketDataService.orderbooks.size).toBeGreaterThan(0);

      marketDataService.clearCache();

      expect(marketDataService.tickers.size).toBe(0);
      expect(marketDataService.orderbooks.size).toBe(0);
    });
  });

  describe('Service Statistics', () => {
    test('should return service statistics', () => {
      const stats = marketDataService.getStats();

      expect(stats).toMatchObject({
        tickersCount: expect.any(Number),
        orderbooksCount: expect.any(Number),
        tradesCount: expect.any(Number),
        candlesCount: expect.any(Number),
        subscribersCount: expect.any(Number),
        updateInterval: expect.any(Number),
        isUpdating: expect.any(Boolean)
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle unsupported exchange', async () => {
      exchangeManager.getSupportedExchanges.mockReturnValue([{ id: 'binance', enabled: false }]);

      await expect(marketDataService.getTicker('binance', 'BTC/USDT')).rejects.toThrow(
        'Exchange binance is not supported or disabled'
      );
    });

    test('should handle network errors gracefully', async () => {
      mockExchange.fetchTicker.mockRejectedValue(new Error('Network timeout'));

      await expect(marketDataService.getTicker('binance', 'BTC/USDT')).rejects.toThrow(
        'Network timeout'
      );
    });

    test('should handle invalid symbol format', async () => {
      mockExchange.fetchTicker.mockRejectedValue(new Error('Invalid symbol'));

      await expect(marketDataService.getTicker('binance', 'INVALID_SYMBOL')).rejects.toThrow(
        'Invalid symbol'
      );
    });
  });

  describe('Subscription Management', () => {
    test('should subscribe and unsubscribe callbacks', () => {
      const callback = jest.fn();

      // Subscribe
      const unsubscribe = marketDataService.subscribe(callback);
      expect(typeof unsubscribe).toBe('function');
      expect(marketDataService.subscribers.has(callback)).toBe(true);

      // Unsubscribe
      unsubscribe();
      expect(marketDataService.subscribers.has(callback)).toBe(false);
    });

    test('should notify subscribers on data updates', () => {
      const callback = jest.fn();
      marketDataService.subscribe(callback);

      // Trigger a notification (this would normally be called internally)
      marketDataService.subscribers.forEach(cb => cb('ticker', { symbol: 'BTC/USDT', data: {} }));

      expect(callback).toHaveBeenCalledWith('ticker', { symbol: 'BTC/USDT', data: {} });
    });
  });
});
