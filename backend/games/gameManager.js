const CrashGame = require('./engines/crashGame');
const DiceGame = require('./engines/diceGame');
const PlinkoGame = require('./engines/plinkoGame');
const GameSession = require('../models/GameSession');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { SecurityMonitor } = require('../utils/securityMonitor');

class GameManager {
  constructor() {
    this.crashGame = new CrashGame();
    this.diceGame = new DiceGame();
    this.plinkoGame = new PlinkoGame();
    this.activeSessions = new Map(); // sessionId -> session data
    
    // Initialize crash game
    this.initializeCrashGame();
  }

  /**
   * Initialize crash game with event listeners
   */
  initializeCrashGame() {
    // Start the first crash game
    this.crashGame.startNewGame();

    // Set up event listeners for crash game
    this.crashGame.on('gameStarted', (data) => {
      console.log('Crash game started:', data.gameId);
    });

    this.crashGame.on('multiplierUpdate', (data) => {
      // Broadcast to connected clients via WebSocket
      this.broadcastCrashUpdate(data);
      
      // Check for auto cash outs
      this.crashGame.checkAutoCashOuts();
    });

    this.crashGame.on('gameCrashed', (data) => {
      console.log('Crash game ended:', data.gameId, 'at', data.crashPoint);
      this.processCrashGameResults(data);
    });

    this.crashGame.on('playerCashedOut', (data) => {
      console.log('Player cashed out:', data.userId, 'at', data.multiplier);
      this.processCashOut(data);
    });
  }

