const { Exchange, ExchangeError, ExchangeNotAvailable, BadResponse, BadRequest, InvalidOrder, InsufficientFunds, AuthenticationError, RateLimitExceeded, InvalidAddress, DDoSProtection, BadSymbol } = require('ccxt');
const crypto = require('crypto');

/**
 * LCX Exchange Adapter
 * CommonJS wrapper for the LCX exchange implementation
 */
class LCXExchange extends Exchange {
  describe() {
    return this.deepExtend(super.describe(), {
      'id': 'lcx',
      'name': 'LCX',
      'countries': ['LI'],
      'rateLimit': 1000,
      'has': {
        'CORS': true,
        'fetchMarkets': true,
        'fetchOHLCV': true,
        'fetchTickers': true,
        'fetchTicker': true,
        'fetchOrderBook': true,
        'fetchTrades': true,
        'fetchBalance': true,
        'createOrder': true,
        'cancelOrder': true,
        'fetchOpenOrders': true,
        'fetchClosedOrders': true,
        'fetchMyTrades': true,
      },
      'timeframes': {
        '1m': '1',
        '3m': '3',
        '5m': '5',
        '15m': '15',
        '30m': '30',
        '45m': '45',
        '1h': '60',
        '2h': '120',
        '3h': '180',
        '4h': '240',
        '1d': '1D',
        '1w': '1W',
        '1M': '1M',
      },
      'version': 'v1',
      'urls': {
        'logo': 'https://terminal-files.lcx.com/static/img/ccxt/LCX.jpg',
        'api': {
          'accounts': 'https://exchange-api.lcx.com',
          'public': 'https://exchange-api.lcx.com',
          'private': 'https://exchange-api.lcx.com',
        },
        'test': {
          'accounts': 'https://exchange-api.lcx.com',
          'public': 'https://exchange-api.lcx.com',
          'private': 'https://exchange-api.lcx.com',
        },
        'www': 'https://www.lcx.com',
        'doc': [
          'https://exchange.lcx.com/v1/docs',
        ],
        'fees': 'https://www.lcx.com/fees/',
        'referral': 'https://accounts.lcx.com/register',
      },
      'api': {
        'public': {
          'get': [
            'market/pairs',
            'currency',
            'market/tickers',
          ],
          'post': [
            'order/book',
            'market/ticker',
            'market/kline',
            'trade/recent',
          ],
        },
        'private': {
          'post': [
            'orderHistory',
            'open',
            'create',
            'cancel',
          ],
          'get': [
            'balances',
          ],
        },
      },
      'fees': {
        'trading': {
          'maker': 0.003,
          'taker': 0.003,
        },
      },
      'exceptions': {
        'exact': {
          'UNAUTHORIZED': AuthenticationError,
          'INVALID_ARGUMENT': BadRequest,
          'TRADING_UNAVAILABLE': ExchangeNotAvailable,
          'Invalid amount': InvalidOrder,
          'Invalid price': InvalidOrder,
          'Not Enough Balance': InsufficientFunds,
          'NOT_ALLOWED_COMBINATION': BadRequest,
          'Invalid order': InvalidOrder,
          'RATE_LIMIT_EXCEEDED': RateLimitExceeded,
          'MARKET_UNAVAILABLE': ExchangeNotAvailable,
          'INVALID_MARKET': BadSymbol,
          'INVALID_CURRENCY': BadRequest,
          'TOO_MANY_OPEN_ORDERS': DDoSProtection,
          'DUPLICATE_ADDRESS': InvalidAddress,
          'Bad Request': BadRequest,
        },
      },
      'requiredCredentials': {
        'apiKey': true,
        'secret': true,
      },
      'options': {},
      'commonCurrencies': {
        'LCX': 'LCX',
        'BTC': 'Bitcoin',
      },
    });
  }

  async fetchMarkets(params = {}) {
    const response = await this.publicGetMarketPairs(params);
    const markets = this.safeValue(response, 'data', []);
    const result = [];
    
    for (let i = 0; i < markets.length; i++) {
      const market = markets[i];
      const id = this.safeString(market, 'symbol');
      const baseId = this.safeString(market, 'base');
      const quoteId = this.safeString(market, 'quote');
      const base = this.safeString(market, 'base');
      const quote = this.safeString(market, 'quote');
      const symbol = base + '/' + quote;
      const active = this.safeValue(market, 'status', false);
      const amountPrecision = this.safeInteger(market, 'amountPrecision');
      const costPrecision = this.safeInteger(market, 'amountPrecision');
      const precision = {
        'amount': amountPrecision,
        'price': this.safeFloat(market, 'pricePrecision'),
        'cost': costPrecision,
      };
      const takerFeeRate = 0.003;
      const makerFeeRate = 0.003;
      
      result.push({
        'id': id,
        'info': market,
        'symbol': symbol,
        'base': base,
        'quote': quote,
        'baseId': baseId,
        'quoteId': quoteId,
        'active': active,
        'precision': precision,
        'taker': takerFeeRate,
        'maker': makerFeeRate,
        'limits': {
          'amount': {
            'min': this.safeFloat(market, 'minBaseOrder'),
            'max': this.safeFloat(market, 'maxBaseOrder'),
          },
          'price': {
            'min': this.safeFloat(market, 'min_price'),
            'max': this.safeFloat(market, 'max_price'),
          },
          'cost': {
            'min': this.safeFloat(market, 'minQuoteOrder'),
            'max': this.safeFloat(market, 'maxQuoteOrder'),
          },
        },
      });
    }
    return result;
  }

