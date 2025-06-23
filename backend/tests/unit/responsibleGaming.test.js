const ResponsibleGaming = require('../../utils/compliance/responsibleGaming');
const User = require('../../models/User');
const GameSession = require('../../models/GameSession');
const Transaction = require('../../models/Transaction');

describe('Responsible Gaming Utility', () => {
  let userId;
  let user;

  beforeEach(async () => {
    user = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword',
      dateOfBirth: new Date('1990-01-01'),
      country: 'US',
      status: 'active',
      limits: {
        dailyDeposit: 1000,
        dailyWithdrawal: 5000,
        sessionTime: 120
      },
      wallet: {
        USD: { balance: 500 }
      }
    });
    userId = user._id;
  });

  describe('checkDailyDepositLimit', () => {
    it('should allow deposit within limit', async () => {
      const result = await ResponsibleGaming.checkDailyDepositLimit(userId, 500);
      
      expect(result.allowed).toBe(true);
    });

    it('should reject deposit exceeding limit', async () => {
      // Create a deposit today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      await Transaction.create({
        userId,
        type: 'deposit',
        amount: 800,
        status: 'completed',
        currency: 'USD',
        createdAt: new Date(today.getTime() + 1000)
      });

      const result = await ResponsibleGaming.checkDailyDepositLimit(userId, 300);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Daily deposit limit exceeded');
      expect(result.currentTotal).toBe(800);
      expect(result.limit).toBe(1000);
      expect(result.remaining).toBe(200);
    });

    it('should allow deposit exactly at limit', async () => {
      const result = await ResponsibleGaming.checkDailyDepositLimit(userId, 1000);
      
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkSelfExclusion', () => {
    it('should allow access for non-excluded user', async () => {
      const result = await ResponsibleGaming.checkSelfExclusion(userId);
      
      expect(result.excluded).toBe(false);
    });

    it('should block permanently excluded user', async () => {
      await User.findByIdAndUpdate(userId, {
        'responsibleGaming.selfExclusion.permanent': true
      });

      const result = await ResponsibleGaming.checkSelfExclusion(userId);
      
      expect(result.excluded).toBe(true);
      expect(result.type).toBe('permanent');
    });

    it('should block temporarily excluded user', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      
      await User.findByIdAndUpdate(userId, {
        'responsibleGaming.selfExclusion.until': futureDate
      });

      const result = await ResponsibleGaming.checkSelfExclusion(userId);
      
      expect(result.excluded).toBe(true);
      expect(result.type).toBe('temporary');
      expect(result.until).toEqual(futureDate);
    });

    it('should allow access after exclusion period expires', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      await User.findByIdAndUpdate(userId, {
        'responsibleGaming.selfExclusion.until': pastDate
      });

      const result = await ResponsibleGaming.checkSelfExclusion(userId);
      
      expect(result.excluded).toBe(false);
    });
  });

  describe('detectProblemGambling', () => {
    it('should detect low risk for normal gambling', async () => {
      // Create normal gaming pattern
      await GameSession.create({
        userId,
        gameType: 'dice',
        betAmount: 10,
        winAmount: 15,
        status: 'completed',
        startTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        endTime: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
      });

      const result = await ResponsibleGaming.detectProblemGambling(userId);
      
      expect(result.risk).toBe('minimal');
      expect(result.score).toBe(0);
      expect(result.factors.length).toBe(0);
    });

    it('should detect high risk for excessive gambling', async () => {
      // Create excessive deposits
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (let i = 0; i < 12; i++) {
        await Transaction.create({
          userId,
          type: 'deposit',
          amount: 100,
          status: 'completed',
          currency: 'USD',
          createdAt: new Date(today.getTime() + i * 60 * 60 * 1000)
        });
      }

      // Create long gaming sessions
      for (let i = 0; i < 5; i++) {
        const startTime = new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000);
        const endTime = new Date(startTime.getTime() + 5 * 60 * 60 * 1000); // 5 hour sessions
        
        await GameSession.create({
          userId,
          gameType: 'crash',
          betAmount: 50,
          winAmount: 0, // All losses
          status: 'completed',
          startTime,
          endTime
        });
      }

      const result = await ResponsibleGaming.detectProblemGambling(userId);
      
      expect(result.risk).toBe('high');
      expect(result.score).toBeGreaterThan(5);
      expect(result.factors.length).toBeGreaterThan(0);
    });
  });

  describe('applySelfExclusion', () => {
    it('should apply temporary self-exclusion', async () => {
      const result = await ResponsibleGaming.applySelfExclusion(userId, 'temporary', 30);
      
      expect(result.success).toBe(true);
      
      const updatedUser = await User.findById(userId);
      expect(updatedUser.status).toBe('suspended');
      expect(updatedUser.responsibleGaming.selfExclusion.until).toBeDefined();
    });

    it('should apply permanent self-exclusion', async () => {
      const result = await ResponsibleGaming.applySelfExclusion(userId, 'permanent');
      
      expect(result.success).toBe(true);
      
      const updatedUser = await User.findById(userId);
      expect(updatedUser.status).toBe('suspended');
      expect(updatedUser.responsibleGaming.selfExclusion.permanent).toBe(true);
    });

    it('should apply cooling-off period', async () => {
      const result = await ResponsibleGaming.applySelfExclusion(userId, 'cooling-off', 48);
      
      expect(result.success).toBe(true);
      
      const updatedUser = await User.findById(userId);
      expect(updatedUser.status).toBe('suspended');
      expect(updatedUser.responsibleGaming.coolingOff.until).toBeDefined();
    });
  });

  describe('updateLimits', () => {
    it('should update user limits successfully', async () => {
      const newLimits = {
        dailyDeposit: 500,
        sessionTime: 60
      };

      const result = await ResponsibleGaming.updateLimits(userId, newLimits);
      
      expect(result.success).toBe(true);
      
      const updatedUser = await User.findById(userId);
      expect(updatedUser.limits.dailyDeposit).toBe(500);
      expect(updatedUser.limits.sessionTime).toBe(60);
      expect(updatedUser.limits.dailyWithdrawal).toBe(5000); // Should remain unchanged
    });

    it('should reject negative limits', async () => {
      const newLimits = {
        dailyDeposit: -100
      };

      const result = await ResponsibleGaming.updateLimits(userId, newLimits);
      
      expect(result.success).toBe(true); // Function doesn't update invalid values
      
      const updatedUser = await User.findById(userId);
      expect(updatedUser.limits.dailyDeposit).toBe(1000); // Should remain unchanged
    });
  });

  describe('sendRealityCheck', () => {
    beforeEach(async () => {
      // Set last login to simulate session start
      await User.findByIdAndUpdate(userId, {
        lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      });

      // Create some game sessions
      await GameSession.create({
        userId,
        gameType: 'dice',
        betAmount: 50,
        winAmount: 30,
        status: 'completed',
        startTime: new Date(Date.now() - 90 * 60 * 1000) // 90 minutes ago
      });

      await GameSession.create({
        userId,
        gameType: 'crash',
        betAmount: 25,
        winAmount: 0,
        status: 'completed',
        startTime: new Date(Date.now() - 60 * 60 * 1000) // 60 minutes ago
      });
    });

    it('should generate reality check with session statistics', async () => {
      const result = await ResponsibleGaming.sendRealityCheck(userId);
      
      expect(result).toBeTruthy();
      expect(result.sessionDuration).toBeGreaterThan(100); // More than 100 minutes
      expect(result.gamesPlayed).toBe(2);
      expect(result.totalBet).toBe(75);
      expect(result.totalWin).toBe(30);
      expect(result.netResult).toBe(-45); // Loss of 45
    });
  });
});

