const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const logger = require('../../utils/logger');
const marketDataService = require('../market/marketDataService');
const tradingService = require('../trading/tradingService');
const exchangeManager = require('../exchanges/exchangeManager');

class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map();
    this.subscriptions = new Map();
    this.marketDataUnsubscribe = null;
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: config.server.corsOrigin,
        credentials: true,
        methods: ['GET', 'POST']
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupAuthentication();
    this.setupEventHandlers();
    this.subscribeToMarketData();

    logger.info('WebSocket service initialized');
  }

  setupAuthentication() {
    this.io.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          throw new Error('Authentication required');
        }

        const decoded = jwt.verify(token, config.jwt.secret);
        socket.userId = decoded.userId;
        socket.user = decoded;

        logger.info('WebSocket client authenticated', {
          userId: socket.userId,
          socketId: socket.id
        });

        next();
      } catch (error) {
        logger.error('WebSocket authentication failed', {
          error: error.message,
          socketId: socket.id
        });
        next(new Error('Authentication failed'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', socket => {
      this.handleConnection(socket);
    });
  }

  handleConnection(socket) {
    const userId = socket.userId;

    // Store user connection
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId).add(socket.id);

    logger.info('WebSocket client connected', {
      userId,
      socketId: socket.id,
      totalConnections: this.io.engine.clientsCount
    });

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to Wire-Trader WebSocket',
      userId,
      timestamp: new Date().toISOString()
    });

    // Handle market data subscriptions
    socket.on('subscribe:ticker', data => {
      this.handleTickerSubscription(socket, data);
    });

    socket.on('unsubscribe:ticker', data => {
      this.handleTickerUnsubscription(socket, data);
    });

    socket.on('subscribe:orderbook', data => {
      this.handleOrderbookSubscription(socket, data);
    });

    socket.on('unsubscribe:orderbook', data => {
      this.handleOrderbookUnsubscription(socket, data);
    });

    socket.on('subscribe:trades', data => {
      this.handleTradesSubscription(socket, data);
    });

    socket.on('unsubscribe:trades', data => {
      this.handleTradesUnsubscription(socket, data);
    });

    // Handle trading subscriptions
    socket.on('subscribe:orders', () => {
      this.handleOrdersSubscription(socket);
    });

    socket.on('unsubscribe:orders', () => {
      this.handleOrdersUnsubscription(socket);
    });

    socket.on('subscribe:balances', () => {
      this.handleBalancesSubscription(socket);
    });

    socket.on('unsubscribe:balances', () => {
      this.handleBalancesUnsubscription(socket);
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle disconnection
    socket.on('disconnect', reason => {
      this.handleDisconnection(socket, reason);
    });

    // Handle errors
    socket.on('error', error => {
      logger.error('WebSocket error', {
        userId,
        socketId: socket.id,
        error: error.message
      });
    });
  }

  handleTickerSubscription(socket, data) {
    try {
      const { symbols } = data;
      if (!Array.isArray(symbols) || symbols.length === 0) {
        socket.emit('error', { message: 'Invalid symbols array' });
        return;
      }

      symbols.forEach(symbol => {
        const room = `ticker:${symbol}`;
        socket.join(room);

        if (!this.subscriptions.has(room)) {
          this.subscriptions.set(room, new Set());
        }
        this.subscriptions.get(room).add(socket.id);
      });

      socket.emit('subscribed:ticker', { symbols });

      logger.info('Client subscribed to ticker updates', {
        userId: socket.userId,
        symbols
      });
    } catch (error) {
      socket.emit('error', { message: 'Failed to subscribe to ticker updates' });
      logger.error('Ticker subscription error', error);
    }
  }

  handleTickerUnsubscription(socket, data) {
    try {
      const { symbols } = data;
      if (!Array.isArray(symbols)) {
        socket.emit('error', { message: 'Invalid symbols array' });
        return;
      }

      symbols.forEach(symbol => {
        const room = `ticker:${symbol}`;
        socket.leave(room);

        if (this.subscriptions.has(room)) {
          this.subscriptions.get(room).delete(socket.id);
          if (this.subscriptions.get(room).size === 0) {
            this.subscriptions.delete(room);
          }
        }
      });

      socket.emit('unsubscribed:ticker', { symbols });
    } catch (error) {
      socket.emit('error', { message: 'Failed to unsubscribe from ticker updates' });
      logger.error('Ticker unsubscription error', error);
    }
  }

  handleOrderbookSubscription(socket, data) {
    try {
      const { symbols } = data;
      if (!Array.isArray(symbols) || symbols.length === 0) {
        socket.emit('error', { message: 'Invalid symbols array' });
        return;
      }

      symbols.forEach(symbol => {
        const room = `orderbook:${symbol}`;
        socket.join(room);

        if (!this.subscriptions.has(room)) {
          this.subscriptions.set(room, new Set());
        }
        this.subscriptions.get(room).add(socket.id);
      });

      socket.emit('subscribed:orderbook', { symbols });
    } catch (error) {
      socket.emit('error', { message: 'Failed to subscribe to orderbook updates' });
      logger.error('Orderbook subscription error', error);
    }
  }

  handleOrderbookUnsubscription(socket, data) {
    try {
      const { symbols } = data;
      if (!Array.isArray(symbols)) {
        socket.emit('error', { message: 'Invalid symbols array' });
        return;
      }

      symbols.forEach(symbol => {
        const room = `orderbook:${symbol}`;
        socket.leave(room);

        if (this.subscriptions.has(room)) {
          this.subscriptions.get(room).delete(socket.id);
          if (this.subscriptions.get(room).size === 0) {
            this.subscriptions.delete(room);
          }
        }
      });

      socket.emit('unsubscribed:orderbook', { symbols });
    } catch (error) {
      socket.emit('error', { message: 'Failed to unsubscribe from orderbook updates' });
      logger.error('Orderbook unsubscription error', error);
    }
  }

  handleTradesSubscription(socket, data) {
    try {
      const { symbols } = data;
      if (!Array.isArray(symbols) || symbols.length === 0) {
        socket.emit('error', { message: 'Invalid symbols array' });
        return;
      }

      symbols.forEach(symbol => {
        const room = `trades:${symbol}`;
        socket.join(room);

        if (!this.subscriptions.has(room)) {
          this.subscriptions.set(room, new Set());
        }
        this.subscriptions.get(room).add(socket.id);
      });

      socket.emit('subscribed:trades', { symbols });
    } catch (error) {
      socket.emit('error', { message: 'Failed to subscribe to trades updates' });
      logger.error('Trades subscription error', error);
    }
  }

  handleTradesUnsubscription(socket, data) {
    try {
      const { symbols } = data;
      if (!Array.isArray(symbols)) {
        socket.emit('error', { message: 'Invalid symbols array' });
        return;
      }

      symbols.forEach(symbol => {
        const room = `trades:${symbol}`;
        socket.leave(room);

        if (this.subscriptions.has(room)) {
          this.subscriptions.get(room).delete(socket.id);
          if (this.subscriptions.get(room).size === 0) {
            this.subscriptions.delete(room);
          }
        }
      });

      socket.emit('unsubscribed:trades', { symbols });
    } catch (error) {
      socket.emit('error', { message: 'Failed to unsubscribe from trades updates' });
      logger.error('Trades unsubscription error', error);
    }
  }

  handleOrdersSubscription(socket) {
    try {
      const room = `orders:${socket.userId}`;
      socket.join(room);
      socket.emit('subscribed:orders', { userId: socket.userId });

      logger.info('Client subscribed to order updates', {
        userId: socket.userId
      });
    } catch (error) {
      socket.emit('error', { message: 'Failed to subscribe to order updates' });
      logger.error('Orders subscription error', error);
    }
  }

  handleOrdersUnsubscription(socket) {
    try {
      const room = `orders:${socket.userId}`;
      socket.leave(room);
      socket.emit('unsubscribed:orders', { userId: socket.userId });
    } catch (error) {
      socket.emit('error', { message: 'Failed to unsubscribe from order updates' });
      logger.error('Orders unsubscription error', error);
    }
  }

  handleBalancesSubscription(socket) {
    try {
      const room = `balances:${socket.userId}`;
      socket.join(room);
      socket.emit('subscribed:balances', { userId: socket.userId });

      logger.info('Client subscribed to balance updates', {
        userId: socket.userId
      });
    } catch (error) {
      socket.emit('error', { message: 'Failed to subscribe to balance updates' });
      logger.error('Balances subscription error', error);
    }
  }

  handleBalancesUnsubscription(socket) {
    try {
      const room = `balances:${socket.userId}`;
      socket.leave(room);
      socket.emit('unsubscribed:balances', { userId: socket.userId });
    } catch (error) {
      socket.emit('error', { message: 'Failed to unsubscribe from balance updates' });
      logger.error('Balances unsubscription error', error);
    }
  }

  handleDisconnection(socket, reason) {
    const userId = socket.userId;

    // Remove from connected users
    if (this.connectedUsers.has(userId)) {
      this.connectedUsers.get(userId).delete(socket.id);
      if (this.connectedUsers.get(userId).size === 0) {
        this.connectedUsers.delete(userId);
      }
    }

    // Clean up subscriptions
    this.subscriptions.forEach((sockets, room) => {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        this.subscriptions.delete(room);
      }
    });

    logger.info('WebSocket client disconnected', {
      userId,
      socketId: socket.id,
      reason,
      totalConnections: this.io.engine.clientsCount
    });
  }

  subscribeToMarketData() {
    this.marketDataUnsubscribe = marketDataService.subscribe((type, data) => {
      if (type === 'ticker') {
        this.broadcastTicker(data.symbol, data.data);
      }
    });
  }

  broadcastTicker(symbol, tickerData) {
    const room = `ticker:${symbol}`;
    this.io.to(room).emit('ticker:update', {
      symbol,
      data: tickerData,
      timestamp: new Date().toISOString()
    });
  }

  broadcastOrderbook(symbol, orderbookData) {
    const room = `orderbook:${symbol}`;
    this.io.to(room).emit('orderbook:update', {
      symbol,
      data: orderbookData,
      timestamp: new Date().toISOString()
    });
  }

  broadcastTrades(symbol, tradesData) {
    const room = `trades:${symbol}`;
    this.io.to(room).emit('trades:update', {
      symbol,
      data: tradesData,
      timestamp: new Date().toISOString()
    });
  }

  notifyOrderUpdate(userId, orderData) {
    const room = `orders:${userId}`;
    this.io.to(room).emit('order:update', {
      data: orderData,
      timestamp: new Date().toISOString()
    });
  }

  notifyBalanceUpdate(userId, balanceData) {
    const room = `balances:${userId}`;
    this.io.to(room).emit('balance:update', {
      data: balanceData,
      timestamp: new Date().toISOString()
    });
  }

  notifyUserMessage(userId, message, type = 'info') {
    const room = `user:${userId}`;
    this.io.to(room).emit('notification', {
      type,
      message,
      timestamp: new Date().toISOString()
    });
  }

  broadcast(event, data) {
    this.io.emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  getStats() {
    return {
      connectedUsers: this.connectedUsers.size,
      totalConnections: this.io ? this.io.engine.clientsCount : 0,
      subscriptions: this.subscriptions.size,
      rooms: this.io ? Object.keys(this.io.sockets.adapter.rooms).length : 0
    };
  }

  getConnectedUsers() {
    return Array.from(this.connectedUsers.keys());
  }

  isUserConnected(userId) {
    return this.connectedUsers.has(userId);
  }

  disconnect() {
    if (this.marketDataUnsubscribe) {
      this.marketDataUnsubscribe();
    }

    if (this.io) {
      this.io.close();
    }

    logger.info('WebSocket service disconnected');
  }
}

const websocketService = new WebSocketService();

module.exports = websocketService;
