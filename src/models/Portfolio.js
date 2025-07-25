const mongoose = require('mongoose');

/**
 * Portfolio Schema
 * Tracks overall portfolio composition and performance across exchanges
 */
const portfolioSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },

    // Portfolio settings
    baseCurrency: {
      type: String,
      required: true,
      default: 'USDT',
      enum: ['USDT', 'USD', 'BUSD', 'USDC', 'BTC', 'ETH']
    },

    // Holdings across all exchanges
    holdings: {
      type: Map,
      of: {
        // Asset holdings
        totalAmount: {
          type: Number,
          default: 0,
          min: 0
        },
        availableAmount: {
          type: Number,
          default: 0,
          min: 0
        },
        lockedAmount: {
          type: Number,
          default: 0,
          min: 0
        },
        
        // Value calculations
        averageCost: {
          type: Number,
          default: 0,
          min: 0
        },
        currentPrice: {
          type: Number,
          default: 0,
          min: 0
        },
        currentValue: {
          type: Number,
          default: 0,
          min: 0
        },
        costBasis: {
          type: Number,
          default: 0,
          min: 0
        },
        
        // P&L for this asset
        unrealizedPnL: {
          type: Number,
          default: 0
        },
        unrealizedPnLPercentage: {
          type: Number,
          default: 0
        },
        realizedPnL: {
          type: Number,
          default: 0
        },
        
        // Exchange breakdown
        exchanges: {
          type: Map,
          of: {
            amount: Number,
            available: Number,
            locked: Number,
            lastUpdated: Date
          },
          default: new Map()
        },
        
        // Metadata
        firstPurchaseDate: Date,
        lastUpdateDate: {
          type: Date,
          default: Date.now
        }
      },
      default: new Map()
    },

    // Portfolio totals
    totalValue: {
      current: {
        type: Number,
        default: 0,
        min: 0
      },
      costBasis: {
        type: Number,
        default: 0,
        min: 0
      },
      change24h: {
        value: {
          type: Number,
          default: 0
        },
        percentage: {
          type: Number,
          default: 0
        }
      },
      change7d: {
        value: {
          type: Number,
          default: 0
        },
        percentage: {
          type: Number,
          default: 0
        }
      },
      change30d: {
        value: {
          type: Number,
          default: 0
        },
        percentage: {
          type: Number,
          default: 0
        }
      }
    },

    // Portfolio allocation
    allocation: {
      byAsset: {
        type: Map,
        of: {
          percentage: Number,
          value: Number,
          targetPercentage: Number
        },
        default: new Map()
      },
      byExchange: {
        type: Map,
        of: {
          percentage: Number,
          value: Number
        },
        default: new Map()
      },
      byType: {
        crypto: {
          percentage: { type: Number, default: 0 },
          value: { type: Number, default: 0 }
        },
        stablecoin: {
          percentage: { type: Number, default: 0 },
          value: { type: Number, default: 0 }
        },
        fiat: {
          percentage: { type: Number, default: 0 },
          value: { type: Number, default: 0 }
        }
      }
    },

    // Performance metrics
    performance: {
      totalPnL: {
        realized: {
          type: Number,
          default: 0
        },
        unrealized: {
          type: Number,
          default: 0
        },
        total: {
          type: Number,
          default: 0
        }
      },
      
      totalPnLPercentage: {
        type: Number,
        default: 0
      },
      
      bestPerformingAsset: {
        symbol: String,
        pnlPercentage: {
          type: Number,
          default: 0
        }
      },
      
      worstPerformingAsset: {
        symbol: String,
        pnlPercentage: {
          type: Number,
          default: 0
        }
      },
      
      // Historical performance
      dailyValues: [{
        date: {
          type: Date,
          required: true
        },
        totalValue: {
          type: Number,
          required: true
        },
        pnl: {
          type: Number,
          default: 0
        },
        pnlPercentage: {
          type: Number,
          default: 0
        }
      }],
      
      // High water mark tracking
      highWaterMark: {
        value: {
          type: Number,
          default: 0
        },
        date: Date
      },
      
      // Drawdown tracking
      maxDrawdown: {
        value: {
          type: Number,
          default: 0
        },
        percentage: {
          type: Number,
          default: 0
        },
        start: Date,
        end: Date
      }
    },

    // Portfolio settings and preferences
    settings: {
      autoRebalance: {
        enabled: {
          type: Boolean,
          default: false
        },
        threshold: {
          type: Number,
          default: 5, // 5% deviation threshold
          min: 1,
          max: 50
        }
      },
      
      riskManagement: {
        maxAssetAllocation: {
          type: Number,
          default: 25, // 25% max per asset
          min: 5,
          max: 100
        },
        maxExchangeAllocation: {
          type: Number,
          default: 50, // 50% max per exchange
          min: 10,
          max: 100
        },
        stopLossThreshold: {
          type: Number,
          default: 10, // 10% portfolio stop loss
          min: 1,
          max: 50
        }
      },
      
      notifications: {
        dailyReport: {
          type: Boolean,
          default: true
        },
        performanceAlerts: {
          type: Boolean,
          default: true
        },
        rebalanceAlerts: {
          type: Boolean,
          default: true
        }
      }
    },

    // Last sync information
    lastSyncDate: {
      type: Date,
      default: Date.now
    },
    
    syncStatus: {
      type: String,
      enum: ['syncing', 'synced', 'error'],
      default: 'synced'
    },
    
    syncErrors: [{
      exchange: String,
      error: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
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

// Indexes for performance (userId index is already defined in the schema)
portfolioSchema.index({ lastSyncDate: -1 });
portfolioSchema.index({ 'performance.dailyValues.date': -1 });

/**
 * Virtual for total portfolio P&L percentage
 */
portfolioSchema.virtual('totalPnLPercentage').get(function () {
  if (this.totalValue.costBasis === 0) return 0;
  return ((this.totalValue.current - this.totalValue.costBasis) / this.totalValue.costBasis) * 100;
});

/**
 * Virtual for diversification score
 */
portfolioSchema.virtual('diversificationScore').get(function () {
  const allocations = Array.from(this.allocation.byAsset.values()).map(a => a.percentage);
  if (allocations.length === 0) return 0;
  
  // Calculate Herfindahl-Hirschman Index (HHI) and convert to diversification score
  const hhi = allocations.reduce((sum, percentage) => sum + Math.pow(percentage, 2), 0);
  return Math.max(0, 100 - hhi); // Higher score = more diversified
});

/**
 * Virtual for asset count
 */
portfolioSchema.virtual('assetCount').get(function () {
  return Array.from(this.holdings.keys()).filter(asset => {
    const holding = this.holdings.get(asset);
    return holding && holding.totalAmount > 0;
  }).length;
});

/**
 * Instance method to update holding for an asset
 * @param {string} asset - Asset symbol
 * @param {string} exchange - Exchange name
 * @param {number} amount - Amount
 * @param {number} price - Current price
 * @param {number} available - Available amount
 * @param {number} locked - Locked amount
 */
portfolioSchema.methods.updateHolding = function (asset, exchange, amount, price, available = null, locked = null) {
  // Get or create holding
  let holding = this.holdings.get(asset) || {
    totalAmount: 0,
    availableAmount: 0,
    lockedAmount: 0,
    averageCost: 0,
    currentPrice: price,
    currentValue: 0,
    costBasis: 0,
    unrealizedPnL: 0,
    unrealizedPnLPercentage: 0,
    realizedPnL: 0,
    exchanges: new Map(),
    lastUpdateDate: new Date()
  };

  // Update exchange-specific data
  holding.exchanges.set(exchange, {
    amount: amount,
    available: available !== null ? available : amount,
    locked: locked !== null ? locked : 0,
    lastUpdated: new Date()
  });

  // Recalculate totals across all exchanges
  let totalAmount = 0;
  let totalAvailable = 0;
  let totalLocked = 0;

  for (const [, exchangeData] of holding.exchanges) {
    totalAmount += exchangeData.amount;
    totalAvailable += exchangeData.available;
    totalLocked += exchangeData.locked;
  }

  holding.totalAmount = totalAmount;
  holding.availableAmount = totalAvailable;
  holding.lockedAmount = totalLocked;
  holding.currentPrice = price;
  holding.currentValue = totalAmount * price;
  holding.lastUpdateDate = new Date();

  // Calculate unrealized P&L if we have cost basis
  if (holding.costBasis > 0) {
    holding.unrealizedPnL = holding.currentValue - holding.costBasis;
    holding.unrealizedPnLPercentage = (holding.unrealizedPnL / holding.costBasis) * 100;
  }

  // Set first purchase date if not set
  if (!holding.firstPurchaseDate && totalAmount > 0) {
    holding.firstPurchaseDate = new Date();
  }

  // Update holdings map
  this.holdings.set(asset, holding);
  this.markModified('holdings');
};

/**
 * Instance method to add a trade to update cost basis
 * @param {string} asset - Asset symbol
 * @param {string} side - 'buy' or 'sell'
 * @param {number} amount - Trade amount
 * @param {number} price - Trade price
 * @param {number} fee - Trade fee
 */
portfolioSchema.methods.addTrade = function (asset, side, amount, price, fee = 0) {
  let holding = this.holdings.get(asset) || {
    totalAmount: 0,
    availableAmount: 0,
    lockedAmount: 0,
    averageCost: 0,
    currentPrice: price,
    currentValue: 0,
    costBasis: 0,
    unrealizedPnL: 0,
    unrealizedPnLPercentage: 0,
    realizedPnL: 0,
    exchanges: new Map(),
    lastUpdateDate: new Date()
  };

  if (side === 'buy') {
    // Update average cost using weighted average
    const newCostBasis = holding.costBasis + (amount * price) + fee;
    const newTotalAmount = holding.totalAmount + amount;
    
    holding.averageCost = newTotalAmount > 0 ? newCostBasis / newTotalAmount : 0;
    holding.costBasis = newCostBasis;
    holding.totalAmount = newTotalAmount;
    holding.availableAmount += amount;
  } else if (side === 'sell') {
    // Calculate realized P&L
    const soldValue = amount * price;
    const soldCostBasis = amount * holding.averageCost;
    const realizedPnL = soldValue - soldCostBasis - fee;
    
    holding.realizedPnL += realizedPnL;
    holding.totalAmount -= amount;
    holding.availableAmount -= amount;
    holding.costBasis -= soldCostBasis;
    
    // Ensure amounts don't go negative
    holding.totalAmount = Math.max(0, holding.totalAmount);
    holding.availableAmount = Math.max(0, holding.availableAmount);
    holding.costBasis = Math.max(0, holding.costBasis);
  }

  holding.currentValue = holding.totalAmount * price;
  holding.lastUpdateDate = new Date();

  this.holdings.set(asset, holding);
  this.markModified('holdings');
};

/**
 * Instance method to recalculate portfolio totals and allocation
 */
portfolioSchema.methods.recalculatePortfolio = function () {
  let totalValue = 0;
  let totalCostBasis = 0;
  let totalRealizedPnL = 0;
  let totalUnrealizedPnL = 0;

  const assetAllocations = new Map();
  const exchangeAllocations = new Map();
  
  let bestAsset = { symbol: null, pnlPercentage: -Infinity };
  let worstAsset = { symbol: null, pnlPercentage: Infinity };

  // Calculate totals and allocations
  for (const [asset, holding] of this.holdings) {
    if (holding.totalAmount > 0) {
      totalValue += holding.currentValue;
      totalCostBasis += holding.costBasis;
      totalRealizedPnL += holding.realizedPnL;
      totalUnrealizedPnL += holding.unrealizedPnL;

      // Track best/worst performing assets
      if (holding.unrealizedPnLPercentage > bestAsset.pnlPercentage) {
        bestAsset = { symbol: asset, pnlPercentage: holding.unrealizedPnLPercentage };
      }
      if (holding.unrealizedPnLPercentage < worstAsset.pnlPercentage) {
        worstAsset = { symbol: asset, pnlPercentage: holding.unrealizedPnLPercentage };
      }

      // Calculate exchange allocations for this asset
      for (const [exchange, exchangeData] of holding.exchanges) {
        const exchangeValue = exchangeData.amount * holding.currentPrice;
        const currentExchangeAllocation = exchangeAllocations.get(exchange) || { value: 0, percentage: 0 };
        currentExchangeAllocation.value += exchangeValue;
        exchangeAllocations.set(exchange, currentExchangeAllocation);
      }
    }
  }

  // Update portfolio totals
  this.totalValue.current = totalValue;
  this.totalValue.costBasis = totalCostBasis;
  this.performance.totalPnL.realized = totalRealizedPnL;
  this.performance.totalPnL.unrealized = totalUnrealizedPnL;
  this.performance.totalPnL.total = totalRealizedPnL + totalUnrealizedPnL;
  this.performance.totalPnLPercentage = totalCostBasis > 0 ? (this.performance.totalPnL.total / totalCostBasis) * 100 : 0;

  // Update best/worst performing assets
  this.performance.bestPerformingAsset = bestAsset.symbol ? bestAsset : { symbol: null, pnlPercentage: 0 };
  this.performance.worstPerformingAsset = worstAsset.symbol ? worstAsset : { symbol: null, pnlPercentage: 0 };

  // Calculate asset allocations
  for (const [asset, holding] of this.holdings) {
    if (holding.totalAmount > 0) {
      const percentage = totalValue > 0 ? (holding.currentValue / totalValue) * 100 : 0;
      assetAllocations.set(asset, {
        percentage,
        value: holding.currentValue,
        targetPercentage: 0 // This could be set by user preferences
      });
    }
  }

  // Calculate exchange allocation percentages
  for (const [exchange, allocation] of exchangeAllocations) {
    allocation.percentage = totalValue > 0 ? (allocation.value / totalValue) * 100 : 0;
  }

  this.allocation.byAsset = assetAllocations;
  this.allocation.byExchange = exchangeAllocations;
  
  // Update high water mark
  if (totalValue > this.performance.highWaterMark.value) {
    this.performance.highWaterMark.value = totalValue;
    this.performance.highWaterMark.date = new Date();
  }

  // Calculate current drawdown
  const currentDrawdown = this.performance.highWaterMark.value - totalValue;
  const currentDrawdownPercentage = this.performance.highWaterMark.value > 0 
    ? (currentDrawdown / this.performance.highWaterMark.value) * 100 
    : 0;

  // Update max drawdown if current is worse
  if (currentDrawdownPercentage > this.performance.maxDrawdown.percentage) {
    this.performance.maxDrawdown.value = currentDrawdown;
    this.performance.maxDrawdown.percentage = currentDrawdownPercentage;
    this.performance.maxDrawdown.start = this.performance.highWaterMark.date;
    this.performance.maxDrawdown.end = new Date();
  }

  this.lastSyncDate = new Date();
};

/**
 * Instance method to add daily performance record
 */
portfolioSchema.methods.addDailyPerformance = function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if we already have today's record
  const existingRecord = this.performance.dailyValues.find(
    record => record.date.getTime() === today.getTime()
  );

  const totalValue = this.totalValue.current;
  const yesterdayValue = this.performance.dailyValues.length > 0 
    ? this.performance.dailyValues[this.performance.dailyValues.length - 1].totalValue 
    : this.totalValue.costBasis;

  const dailyPnL = totalValue - yesterdayValue;
  const dailyPnLPercentage = yesterdayValue > 0 ? (dailyPnL / yesterdayValue) * 100 : 0;

  if (existingRecord) {
    existingRecord.totalValue = totalValue;
    existingRecord.pnl = dailyPnL;
    existingRecord.pnlPercentage = dailyPnLPercentage;
  } else {
    this.performance.dailyValues.push({
      date: today,
      totalValue,
      pnl: dailyPnL,
      pnlPercentage: dailyPnLPercentage
    });
  }

  // Keep only last 365 days
  if (this.performance.dailyValues.length > 365) {
    this.performance.dailyValues = this.performance.dailyValues.slice(-365);
  }
};

/**
 * Static method to find portfolio by user ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Portfolio
 */
portfolioSchema.statics.findByUserId = function (userId) {
  return this.findOne({ userId });
};

/**
 * Static method to create default portfolio for user
 * @param {string} userId - User ID
 * @param {string} baseCurrency - Base currency
 * @returns {Promise<Object>} Created portfolio
 */
portfolioSchema.statics.createDefaultPortfolio = function (userId, baseCurrency = 'USDT') {
  return this.create({
    userId,
    baseCurrency,
    holdings: new Map(),
    allocation: {
      byAsset: new Map(),
      byExchange: new Map()
    }
  });
};

// Create and export the model
const Portfolio = mongoose.model('Portfolio', portfolioSchema);

module.exports = Portfolio;