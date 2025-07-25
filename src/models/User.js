const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

/**
 * User Schema
 * Defines the structure for user accounts in the system
 */
const userSchema = new mongoose.Schema(
  {
    // Basic user information
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false // Don't include password in queries by default
    },

    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters']
    },

    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters']
    },

    // Account status and settings
    isActive: {
      type: Boolean,
      default: true
    },

    isEmailVerified: {
      type: Boolean,
      default: false
    },

    // User preferences
    preferences: {
      // Display preferences
      baseCurrency: {
        type: String,
        default: 'USDT',
        enum: ['USD', 'EUR', 'USDT', 'USDC', 'BTC', 'ETH']
      },
      theme: {
        type: String,
        default: 'light',
        enum: ['light', 'dark', 'auto']
      },
      timezone: {
        type: String,
        default: 'UTC'
      },
      language: {
        type: String,
        default: 'en',
        enum: ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko']
      },
      dateFormat: {
        type: String,
        default: 'MM/DD/YYYY',
        enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']
      },
      
      // Trading preferences
      trading: {
        defaultOrderType: {
          type: String,
          default: 'limit',
          enum: ['market', 'limit', 'stop', 'stop_limit']
        },
        defaultTimeInForce: {
          type: String,
          default: 'GTC',
          enum: ['GTC', 'IOC', 'FOK']
        },
        confirmBeforeOrder: {
          type: Boolean,
          default: true
        },
        showAdvancedOrderTypes: {
          type: Boolean,
          default: false
        },
        enablePaperTrading: {
          type: Boolean,
          default: false
        },
        autoRefreshInterval: {
          type: Number,
          default: 5000, // milliseconds
          min: 1000,
          max: 60000
        }
      },

      // Chart preferences
      charts: {
        defaultTimeframe: {
          type: String,
          default: '1h',
          enum: ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w']
        },
        showVolume: {
          type: Boolean,
          default: true
        },
        showGrid: {
          type: Boolean,
          default: true
        },
        chartType: {
          type: String,
          default: 'candlestick',
          enum: ['candlestick', 'line', 'area', 'ohlc']
        },
        indicators: [{
          name: String,
          enabled: Boolean,
          parameters: Object
        }]
      },

      // Dashboard preferences
      dashboard: {
        layout: {
          type: String,
          default: 'grid',
          enum: ['grid', 'list', 'compact']
        },
        widgets: [{
          type: {
            type: String,
            enum: ['portfolio', 'watchlist', 'orders', 'trades', 'news', 'chart']
          },
          position: {
            x: Number,
            y: Number,
            width: Number,
            height: Number
          },
          settings: Object,
          enabled: {
            type: Boolean,
            default: true
          }
        }],
        refreshInterval: {
          type: Number,
          default: 30000, // 30 seconds
          min: 5000,
          max: 300000
        }
      },

      // Watchlist preferences
      watchlists: [{
        name: {
          type: String,
          required: true
        },
        symbols: [String],
        sortBy: {
          type: String,
          default: 'symbol',
          enum: ['symbol', 'price', 'change', 'volume']
        },
        sortOrder: {
          type: String,
          default: 'asc',
          enum: ['asc', 'desc']
        },
        isDefault: {
          type: Boolean,
          default: false
        }
      }],

      // Notification preferences
      notifications: {
        email: {
          enabled: {
            type: Boolean,
            default: true
          },
          orderUpdates: {
            type: Boolean,
            default: true
          },
          priceAlerts: {
            type: Boolean,
            default: true
          },
          tradingSignals: {
            type: Boolean,
            default: false
          },
          weeklyReports: {
            type: Boolean,
            default: true
          },
          securityAlerts: {
            type: Boolean,
            default: true
          }
        },
        push: {
          enabled: {
            type: Boolean,
            default: false
          },
          orderFills: {
            type: Boolean,
            default: true
          },
          priceMovements: {
            type: Boolean,
            default: false
          },
          portfolioUpdates: {
            type: Boolean,
            default: false
          }
        },
        sound: {
          enabled: {
            type: Boolean,
            default: true
          },
          orderFills: {
            type: Boolean,
            default: true
          },
          priceAlerts: {
            type: Boolean,
            default: true
          },
          volume: {
            type: Number,
            default: 0.5,
            min: 0,
            max: 1
          }
        }
      },

      // Privacy preferences
      privacy: {
        sharePortfolioStats: {
          type: Boolean,
          default: false
        },
        showOnLeaderboard: {
          type: Boolean,
          default: false
        },
        allowAnalytics: {
          type: Boolean,
          default: true
        },
        marketingEmails: {
          type: Boolean,
          default: false
        }
      },

      // API preferences
      api: {
        enableWebhooks: {
          type: Boolean,
          default: false
        },
        webhookUrl: String,
        rateLimitTier: {
          type: String,
          default: 'basic',
          enum: ['basic', 'premium', 'enterprise']
        }
      }
    },

    // Security settings
    twoFactorAuth: {
      enabled: {
        type: Boolean,
        default: false
      },
      secret: {
        type: String,
        select: false
      }
    },

    // Account statistics
    stats: {
      totalTrades: {
        type: Number,
        default: 0
      },
      totalVolume: {
        type: Number,
        default: 0
      },
      connectedExchanges: {
        type: Number,
        default: 0
      },
      lastLoginAt: {
        type: Date
      },
      loginCount: {
        type: Number,
        default: 0
      }
    },

    // Verification and reset tokens
    emailVerificationToken: {
      type: String,
      select: false
    },

    emailVerificationTokenExpires: {
      type: Date,
      select: false
    },

    passwordResetToken: {
      type: String,
      select: false
    },

    passwordResetTokenExpires: {
      type: Date,
      select: false
    }
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Indexes for better query performance
userSchema.index({ createdAt: 1 });
userSchema.index({ 'stats.lastLoginAt': 1 });

