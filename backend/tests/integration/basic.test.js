const request = require('supertest');
const mongoose = require('mongoose');

// Simple test to verify basic functionality
describe('Backend Basic Tests', () => {
  it('should connect to test database', async () => {
    expect(mongoose.connection.readyState).toBe(1);
  });

  it('should have required environment variables', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.JWT_SECRET).toBeDefined();
  });

  it('should handle basic math operations', () => {
    expect(2 + 2).toBe(4);
    expect(Math.max(1, 2, 3)).toBe(3);
  });
});

// Test User model basic functionality
describe('User Model', () => {
  const User = require('../../models/User');

  it('should create a user with required fields', async () => {
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword',
      dateOfBirth: new Date('1990-01-01'),
      country: 'US'
    };

    const user = new User(userData);
    const savedUser = await user.save();

    expect(savedUser._id).toBeDefined();
    expect(savedUser.username).toBe(userData.username);
    expect(savedUser.email).toBe(userData.email);
    expect(savedUser.status).toBe('active'); // Default value
  });

  it('should validate required fields', async () => {
    const user = new User({});
    
    let error;
    try {
      await user.save();
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.name).toBe('ValidationError');
  });

  it('should have default wallet balances', async () => {
    const user = new User({
      username: 'testuser2',
      email: 'test2@example.com',
      password: 'hashedpassword',
      dateOfBirth: new Date('1990-01-01'),
      country: 'US'
    });

    const savedUser = await user.save();
    
    expect(savedUser.wallet).toBeDefined();
    expect(savedUser.wallet.USD.balance).toBe(0);
    expect(savedUser.wallet.BTC.balance).toBe(0);
  });
});

// Test Transaction model
describe('Transaction Model', () => {
  const Transaction = require('../../models/Transaction');
  const User = require('../../models/User');
  
  let userId;

  beforeEach(async () => {
    const user = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword',
      dateOfBirth: new Date('1990-01-01'),
      country: 'US'
    });
    userId = user._id;
  });

  it('should create a transaction', async () => {
    const transactionData = {
      userId,
      type: 'deposit',
      amount: 100,
      currency: 'USD',
      status: 'completed'
    };

    const transaction = await Transaction.create(transactionData);

    expect(transaction._id).toBeDefined();
    expect(transaction.userId.toString()).toBe(userId.toString());
    expect(transaction.type).toBe('deposit');
    expect(transaction.amount).toBe(100);
  });

  it('should validate transaction type', async () => {
    const transactionData = {
      userId,
      type: 'invalid_type',
      amount: 100,
      currency: 'USD',
      status: 'completed'
    };

    let error;
    try {
      await Transaction.create(transactionData);
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.name).toBe('ValidationError');
  });
});

