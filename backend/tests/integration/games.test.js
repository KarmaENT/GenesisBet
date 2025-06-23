const request = require('supertest');
const app = require('../../server');
const User = require('../../models/User');
const GameSession = require('../../models/GameSession');
const bcrypt = require('bcryptjs');

describe('Games Routes', () => {
  let authToken;
  let userId;

  beforeEach(async () => {
    // Create and login user
    const hashedPassword = await bcrypt.hash('Password123!', 12);
    const user = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: hashedPassword,
      dateOfBirth: new Date('1990-01-01'),
      country: 'US',
      status: 'active',
      wallet: {
        USD: { balance: 1000 }
      }
    });
    userId = user._id;

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Password123!'
      });

    authToken = loginResponse.body.data.token;
  });

  describe('GET /api/games', () => {
    it('should get list of available games', async () => {
      const response = await request(app)
        .get('/api/games')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.games).toBeDefined();
      expect(Array.isArray(response.body.data.games)).toBe(true);
    });

    it('should filter games by category', async () => {
      const response = await request(app)
        .get('/api/games?category=provably-fair')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.games).toBeDefined();
    });
  });

  describe('POST /api/games/crash/play', () => {
    it('should start a crash game successfully', async () => {
      const gameData = {
        betAmount: 10,
        autoCashout: 2.0
      };

      const response = await request(app)
        .post('/api/games/crash/play')
        .set('Authorization', `Bearer ${authToken}`)
        .send(gameData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.gameId).toBeDefined();
      expect(response.body.data.serverSeed).toBeDefined();
      expect(response.body.data.clientSeed).toBeDefined();

      // Verify game session was created
      const gameSession = await GameSession.findById(response.body.data.gameId);
      expect(gameSession).toBeTruthy();
      expect(gameSession.userId.toString()).toBe(userId.toString());
      expect(gameSession.betAmount).toBe(gameData.betAmount);
    });

    it('should not allow bet with insufficient balance', async () => {
      const gameData = {
        betAmount: 2000, // More than user balance
        autoCashout: 2.0
      };

      const response = await request(app)
        .post('/api/games/crash/play')
        .set('Authorization', `Bearer ${authToken}`)
        .send(gameData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Insufficient balance');
    });

    it('should not allow invalid bet amount', async () => {
      const gameData = {
        betAmount: -10, // Negative amount
        autoCashout: 2.0
      };

      const response = await request(app)
        .post('/api/games/crash/play')
        .set('Authorization', `Bearer ${authToken}`)
        .send(gameData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/games/dice/play', () => {
    it('should play dice game successfully', async () => {
      const gameData = {
        betAmount: 10,
        target: 50,
        isOver: true
      };

      const response = await request(app)
        .post('/api/games/dice/play')
        .set('Authorization', `Bearer ${authToken}`)
        .send(gameData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.result).toBeDefined();
      expect(response.body.data.isWin).toBeDefined();
      expect(response.body.data.payout).toBeDefined();
      expect(response.body.data.verification).toBeDefined();
    });

    it('should not allow invalid target value', async () => {
      const gameData = {
        betAmount: 10,
        target: 150, // Invalid target (>100)
        isOver: true
      };

      const response = await request(app)
        .post('/api/games/dice/play')
        .set('Authorization', `Bearer ${authToken}`)
        .send(gameData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/games/verify', () => {
    it('should verify game result', async () => {
      // First play a game
      const gameResponse = await request(app)
        .post('/api/games/dice/play')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          betAmount: 10,
          target: 50,
          isOver: true
        });

      const gameData = gameResponse.body.data;

      // Then verify it
      const verifyResponse = await request(app)
        .post('/api/games/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          serverSeed: gameData.verification.serverSeed,
          clientSeed: gameData.verification.clientSeed,
          nonce: gameData.verification.nonce,
          gameType: 'dice'
        })
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.data.isValid).toBe(true);
      expect(verifyResponse.body.data.result).toBeDefined();
    });

    it('should detect invalid verification data', async () => {
      const verifyResponse = await request(app)
        .post('/api/games/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          serverSeed: 'invalid',
          clientSeed: 'invalid',
          nonce: 1,
          gameType: 'dice'
        })
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.data.isValid).toBe(false);
    });
  });

  describe('GET /api/games/history', () => {
    beforeEach(async () => {
      // Create some game sessions
      await GameSession.create({
        userId,
        gameType: 'dice',
        betAmount: 10,
        winAmount: 20,
        status: 'completed',
        result: { value: 75, isWin: true },
        provablyFair: {
          serverSeed: 'test-server-seed',
          clientSeed: 'test-client-seed',
          nonce: 1
        }
      });

      await GameSession.create({
        userId,
        gameType: 'crash',
        betAmount: 5,
        winAmount: 0,
        status: 'completed',
        result: { multiplier: 1.5, cashedOut: false },
        provablyFair: {
          serverSeed: 'test-server-seed-2',
          clientSeed: 'test-client-seed-2',
          nonce: 2
        }
      });
    });

    it('should get user game history', async () => {
      const response = await request(app)
        .get('/api/games/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.games).toBeDefined();
      expect(response.body.data.games.length).toBe(2);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should filter history by game type', async () => {
      const response = await request(app)
        .get('/api/games/history?gameType=dice')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.games.length).toBe(1);
      expect(response.body.data.games[0].gameType).toBe('dice');
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/games/history?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.games.length).toBe(1);
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.totalPages).toBe(2);
    });
  });
});

