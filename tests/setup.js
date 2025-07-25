const database = require('../src/config/database');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.ENCRYPTION_KEY = 'test-32-character-encryption-key!';

// Setup test database
beforeAll(async () => {
  try {
    // Connect to test database
    await database.connect();
  } catch (error) {
    console.error('Test database setup failed:', error);
    process.exit(1);
  }
});

// Cleanup after each test
afterEach(async () => {
  try {
    // Clear test database
    if (process.env.NODE_ENV === 'test') {
      await database.clearDatabase();
    }
  } catch (error) {
    console.error('Test cleanup failed:', error);
  }
});

// Cleanup after all tests
afterAll(async () => {
  try {
    // Disconnect from test database
    await database.disconnect();
  } catch (error) {
    console.error('Test database cleanup failed:', error);
  }
});

// Global test helpers
global.testConfig = {
  testUser: {
    email: 'test@wire-trader.com',
    password: 'testpassword123',
    firstName: 'Test',
    lastName: 'User'
  },
  testExchange: {
    exchangeName: 'binance',
    apiKey: 'test-api-key',
    secret: 'test-secret-key',
    sandbox: true
  }
};