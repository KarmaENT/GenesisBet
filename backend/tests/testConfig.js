// Test environment configuration
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.MONGO_URI = 'mongodb://localhost:27017/genesisbet-test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.DISABLE_REDIS = 'true'; // Disable Redis in tests

// Mock Redis client for tests
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1)
  }))
}));

// Mock SecurityMonitor to prevent Redis dependency
jest.mock('../utils/securityMonitor', () => ({
  SecurityMonitor: {
    logEvent: jest.fn().mockResolvedValue(true),
    getUserEvents: jest.fn().mockResolvedValue([]),
    getEvents: jest.fn().mockResolvedValue([])
  }
}));

