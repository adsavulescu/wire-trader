const mongoose = require('mongoose');
const Order = require('../src/models/Order');
const User = require('../src/models/User');

describe('Order Model', () => {
  let testUser;

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
  });

  describe('Order Creation', () => {
    test('should create a valid order', async () => {
      const orderData = {
        userId: testUser._id,
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 0.001,
        price: 50000
      };

      const order = new Order(orderData);
      await order.save();

      expect(order.userId).toEqual(testUser._id);
      expect(order.exchangeName).toBe('binance');
      expect(order.symbol).toBe('BTC/USDT');
      expect(order.type).toBe('limit');
      expect(order.side).toBe('buy');
      expect(order.amount).toBe(0.001);
      expect(order.price).toBe(50000);
      expect(order.status).toBe('pending');
      expect(order.filled).toBe(0);
      expect(order.clientOrderId).toBeTruthy();
      expect(order.timestamps.created).toBeTruthy();
    });

    test('should auto-generate client order ID', async () => {
      const order = new Order({
        userId: testUser._id,
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'market',
        side: 'buy',
        amount: 0.001
      });

      await order.save();

      expect(order.clientOrderId).toBeTruthy();
      expect(order.clientOrderId).toMatch(/^WRT_/);
    });

    test('should validate required fields', async () => {
      const order = new Order({});

      let error;
      try {
        await order.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeTruthy();
      expect(error.errors.userId).toBeTruthy();
      expect(error.errors.exchangeName).toBeTruthy();
      expect(error.errors.symbol).toBeTruthy();
      expect(error.errors.side).toBeTruthy();
      expect(error.errors.amount).toBeTruthy();
    });

    test('should validate exchange name enum', async () => {
      const order = new Order({
        userId: testUser._id,
        exchangeName: 'invalid_exchange',
        symbol: 'BTC/USDT',
        type: 'market',
        side: 'buy',
        amount: 0.001
      });

      let error;
      try {
        await order.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeTruthy();
      expect(error.errors.exchangeName).toBeTruthy();
    });

    test('should validate order type enum', async () => {
      const order = new Order({
        userId: testUser._id,
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'invalid_type',
        side: 'buy',
        amount: 0.001
      });

      let error;
      try {
        await order.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeTruthy();
      expect(error.errors.type).toBeTruthy();
    });

    test('should validate side enum', async () => {
      const order = new Order({
        userId: testUser._id,
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'market',
        side: 'invalid_side',
        amount: 0.001
      });

      let error;
      try {
        await order.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeTruthy();
      expect(error.errors.side).toBeTruthy();
    });

    test('should validate positive amount', async () => {
      const order = new Order({
        userId: testUser._id,
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'market',
        side: 'buy',
        amount: -0.001
      });

      let error;
      try {
        await order.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeTruthy();
      expect(error.errors.amount).toBeTruthy();
    });
  });

  describe('Order Methods', () => {
    let order;

    beforeEach(async () => {
      order = new Order({
        userId: testUser._id,
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 0.001,
        price: 50000
      });
      await order.save();
    });

    test('should update from exchange order data', async () => {
      const exchangeOrder = {
        id: 'exchange_order_123',
        status: 'closed',
        filled: 0.0008,
        remaining: 0.0002,
        cost: 40,
        fee: {
          currency: 'USDT',
          cost: 0.1,
          rate: 0.001
        },
        trades: [
          {
            id: 'trade_1',
            timestamp: Date.now(),
            amount: 0.0008,
            price: 50000,
            cost: 40,
            fee: { currency: 'USDT', cost: 0.1 }
          }
        ]
      };

      order.updateFromExchange(exchangeOrder);
      await order.save();

      expect(order.status).toBe('closed');
      expect(order.filled).toBe(0.0008);
      expect(order.remaining).toBe(0.0002);
      expect(order.cost).toBe(40);
      expect(order.exchangeOrderId).toBe('exchange_order_123');
      expect(order.fee.currency).toBe('USDT');
      expect(order.fee.cost).toBe(0.1);
      expect(order.trades).toHaveLength(1);
      expect(order.timestamps.filled).toBeTruthy();
      expect(order.timestamps.closed).toBeTruthy();
    });

    test('should map exchange status correctly', () => {
      expect(order.mapExchangeStatus('open')).toBe('open');
      expect(order.mapExchangeStatus('closed')).toBe('closed');
      expect(order.mapExchangeStatus('canceled')).toBe('canceled');
      expect(order.mapExchangeStatus('cancelled')).toBe('canceled');
      expect(order.mapExchangeStatus('expired')).toBe('expired');
      expect(order.mapExchangeStatus('rejected')).toBe('rejected');
      expect(order.mapExchangeStatus('unknown')).toBe('pending');
    });

    test('should add error correctly', async () => {
      order.addError('Test error message', 'TEST_ERROR', 'exchange');
      await order.save();

      expect(order.errors).toHaveLength(1);
      expect(order.errors[0].message).toBe('Test error message');
      expect(order.errors[0].code).toBe('TEST_ERROR');
      expect(order.errors[0].source).toBe('exchange');
      expect(order.errors[0].timestamp).toBeTruthy();
    });

    test('should generate unique client order ID', () => {
      const clientOrderId1 = order.generateClientOrderId();

      // Create another order
      const order2 = new Order({
        userId: testUser._id,
        exchangeName: 'binance',
        symbol: 'ETH/USDT',
        type: 'market',
        side: 'sell',
        amount: 0.1
      });

      const clientOrderId2 = order2.generateClientOrderId();

      expect(clientOrderId1).toBeTruthy();
      expect(clientOrderId2).toBeTruthy();
      expect(clientOrderId1).not.toBe(clientOrderId2);
      expect(clientOrderId1).toMatch(/^WRT_/);
      expect(clientOrderId2).toMatch(/^WRT_/);
    });
  });

  describe('Order Virtual Properties', () => {
    test('should calculate average price correctly', async () => {
      const order = new Order({
        userId: testUser._id,
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 0.001,
        price: 50000,
        filled: 0.0008,
        cost: 40
      });

      expect(order.averagePrice).toBe(50000); // 40 / 0.0008
    });

    test('should calculate fill percentage correctly', async () => {
      const order = new Order({
        userId: testUser._id,
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 0.001,
        filled: 0.0008
      });

      expect(order.fillPercentage).toBe(80); // (0.0008 / 0.001) * 100
    });

    test('should determine if order is complete', async () => {
      const order = new Order({
        userId: testUser._id,
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 0.001,
        status: 'closed'
      });

      expect(order.isComplete).toBe(true);

      order.status = 'open';
      expect(order.isComplete).toBe(false);
    });

    test('should determine if order is active', async () => {
      const order = new Order({
        userId: testUser._id,
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 0.001,
        status: 'open'
      });

      expect(order.isActive).toBe(true);

      order.status = 'closed';
      expect(order.isActive).toBe(false);
    });
  });

  describe('Order Pre-save Middleware', () => {
    test('should set remaining amount on new order', async () => {
      const order = new Order({
        userId: testUser._id,
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 0.001,
        filled: 0.0003
      });

      await order.save();

      expect(order.remaining).toBeCloseTo(0.0007, 6); // 0.001 - 0.0003
    });

    test('should update lastUpdate timestamp on save', async () => {
      const order = new Order({
        userId: testUser._id,
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 0.001
      });

      await order.save();
      const firstTimestamp = order.timestamps.lastUpdate;

      // Wait a bit and update
      await new Promise(resolve => setTimeout(resolve, 10));
      order.filled = 0.0005;
      await order.save();

      expect(order.timestamps.lastUpdate.getTime()).toBeGreaterThan(firstTimestamp.getTime());
    });
  });

  describe('Order Indexes', () => {
    test('should create unique client order ID', async () => {
      const order1 = new Order({
        userId: testUser._id,
        exchangeName: 'binance',
        symbol: 'BTC/USDT',
        type: 'limit',
        side: 'buy',
        amount: 0.001,
        clientOrderId: 'unique_client_id_1'
      });

      const order2 = new Order({
        userId: testUser._id,
        exchangeName: 'binance',
        symbol: 'ETH/USDT',
        type: 'limit',
        side: 'buy',
        amount: 0.1,
        clientOrderId: 'unique_client_id_1' // Same client order ID
      });

      await order1.save();

      let error;
      try {
        await order2.save();
      } catch (e) {
        error = e;
      }

      expect(error).toBeTruthy();
      expect(error.code).toBe(11000); // MongoDB duplicate key error
    });
  });
});
