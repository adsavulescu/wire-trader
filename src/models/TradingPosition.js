const mongoose = require('mongoose');

/**
 * Trading Position Schema
 * Tracks open positions and their P&L
 */
const tradingPositionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    symbol: {
      type: String,
      required: true,
      uppercase: true,
      index: true
    },

    exchangeName: {
      type: String,
      required: true,
      enum: ['binance', 'coinbase', 'kraken', 'paper_trading'],
      index: true
    },

    side: {
      type: String,
      required: true,
      enum: ['long', 'short']
    },

    status: {
      type: String,
      required: true,
      enum: ['open', 'closed'],
      default: 'open',
      index: true
    },

    // Position size and entry
    size: {
      type: Number,
      required: true,
      min: 0
    },

    entryPrice: {
      type: Number,
      required: true,
      min: 0
    },

    entryValue: {
      type: Number,
      required: true,
      min: 0
    },

    entryDate: {
      type: Date,
      required: true,
      default: Date.now
    },

    // Exit information (for closed positions)
    exitPrice: {
      type: Number,
      min: 0
    },

    exitValue: {
      type: Number,
      min: 0
    },

    exitDate: {
      type: Date
    },

    // P&L calculations
    unrealizedPnL: {
      type: Number,
      default: 0
    },

    realizedPnL: {
      type: Number,
      default: 0
    },

    totalFees: {
      type: Number,
      default: 0
    },

    netPnL: {
      type: Number,
      default: 0
    },

    pnlPercentage: {
      type: Number,
      default: 0
    },

    // Related orders
    entryOrders: [{
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
      },
      amount: Number,
      price: Number,
      fee: Number,
      timestamp: Date
    }],

    exitOrders: [{
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
      },
      amount: Number,
      price: Number,
      fee: Number,
      timestamp: Date
    }],

    // Risk metrics
    maxDrawdown: {
      value: {
        type: Number,
        default: 0
      },
      percentage: {
        type: Number,
        default: 0
      },
      date: Date
    },

    maxProfit: {
      value: {
        type: Number,
        default: 0
      },
      percentage: {
        type: Number,
        default: 0
      },
      date: Date
    },

    // Holding period
    holdingPeriod: {
      days: Number,
      hours: Number,
      minutes: Number
    },

    // Additional metadata
    strategy: String,
    tags: [String],
    notes: String
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

// Indexes for performance
tradingPositionSchema.index({ userId: 1, status: 1 });
tradingPositionSchema.index({ symbol: 1, createdAt: -1 });
tradingPositionSchema.index({ entryDate: -1 });
tradingPositionSchema.index({ exitDate: -1 });

/**
 * Virtual for current market value (for open positions)
 */
tradingPositionSchema.virtual('currentValue').get(function () {
  if (this.status === 'closed') {
    return this.exitValue;
  }
  // This would need current market price - calculated in service layer
  return this.entryValue;
});

/**
 * Virtual for position duration
 */
