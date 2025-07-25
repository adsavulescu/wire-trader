const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    exchangeName: {
      type: String,
      required: true,
      enum: ['binance', 'coinbase', 'kraken', 'kucoin', 'lcx', 'paper_trading'],
      index: true
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      enum: ['market', 'limit', 'stop', 'stop_limit', 'take_profit', 'oco', 'trailing_stop', 'iceberg'],
      default: 'market'
    },
    side: {
      type: String,
      required: true,
      enum: ['buy', 'sell']
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    price: {
      type: Number,
      min: 0
    },
    stopPrice: {
      type: Number,
      min: 0
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'open', 'closed', 'canceled', 'cancelled', 'expired', 'rejected', 'filled', 'partially_filled'],
      default: 'pending',
      index: true
    },
    filled: {
      type: Number,
      default: 0,
      min: 0
    },
    remaining: {
      type: Number,
      default: 0,
      min: 0
    },
    cost: {
      type: Number,
      default: 0,
      min: 0
    },
    fee: {
      currency: {
        type: String,
        uppercase: true
      },
      cost: {
        type: Number,
        min: 0
      },
      rate: {
        type: Number,
        min: 0
      }
    },
    exchangeOrderId: {
      type: String,
      index: true
    },
    clientOrderId: {
      type: String
    },
    trades: [
      {
        id: String,
        timestamp: Date,
        amount: Number,
        price: Number,
        cost: Number,
        fee: {
          currency: String,
          cost: Number,
          rate: Number
        }
      }
    ],
    timeInForce: {
      type: String,
      enum: ['GTC', 'IOC', 'FOK'],
      default: 'GTC'
    },
    reduceOnly: {
      type: Boolean,
      default: false
    },
    postOnly: {
      type: Boolean,
      default: false
    },
    // Advanced order type fields
    advancedOrderData: {
      // OCO (One-Cancels-Other) order data
      oco: {
        orderListId: String,
        contingencyType: {
          type: String,
          enum: ['OCO']
        },
        listStatusType: {
          type: String,
          enum: ['RESPONSE', 'EXEC_STARTED', 'ALL_DONE']
        },
        listOrderStatus: {
          type: String,
          enum: ['EXECUTING', 'ALL_DONE', 'REJECT']
        },
        linkedOrderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Order'
        }
      },
      
      // Trailing Stop order data
      trailingStop: {
        trailingAmount: Number,        // Fixed trailing amount
        trailingPercent: Number,       // Percentage trailing amount
        activationPrice: Number,       // Price at which trailing starts
        currentStopPrice: Number,      // Current stop price (updated dynamically)
        highestPrice: Number,          // For sell orders - highest price seen
        lowestPrice: Number,           // For buy orders - lowest price seen
        isActivated: {
          type: Boolean,
          default: false
        }
      },
      
      // Iceberg order data
      iceberg: {
        visibleSize: Number,           // Visible order size
        totalSize: Number,             // Total order size
        executedSize: Number,          // Amount already executed
        hiddenRemaining: Number,       // Hidden remaining amount
        childOrders: [{
          orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order'
          },
          size: Number,
          status: String,
          createdAt: Date
        }]
      }
    },

    // Paper trading flag
    isPaperTrade: {
      type: Boolean,
      default: false,
      index: true
    },

    // Additional execution data
    executedAt: Date,
    cancelledAt: Date,

    metadata: {
      strategy: String,
      notes: String,
      parentOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
      },
      relatedOrders: [{
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Order'
        },
        relationship: {
          type: String,
          enum: ['child', 'parent', 'sibling', 'linked']
        }
      }]
    },
    timestamps: {
      created: {
        type: Date,
        default: Date.now,
        index: true
      },
      submitted: Date,
      filled: Date,
      closed: Date,
      canceled: Date,
      lastUpdate: {
        type: Date,
        default: Date.now
      }
    },
    orderErrors: [
      {
        timestamp: {
          type: Date,
          default: Date.now
        },
        message: String,
        code: String,
        source: {
          type: String,
          enum: ['exchange', 'system', 'validation']
        }
      }
    ]
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

orderSchema.virtual('averagePrice').get(function () {
  return this.filled > 0 ? this.cost / this.filled : 0;
});

orderSchema.virtual('fillPercentage').get(function () {
  return this.amount > 0 ? (this.filled / this.amount) * 100 : 0;
});

orderSchema.virtual('isComplete').get(function () {
  return ['closed', 'canceled', 'expired', 'rejected'].includes(this.status);
});

orderSchema.virtual('isActive').get(function () {
  return ['pending', 'open'].includes(this.status);
});

orderSchema.methods.updateFromExchange = function (exchangeOrder) {
  this.status = this.mapExchangeStatus(exchangeOrder.status);
  this.filled = exchangeOrder.filled || 0;
  this.remaining = exchangeOrder.remaining || this.amount - this.filled;
  this.cost = exchangeOrder.cost || 0;
  this.exchangeOrderId = exchangeOrder.id;

  if (exchangeOrder.fee) {
    this.fee = {
      currency: exchangeOrder.fee.currency,
      cost: exchangeOrder.fee.cost,
      rate: exchangeOrder.fee.rate
    };
  }

  if (exchangeOrder.trades && exchangeOrder.trades.length > 0) {
    this.trades = exchangeOrder.trades.map(trade => ({
      id: trade.id,
      timestamp: new Date(trade.timestamp),
      amount: trade.amount,
      price: trade.price,
      cost: trade.cost,
      fee: trade.fee
    }));
  }

  this.timestamps.lastUpdate = new Date();

  if (this.status === 'closed' && !this.timestamps.filled) {
    this.timestamps.filled = new Date();
  }

  if (this.isComplete && !this.timestamps.closed) {
    this.timestamps.closed = new Date();
  }
};

orderSchema.methods.mapExchangeStatus = function (exchangeStatus) {
  const statusMap = {
    open: 'open',
    closed: 'closed',
    canceled: 'canceled',
    cancelled: 'canceled',
    expired: 'expired',
    rejected: 'rejected',
    pending: 'pending'
  };

  return statusMap[exchangeStatus] || 'pending';
};

orderSchema.methods.addError = function (message, code = null, source = 'system') {
  this.orderErrors.push({
    timestamp: new Date(),
    message,
    code,
    source
  });
};

orderSchema.methods.generateClientOrderId = function () {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  this.clientOrderId = `WRT_${this.userId}_${timestamp}_${random}`;
  return this.clientOrderId;
};

orderSchema.pre('save', function (next) {
  if (this.isNew) {
    this.remaining = this.amount - this.filled;

    if (!this.clientOrderId) {
      this.generateClientOrderId();
    }
  }

  this.timestamps.lastUpdate = new Date();
  next();
});

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ exchangeName: 1, status: 1 });
orderSchema.index({ symbol: 1, createdAt: -1 });
orderSchema.index({ exchangeOrderId: 1, exchangeName: 1 });
orderSchema.index({ clientOrderId: 1 }, { unique: true, sparse: true });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
