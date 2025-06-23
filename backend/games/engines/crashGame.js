const ProvablyFair = require('../utils/provablyFair');
const EventEmitter = require('events');

class CrashGame extends EventEmitter {
  constructor() {
    super();
    this.gameState = 'waiting'; // waiting, starting, running, crashed, ended
    this.currentMultiplier = 1.00;
    this.crashPoint = null;
    this.startTime = null;
    this.gameId = null;
    this.players = new Map(); // userId -> player data
    this.gameSeeds = null;
    this.gameHistory = [];
    this.maxHistory = 100;
    
    // Game configuration
    this.config = {
      minBet: 0.01,
      maxBet: 1000,
      maxMultiplier: 1000,
      gameInterval: 100, // Update interval in ms
      waitTime: 5000, // Wait time between games in ms
      maxPlayers: 1000
    };
  }

  /**
   * Start a new crash game
   */
  async startNewGame() {
    if (this.gameState !== 'waiting') {
      throw new Error('Game already in progress');
    }

    // Generate new game seeds
    this.gameSeeds = ProvablyFair.generateGameSeeds();
    this.gameId = this.generateGameId();
    
    // Calculate crash point
    const resultHash = ProvablyFair.generateResult(
      this.gameSeeds.serverSeed,
      this.gameSeeds.clientSeed,
      0 // nonce for crash point
    );
    
    this.crashPoint = ProvablyFair.generateCrashMultiplier(resultHash);
    this.currentMultiplier = 1.00;
    this.startTime = Date.now();
    this.gameState = 'starting';
    
    console.log(`New crash game started: ${this.gameId}, crash point: ${this.crashPoint.toFixed(2)}x`);
    
    // Emit game started event
    this.emit('gameStarted', {
      gameId: this.gameId,
      serverSeedHash: this.gameSeeds.serverSeedHash,
      clientSeed: this.gameSeeds.clientSeed
    });

    // Start the game loop after a brief delay
    setTimeout(() => {
      this.gameState = 'running';
      this.runGameLoop();
    }, 1000);
  }

  /**
   * Run the main game loop
   */
  runGameLoop() {
    if (this.gameState !== 'running') return;

    const elapsed = Date.now() - this.startTime;
    
    // Calculate current multiplier based on elapsed time
    // Multiplier grows exponentially over time
    this.currentMultiplier = Math.pow(Math.E, elapsed / 25000); // Adjust growth rate
    
    // Check if we've reached the crash point
    if (this.currentMultiplier >= this.crashPoint) {
      this.crashGame();
      return;
    }

    // Emit multiplier update
    this.emit('multiplierUpdate', {
      gameId: this.gameId,
      multiplier: this.currentMultiplier,
      elapsed: elapsed
    });

    // Continue the loop
    setTimeout(() => this.runGameLoop(), this.config.gameInterval);
  }

  /**
   * Crash the game
   */
  crashGame() {
    this.gameState = 'crashed';
    this.currentMultiplier = this.crashPoint;
    
    console.log(`Game crashed at ${this.crashPoint.toFixed(2)}x`);
    
    // Process all remaining players (they lose)
    for (const [userId, player] of this.players) {
      if (!player.cashedOut) {
        player.result = 'loss';
        player.payout = 0;
        player.profit = -player.betAmount;
      }
    }

    // Emit crash event
    this.emit('gameCrashed', {
      gameId: this.gameId,
      crashPoint: this.crashPoint,
      serverSeed: this.gameSeeds.serverSeed, // Reveal server seed
      players: Array.from(this.players.values())
    });

    // Add to history
    this.addToHistory();
    
    // End the game
    this.endGame();
  }

  /**
   * End the current game
   */
  endGame() {
    this.gameState = 'ended';
    
    // Emit game ended event
    this.emit('gameEnded', {
      gameId: this.gameId,
      crashPoint: this.crashPoint,
      totalPlayers: this.players.size,
      totalWagered: this.getTotalWagered(),
      totalPayout: this.getTotalPayout()
    });

    // Reset for next game
    setTimeout(() => {
      this.resetGame();
    }, this.config.waitTime);
  }

  /**
   * Reset game state for next round
   */
  resetGame() {
    this.gameState = 'waiting';
    this.currentMultiplier = 1.00;
    this.crashPoint = null;
    this.startTime = null;
    this.gameId = null;
    this.players.clear();
    this.gameSeeds = null;
    
    this.emit('gameReset');
    
    // Auto-start next game
    setTimeout(() => {
      this.startNewGame();
    }, 1000);
  }

