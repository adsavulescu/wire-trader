const mongoose = require('mongoose');

/**
 * Paper Trading Account Schema
 * Manages virtual balances and portfolio for paper trading mode
 */
const paperTradingAccountSchema = new mongoose.Schema(
  {
    // User reference
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
      index: true
    },

    // Account status
    isActive: {
      type: Boolean,
      default: true
    },

    // Virtual balances for different assets
    virtualBalances: {
      type: Map,
      of: {
        total: {
          type: Number,
          default: 0,
          min: [0, 'Balance cannot be negative']
        },
        available: {
          type: Number,
          default: 0,
          min: [0, 'Available balance cannot be negative']
        },
        locked: {
          type: Number,
          default: 0,
          min: [0, 'Locked balance cannot be negative']
        }
      },
      default: new Map([
        ['USDT', { total: 100000, available: 100000, locked: 0 }],
        ['BTC', { total: 0, available: 0, locked: 0 }],
        ['ETH', { total: 0, available: 0, locked: 0 }]
      ])
    },

    // Initial account value and settings
    initialBalance: {
      type: Number,
      default: 100000,
      min: [1000, 'Initial balance must be at least $1,000']
    },

    baseCurrency: {
      type: String,
      default: 'USDT',
      enum: ['USDT', 'USD', 'BUSD', 'USDC']
    },

    // Performance tracking
    performance: {
      totalTrades: {
        type: Number,
        default: 0
      },
      winningTrades: {
        type: Number,
        default: 0
      },
      losingTrades: {
        type: Number,
        default: 0
      },
      totalVolume: {
        type: Number,
        default: 0
      },
      totalPnL: {
        type: Number,
        default: 0
      },
      realizedPnL: {
        type: Number,
        default: 0
      },
      unrealizedPnL: {
        type: Number,
        default: 0
      },
      highWaterMark: {
        value: {
          type: Number,
          default: 100000
        },
        date: {
          type: Date,
          default: Date.now
        }
      },
      maxDrawdown: {
        value: {
          type: Number,
          default: 0
        },
        percentage: {
          type: Number,
          default: 0
        },
        date: {
          type: Date
        }
      }
    },

    // Risk management settings
    riskSettings: {
      maxPositionSize: {
        type: Number,
        default: 0.1, // 10% of portfolio
        min: [0.01, 'Minimum position size is 1%'],
        max: [1, 'Maximum position size is 100%']
      },
      maxDailyLoss: {
        type: Number,
        default: 0.05, // 5% daily loss limit
        min: [0.01, 'Minimum daily loss limit is 1%'],
        max: [0.2, 'Maximum daily loss limit is 20%']
      },
      stopLossDefault: {
        type: Number,
        default: 0.02, // 2% default stop loss
        min: [0.005, 'Minimum stop loss is 0.5%'],
        max: [0.1, 'Maximum stop loss is 10%']
      }
    },

    // Trading statistics by timeframe
    dailyStats: [{
      date: {
        type: Date,
        required: true
      },
      openingBalance: {
        type: Number,
        required: true
      },
      closingBalance: {
        type: Number,
        required: true
      },
      trades: {
        type: Number,
        default: 0
      },
      pnl: {
        type: Number,
        default: 0
      },
      volume: {
        type: Number,
        default: 0
      }
    }],

    // Account reset history
    resetHistory: [{
      resetDate: {
        type: Date,
        required: true
      },
      previousBalance: {
        type: Number,
        required: true
      },
      newBalance: {
        type: Number,
        required: true
      },
      reason: {
        type: String,
        enum: ['manual_reset', 'performance_reset', 'strategy_change'],
        default: 'manual_reset'
      }
    }]
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Indexes for performance (userId index is already defined in the schema)
paperTradingAccountSchema.index({ 'dailyStats.date': -1 });
paperTradingAccountSchema.index({ createdAt: -1 });

/**
 * Virtual for current portfolio value in base currency
 */
paperTradingAccountSchema.virtual('currentPortfolioValue').get(function () {
  let totalValue = 0;
  for (const [asset, balance] of this.virtualBalances) {
    if (asset === this.baseCurrency) {
      totalValue += balance.total;
    }
    // For other assets, we would need current market prices
    // This would be calculated in the service layer
  }
  return totalValue;
});

/**
 * Virtual for win rate
 */
paperTradingAccountSchema.virtual('winRate').get(function () {
  const totalTrades = this.performance.totalTrades;
  if (totalTrades === 0) return 0;
  return (this.performance.winningTrades / totalTrades) * 100;
});

/**
 * Virtual for average trade size
 */
paperTradingAccountSchema.virtual('averageTradeSize').get(function () {
  const totalTrades = this.performance.totalTrades;
  if (totalTrades === 0) return 0;
  return this.performance.totalVolume / totalTrades;
});

/**
 * Instance method to get available balance for an asset
 */
paperTradingAccountSchema.methods.getAvailableBalance = function (asset) {
  const balance = this.virtualBalances.get(asset);
  return balance ? balance.available : 0;
};

/**
 * Instance method to get total balance for an asset
 */
paperTradingAccountSchema.methods.getTotalBalance = function (asset) {
  const balance = this.virtualBalances.get(asset);
  return balance ? balance.total : 0;
};

/**
 * Instance method to lock balance for pending orders
 */
paperTradingAccountSchema.methods.lockBalance = function (asset, amount) {
  const balance = this.virtualBalances.get(asset) || { total: 0, available: 0, locked: 0 };
  
  if (balance.available < amount) {
    throw new Error(`Insufficient available balance. Available: ${balance.available}, Required: ${amount}`);
  }
  
  balance.available -= amount;
  balance.locked += amount;
  this.virtualBalances.set(asset, balance);
};

/**
 * Instance method to unlock balance (when order is cancelled)
 */
paperTradingAccountSchema.methods.unlockBalance = function (asset, amount) {
  const balance = this.virtualBalances.get(asset) || { total: 0, available: 0, locked: 0 };
  
  balance.available += amount;
  balance.locked = Math.max(0, balance.locked - amount);
  this.virtualBalances.set(asset, balance);
};

/**
 * Instance method to update balance after trade execution
 */
paperTradingAccountSchema.methods.updateBalanceAfterTrade = function (fromAsset, fromAmount, toAsset, toAmount) {
  // Reduce balance in fromAsset
  const fromBalance = this.virtualBalances.get(fromAsset) || { total: 0, available: 0, locked: 0 };
  fromBalance.total -= fromAmount;
  fromBalance.locked = Math.max(0, fromBalance.locked - fromAmount);
  this.virtualBalances.set(fromAsset, fromBalance);
  
  // Add balance in toAsset
  const toBalance = this.virtualBalances.get(toAsset) || { total: 0, available: 0, locked: 0 };
  toBalance.total += toAmount;
  toBalance.available += toAmount;
  this.virtualBalances.set(toAsset, toBalance);
};

/**
 * Instance method to reset account to initial state
 */
paperTradingAccountSchema.methods.resetAccount = function (newBalance = null, reason = 'manual_reset') {
  const previousBalance = this.currentPortfolioValue || this.initialBalance;
  const resetBalance = newBalance || this.initialBalance;
  
  // Record reset in history
  this.resetHistory.push({
    resetDate: new Date(),
    previousBalance,
    newBalance: resetBalance,
    reason
  });
  
  // Reset balances
  this.virtualBalances.set(this.baseCurrency, {
    total: resetBalance,
    available: resetBalance,
    locked: 0
  });
  
  // Clear other asset balances
  for (const [asset] of this.virtualBalances) {
    if (asset !== this.baseCurrency) {
      this.virtualBalances.set(asset, { total: 0, available: 0, locked: 0 });
    }
  }
  
  // Reset performance metrics
  this.performance.totalTrades = 0;
  this.performance.winningTrades = 0;
  this.performance.losingTrades = 0;
  this.performance.totalVolume = 0;
  this.performance.totalPnL = 0;
  this.performance.realizedPnL = 0;
  this.performance.unrealizedPnL = 0;
  this.performance.highWaterMark = {
    value: resetBalance,
    date: new Date()
  };
  this.performance.maxDrawdown = {
    value: 0,
    percentage: 0,
    date: null
  };
  
  this.initialBalance = resetBalance;
};

/**
 * Instance method to update daily statistics
 */
paperTradingAccountSchema.methods.updateDailyStats = function (trades = 0, pnl = 0, volume = 0) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const existingDay = this.dailyStats.find(stat => 
    stat.date.getTime() === today.getTime()
  );
  
  if (existingDay) {
    existingDay.trades += trades;
    existingDay.pnl += pnl;
    existingDay.volume += volume;
    existingDay.closingBalance = this.currentPortfolioValue;
  } else {
    this.dailyStats.push({
      date: today,
      openingBalance: this.currentPortfolioValue - pnl,
      closingBalance: this.currentPortfolioValue,
      trades,
      pnl,
      volume
    });
  }
  
  // Keep only last 365 days
  if (this.dailyStats.length > 365) {
    this.dailyStats = this.dailyStats.slice(-365);
  }
};

/**
 * Static method to find account by user ID
 */
paperTradingAccountSchema.statics.findByUserId = function (userId) {
  return this.findOne({ userId });
};

/**
 * Static method to create default account for user
 */
paperTradingAccountSchema.statics.createDefaultAccount = function (userId, initialBalance = 100000) {
  const virtualBalances = new Map([
    ['USDT', { total: initialBalance, available: initialBalance, locked: 0 }],
    ['BTC', { total: 0, available: 0, locked: 0 }],
    ['ETH', { total: 0, available: 0, locked: 0 }]
  ]);
  
  return this.create({
    userId,
    initialBalance,
    virtualBalances
  });
};

// Create and export the model
const PaperTradingAccount = mongoose.model('PaperTradingAccount', paperTradingAccountSchema);

module.exports = PaperTradingAccount;