const mongoose = require('mongoose');
const crypto = require('crypto');
const config = require('../config');

/**
 * Exchange Credentials Schema
 * Stores encrypted API credentials for various exchanges
 */
const exchangeCredentialsSchema = new mongoose.Schema({
  // User reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },

  // Exchange information
  exchangeName: {
    type: String,
    required: [true, 'Exchange name is required'],
    enum: ['binance', 'coinbase', 'kraken'],
    lowercase: true
  },

  exchangeDisplayName: {
    type: String,
    required: true
  },

  // Encrypted credentials
  encryptedApiKey: {
    type: String,
    required: [true, 'API key is required']
  },

  encryptedSecret: {
    type: String,
    required: [true, 'Secret key is required']
  },

  encryptedPassphrase: {
    type: String,
    // Only required for exchanges that need it (like Coinbase)
    required: function() {
      return this.exchangeName === 'coinbase';
    }
  },

  // IV (Initialization Vector) for encryption
  iv: {
    type: String,
    required: true
  },

  // Settings
  sandbox: {
    type: Boolean,
    default: false
  },

  // Status and metadata
  isActive: {
    type: Boolean,
    default: true
  },

  lastUsed: {
    type: Date,
    default: Date.now
  },

  lastConnectionTest: {
    type: Date
  },

  connectionStatus: {
    type: String,
    enum: ['connected', 'disconnected', 'error', 'untested'],
    default: 'untested'
  },

  lastError: {
    type: String
  },

  // Permissions (if supported by exchange)
  permissions: {
    spot: {
      type: Boolean,
      default: false
    },
    futures: {
      type: Boolean,
      default: false
    },
    margin: {
      type: Boolean,
      default: false
    },
    withdraw: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      // Never expose encrypted credentials in JSON
      delete ret.encryptedApiKey;
      delete ret.encryptedSecret;
      delete ret.encryptedPassphrase;
      delete ret.iv;
      delete ret.__v;
      return ret;
    }
  }
});

// Compound index for user and exchange
exchangeCredentialsSchema.index({ userId: 1, exchangeName: 1 }, { unique: true });
exchangeCredentialsSchema.index({ userId: 1 });
exchangeCredentialsSchema.index({ exchangeName: 1 });
exchangeCredentialsSchema.index({ lastUsed: 1 });

/**
 * Encryption utility functions
 */
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = Buffer.from(config.encryption.key, 'utf8');

/**
 * Encrypt text
 * @param {string} text - Text to encrypt
 * @returns {Object} Encrypted data with IV
 */
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted
  };
}

/**
 * Decrypt text
 * @param {string} encryptedData - Encrypted data
 * @param {string} ivHex - Initialization vector as hex string
 * @returns {string} Decrypted text
 */
function decrypt(encryptedData, ivHex) {
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Pre-save middleware to encrypt credentials
 */
exchangeCredentialsSchema.pre('save', function(next) {
  try {
    // Only encrypt if credentials are being modified
    if (this.isModified('apiKey') || this.isModified('secret') || this.isModified('passphrase')) {
      const iv = crypto.randomBytes(16).toString('hex');
      this.iv = iv;

      // Encrypt API key
      if (this.apiKey) {
        const encryptedApiKey = encrypt(this.apiKey);
        this.encryptedApiKey = encryptedApiKey.encryptedData;
        this.apiKey = undefined; // Remove plain text
      }

      // Encrypt secret
      if (this.secret) {
        const encryptedSecret = encrypt(this.secret);
        this.encryptedSecret = encryptedSecret.encryptedData;
        this.secret = undefined; // Remove plain text
      }

      // Encrypt passphrase if provided
      if (this.passphrase) {
        const encryptedPassphrase = encrypt(this.passphrase);
        this.encryptedPassphrase = encryptedPassphrase.encryptedData;
        this.passphrase = undefined; // Remove plain text
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Instance method to get decrypted credentials
 * @returns {Object} Decrypted credentials
 */
exchangeCredentialsSchema.methods.getDecryptedCredentials = function() {
  try {
    const credentials = {
      apiKey: decrypt(this.encryptedApiKey, this.iv),
      secret: decrypt(this.encryptedSecret, this.iv)
    };

    // Add passphrase if it exists
    if (this.encryptedPassphrase) {
      credentials.passphrase = decrypt(this.encryptedPassphrase, this.iv);
    }

    return credentials;
  } catch (error) {
    throw new Error('Failed to decrypt credentials');
  }
};

/**
 * Instance method to update last used timestamp
 */
exchangeCredentialsSchema.methods.updateLastUsed = async function() {
  this.lastUsed = new Date();
  await this.save();
};

/**
 * Instance method to update connection status
 * @param {string} status - Connection status
 * @param {string} error - Error message if any
 */
exchangeCredentialsSchema.methods.updateConnectionStatus = async function(status, error = null) {
  this.connectionStatus = status;
  this.lastConnectionTest = new Date();
  
  if (error) {
    this.lastError = error;
  } else {
    this.lastError = undefined;
  }

  await this.save();
};

/**
 * Instance method to update permissions
 * @param {Object} permissionsData - Permissions object
 */
exchangeCredentialsSchema.methods.updatePermissions = async function(permissionsData) {
  this.permissions = {
    ...this.permissions,
    ...permissionsData
  };
  await this.save();
};

/**
 * Static method to find credentials by user and exchange
 * @param {string} userId - User ID
 * @param {string} exchangeName - Exchange name
 * @returns {Promise<Object>} Credentials document
 */
exchangeCredentialsSchema.statics.findByUserAndExchange = function(userId, exchangeName) {
  return this.findOne({ 
    userId: userId, 
    exchangeName: exchangeName.toLowerCase(),
    isActive: true 
  });
};

/**
 * Static method to find all active credentials for user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of credentials documents
 */
exchangeCredentialsSchema.statics.findActiveByUser = function(userId) {
  return this.find({ 
    userId: userId, 
    isActive: true 
  }).sort({ lastUsed: -1 });
};

/**
 * Static method to find credentials that need health check
 * @param {number} hoursOld - Hours since last test
 * @returns {Promise<Array>} Array of credentials documents
 */
exchangeCredentialsSchema.statics.findNeedingHealthCheck = function(hoursOld = 24) {
  const cutoffTime = new Date(Date.now() - (hoursOld * 60 * 60 * 1000));
  return this.find({
    isActive: true,
    $or: [
      { lastConnectionTest: { $lt: cutoffTime } },
      { lastConnectionTest: { $exists: false } }
    ]
  });
};

/**
 * Static method to create credentials with encryption
 * @param {Object} data - Credentials data
 * @returns {Promise<Object>} Created credentials document
 */
exchangeCredentialsSchema.statics.createWithEncryption = async function(data) {
  const {
    userId,
    exchangeName,
    apiKey,
    secret,
    passphrase,
    sandbox = false
  } = data;

  // Get exchange display name
  const displayNames = {
    binance: 'Binance',
    coinbase: 'Coinbase Pro',
    kraken: 'Kraken'
  };

  const credentials = new this({
    userId,
    exchangeName: exchangeName.toLowerCase(),
    exchangeDisplayName: displayNames[exchangeName.toLowerCase()] || exchangeName,
    apiKey, // Will be encrypted in pre-save hook
    secret, // Will be encrypted in pre-save hook
    passphrase, // Will be encrypted in pre-save hook if provided
    sandbox
  });

  return await credentials.save();
};

// Create and export the model
const ExchangeCredentials = mongoose.model('ExchangeCredentials', exchangeCredentialsSchema);

module.exports = ExchangeCredentials;