tradingPositionSchema.virtual('duration').get(function () {
  const endDate = this.exitDate || new Date();
  const durationMs = endDate - this.entryDate;
  const days = Math.floor(durationMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return { days, hours, minutes };
});

/**
 * Virtual for win/loss status
 */
tradingPositionSchema.virtual('isWinning').get(function () {
  return this.status === 'closed' ? this.netPnL > 0 : this.unrealizedPnL > 0;
});

/**
 * Instance method to update unrealized P&L
 * @param {number} currentPrice - Current market price
 */
tradingPositionSchema.methods.updateUnrealizedPnL = function (currentPrice) {
  if (this.status === 'closed') return;
  
  const currentValue = this.size * currentPrice;
  
  if (this.side === 'long') {
    this.unrealizedPnL = currentValue - this.entryValue;
  } else {
    this.unrealizedPnL = this.entryValue - currentValue;
  }
  
  this.unrealizedPnL -= this.totalFees;
  this.pnlPercentage = (this.unrealizedPnL / this.entryValue) * 100;
  
  // Update max profit/drawdown
  if (this.unrealizedPnL > this.maxProfit.value) {
    this.maxProfit.value = this.unrealizedPnL;
    this.maxProfit.percentage = this.pnlPercentage;
    this.maxProfit.date = new Date();
  }
  
  if (this.unrealizedPnL < this.maxDrawdown.value) {
    this.maxDrawdown.value = this.unrealizedPnL;
    this.maxDrawdown.percentage = this.pnlPercentage;
    this.maxDrawdown.date = new Date();
  }
};

/**
 * Instance method to close position
 * @param {number} exitPrice - Exit price
 * @param {Array} exitOrders - Exit orders
 */
tradingPositionSchema.methods.closePosition = function (exitPrice, exitOrders = []) {
  this.status = 'closed';
  this.exitPrice = exitPrice;
  this.exitValue = this.size * exitPrice;
  this.exitDate = new Date();
  this.exitOrders = exitOrders;
  
  // Calculate realized P&L
  if (this.side === 'long') {
    this.realizedPnL = this.exitValue - this.entryValue;
  } else {
    this.realizedPnL = this.entryValue - this.exitValue;
  }
  
  this.netPnL = this.realizedPnL - this.totalFees;
  this.pnlPercentage = (this.netPnL / this.entryValue) * 100;
  this.unrealizedPnL = 0;
  
  // Calculate holding period
  const duration = this.duration;
  this.holdingPeriod = duration;
};

/**
 * Instance method to add entry order
 * @param {Object} order - Order object
 */
tradingPositionSchema.methods.addEntryOrder = function (order) {
  this.entryOrders.push({
    orderId: order._id,
    amount: order.filled,
    price: order.averagePrice || order.price,
    fee: order.fee?.cost || 0,
    timestamp: order.executedAt || order.createdAt
  });
  
  // Recalculate weighted average entry price
  let totalValue = 0;
  let totalSize = 0;
  let totalFees = 0;
  
  this.entryOrders.forEach(entryOrder => {
    totalValue += entryOrder.amount * entryOrder.price;
    totalSize += entryOrder.amount;
    totalFees += entryOrder.fee;
  });
  
  this.size = totalSize;
  this.entryPrice = totalValue / totalSize;
  this.entryValue = totalValue;
  this.totalFees += (order.fee?.cost || 0);
};

/**
 * Instance method to add exit order
 * @param {Object} order - Order object
 */
tradingPositionSchema.methods.addExitOrder = function (order) {
  this.exitOrders.push({
    orderId: order._id,
    amount: order.filled,
    price: order.averagePrice || order.price,
    fee: order.fee?.cost || 0,
    timestamp: order.executedAt || order.createdAt
  });
  
  this.totalFees += (order.fee?.cost || 0);
  
  // Check if position is fully closed
  const totalExitSize = this.exitOrders.reduce((sum, order) => sum + order.amount, 0);
  if (totalExitSize >= this.size) {
    // Calculate weighted average exit price
    let totalExitValue = 0;
    this.exitOrders.forEach(exitOrder => {
      totalExitValue += exitOrder.amount * exitOrder.price;
    });
    
    const avgExitPrice = totalExitValue / totalExitSize;
    this.closePosition(avgExitPrice, this.exitOrders);
  }
};

/**
 * Static method to find open positions for user
 * @param {string} userId - User ID
 * @param {string} symbol - Optional symbol filter
 * @returns {Promise<Array>} Open positions
 */
tradingPositionSchema.statics.findOpenPositions = function (userId, symbol = null) {
  const query = { userId, status: 'open' };
  if (symbol) query.symbol = symbol.toUpperCase();
  return this.find(query).sort({ entryDate: -1 });
};

/**
 * Static method to find closed positions for user
 * @param {string} userId - User ID
 * @param {Object} filters - Additional filters
 * @returns {Promise<Array>} Closed positions
 */
tradingPositionSchema.statics.findClosedPositions = function (userId, filters = {}) {
  const query = { userId, status: 'closed', ...filters };
  return this.find(query).sort({ exitDate: -1 });
};

/**
 * Static method to calculate portfolio metrics
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Portfolio metrics
 */
tradingPositionSchema.statics.calculatePortfolioMetrics = async function (userId) {
  const pipeline = [
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalPositions: { $sum: 1 },
        openPositions: {
          $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
        },
        closedPositions: {
          $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] }
        },
        winningTrades: {
          $sum: { $cond: [{ $and: [{ $eq: ['$status', 'closed'] }, { $gt: ['$netPnL', 0] }] }, 1, 0] }
        },
        losingTrades: {
          $sum: { $cond: [{ $and: [{ $eq: ['$status', 'closed'] }, { $lt: ['$netPnL', 0] }] }, 1, 0] }
        },
        totalRealizedPnL: {
          $sum: { $cond: [{ $eq: ['$status', 'closed'] }, '$netPnL', 0] }
        },
        totalUnrealizedPnL: {
          $sum: { $cond: [{ $eq: ['$status', 'open'] }, '$unrealizedPnL', 0] }
        },
        totalFees: { $sum: '$totalFees' },
        averageHoldingPeriod: {
          $avg: {
            $cond: [
              { $eq: ['$status', 'closed'] },
              { $divide: [{ $subtract: ['$exitDate', '$entryDate'] }, 1000 * 60 * 60 * 24] },
              null
            ]
          }
        },
        maxDrawdown: { $min: '$maxDrawdown.value' },
        maxProfit: { $max: '$maxProfit.value' }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {};
};

// Create and export the model
const TradingPosition = mongoose.model('TradingPosition', tradingPositionSchema);

module.exports = TradingPosition;