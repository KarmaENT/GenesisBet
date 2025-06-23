const ProvablyFair = require('../utils/provablyFair');

class DiceGame {
  constructor() {
    this.config = {
      minBet: 0.01,
      maxBet: 1000,
      minChance: 0.01, // 0.01%
      maxChance: 98.99, // 98.99%
      houseEdge: 1.0 // 1%
    };
  }

  /**
   * Play a dice game
   * @param {string} userId - User ID
   * @param {number} betAmount - Bet amount
   * @param {number} target - Target number (0-99.99)
   * @param {string} direction - 'over' or 'under'
   * @param {string} clientSeed - Client seed (optional)
   * @param {number} nonce - User's nonce
   * @returns {Object} Game result
   */
  async playGame(userId, betAmount, target, direction, clientSeed = null, nonce = 0) {
    // Validate inputs
    this.validateInputs(betAmount, target, direction);

    // Generate game seeds
    const gameSeeds = ProvablyFair.generateGameSeeds();
    if (clientSeed) {
      gameSeeds.clientSeed = clientSeed;
    }

    // Generate game result
    const resultHash = ProvablyFair.generateResult(
      gameSeeds.serverSeed,
      gameSeeds.clientSeed,
      nonce
    );

    // Get dice result (0-99.99)
    const diceResult = this.generateDiceResult(resultHash);
    
    // Calculate win chance and payout multiplier
    const winChance = this.calculateWinChance(target, direction);
    const payoutMultiplier = this.calculatePayoutMultiplier(winChance);
    
    // Determine if player won
    const isWin = this.checkWin(diceResult, target, direction);
    
    // Calculate payout
    const payout = isWin ? betAmount * payoutMultiplier : 0;
    const profit = payout - betAmount;

    // Create game result
    const gameResult = {
      gameId: this.generateGameId(),
      userId,
      gameType: 'dice',
      betAmount,
      target,
      direction,
      diceResult,
      winChance,
      payoutMultiplier,
      isWin,
      payout,
      profit,
      provablyFair: {
        serverSeed: gameSeeds.serverSeed,
        serverSeedHash: gameSeeds.serverSeedHash,
        clientSeed: gameSeeds.clientSeed,
        nonce,
        resultHash
      },
      timestamp: new Date()
    };

    return gameResult;
  }

  /**
   * Generate dice result from hash (0-99.99)
   * @param {string} hash - SHA-256 hash
   * @returns {number} Dice result
   */
  generateDiceResult(hash) {
    const float = ProvablyFair.hashToFloat(hash);
    return Math.floor(float * 10000) / 100; // 0-99.99 with 2 decimal places
  }

  /**
   * Calculate win chance based on target and direction
   * @param {number} target - Target number
   * @param {string} direction - 'over' or 'under'
   * @returns {number} Win chance percentage
   */
  calculateWinChance(target, direction) {
    if (direction === 'over') {
      return 100 - target;
    } else {
      return target;
    }
  }

  /**
   * Calculate payout multiplier based on win chance
   * @param {number} winChance - Win chance percentage
   * @returns {number} Payout multiplier
   */
  calculatePayoutMultiplier(winChance) {
    // Formula: (100 - house edge) / win chance
    return (100 - this.config.houseEdge) / winChance;
  }

  /**
   * Check if player won
   * @param {number} diceResult - Dice result
   * @param {number} target - Target number
   * @param {string} direction - 'over' or 'under'
   * @returns {boolean} True if player won
   */
  checkWin(diceResult, target, direction) {
    if (direction === 'over') {
      return diceResult > target;
    } else {
      return diceResult < target;
    }
  }

  /**
   * Validate game inputs
   * @param {number} betAmount - Bet amount
   * @param {number} target - Target number
   * @param {string} direction - Direction
   */
  validateInputs(betAmount, target, direction) {
    if (betAmount < this.config.minBet || betAmount > this.config.maxBet) {
      throw new Error(`Bet amount must be between ${this.config.minBet} and ${this.config.maxBet}`);
    }

    if (target < 0 || target > 100) {
      throw new Error('Target must be between 0 and 100');
    }

    if (!['over', 'under'].includes(direction)) {
      throw new Error('Direction must be "over" or "under"');
    }

    // Calculate win chance and validate
    const winChance = this.calculateWinChance(target, direction);
    if (winChance < this.config.minChance || winChance > this.config.maxChance) {
      throw new Error(`Win chance must be between ${this.config.minChance}% and ${this.config.maxChance}%`);
    }
  }