  async fetchBalance(params = {}) {
    await this.loadMarkets();
    const response = await this.privateGetBalances({});
    const data = this.safeValue(response, 'data');
    const result = { 'info': data };
    
    for (let i = 0; i < data.length; i++) {
      const balance = data[i];
      const code = this.safeString(balance, 'coin');
      const account = this.account();
      account['total'] = this.safeFloat(balance.balance, 'totalBalance');
      account['free'] = this.safeFloat(balance.balance, 'freeBalance');
      account['used'] = this.safeFloat(balance.balance, 'occupiedBalance');
      result[code] = account;
    }
    return this.parseBalance(result);
  }

  async fetchTicker(symbol, params = {}) {
    await this.loadMarkets();
    const market = this.market(symbol);
    const request = {
      'pair': market['symbol'],
    };
    params['pair'] = market['symbol'];
    const response = await this.publicPostMarketTicker(this.extend(request, params));
    const ticker = this.safeValue(response, 'data', []);
    
    if (ticker === undefined) {
      throw new BadResponse(this.id + ' fetchTicker () returned an empty response');
    }
    return this.parseTicker(ticker, market);
  }

  parseTicker(ticker, market = undefined) {
    const timestamp = this.safeInteger(ticker, 'lastUpdated') * 1000;
    const symbol = this.safeString(ticker, 'symbol');
    const close = this.safeFloat(ticker, 'lastPrice');
    const change = this.safeFloat(ticker, 'change');
    let percentage = undefined;
    let open = undefined;
    
    if (change !== undefined) {
      if (close !== undefined) {
        open = close - change;
        percentage = open ? (change / open) * 100 : 0;
      }
    }
    
    const baseVolume = this.safeFloat(ticker, 'volume');
    
    return {
      'symbol': symbol,
      'timestamp': timestamp,
      'datetime': this.iso8601(timestamp),
      'high': this.safeFloat(ticker, 'high'),
      'low': this.safeFloat(ticker, 'low'),
      'bid': this.safeFloat(ticker, 'bestBid'),
      'bidVolume': undefined,
      'ask': this.safeFloat(ticker, 'bestAsk'),
      'askVolume': undefined,
      'vwap': undefined,
      'open': open,
      'close': close,
      'last': close,
      'previousClose': undefined,
      'change': change,
      'percentage': percentage,
      'average': undefined,
      'baseVolume': baseVolume,
      'quoteVolume': undefined,
      'info': ticker,
    };
  }

  sign(path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
    let url = this.urls['api'][api] + '/';
    const query = this.omit(params, this.extractParams(path));
    
    if (api === 'private') {
      path = 'api' + '/' + path;
      const now = this.nonce();
      this.checkRequiredCredentials();
      let payload = method + '/' + path + this.json(query);
      
      if (method === 'GET') {
        payload = method + '/' + path;
      }

      const signature = crypto.createHmac('sha256', this.secret).update(payload).digest('hex');
      const signatureBuffer = Buffer.from(signature, 'hex');
      const signatureBase64 = signatureBuffer.toString('base64');

      headers = {
        'x-access-key': this.apiKey,
        'x-access-sign': signatureBase64,
        'x-access-timestamp': now,
      };
    }

    url += this.implodeParams(path, params);
    if (Object.keys(query).length) {
      url += '?' + this.urlencode(query);
    }

    if (method === 'POST') {
      if (Object.keys(query).length) {
        body = this.json(query);
      }
    }

    return { 'url': url, 'method': method, 'body': body, 'headers': headers };
  }

  handleErrors(code, reason, url, method, headers, body, response, requestHeaders, requestBody) {
    if ((code === 418) || (code === 429)) {
      throw new DDoSProtection(this.id + ' ' + code.toString() + ' ' + reason + ' ' + body);
    }
    
    if (code === 401) {
      this.throwExactlyMatchedException(this.exceptions, body, body);
      return;
    }
    
    if (response === undefined) {
      return;
    }
    
    const feedback = this.id + ' ' + body;
    const message = this.safeString(response, 'message');
    
    if (message !== undefined) {
      this.throwExactlyMatchedException(this.exceptions['exact'], message, feedback);
    }
    
    if ('errorCode' in response) {
      const errorCode = this.safeString(response, 'errorCode');
      if (errorCode !== undefined) {
        this.throwBroadlyMatchedException(this.exceptions['exact'], errorCode, feedback);
        throw new ExchangeError(feedback);
      }
    }
  }
}

module.exports = LCXExchange;