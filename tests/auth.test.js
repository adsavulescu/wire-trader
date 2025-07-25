const authService = require('../src/services/auth/authService');
const User = require('../src/models/User');

describe('Authentication Service', () => {
  describe('User Registration', () => {
    test('should register a new user successfully', async () => {
      const userData = global.testConfig.testUser;
      
      const result = await authService.register(userData);
      
      expect(result.success).toBe(true);
      expect(result.user.email).toBe(userData.email);
      expect(result.user.firstName).toBe(userData.firstName);
      expect(result.user.lastName).toBe(userData.lastName);
      expect(result.user.fullName).toBe(`${userData.firstName} ${userData.lastName}`);
      expect(result.token).toBeTruthy();
      expect(result.user.id).toBeTruthy();
    });

    test('should fail to register user with existing email', async () => {
      const userData = global.testConfig.testUser;
      
      // Register first user
      await authService.register(userData);
      
      // Try to register same email again
      await expect(authService.register(userData))
        .rejects
        .toThrow('User with this email already exists');
    });

    test('should hash user password during registration', async () => {
      const userData = global.testConfig.testUser;
      
      await authService.register(userData);
      
      const user = await User.findByEmail(userData.email).select('+password');
      expect(user.password).not.toBe(userData.password);
      expect(user.password).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash pattern
    });
  });

  describe('User Login', () => {
    beforeEach(async () => {
      // Create test user before each login test
      await authService.register(global.testConfig.testUser);
    });

    test('should login user with correct credentials', async () => {
      const { email, password } = global.testConfig.testUser;
      
      const result = await authService.login(email, password, '127.0.0.1', 'test-agent');
      
      expect(result.success).toBe(true);
      expect(result.user.email).toBe(email);
      expect(result.token).toBeTruthy();
    });

    test('should fail login with incorrect password', async () => {
      const { email } = global.testConfig.testUser;
      
      await expect(authService.login(email, 'wrongpassword', '127.0.0.1', 'test-agent'))
        .rejects
        .toThrow('Invalid email or password');
    });

    test('should fail login with non-existent email', async () => {
      await expect(authService.login('nonexistent@test.com', 'password', '127.0.0.1', 'test-agent'))
        .rejects
        .toThrow('Invalid email or password');
    });

    test('should update login statistics on successful login', async () => {
      const { email, password } = global.testConfig.testUser;
      
      const beforeLogin = await User.findByEmail(email);
      const loginCountBefore = beforeLogin.stats.loginCount;
      
      await authService.login(email, password, '127.0.0.1', 'test-agent');
      
      const afterLogin = await User.findByEmail(email);
      expect(afterLogin.stats.loginCount).toBe(loginCountBefore + 1);
      expect(afterLogin.stats.lastLoginAt).toBeTruthy();
    });
  });

  describe('JWT Token Management', () => {
    test('should generate valid JWT token', () => {
      const userId = '507f1f77bcf86cd799439011';
      const token = authService.generateToken(userId);
      
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    test('should verify valid JWT token', () => {
      const userId = '507f1f77bcf86cd799439011';
      const token = authService.generateToken(userId);
      
      const decoded = authService.verifyToken(token);
      
      expect(decoded.userId).toBe(userId);
      expect(decoded.iat).toBeTruthy();
      expect(decoded.exp).toBeTruthy();
    });

    test('should fail to verify invalid token', () => {
      expect(() => authService.verifyToken('invalid-token'))
        .toThrow('Invalid token');
    });

    test('should generate refresh token', () => {
      const userId = '507f1f77bcf86cd799439011';
      const refreshToken = authService.generateRefreshToken(userId);
      
      expect(refreshToken).toBeTruthy();
      expect(typeof refreshToken).toBe('string');
    });
  });

  describe('User Profile Management', () => {
    let userId;

    beforeEach(async () => {
      // Create test user and get ID
      const result = await authService.register(global.testConfig.testUser);
      userId = result.user.id;
    });

    test('should get user profile', async () => {
      const profile = await authService.getUserProfile(userId);
      
      expect(profile.id).toBe(userId);
      expect(profile.email).toBe(global.testConfig.testUser.email);
      expect(profile.firstName).toBe(global.testConfig.testUser.firstName);
      expect(profile.lastName).toBe(global.testConfig.testUser.lastName);
    });

    test('should update user profile', async () => {
      const updateData = {
        firstName: 'Updated',
        preferences: {
          theme: 'dark',
          baseCurrency: 'EUR'
        }
      };
      
      const updatedProfile = await authService.updateProfile(userId, updateData);
      
      expect(updatedProfile.firstName).toBe('Updated');
      expect(updatedProfile.preferences.theme).toBe('dark');
      expect(updatedProfile.preferences.baseCurrency).toBe('EUR');
    });

    test('should change user password', async () => {
      const currentPassword = global.testConfig.testUser.password;
      const newPassword = 'newpassword123';
      
      const result = await authService.changePassword(userId, currentPassword, newPassword);
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Password changed successfully');
      
      // Verify new password works
      const { email } = global.testConfig.testUser;
      const loginResult = await authService.login(email, newPassword, '127.0.0.1', 'test-agent');
      expect(loginResult.success).toBe(true);
    });

    test('should fail to change password with incorrect current password', async () => {
      await expect(authService.changePassword(userId, 'wrongpassword', 'newpassword123'))
        .rejects
        .toThrow('Current password is incorrect');
    });
  });

  describe('User Statistics', () => {
    let userId;

    beforeEach(async () => {
      const result = await authService.register(global.testConfig.testUser);
      userId = result.user.id;
    });

    test('should get user statistics', async () => {
      const stats = await authService.getUserStats(userId);
      
      expect(stats).toHaveProperty('totalTrades');
      expect(stats).toHaveProperty('totalVolume');
      expect(stats).toHaveProperty('connectedExchanges');
      expect(stats).toHaveProperty('loginCount');
      expect(stats).toHaveProperty('accountAge');
      expect(typeof stats.accountAge).toBe('number');
    });
  });

  describe('Permissions', () => {
    let userId;

    beforeEach(async () => {
      const result = await authService.register(global.testConfig.testUser);
      userId = result.user.id;
    });

    test('should check user permissions', async () => {
      const hasTradePermission = await authService.hasPermission(userId, 'trade');
      const hasViewPermission = await authService.hasPermission(userId, 'view_balance');
      const hasManagePermission = await authService.hasPermission(userId, 'manage_exchanges');
      
      expect(hasTradePermission).toBe(true);
      expect(hasViewPermission).toBe(true);
      expect(hasManagePermission).toBe(true);
    });

    test('should return false for invalid permissions', async () => {
      const hasInvalidPermission = await authService.hasPermission(userId, 'invalid_permission');
      
      expect(hasInvalidPermission).toBe(false);
    });
  });
});