  /**
   * Place a bet in the current game
   * @param {string} userId - User ID
   * @param {number} betAmount - Bet amount
   * @param {number} autoCashOut - Auto cash out multiplier (optional)
   * @returns {Object} Bet result
   */
  placeBet(userId, betAmount, autoCashOut = null) {
    if (this.gameState !== 'waiting' && this.gameState !== 'starting') {
      throw new Error('Cannot place bet - game already running');
    }

    if (this.players.has(userId)) {
      throw new Error('User already has a bet in this game');
    }

    if (betAmount < this.config.minBet || betAmount > this.config.maxBet) {
      throw new Error(`Bet amount must be between ${this.config.minBet} and ${this.config.maxBet}`);
    }

    if (this.players.size >= this.config.maxPlayers) {
      throw new Error('Game is full');
    }

    const player = {
      userId,
      betAmount,
      autoCashOut,
      cashedOut: false,
      cashOutMultiplier: null,
      payout: 0,
      profit: 0,
      result: null,
      timestamp: Date.now()
    };

    this.players.set(userId, player);

    this.emit('betPlaced', {
      gameId: this.gameId,
      userId,
      betAmount,
      autoCashOut,
      totalPlayers: this.players.size
    });

    return {
      success: true,
      gameId: this.gameId,
      betAmount,
      autoCashOut
    };
  }

  /**
   * Cash out a player's bet
   * @param {string} userId - User ID
   * @returns {Object} Cash out result
   */
  cashOut(userId) {
    if (this.gameState !== 'running') {
      throw new Error('Cannot cash out - game not running');
    }

    const player = this.players.get(userId);
    if (!player) {
      throw new Error('No bet found for user');
    }

    if (player.cashedOut) {
      throw new Error('Already cashed out');
    }

    // Cash out at current multiplier
    player.cashedOut = true;
    player.cashOutMultiplier = this.currentMultiplier;
    player.payout = player.betAmount * this.currentMultiplier;
    player.profit = player.payout - player.betAmount;
    player.result = 'win';

    this.emit('playerCashedOut', {
      gameId: this.gameId,
      userId,
      multiplier: this.currentMultiplier,
      payout: player.payout,
      profit: player.profit
    });

    return {
      success: true,
      multiplier: this.currentMultiplier,
      payout: player.payout,
      profit: player.profit
    };
  }

  /**
   * Check and process auto cash outs
   */
  checkAutoCashOuts() {
    for (const [userId, player] of this.players) {
      if (!player.cashedOut && player.autoCashOut && 
          this.currentMultiplier >= player.autoCashOut) {
        try {
          this.cashOut(userId);
        } catch (error) {
          console.error(`Auto cash out failed for user ${userId}:`, error);
        }
      }
    }
  }

  /**
   * Get current game state
   * @returns {Object} Game state
   */
  getGameState() {
    return {
      gameId: this.gameId,
      state: this.gameState,
      multiplier: this.currentMultiplier,
      crashPoint: this.gameState === 'crashed' ? this.crashPoint : null,
      players: Array.from(this.players.values()),
      totalPlayers: this.players.size,
      totalWagered: this.getTotalWagered(),
      serverSeedHash: this.gameSeeds?.serverSeedHash,
      clientSeed: this.gameSeeds?.clientSeed,
      history: this.gameHistory.slice(-10) // Last 10 games
    };
  }

  /**
   * Get game history
   * @param {number} limit - Number of games to return
   * @returns {Array} Game history
   */
  getHistory(limit = 50) {
    return this.gameHistory.slice(-limit);
  }

  /**
   * Add current game to history
   */
  addToHistory() {
    const historyEntry = {
      gameId: this.gameId,
      crashPoint: this.crashPoint,
      totalPlayers: this.players.size,
      totalWagered: this.getTotalWagered(),
      totalPayout: this.getTotalPayout(),
      timestamp: Date.now(),
      serverSeed: this.gameSeeds.serverSeed,
      serverSeedHash: this.gameSeeds.serverSeedHash,
      clientSeed: this.gameSeeds.clientSeed
    };

    this.gameHistory.push(historyEntry);
    
    // Keep only last N games
    if (this.gameHistory.length > this.maxHistory) {
      this.gameHistory = this.gameHistory.slice(-this.maxHistory);
    }
  }

  /**
   * Calculate total amount wagered in current game
   * @returns {number} Total wagered
   */
  getTotalWagered() {
    let total = 0;
    for (const player of this.players.values()) {
      total += player.betAmount;
    }
    return total;
  }

  /**
   * Calculate total payout for current game
   * @returns {number} Total payout
   */
  getTotalPayout() {
    let total = 0;
    for (const player of this.players.values()) {
      total += player.payout;
    }
    return total;
  }

  /**
   * Generate unique game ID
   * @returns {string} Game ID
   */
  generateGameId() {
    return `crash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Verify game result
   * @param {string} gameId - Game ID
   * @param {string} serverSeed - Server seed
   * @param {string} clientSeed - Client seed
   * @returns {Object} Verification result
   */
  static verifyGame(gameId, serverSeed, clientSeed) {
    const resultHash = ProvablyFair.generateResult(serverSeed, clientSeed, 0);
    const crashPoint = ProvablyFair.generateCrashMultiplier(resultHash);
    const serverSeedHash = ProvablyFair.generateServerSeedHash(serverSeed);
    
    return {
      gameId,
      crashPoint,
      resultHash,
      serverSeed,
      serverSeedHash,
      clientSeed,
      verified: true
    };
  }
}

module.exports = CrashGame;

