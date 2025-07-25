const exchangeManager = require('../exchanges/exchangeManager');
const logger = require('../../utils/logger');

class MarketDataService {
  constructor() {
    this.tickers = new Map();
    this.orderbooks = new Map();
    this.trades = new Map();
    this.candles = new Map();
    this.updateInterval = 5000; // 5 seconds
    this.subscribers = new Set();
    this.isUpdating = false;

    this.startMarketDataUpdates();
  }

  async getTicker(exchangeName, symbol) {
    try {
      const cacheKey = `${exchangeName}_${symbol}`;
      const cachedTicker = this.tickers.get(cacheKey);

      if (cachedTicker && Date.now() - cachedTicker.timestamp < 10000) {
        return cachedTicker.data;
      }

      const exchange = this.getExchangeInstance(exchangeName);
      const ticker = await exchange.fetchTicker(symbol);

      const tickerData = {
        symbol,
        exchange: exchangeName,
        last: ticker.last,
        bid: ticker.bid,
        ask: ticker.ask,
        high: ticker.high,
        low: ticker.low,
        volume: ticker.quoteVolume || ticker.baseVolume,
        change: ticker.change,
        percentage: ticker.percentage,
        timestamp: ticker.timestamp || Date.now(),
        datetime: ticker.datetime || new Date().toISOString()
      };

      this.tickers.set(cacheKey, {
        data: tickerData,
        timestamp: Date.now()
      });

      return tickerData;
    } catch (error) {
      logger.error('Failed to get ticker', {
        exchangeName,
        symbol,
        error: error.message
      });
      throw error;
    }
  }