  /**
   * Get game statistics
   * @param {Array} gameHistory - Array of game results
   * @returns {Object} Game statistics
   */
  getGameStats(gameHistory) {
    if (!gameHistory || gameHistory.length === 0) {
      return {
        totalGames: 0,
        totalWagered: 0,
        totalPayout: 0,
        totalProfit: 0,
        winRate: 0,
        averageBet: 0,
        averageMultiplier: 0,
        houseEdge: 0
      };
    }

    const totalGames = gameHistory.length;
    const totalWagered = gameHistory.reduce((sum, game) => sum + game.betAmount, 0);
    const totalPayout = gameHistory.reduce((sum, game) => sum + game.payout, 0);
    const totalProfit = totalPayout - totalWagered;
    const wins = gameHistory.filter(game => game.isWin).length;
    const winRate = (wins / totalGames) * 100;
    const averageBet = totalWagered / totalGames;
    const averageMultiplier = totalPayout / totalWagered;
    const houseEdge = ((totalWagered - totalPayout) / totalWagered) * 100;

    return {
      totalGames,
      totalWagered,
      totalPayout,
      totalProfit,
      winRate,
      averageBet,
      averageMultiplier,
      houseEdge
    };
  }

  /**
   * Simulate dice game for testing
   * @param {number} target - Target number
   * @param {string} direction - Direction
   * @param {number} simulations - Number of simulations
   * @returns {Object} Simulation results
   */
  simulate(target, direction, simulations = 10000) {
    const results = [];
    
    for (let i = 0; i < simulations; i++) {
      const serverSeed = ProvablyFair.generateServerSeed();
      const clientSeed = ProvablyFair.generateClientSeed();
      const resultHash = ProvablyFair.generateResult(serverSeed, clientSeed, i);
      const diceResult = this.generateDiceResult(resultHash);
      const isWin = this.checkWin(diceResult, target, direction);
      
      results.push({
        diceResult,
        isWin
      });
    }

    const wins = results.filter(r => r.isWin).length;
    const actualWinRate = (wins / simulations) * 100;
    const expectedWinRate = this.calculateWinChance(target, direction);
    const variance = Math.abs(actualWinRate - expectedWinRate);

    return {
      simulations,
      wins,
      losses: simulations - wins,
      actualWinRate,
      expectedWinRate,
      variance,
      results: results.slice(0, 100) // Return first 100 results
    };
  }

  /**
   * Verify dice game result
   * @param {Object} gameResult - Game result to verify
   * @returns {Object} Verification result
   */
  static verifyGame(gameResult) {
    const { serverSeed, clientSeed, nonce } = gameResult.provablyFair;
    
    // Regenerate result hash
    const calculatedHash = ProvablyFair.generateResult(serverSeed, clientSeed, nonce);
    
    // Regenerate dice result
    const diceGame = new DiceGame();
    const calculatedDiceResult = diceGame.generateDiceResult(calculatedHash);
    
    // Check if results match
    const hashMatches = calculatedHash === gameResult.provablyFair.resultHash;
    const resultMatches = Math.abs(calculatedDiceResult - gameResult.diceResult) < 0.01;
    const winMatches = diceGame.checkWin(
      calculatedDiceResult, 
      gameResult.target, 
      gameResult.direction
    ) === gameResult.isWin;

    return {
      verified: hashMatches && resultMatches && winMatches,
      calculatedHash,
      calculatedDiceResult,
      originalDiceResult: gameResult.diceResult,
      hashMatches,
      resultMatches,
      winMatches,
      gameId: gameResult.gameId
    };
  }

  /**
   * Generate unique game ID
   * @returns {string} Game ID
   */
  generateGameId() {
    return `dice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get game configuration
   * @returns {Object} Game configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Calculate maximum win amount
   * @param {number} betAmount - Bet amount
   * @param {number} winChance - Win chance percentage
   * @returns {number} Maximum win amount
   */
  calculateMaxWin(betAmount, winChance) {
    const multiplier = this.calculatePayoutMultiplier(winChance);
    return betAmount * multiplier;
  }

  /**
   * Get optimal betting strategies
   * @returns {Array} Array of strategy suggestions
   */
  getStrategies() {
    return [
      {
        name: 'Conservative',
        description: 'High win chance, low multiplier',
        target: 50,
        direction: 'under',
        winChance: 50,
        multiplier: 1.98
      },
      {
        name: 'Balanced',
        description: 'Medium win chance, medium multiplier',
        target: 66,
        direction: 'under',
        winChance: 66,
        multiplier: 1.50
      },
      {
        name: 'Aggressive',
        description: 'Low win chance, high multiplier',
        target: 10,
        direction: 'under',
        winChance: 10,
        multiplier: 9.90
      },
      {
        name: 'High Risk',
        description: 'Very low win chance, very high multiplier',
        target: 1,
        direction: 'under',
        winChance: 1,
        multiplier: 99.00
      }
    ];
  }
}

module.exports = DiceGame;