/**
 * Pre-save middleware to hash password
 */
userSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Instance method to check password
 * @param {string} candidatePassword - Password to check
 * @returns {Promise<boolean>} Password match result
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

/**
 * Instance method to get user's full name
 * @returns {string} Full name
 */
userSchema.methods.getFullName = function () {
  return `${this.firstName} ${this.lastName}`;
};

/**
 * Instance method to update last login
 */
userSchema.methods.updateLastLogin = async function () {
  this.stats.lastLoginAt = new Date();
  this.stats.loginCount += 1;
  await this.save();
};

/**
 * Instance method to increment connected exchanges count
 */
userSchema.methods.incrementExchangeCount = async function () {
  this.stats.connectedExchanges += 1;
  await this.save();
};

/**
 * Instance method to decrement connected exchanges count
 */
userSchema.methods.decrementExchangeCount = async function () {
  if (this.stats.connectedExchanges > 0) {
    this.stats.connectedExchanges -= 1;
    await this.save();
  }
};

/**
 * Static method to find user by email
 * @param {string} email - User email
 * @returns {Promise<Object>} User document
 */
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

/**
 * Static method to find active users
 * @returns {Promise<Array>} Active users
 */
userSchema.statics.findActiveUsers = function () {
  return this.find({ isActive: true });
};

/**
 * Virtual for user's age (if birthDate was added)
 */
userSchema.virtual('fullName').get(function () {
  return this.getFullName();
});

/**
 * Pre-remove middleware to cleanup related data
 */
userSchema.pre('remove', async function (next) {
  try {
    // Remove user's exchange credentials
    await mongoose.model('ExchangeCredentials').deleteMany({ userId: this._id });
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Post-save middleware for logging
 */
userSchema.post('save', function (doc) {
  if (this._isNew) {
    console.log(`New user created: ${doc.email}`);
  }
});

// Create and export the model
const User = mongoose.model('User', userSchema);

module.exports = User;