  async getUnifiedTicker(symbol) {
    try {
      const supportedExchanges = exchangeManager
        .getSupportedExchanges()
        .filter(exchange => exchange.enabled);

      const tickers = [];
      const errors = [];

      await Promise.allSettled(
        supportedExchanges.map(async exchange => {
          try {
            const ticker = await this.getTicker(exchange.id, symbol);
            tickers.push(ticker);
          } catch (error) {
            errors.push({
              exchange: exchange.id,
              error: error.message
            });
          }
        })
      );

      if (tickers.length === 0) {
        throw new Error(`No price data available for ${symbol}`);
      }

      const avgPrice = tickers.reduce((sum, ticker) => sum + ticker.last, 0) / tickers.length;
      const bestBid = Math.max(...tickers.map(t => t.bid).filter(Boolean));
      const bestAsk = Math.min(...tickers.map(t => t.ask).filter(Boolean));
      const totalVolume = tickers.reduce((sum, ticker) => sum + (ticker.volume || 0), 0);
      const spread = bestAsk - bestBid;
      const spreadPercentage = (spread / avgPrice) * 100;

      return {
        symbol,
        unified: {
          averagePrice: avgPrice,
          bestBid,
          bestAsk,
          spread,
          spreadPercentage,
          totalVolume,
          exchangeCount: tickers.length
        },
        byExchange: tickers,
        errors,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get unified ticker', {
        symbol,
        error: error.message
      });
      throw error;
    }
  }

  async getOrderbook(exchangeName, symbol, limit = 20) {
    try {
      const cacheKey = `${exchangeName}_${symbol}_${limit}`;
      const cachedOrderbook = this.orderbooks.get(cacheKey);

      if (cachedOrderbook && Date.now() - cachedOrderbook.timestamp < 5000) {
        return cachedOrderbook.data;
      }

      const exchange = this.getExchangeInstance(exchangeName);
      const orderbook = await exchange.fetchOrderBook(symbol, limit);

      const orderbookData = {
        symbol,
        exchange: exchangeName,
        bids: orderbook.bids.slice(0, limit),
        asks: orderbook.asks.slice(0, limit),
        timestamp: orderbook.timestamp || Date.now(),
        datetime: orderbook.datetime || new Date().toISOString(),
        nonce: orderbook.nonce
      };

      // Calculate orderbook metrics
      orderbookData.spread = orderbookData.asks[0]
        ? orderbookData.asks[0][0] - orderbookData.bids[0][0]
        : 0;

      orderbookData.midPrice =
        orderbookData.asks[0] && orderbookData.bids[0]
          ? (orderbookData.asks[0][0] + orderbookData.bids[0][0]) / 2
          : 0;

      orderbookData.bidDepth = orderbookData.bids.reduce((sum, bid) => sum + bid[1], 0);
      orderbookData.askDepth = orderbookData.asks.reduce((sum, ask) => sum + ask[1], 0);

      this.orderbooks.set(cacheKey, {
        data: orderbookData,
        timestamp: Date.now()
      });

      return orderbookData;
    } catch (error) {
      logger.error('Failed to get orderbook', {
        exchangeName,
        symbol,
        error: error.message
      });
      throw error;
    }
  }

  async getUnifiedOrderbook(symbol, limit = 20) {
    try {
      const supportedExchanges = exchangeManager
        .getSupportedExchanges()
        .filter(exchange => exchange.enabled);

      const orderbooks = [];
      const errors = [];

      await Promise.allSettled(
        supportedExchanges.map(async exchange => {
          try {
            const orderbook = await this.getOrderbook(exchange.id, symbol, limit);
            orderbooks.push(orderbook);
          } catch (error) {
            errors.push({
              exchange: exchange.id,
              error: error.message
            });
          }
        })
      );

      if (orderbooks.length === 0) {
        throw new Error(`No orderbook data available for ${symbol}`);
      }

      // Merge and sort all bids and asks
      const allBids = [];
      const allAsks = [];

      orderbooks.forEach(orderbook => {
        orderbook.bids.forEach(bid => {
          allBids.push([bid[0], bid[1], orderbook.exchange]);
        });
        orderbook.asks.forEach(ask => {
          allAsks.push([ask[0], ask[1], orderbook.exchange]);
        });
      });

      // Sort bids (highest price first) and asks (lowest price first)
      allBids.sort((a, b) => b[0] - a[0]);
      allAsks.sort((a, b) => a[0] - b[0]);

      const unifiedOrderbook = {
        symbol,
        unified: {
          bids: allBids.slice(0, limit),
          asks: allAsks.slice(0, limit),
          bestBid: allBids[0] ? allBids[0][0] : 0,
          bestAsk: allAsks[0] ? allAsks[0][0] : 0,
          spread: allAsks[0] && allBids[0] ? allAsks[0][0] - allBids[0][0] : 0,
          midPrice: allAsks[0] && allBids[0] ? (allAsks[0][0] + allBids[0][0]) / 2 : 0,
          totalBidDepth: allBids.reduce((sum, bid) => sum + bid[1], 0),
          totalAskDepth: allAsks.reduce((sum, ask) => sum + ask[1], 0),
          exchangeCount: orderbooks.length
        },
        byExchange: orderbooks,
        errors,
        timestamp: new Date().toISOString()
      };

      return unifiedOrderbook;
    } catch (error) {
      logger.error('Failed to get unified orderbook', {
        symbol,
        error: error.message
      });
      throw error;
    }
  }

  async getRecentTrades(exchangeName, symbol, limit = 50) {
    try {
      const cacheKey = `${exchangeName}_${symbol}_trades_${limit}`;
      const cachedTrades = this.trades.get(cacheKey);

      if (cachedTrades && Date.now() - cachedTrades.timestamp < 10000) {
        return cachedTrades.data;
      }

      const exchange = this.getExchangeInstance(exchangeName);
      const trades = await exchange.fetchTrades(symbol, undefined, limit);

      const tradesData = {
        symbol,
        exchange: exchangeName,
        trades: trades.map(trade => ({
          id: trade.id,
          timestamp: trade.timestamp,
          datetime: trade.datetime,
          price: trade.price,
          amount: trade.amount,
          cost: trade.cost,
          side: trade.side,
          takerOrMaker: trade.takerOrMaker,
          fee: trade.fee
        })),
        count: trades.length,
        timestamp: Date.now()
      };

      this.trades.set(cacheKey, {
        data: tradesData,
        timestamp: Date.now()
      });

      return tradesData;
    } catch (error) {
      logger.error('Failed to get recent trades', {
        exchangeName,
        symbol,
        error: error.message
      });
      throw error;
    }
  }

  async getCandles(exchangeName, symbol, timeframe = '1h', limit = 100) {
    try {
      const cacheKey = `${exchangeName}_${symbol}_${timeframe}_${limit}`;
      const cachedCandles = this.candles.get(cacheKey);

      if (cachedCandles && Date.now() - cachedCandles.timestamp < 60000) {
        return cachedCandles.data;
      }

      const exchange = this.getExchangeInstance(exchangeName);

      if (!exchange.has.fetchOHLCV) {
        throw new Error(`${exchangeName} does not support OHLCV data`);
      }

      const candles = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);

      const candlesData = {
        symbol,
        exchange: exchangeName,
        timeframe,
        candles: candles.map(candle => ({
          timestamp: candle[0],
          datetime: new Date(candle[0]).toISOString(),
          open: candle[1],
          high: candle[2],
          low: candle[3],
          close: candle[4],
          volume: candle[5]
        })),
        count: candles.length,
        timestamp: Date.now()
      };

      this.candles.set(cacheKey, {
        data: candlesData,
        timestamp: Date.now()
      });

      return candlesData;
    } catch (error) {
      logger.error('Failed to get candles', {
        exchangeName,
        symbol,
        timeframe,
        error: error.message
      });
      throw error;
    }
  }

  async getMarkets(exchangeName) {
    try {
      const exchange = this.getExchangeInstance(exchangeName);
      const markets = await exchange.loadMarkets();

      return Object.values(markets).map(market => ({
        id: market.id,
        symbol: market.symbol,
        base: market.base,
        quote: market.quote,
        active: market.active,
        type: market.type,
        spot: market.spot,
        margin: market.margin,
        future: market.future,
        option: market.option,
        contract: market.contract,
        limits: market.limits,
        precision: market.precision,
        fees: market.fees
      }));
    } catch (error) {
      logger.error('Failed to get markets', {
        exchangeName,
        error: error.message
      });
      throw error;
    }
  }

  async getArbitrageOpportunities(symbol, minProfitPercentage = 0.5) {
    try {
      const unifiedTicker = await this.getUnifiedTicker(symbol);
      const opportunities = [];

      const tickers = unifiedTicker.byExchange;

      for (let i = 0; i < tickers.length; i++) {
        for (let j = i + 1; j < tickers.length; j++) {
          const ticker1 = tickers[i];
          const ticker2 = tickers[j];

          // Check buy low on exchange 1, sell high on exchange 2
          if (ticker1.ask && ticker2.bid && ticker2.bid > ticker1.ask) {
            const profit = ticker2.bid - ticker1.ask;
            const profitPercentage = (profit / ticker1.ask) * 100;

            if (profitPercentage >= minProfitPercentage) {
              opportunities.push({
                symbol,
                buyExchange: ticker1.exchange,
                sellExchange: ticker2.exchange,
                buyPrice: ticker1.ask,
                sellPrice: ticker2.bid,
                profit,
                profitPercentage,
                direction: `${ticker1.exchange} -> ${ticker2.exchange}`
              });
            }
          }

          // Check buy low on exchange 2, sell high on exchange 1
          if (ticker2.ask && ticker1.bid && ticker1.bid > ticker2.ask) {
            const profit = ticker1.bid - ticker2.ask;
            const profitPercentage = (profit / ticker2.ask) * 100;

            if (profitPercentage >= minProfitPercentage) {
              opportunities.push({
                symbol,
                buyExchange: ticker2.exchange,
                sellExchange: ticker1.exchange,
                buyPrice: ticker2.ask,
                sellPrice: ticker1.bid,
                profit,
                profitPercentage,
                direction: `${ticker2.exchange} -> ${ticker1.exchange}`
              });
            }
          }
        }
      }

      return {
        symbol,
        opportunities: opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage),
        count: opportunities.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get arbitrage opportunities', {
        symbol,
        error: error.message
      });
      throw error;
    }
  }

  getExchangeInstance(exchangeName) {
    const supportedExchanges = exchangeManager.getSupportedExchanges();
    const exchange = supportedExchanges.find(e => e.id === exchangeName);

    if (!exchange || !exchange.enabled) {
      throw new Error(`Exchange ${exchangeName} is not supported or disabled`);
    }

    let ExchangeClass;
    if (exchangeName === 'lcx') {
      const LCXExchange = require('../exchanges/adapters/lcxAdapter');
      ExchangeClass = LCXExchange;
    } else {
      const ccxt = require('ccxt');
      ExchangeClass = ccxt[exchangeName];
    }

    if (!ExchangeClass) {
      throw new Error(`Exchange class ${exchangeName} not found`);
    }

    return new ExchangeClass({
      enableRateLimit: true,
      sandbox: false
    });
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  async startMarketDataUpdates() {
    if (this.isUpdating) {
      return;
    }

    this.isUpdating = true;

    setInterval(async () => {
      try {
        await this.updateMarketData();
      } catch (error) {
        logger.error('Market data update error', error);
      }
    }, this.updateInterval);
  }

  async updateMarketData() {
    const popularSymbols = ['BTC/USDC'];

    for (const symbol of popularSymbols) {
      try {
        const unifiedTicker = await this.getUnifiedTicker(symbol);

        // Notify subscribers
        this.subscribers.forEach(callback => {
          try {
            callback('ticker', { symbol, data: unifiedTicker });
          } catch (error) {
            logger.error('Subscriber callback error', error);
          }
        });
      } catch (error) {
        // Continue with other symbols if one fails
        logger.error(`Failed to update ${symbol}`, error);
      }
    }
  }

  clearCache() {
    this.tickers.clear();
    this.orderbooks.clear();
    this.trades.clear();
    this.candles.clear();
    logger.info('Market data cache cleared');
  }

  getStats() {
    return {
      tickersCount: this.tickers.size,
      orderbooksCount: this.orderbooks.size,
      tradesCount: this.trades.size,
      candlesCount: this.candles.size,
      subscribersCount: this.subscribers.size,
      updateInterval: this.updateInterval,
      isUpdating: this.isUpdating
    };
  }
}

const marketDataService = new MarketDataService();

module.exports = marketDataService;
