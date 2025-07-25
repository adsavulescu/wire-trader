const tradingService = require('../src/services/trading/tradingService');
const exchangeManager = require('../src/services/exchanges/exchangeManager');
const Order = require('../src/models/Order');
const User = require('../src/models/User');
const logger = require('../src/utils/logger');

// Mock exchange manager
jest.mock('../src/services/exchanges/exchangeManager');

describe('Trading Service', () => {
  let testUser;
  let mockExchange;

  beforeAll(async () => {
    testUser = new User(global.testConfig.testUser);
    await testUser.save();
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Order.deleteMany({});
  });

  beforeEach(async () => {
    await Order.deleteMany({});

    // Setup mock exchange
    mockExchange = {
      fetchBalance: jest.fn(),
      loadMarkets: jest.fn(),
      fetchTicker: jest.fn(),
      createOrder: jest.fn(),
      cancelOrder: jest.fn(),
      fetchOrder: jest.fn()
    };

    exchangeManager.getSupportedExchanges.mockReturnValue([
      { id: 'binance', enabled: true },
      { id: 'coinbase', enabled: true },
      { id: 'kraken', enabled: true }
    ]);

    exchangeManager.getExchange.mockReturnValue(mockExchange);

    // Setup default mock responses
    mockExchange.fetchBalance.mockResolvedValue({
      USDT: { free: 1000, used: 0, total: 1000 },
      BTC: { free: 0.1, used: 0, total: 0.1 }
    });

    mockExchange.loadMarkets.mockResolvedValue({
      'BTC/USDT': {
        id: 'BTCUSDT',
        symbol: 'BTC/USDT',
        limits: {
          amount: { min: 0.000001, max: 9000 },
          price: { min: 0.01, max: 1000000 }
        }
      }
    });

    mockExchange.fetchTicker.mockResolvedValue({
      last: 50000,
      bid: 49999,
      ask: 50001
    });

    mockExchange.createOrder.mockResolvedValue({
      id: 'exchange_order_123',
      status: 'open',
      filled: 0,
      remaining: 0.001,
      cost: 0
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Order Placement', () => {
    test('should place a valid limit order', async () => {
      const orderData = {
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 0.001,
        price: 50000
      };

      const order = await tradingService.placeOrder(testUser._id, orderData);

      expect(order).toBeTruthy();
      expect(order.userId.toString()).toBe(testUser._id.toString());
      expect(order.exchangeName).toBe('binance');
      expect(order.symbol).toBe('BTC/USDT');
      expect(order.type).toBe('limit');
      expect(order.side).toBe('buy');
      expect(order.amount).toBe(0.001);
      expect(order.price).toBe(50000);
      expect(order.status).toBe('open');
      expect(order.exchangeOrderId).toBe('exchange_order_123');

      expect(mockExchange.createOrder).toHaveBeenCalledWith(
        'BTC/USDT',
        'limit',
        'buy',
        0.001,
        50000,
        {}
      );
    });

    test('should place a valid market order', async () => {
      const orderData = {
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'market',
        side: 'buy',
        amount: 0.001
      };

      const order = await tradingService.placeOrder(testUser._id, orderData);

      expect(order).toBeTruthy();
      expect(order.type).toBe('market');
      expect(order.price).toBeUndefined();

      expect(mockExchange.createOrder).toHaveBeenCalledWith(
        'BTC/USDT',
        'market',
        'buy',
        0.001,
        undefined,
        {}
      );
    });

    test('should place order with extra parameters', async () => {
      const orderData = {
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 0.001,
        price: 50000,
        timeInForce: 'IOC',
        reduceOnly: true,
        postOnly: true
      };

      await tradingService.placeOrder(testUser._id, orderData);

      expect(mockExchange.createOrder).toHaveBeenCalledWith(
        'BTC/USDT',
        'limit',
        'buy',
        0.001,
        50000,
        {
          timeInForce: 'IOC',
          reduceOnly: true,
          postOnly: true
        }
      );
    });

    test('should handle exchange rejection', async () => {
      mockExchange.createOrder.mockRejectedValue(new Error('Insufficient funds'));

      const orderData = {
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 0.001,
        price: 50000
      };

      await expect(tradingService.placeOrder(testUser._id, orderData)).rejects.toThrow(
        'Insufficient funds'
      );

      // Order should be saved as rejected
      const orders = await Order.find({ userId: testUser._id });
      expect(orders).toHaveLength(1);
      expect(orders[0].status).toBe('rejected');
      expect(orders[0].errors).toHaveLength(1);
      expect(orders[0].errors[0].message).toBe('Insufficient funds');
    });
  });

  describe('Order Validation', () => {
    test('should validate required fields', async () => {
      const orderData = {
        exchangeName: 'binance'
        // Missing required fields
      };

      await expect(tradingService.placeOrder(testUser._id, orderData)).rejects.toThrow(
        'Missing required fields'
      );
    });

    test('should validate supported exchange', async () => {
      const orderData = {
        exchangeName: 'unsupported_exchange',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 0.001,
        price: 50000
      };

      await expect(tradingService.placeOrder(testUser._id, orderData)).rejects.toThrow(
        'Exchange unsupported_exchange is not supported'
      );
    });

    test('should validate order side', async () => {
      const orderData = {
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'invalid_side',
        amount: 0.001,
        price: 50000
      };

      await expect(tradingService.placeOrder(testUser._id, orderData)).rejects.toThrow(
        'Side must be either "buy" or "sell"'
      );
    });

    test('should validate order type', async () => {
      const orderData = {
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'invalid_type',
        side: 'buy',
        amount: 0.001,
        price: 50000
      };

      await expect(tradingService.placeOrder(testUser._id, orderData)).rejects.toThrow(
        'Invalid order type'
      );
    });

    test('should validate positive amount', async () => {
      const orderData = {
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: -0.001,
        price: 50000
      };

      await expect(tradingService.placeOrder(testUser._id, orderData)).rejects.toThrow(
        'Amount must be greater than 0'
      );
    });

    test('should require price for limit orders', async () => {
      const orderData = {
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 0.001
        // Missing price
      };

      await expect(tradingService.placeOrder(testUser._id, orderData)).rejects.toThrow(
        'Price is required for limit orders'
      );
    });

    test('should validate exchange connection', async () => {
      exchangeManager.getExchange.mockReturnValue(null);

      const orderData = {
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 0.001,
        price: 50000
      };

      await expect(tradingService.placeOrder(testUser._id, orderData)).rejects.toThrow(
        'Exchange binance is not connected for this user'
      );
    });

    test('should validate sufficient balance for buy order', async () => {
      mockExchange.fetchBalance.mockResolvedValue({
        USDT: { free: 10, used: 0, total: 10 }, // Insufficient balance
        BTC: { free: 0.1, used: 0, total: 0.1 }
      });

      const orderData = {
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 0.001,
        price: 50000 // Needs 50 USDT
      };

      await expect(tradingService.placeOrder(testUser._id, orderData)).rejects.toThrow(
        'Insufficient USDT balance'
      );
    });

    test('should validate sufficient balance for sell order', async () => {
      mockExchange.fetchBalance.mockResolvedValue({
        USDT: { free: 1000, used: 0, total: 1000 },
        BTC: { free: 0.0005, used: 0, total: 0.0005 } // Insufficient balance
      });

      const orderData = {
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'sell',
        amount: 0.001, // Needs 0.001 BTC
        price: 50000
      };

      await expect(tradingService.placeOrder(testUser._id, orderData)).rejects.toThrow(
        'Insufficient BTC balance'
      );
    });

    test('should validate symbol availability', async () => {
      mockExchange.loadMarkets.mockResolvedValue({
        'ETH/USDT': { symbol: 'ETH/USDT' }
        // BTC/USDT not available
      });

      const orderData = {
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 0.001,
        price: 50000
      };

      await expect(tradingService.placeOrder(testUser._id, orderData)).rejects.toThrow(
        'Symbol BTC/USDT is not available on binance'
      );
    });

    test('should validate minimum amount', async () => {
      mockExchange.loadMarkets.mockResolvedValue({
        'BTC/USDT': {
          symbol: 'BTC/USDT',
          limits: {
            amount: { min: 0.01, max: 9000 } // Minimum 0.01
          }
        }
      });

      const orderData = {
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 0.001, // Below minimum
        price: 50000
      };

      await expect(tradingService.placeOrder(testUser._id, orderData)).rejects.toThrow(
        'Amount 0.001 is below minimum 0.01'
      );
    });
  });

  describe('Order Cancellation', () => {
    let order;

    beforeEach(async () => {
      const orderData = {
        userId: testUser._id,
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 0.001,
        price: 50000,
        status: 'open',
        exchangeOrderId: 'exchange_order_123'
      };

      order = new Order(orderData);
      await order.save();
    });

    test('should cancel an active order', async () => {
      mockExchange.cancelOrder.mockResolvedValue({});

      const canceledOrder = await tradingService.cancelOrder(testUser._id, order._id);

      expect(canceledOrder.status).toBe('canceled');
      expect(canceledOrder.timestamps.canceled).toBeTruthy();
      expect(mockExchange.cancelOrder).toHaveBeenCalledWith('exchange_order_123', 'BTC/USDT');
    });

    test('should fail to cancel non-existent order', async () => {
      const fakeOrderId = '507f1f77bcf86cd799439011';

      await expect(tradingService.cancelOrder(testUser._id, fakeOrderId)).rejects.toThrow(
        'Order not found'
      );
    });

    test('should fail to cancel completed order', async () => {
      order.status = 'closed';
      await order.save();

      await expect(tradingService.cancelOrder(testUser._id, order._id)).rejects.toThrow(
        'Cannot cancel completed order'
      );
    });

    test('should handle exchange cancellation error', async () => {
      mockExchange.cancelOrder.mockRejectedValue(new Error('Order not found on exchange'));

      await expect(tradingService.cancelOrder(testUser._id, order._id)).rejects.toThrow(
        'Order not found on exchange'
      );
    });
  });

  describe('Order History', () => {
    beforeEach(async () => {
      // Create test orders
      const orders = [
        {
          userId: testUser._id,
          exchangeName: 'binance',
          symbol: 'BTC/USDT',
          type: 'limit',
          side: 'buy',
          amount: 0.001,
          price: 50000,
          status: 'closed'
        },
        {
          userId: testUser._id,
          exchangeName: 'coinbase',
          symbol: 'ETH/USDT',
          type: 'market',
          side: 'sell',
          amount: 0.1,
          status: 'open'
        }
      ];

      await Order.insertMany(orders);
    });

    test('should get order history', async () => {
      const orders = await tradingService.getOrderHistory(testUser._id);

      expect(orders).toHaveLength(2);
      expect(orders[0].symbol).toBe('ETH/USDT'); // Most recent first
      expect(orders[1].symbol).toBe('BTC/USDT');
    });

    test('should filter by exchange', async () => {
      const orders = await tradingService.getOrderHistory(testUser._id, {
        exchangeName: 'binance'
      });

      expect(orders).toHaveLength(1);
      expect(orders[0].exchangeName).toBe('binance');
    });

    test('should filter by symbol', async () => {
      const orders = await tradingService.getOrderHistory(testUser._id, {
        symbol: 'BTC/USDT'
      });

      expect(orders).toHaveLength(1);
      expect(orders[0].symbol).toBe('BTC/USDT');
    });

    test('should filter by status', async () => {
      const orders = await tradingService.getOrderHistory(testUser._id, {
        status: 'closed'
      });

      expect(orders).toHaveLength(1);
      expect(orders[0].status).toBe('closed');
    });

    test('should limit results', async () => {
      const orders = await tradingService.getOrderHistory(testUser._id, {
        limit: 1
      });

      expect(orders).toHaveLength(1);
    });
  });

  describe('Active Orders', () => {
    beforeEach(async () => {
      const orders = [
        {
          userId: testUser._id,
          exchangeName: 'binance',
          symbol: 'BTC/USDT',
          type: 'limit',
          side: 'buy',
          amount: 0.001,
          price: 50000,
          status: 'open'
        },
        {
          userId: testUser._id,
          exchangeName: 'coinbase',
          symbol: 'ETH/USDT',
          type: 'limit',
          side: 'sell',
          amount: 0.1,
          price: 3000,
          status: 'pending'
        },
        {
          userId: testUser._id,
          exchangeName: 'binance',
          symbol: 'ADA/USDT',
          type: 'limit',
          side: 'buy',
          amount: 100,
          price: 1,
          status: 'closed'
        }
      ];

      await Order.insertMany(orders);
    });

    test('should get active orders', async () => {
      const orders = await tradingService.getActiveOrders(testUser._id);

      expect(orders).toHaveLength(2);
      expect(orders.every(order => ['open', 'pending'].includes(order.status))).toBe(true);
    });

    test('should filter active orders by exchange', async () => {
      const orders = await tradingService.getActiveOrders(testUser._id, 'binance');

      expect(orders).toHaveLength(1);
      expect(orders[0].exchangeName).toBe('binance');
      expect(orders[0].status).toBe('open');
    });
  });

  describe('Order Status Updates', () => {
    let order;

    beforeEach(async () => {
      const orderData = {
        userId: testUser._id,
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 0.001,
        price: 50000,
        status: 'open',
        exchangeOrderId: 'exchange_order_123'
      };

      order = new Order(orderData);
      await order.save();
    });

    test('should update order status from exchange', async () => {
      mockExchange.fetchOrder.mockResolvedValue({
        id: 'exchange_order_123',
        status: 'closed',
        filled: 0.001,
        remaining: 0,
        cost: 50
      });

      const updatedOrder = await tradingService.updateOrderStatus(testUser._id, order._id);

      expect(updatedOrder.status).toBe('closed');
      expect(updatedOrder.filled).toBe(0.001);
      expect(updatedOrder.remaining).toBe(0);
      expect(updatedOrder.cost).toBe(50);
    });

    test('should handle exchange fetch error gracefully', async () => {
      mockExchange.fetchOrder.mockRejectedValue(new Error('Order not found'));

      const result = await tradingService.updateOrderStatus(testUser._id, order._id);

      expect(result).toBeNull();
    });

    test('should not update completed orders', async () => {
      order.status = 'closed';
      await order.save();

      const result = await tradingService.updateOrderStatus(testUser._id, order._id);

      expect(result.status).toBe('closed');
      expect(mockExchange.fetchOrder).not.toHaveBeenCalled();
    });
  });

  describe('Service Statistics', () => {
    test('should return service statistics', () => {
      const stats = tradingService.getStats();

      expect(stats).toHaveProperty('activeOrdersCount');
      expect(stats).toHaveProperty('monitoringInterval');
      expect(typeof stats.activeOrdersCount).toBe('number');
      expect(typeof stats.monitoringInterval).toBe('number');
    });
  });
});
