const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * Authentication Service
 * Handles user authentication, registration, and JWT token management
 */
class AuthService {
  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Registration result
   */
  async register(userData) {
    try {
      const { email, password, firstName, lastName } = userData;

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Create new user (password will be hashed by pre-save middleware)
      const user = new User({
        email,
        password,
        firstName,
        lastName
      });

      await user.save();

      // Generate JWT token
      const token = this.generateToken(user._id);

      logger.info('User registered successfully', {
        userId: user._id,
        email: user.email
      });

      return {
        success: true,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.getFullName(),
          preferences: user.preferences,
          isEmailVerified: user.isEmailVerified,
          createdAt: user.createdAt
        },
        token
      };
    } catch (error) {
      logger.error('User registration failed:', error);
      throw error;
    }
  }

  /**
   * Authenticate user login
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} ip - User IP address
   * @param {string} userAgent - User agent string
   * @returns {Promise<Object>} Login result
   */
  async login(email, password, ip, userAgent) {
    try {
      // Find user and include password for comparison
      const user = await User.findByEmail(email).select('+password');

      if (!user) {
        logger.logAuthEvent(null, 'login', false, ip, userAgent, 'User not found');
        throw new Error('Invalid email or password');
      }

      // Check if user is active
      if (!user.isActive) {
        logger.logAuthEvent(user._id, 'login', false, ip, userAgent, 'Account inactive');
        throw new Error('Account is inactive. Please contact support.');
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        logger.logAuthEvent(user._id, 'login', false, ip, userAgent, 'Invalid password');
        throw new Error('Invalid email or password');
      }

      // Update last login
      await user.updateLastLogin();

      // Generate JWT token
      const token = this.generateToken(user._id);

      logger.logAuthEvent(user._id, 'login', true, ip, userAgent);

      return {
        success: true,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.getFullName(),
          preferences: user.preferences,
          isEmailVerified: user.isEmailVerified,
          stats: user.stats,
          createdAt: user.createdAt
        },
        token
      };
    } catch (error) {
      logger.error('User login failed:', error);
      throw error;
    }
  }

  /**
   * Get user profile by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User profile
   */
  async getUserProfile(userId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new Error('User not found');
      }

      if (!user.isActive) {
        throw new Error('Account is inactive');
      }

      return {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.getFullName(),
        preferences: user.preferences,
        isEmailVerified: user.isEmailVerified,
        stats: user.stats,
        twoFactorAuth: {
          enabled: user.twoFactorAuth.enabled
        },
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
    } catch (error) {
      logger.error('Failed to get user profile:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated user profile
   */
  async updateProfile(userId, updateData) {
    try {
      const allowedUpdates = ['firstName', 'lastName', 'preferences'];
      const updates = {};

      // Filter allowed updates
      for (const key of allowedUpdates) {
        if (updateData[key] !== undefined) {
          updates[key] = updateData[key];
        }
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!user) {
        throw new Error('User not found');
      }

      logger.info('User profile updated', {
        userId: user._id,
        updatedFields: Object.keys(updates)
      });

      return {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.getFullName(),
        preferences: user.preferences,
        isEmailVerified: user.isEmailVerified,
        updatedAt: user.updatedAt
      };
    } catch (error) {
      logger.error('Failed to update user profile:', error);
      throw error;
    }
  }

  /**
   * Change user password
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Result
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findById(userId).select('+password');

      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Update password (will be hashed by pre-save middleware)
      user.password = newPassword;
      await user.save();

      logger.info('User password changed', { userId });

      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      logger.error('Failed to change password:', error);
      throw error;
    }
  }

  /**
   * Generate JWT token
   * @param {string} userId - User ID
   * @returns {string} JWT token
   */
  generateToken(userId) {
    return jwt.sign({ userId }, config.jwt.secret, { expiresIn: config.jwt.expire });
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Object} Decoded token data
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  /**
   * Generate refresh token
   * @param {string} userId - User ID
   * @returns {string} Refresh token
   */
  generateRefreshToken(userId) {
    return jwt.sign({ userId, type: 'refresh' }, config.jwt.secret, {
      expiresIn: config.jwt.refreshExpire
    });
  }

  /**
   * Refresh access token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New access token
   */
  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.secret);

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      const newToken = this.generateToken(user._id);

      logger.info('Token refreshed', { userId: user._id });

      return {
        success: true,
        token: newToken,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        }
      };
    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Deactivate user account
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result
   */
  async deactivateAccount(userId) {
    try {
      const user = await User.findByIdAndUpdate(userId, { isActive: false }, { new: true });

      if (!user) {
        throw new Error('User not found');
      }

      logger.info('User account deactivated', { userId });

      return {
        success: true,
        message: 'Account deactivated successfully'
      };
    } catch (error) {
      logger.error('Failed to deactivate account:', error);
      throw error;
    }
  }

  /**
   * Get user statistics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User statistics
   */
  async getUserStats(userId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new Error('User not found');
      }

      return {
        totalTrades: user.stats.totalTrades,
        totalVolume: user.stats.totalVolume,
        connectedExchanges: user.stats.connectedExchanges,
        lastLoginAt: user.stats.lastLoginAt,
        loginCount: user.stats.loginCount,
        accountAge: Math.floor((Date.now() - user.createdAt) / (1000 * 60 * 60 * 24)) // days
      };
    } catch (error) {
      logger.error('Failed to get user stats:', error);
      throw error;
    }
  }

  /**
   * Send email verification token
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result
   */
  async sendEmailVerification(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.isEmailVerified) {
        throw new Error('Email is already verified');
      }

      // Generate verification token
      const crypto = require('crypto');
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      user.emailVerificationToken = verificationToken;
      user.emailVerificationTokenExpires = tokenExpires;
      await user.save();

      logger.info('Email verification token generated', {
        userId: user._id,
        email: user.email
      });

      // In a real implementation, send email here
      // For now, return the token for testing
      return {
        success: true,
        message: 'Email verification token sent',
        verificationToken // Remove this in production
      };
    } catch (error) {
      logger.error('Failed to send email verification:', error);
      throw error;
    }
  }

  /**
   * Verify email with token
   * @param {string} token - Verification token
   * @returns {Promise<Object>} Result
   */
  async verifyEmail(token) {
    try {
      const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationTokenExpires: { $gt: new Date() }
      });

      if (!user) {
        throw new Error('Invalid or expired verification token');
      }

      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationTokenExpires = undefined;
      await user.save();

      logger.info('Email verified successfully', {
        userId: user._id,
        email: user.email
      });

      return {
        success: true,
        message: 'Email verified successfully'
      };
    } catch (error) {
      logger.error('Email verification failed:', error);
      throw error;
    }
  }

  /**
   * Send password reset token
   * @param {string} email - User email
   * @returns {Promise<Object>} Result
   */
  async sendPasswordReset(email) {
    try {
      const user = await User.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists for security
        return {
          success: true,
          message: 'If the email exists, a password reset link has been sent'
        };
      }

      // Generate reset token
      const crypto = require('crypto');
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      user.passwordResetToken = resetToken;
      user.passwordResetTokenExpires = tokenExpires;
      await user.save();

      logger.info('Password reset token generated', {
        userId: user._id,
        email: user.email
      });

      // In a real implementation, send email here
      // For now, return the token for testing
      return {
        success: true,
        message: 'If the email exists, a password reset link has been sent',
        resetToken // Remove this in production
      };
    } catch (error) {
      logger.error('Failed to send password reset:', error);
      throw error;
    }
  }

  /**
   * Reset password with token
   * @param {string} token - Reset token
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Result
   */
  async resetPassword(token, newPassword) {
    try {
      const user = await User.findOne({
        passwordResetToken: token,
        passwordResetTokenExpires: { $gt: new Date() }
      });

      if (!user) {
        throw new Error('Invalid or expired reset token');
      }

      user.password = newPassword; // Will be hashed by pre-save middleware
      user.passwordResetToken = undefined;
      user.passwordResetTokenExpires = undefined;
      await user.save();

      logger.info('Password reset successfully', {
        userId: user._id,
        email: user.email
      });

      return {
        success: true,
        message: 'Password reset successfully'
      };
    } catch (error) {
      logger.error('Password reset failed:', error);
      throw error;
    }
  }

  /**
   * Setup two-factor authentication
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Setup data
   */
  async setupTwoFactor(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.twoFactorAuth.enabled) {
        throw new Error('Two-factor authentication is already enabled');
      }

      // Generate TOTP secret
      const speakeasy = require('speakeasy');
      const secret = speakeasy.generateSecret({
        name: `Wire-Trader (${user.email})`,
        issuer: 'Wire-Trader'
      });

      // Store secret temporarily (will be confirmed when user verifies)
      user.twoFactorAuth.secret = secret.base32;
      await user.save();

      logger.info('Two-factor authentication setup initiated', {
        userId: user._id,
        email: user.email
      });

      return {
        success: true,
        secret: secret.base32,
        qrCode: secret.otpauth_url,
        manualEntryKey: secret.base32
      };
    } catch (error) {
      logger.error('2FA setup failed:', error);
      throw error;
    }
  }

  /**
   * Verify and enable two-factor authentication
   * @param {string} userId - User ID
   * @param {string} token - TOTP token
   * @returns {Promise<Object>} Result
   */
  async verifyTwoFactor(userId, token) {
    try {
      const user = await User.findById(userId).select('+twoFactorAuth.secret');
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.twoFactorAuth.secret) {
        throw new Error('Two-factor authentication not set up');
      }

      const speakeasy = require('speakeasy');
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorAuth.secret,
        encoding: 'base32',
        token: token,
        window: 2
      });

      if (!verified) {
        throw new Error('Invalid verification code');
      }

      user.twoFactorAuth.enabled = true;
      await user.save();

      logger.info('Two-factor authentication enabled', {
        userId: user._id,
        email: user.email
      });

      return {
        success: true,
        message: 'Two-factor authentication enabled successfully'
      };
    } catch (error) {
      logger.error('2FA verification failed:', error);
      throw error;
    }
  }

  /**
   * Disable two-factor authentication
   * @param {string} userId - User ID
   * @param {string} token - TOTP token
   * @returns {Promise<Object>} Result
   */
  async disableTwoFactor(userId, token) {
    try {
      const user = await User.findById(userId).select('+twoFactorAuth.secret');
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.twoFactorAuth.enabled) {
        throw new Error('Two-factor authentication is not enabled');
      }

      const speakeasy = require('speakeasy');
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorAuth.secret,
        encoding: 'base32',
        token: token,
        window: 2
      });

      if (!verified) {
        throw new Error('Invalid verification code');
      }

      user.twoFactorAuth.enabled = false;
      user.twoFactorAuth.secret = undefined;
      await user.save();

      logger.info('Two-factor authentication disabled', {
        userId: user._id,
        email: user.email
      });

      return {
        success: true,
        message: 'Two-factor authentication disabled successfully'
      };
    } catch (error) {
      logger.error('2FA disable failed:', error);
      throw error;
    }
  }

  /**
   * Validate user permissions
   * @param {string} userId - User ID
   * @param {string} permission - Permission to check
   * @returns {Promise<boolean>} Permission status
   */
  async hasPermission(userId, permission) {
    try {
      const user = await User.findById(userId);

      if (!user || !user.isActive) {
        return false;
      }

      // Add permission logic here based on user roles/subscriptions
      // For now, all active users have basic permissions
      const basicPermissions = ['trade', 'view_balance', 'manage_exchanges'];

      return basicPermissions.includes(permission);
    } catch (error) {
      logger.error('Permission check failed:', error);
      return false;
    }
  }
}

// Create singleton instance
const authService = new AuthService();

module.exports = authService;