  /**
   * Start a new game session
   * @param {string} userId - User ID
   * @param {string} gameType - Type of game
   * @param {number} betAmount - Bet amount
   * @param {string} currency - Currency
   * @param {Object} gameParams - Game-specific parameters
   * @returns {Object} Session result
   */
  async startGameSession(userId, gameType, betAmount, currency, gameParams = {}) {
    try {
      // Validate user and balance
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.status !== 'active') {
        throw new Error('Account is not active');
      }

      // Check user balance
      const balance = user.wallet.balance[currency] || 0;
      if (balance < betAmount) {
        throw new Error('Insufficient balance');
      }

      // Check responsible gambling limits
      await this.checkGamblingLimits(user, betAmount, currency);

      // Create game session
      const sessionId = this.generateSessionId();
      const gameSession = new GameSession({
        sessionId,
        userId,
        gameId: null, // Will be set based on game type
        status: 'active',
        betAmount,
        currency,
        provablyFair: {
          serverSeed: '',
          serverSeedHash: '',
          clientSeed: gameParams.clientSeed || '',
          nonce: gameParams.nonce || 0,
          revealed: false
        },
        gameData: gameParams,
        metadata: {
          userAgent: gameParams.userAgent,
          ipAddress: gameParams.ipAddress,
          device: gameParams.device,
          platform: gameParams.platform
        }
      });

      // Deduct bet amount from user balance
      await this.deductBalance(userId, betAmount, currency);

      // Create bet transaction
      await this.createTransaction(userId, 'bet', betAmount, currency, {
        sessionId,
        gameType
      });

      // Store active session
      this.activeSessions.set(sessionId, {
        session: gameSession,
        gameType,
        startTime: Date.now()
      });

      return {
        success: true,
        sessionId,
        gameType,
        betAmount,
        currency,
        balance: user.wallet.balance[currency] - betAmount
      };

    } catch (error) {
      console.error('Error starting game session:', error);
      throw error;
    }
  }

  /**
   * Play crash game
   * @param {string} userId - User ID
   * @param {number} betAmount - Bet amount
   * @param {string} currency - Currency
   * @param {number} autoCashOut - Auto cash out multiplier (optional)
   * @returns {Object} Game result
   */
  async playCrash(userId, betAmount, currency, autoCashOut = null) {
    try {
      // Start game session
      const sessionResult = await this.startGameSession(userId, 'crash', betAmount, currency, {
        autoCashOut
      });

      // Place bet in crash game
      const betResult = this.crashGame.placeBet(userId, betAmount, autoCashOut);

      // Update session with game ID
      const sessionData = this.activeSessions.get(sessionResult.sessionId);
      if (sessionData) {
        sessionData.session.gameId = betResult.gameId;
      }

      return {
        ...sessionResult,
        gameId: betResult.gameId,
        autoCashOut,
        gameState: this.crashGame.getGameState()
      };

    } catch (error) {
      console.error('Error playing crash:', error);
      throw error;
    }
  }

  /**
   * Cash out from crash game
   * @param {string} userId - User ID
   * @returns {Object} Cash out result
   */
  async crashCashOut(userId) {
    try {
      const result = this.crashGame.cashOut(userId);
      
      // Process the cash out
      await this.processCashOut({
        userId,
        multiplier: result.multiplier,
        payout: result.payout,
        profit: result.profit
      });

      return result;

    } catch (error) {
      console.error('Error cashing out:', error);
      throw error;
    }
  }

  /**
   * Play dice game
   * @param {string} userId - User ID
   * @param {number} betAmount - Bet amount
   * @param {string} currency - Currency
   * @param {number} target - Target number
   * @param {string} direction - 'over' or 'under'
   * @param {string} clientSeed - Client seed (optional)
   * @param {number} nonce - Nonce
   * @returns {Object} Game result
   */
  async playDice(userId, betAmount, currency, target, direction, clientSeed = null, nonce = 0) {
    try {
      // Start game session
      const sessionResult = await this.startGameSession(userId, 'dice', betAmount, currency, {
        target,
        direction,
        clientSeed,
        nonce
      });

      // Play dice game
      const gameResult = await this.diceGame.playGame(userId, betAmount, target, direction, clientSeed, nonce);

      // Complete the session
      await this.completeGameSession(sessionResult.sessionId, gameResult);

      return {
        ...sessionResult,
        ...gameResult
      };

    } catch (error) {
      console.error('Error playing dice:', error);
      throw error;
    }
  }

  /**
   * Play Plinko game
   * @param {string} userId - User ID
   * @param {number} betAmount - Bet amount
   * @param {string} currency - Currency
   * @param {string} risk - Risk level ('low', 'medium', 'high')
   * @param {string} clientSeed - Client seed (optional)
   * @param {number} nonce - Nonce
   * @returns {Object} Game result
   */
  async playPlinko(userId, betAmount, currency, risk = 'medium', clientSeed = null, nonce = 0) {
    try {
      // Start game session
      const sessionResult = await this.startGameSession(userId, 'plinko', betAmount, currency, {
        risk,
        clientSeed,
        nonce
      });

      // Play Plinko game
      const gameResult = await this.plinkoGame.playGame(userId, betAmount, risk, clientSeed, nonce);

      // Complete the session
      await this.completeGameSession(sessionResult.sessionId, gameResult);

      return {
        ...sessionResult,
        ...gameResult
      };

    } catch (error) {
      console.error('Error playing Plinko:', error);
      throw error;
    }
  }

  /**
   * Complete a game session
   * @param {string} sessionId - Session ID
   * @param {Object} gameResult - Game result
   */
  async completeGameSession(sessionId, gameResult) {
    try {
      const sessionData = this.activeSessions.get(sessionId);
      if (!sessionData) {
        throw new Error('Session not found');
      }

      const { session } = sessionData;
      
      // Update session with results
      await session.complete(
        gameResult.isWin ? 'win' : 'loss',
        gameResult.payout,
        gameResult
      );

      // Save to database
      await session.save();

      // Process payout if player won
      if (gameResult.payout > 0) {
        await this.addBalance(session.userId, gameResult.payout, session.currency);
        
        // Create win transaction
        await this.createTransaction(session.userId, 'win', gameResult.payout, session.currency, {
          sessionId,
          gameType: sessionData.gameType,
          multiplier: gameResult.multiplier
        });
      }

      // Remove from active sessions
      this.activeSessions.delete(sessionId);

      // Update user statistics
      await this.updateUserStats(session.userId, session.betAmount, gameResult.payout, session.currency);

      // Log large wins
      if (gameResult.payout >= 100) { // Adjust threshold as needed
        await SecurityMonitor.logEvent({
          userId: session.userId,
          eventType: 'large_transaction',
          severity: 'medium',
          description: `Large win: ${gameResult.payout} ${session.currency}`,
          metadata: {
            additionalData: {
              gameType: sessionData.gameType,
              betAmount: session.betAmount,
              payout: gameResult.payout,
              multiplier: gameResult.multiplier
            }
          }
        });
      }

    } catch (error) {
      console.error('Error completing game session:', error);
      throw error;
    }
  }

  /**
   * Process crash game results
   * @param {Object} crashData - Crash game data
   */
  async processCrashGameResults(crashData) {
    try {
      for (const player of crashData.players) {
        const sessionId = this.findSessionByUserId(player.userId);
        if (sessionId) {
          await this.completeGameSession(sessionId, {
            isWin: player.result === 'win',
            payout: player.payout,
            profit: player.profit,
            multiplier: player.cashOutMultiplier || 1,
            gameId: crashData.gameId,
            crashPoint: crashData.crashPoint
          });
        }
      }
    } catch (error) {
      console.error('Error processing crash game results:', error);
    }
  }

  /**
   * Process cash out
   * @param {Object} cashOutData - Cash out data
   */
  async processCashOut(cashOutData) {
    try {
      const { userId, payout } = cashOutData;
      
      // Find user's session
      const sessionId = this.findSessionByUserId(userId);
      if (!sessionId) return;

      const sessionData = this.activeSessions.get(sessionId);
      if (!sessionData) return;

      // Add payout to user balance
      await this.addBalance(userId, payout, sessionData.session.currency);

      // Create win transaction
      await this.createTransaction(userId, 'win', payout, sessionData.session.currency, {
        sessionId,
        gameType: 'crash',
        multiplier: cashOutData.multiplier
      });

    } catch (error) {
      console.error('Error processing cash out:', error);
    }
  }

  /**
   * Find session by user ID
   * @param {string} userId - User ID
   * @returns {string|null} Session ID
   */
  findSessionByUserId(userId) {
    for (const [sessionId, sessionData] of this.activeSessions) {
      if (sessionData.session.userId.toString() === userId) {
        return sessionId;
      }
    }
    return null;
  }

  /**
   * Check responsible gambling limits
   * @param {Object} user - User object
   * @param {number} betAmount - Bet amount
   * @param {string} currency - Currency
   */
  async checkGamblingLimits(user, betAmount, currency) {
    const limits = user.limits;
    if (!limits) return;

    // Check daily deposit limit
    if (limits.dailyDeposit && limits.dailyDeposit > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayDeposits = await Transaction.aggregate([
        {
          $match: {
            userId: user._id,
            type: 'bet',
            currency,
            createdAt: { $gte: today }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]);

      const totalToday = todayDeposits[0]?.total || 0;
      if (totalToday + betAmount > limits.dailyDeposit) {
        throw new Error('Daily betting limit exceeded');
      }
    }

    // Check session time limit
    if (limits.sessionTime && limits.sessionTime > 0) {
      const sessionStart = user.lastLogin;
      const sessionDuration = Date.now() - sessionStart.getTime();
      
      if (sessionDuration > limits.sessionTime) {
        throw new Error('Session time limit exceeded');
      }
    }
  }

  /**
   * Deduct balance from user
   * @param {string} userId - User ID
   * @param {number} amount - Amount to deduct
   * @param {string} currency - Currency
   */
  async deductBalance(userId, amount, currency) {
    await User.findByIdAndUpdate(userId, {
      $inc: { [`wallet.balance.${currency}`]: -amount }
    });
  }

  /**
   * Add balance to user
   * @param {string} userId - User ID
   * @param {number} amount - Amount to add
   * @param {string} currency - Currency
   */
  async addBalance(userId, amount, currency) {
    await User.findByIdAndUpdate(userId, {
      $inc: { [`wallet.balance.${currency}`]: amount }
    });
  }

  /**
   * Create transaction record
   * @param {string} userId - User ID
   * @param {string} type - Transaction type
   * @param {number} amount - Amount
   * @param {string} currency - Currency
   * @param {Object} metadata - Additional metadata
   */
  async createTransaction(userId, type, amount, currency, metadata = {}) {
    const transaction = new Transaction({
      userId,
      type,
      amount,
      currency,
      status: 'completed',
      metadata
    });

    await transaction.save();
    return transaction;
  }

  /**
   * Update user statistics
   * @param {string} userId - User ID
   * @param {number} betAmount - Bet amount
   * @param {number} payout - Payout amount
   * @param {string} currency - Currency
   */
  async updateUserStats(userId, betAmount, payout, currency) {
    const profit = payout - betAmount;
    
    await User.findByIdAndUpdate(userId, {
      $inc: {
        'profile.totalWagered': betAmount,
        'profile.totalWon': payout,
        'profile.netProfit': profit,
        'profile.gamesPlayed': 1
      }
    });
  }

  /**
   * Generate unique session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get crash game state
   * @returns {Object} Crash game state
   */
  getCrashGameState() {
    return this.crashGame.getGameState();
  }

  /**
   * Get game statistics
   * @param {string} gameType - Game type
   * @param {string} userId - User ID (optional)
   * @returns {Object} Game statistics
   */
  async getGameStats(gameType, userId = null) {
    const query = { status: 'completed' };
    
    if (userId) {
      query.userId = userId;
    }

    // Get game sessions from database
    const sessions = await GameSession.find(query)
      .populate('gameId')
      .sort({ createdAt: -1 })
      .limit(1000);

    // Filter by game type if specified
    let filteredSessions = sessions;
    if (gameType) {
      filteredSessions = sessions.filter(session => 
        session.gameData?.gameType === gameType || 
        session.gameId?.slug === gameType
      );
    }

    // Calculate statistics
    const totalGames = filteredSessions.length;
    const totalWagered = filteredSessions.reduce((sum, session) => sum + session.betAmount, 0);
    const totalPayout = filteredSessions.reduce((sum, session) => sum + session.result.payout, 0);
    const wins = filteredSessions.filter(session => session.result.outcome === 'win').length;
    
    return {
      totalGames,
      totalWagered,
      totalPayout,
      totalProfit: totalPayout - totalWagered,
      winRate: totalGames > 0 ? (wins / totalGames) * 100 : 0,
      averageBet: totalGames > 0 ? totalWagered / totalGames : 0,
      rtp: totalWagered > 0 ? (totalPayout / totalWagered) * 100 : 0
    };
  }

  /**
   * Broadcast crash game update to connected clients
   * @param {Object} data - Update data
   */
  broadcastCrashUpdate(data) {
    // This would integrate with WebSocket server
    // For now, just log the update
    console.log('Crash update:', data.multiplier.toFixed(2) + 'x');
  }

  /**
   * Verify game result
   * @param {string} gameType - Game type
   * @param {Object} gameResult - Game result to verify
   * @returns {Object} Verification result
   */
  verifyGameResult(gameType, gameResult) {
    switch (gameType) {
      case 'crash':
        return CrashGame.verifyGame(
          gameResult.gameId,
          gameResult.provablyFair.serverSeed,
          gameResult.provablyFair.clientSeed
        );
      case 'dice':
        return DiceGame.verifyGame(gameResult);
      case 'plinko':
        return PlinkoGame.verifyGame(gameResult);
      default:
        throw new Error('Unknown game type');
    }
  }
}

module.exports = GameManager;

