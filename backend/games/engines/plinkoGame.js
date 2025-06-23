const ProvablyFair = require('../utils/provablyFair');

class PlinkoGame {
  constructor() {
    this.config = {
      minBet: 0.01,
      maxBet: 100,
      rows: 16,
      houseEdge: 1.0 // 1%
    };

    // Plinko multiplier configurations for different risk levels
    this.multiplierConfigs = {
      low: {
        rows: 8,
        multipliers: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6]
      },
      medium: {
        rows: 12,
        multipliers: [8.4, 3, 1.3, 1.1, 1, 0.5, 0.3, 0.5, 1, 1.1, 1.3, 3, 8.4]
      },
      high: {
        rows: 16,
        multipliers: [1000, 130, 26, 9, 4, 2, 1.5, 1.2, 1, 1.2, 1.5, 2, 4, 9, 26, 130, 1000]
      }
    };
  }

  /**
   * Play a Plinko game
   * @param {string} userId - User ID
   * @param {number} betAmount - Bet amount
   * @param {string} risk - Risk level ('low', 'medium', 'high')
   * @param {string} clientSeed - Client seed (optional)
   * @param {number} nonce - User's nonce
   * @returns {Object} Game result
   */
  async playGame(userId, betAmount, risk = 'medium', clientSeed = null, nonce = 0) {
    // Validate inputs
    this.validateInputs(betAmount, risk);

    // Get multiplier configuration
    const config = this.multiplierConfigs[risk];
    
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

    // Generate Plinko path
    const path = ProvablyFair.generatePlinkoPath(resultHash, config.rows);
    
    // Calculate final bucket position
    const bucketIndex = this.calculateBucketIndex(path);
    const multiplier = config.multipliers[bucketIndex];
    
    // Calculate payout
    const payout = betAmount * multiplier;
    const profit = payout - betAmount;

    // Create game result
    const gameResult = {
      gameId: this.generateGameId(),
      userId,
      gameType: 'plinko',
      betAmount,
      risk,
      path,
      bucketIndex,
      multiplier,
      payout,
      profit,
      provablyFair: {
        serverSeed: gameSeeds.serverSeed,
        serverSeedHash: gameSeeds.serverSeedHash,
        clientSeed: gameSeeds.clientSeed,
        nonce,
        resultHash
      },
      gameData: {
        rows: config.rows,
        multipliers: config.multipliers,
        pathVisualization: this.generatePathVisualization(path, config.rows)
      },
      timestamp: new Date()
    };

    return gameResult;
  }

  /**
   * Calculate bucket index from path
   * @param {Array} path - Plinko path (0 = left, 1 = right)
   * @returns {number} Bucket index
   */
  calculateBucketIndex(path) {
    // Count right moves to determine final position
    return path.reduce((sum, move) => sum + move, 0);
  }

  /**
   * Generate path visualization for frontend
   * @param {Array} path - Plinko path
   * @param {number} rows - Number of rows
   * @returns {Array} Visualization data
   */
  generatePathVisualization(path, rows) {
    const visualization = [];
    let position = 0; // Start at center

    for (let row = 0; row < rows; row++) {
      const move = path[row];
      position += move; // 0 = stay, 1 = move right
      
      visualization.push({
        row,
        position,
        direction: move === 0 ? 'left' : 'right'
      });
    }

    return visualization;
  }

  /**
   * Validate game inputs
   * @param {number} betAmount - Bet amount
   * @param {string} risk - Risk level
   */
  validateInputs(betAmount, risk) {
    if (betAmount < this.config.minBet || betAmount > this.config.maxBet) {
      throw new Error(`Bet amount must be between ${this.config.minBet} and ${this.config.maxBet}`);
    }

    if (!['low', 'medium', 'high'].includes(risk)) {
      throw new Error('Risk must be "low", "medium", or "high"');
    }
  }

  /**
   * Get game statistics
   * @param {Array} gameHistory - Array of game results
   * @param {string} risk - Risk level filter (optional)
   * @returns {Object} Game statistics
   */
  getGameStats(gameHistory, risk = null) {
    let filteredHistory = gameHistory;
    
    if (risk) {
      filteredHistory = gameHistory.filter(game => game.risk === risk);
    }

    if (!filteredHistory || filteredHistory.length === 0) {
      return {
        totalGames: 0,
        totalWagered: 0,
        totalPayout: 0,
        totalProfit: 0,
        averageBet: 0,
        averageMultiplier: 0,
        houseEdge: 0,
        bucketDistribution: {}
      };
    }

    const totalGames = filteredHistory.length;
    const totalWagered = filteredHistory.reduce((sum, game) => sum + game.betAmount, 0);
    const totalPayout = filteredHistory.reduce((sum, game) => sum + game.payout, 0);
    const totalProfit = totalPayout - totalWagered;
    const averageBet = totalWagered / totalGames;
    const averageMultiplier = totalPayout / totalWagered;
    const houseEdge = ((totalWagered - totalPayout) / totalWagered) * 100;

    // Calculate bucket distribution
    const bucketDistribution = {};
    filteredHistory.forEach(game => {
      const bucket = game.bucketIndex;
      bucketDistribution[bucket] = (bucketDistribution[bucket] || 0) + 1;
    });

    return {
      totalGames,
      totalWagered,
      totalPayout,
      totalProfit,
      averageBet,
      averageMultiplier,
      houseEdge,
      bucketDistribution
    };
  }

  /**
   * Simulate Plinko game for testing
   * @param {string} risk - Risk level
   * @param {number} simulations - Number of simulations
   * @returns {Object} Simulation results
   */
  simulate(risk = 'medium', simulations = 10000) {
    const config = this.multiplierConfigs[risk];
    const results = [];
    const bucketCounts = new Array(config.multipliers.length).fill(0);
    
    for (let i = 0; i < simulations; i++) {
      const serverSeed = ProvablyFair.generateServerSeed();
      const clientSeed = ProvablyFair.generateClientSeed();
      const resultHash = ProvablyFair.generateResult(serverSeed, clientSeed, i);
      const path = ProvablyFair.generatePlinkoPath(resultHash, config.rows);
      const bucketIndex = this.calculateBucketIndex(path);
      const multiplier = config.multipliers[bucketIndex];
      
      bucketCounts[bucketIndex]++;
      
      if (i < 100) { // Store first 100 results
        results.push({
          path,
          bucketIndex,
          multiplier
        });
      }
    }

    // Calculate distribution percentages
    const distribution = bucketCounts.map((count, index) => ({
      bucket: index,
      multiplier: config.multipliers[index],
      count,
      percentage: (count / simulations) * 100
    }));

    // Calculate theoretical vs actual RTP
    const theoreticalRTP = this.calculateTheoreticalRTP(config.multipliers);
    const actualRTP = distribution.reduce((sum, bucket) => 
      sum + (bucket.multiplier * bucket.percentage / 100), 0
    );

    return {
      risk,
      simulations,
      distribution,
      theoreticalRTP,
      actualRTP,
      variance: Math.abs(theoreticalRTP - actualRTP),
      results
    };
  }

  /**
   * Calculate theoretical RTP for a multiplier configuration
   * @param {Array} multipliers - Array of multipliers
   * @returns {number} Theoretical RTP
   */
  calculateTheoreticalRTP(multipliers) {
    // Each bucket has equal probability in a fair Plinko
    const probability = 1 / multipliers.length;
    return multipliers.reduce((sum, multiplier) => sum + (multiplier * probability), 0);
  }

  /**
   * Verify Plinko game result
   * @param {Object} gameResult - Game result to verify
   * @returns {Object} Verification result
   */
  static verifyGame(gameResult) {
    const { serverSeed, clientSeed, nonce } = gameResult.provablyFair;
    const config = new PlinkoGame().multiplierConfigs[gameResult.risk];
    
    // Regenerate result hash
    const calculatedHash = ProvablyFair.generateResult(serverSeed, clientSeed, nonce);
    
    // Regenerate path
    const calculatedPath = ProvablyFair.generatePlinkoPath(calculatedHash, config.rows);
    
    // Calculate bucket index and multiplier
    const plinkoGame = new PlinkoGame();
    const calculatedBucketIndex = plinkoGame.calculateBucketIndex(calculatedPath);
    const calculatedMultiplier = config.multipliers[calculatedBucketIndex];
    
    // Check if results match
    const hashMatches = calculatedHash === gameResult.provablyFair.resultHash;
    const pathMatches = JSON.stringify(calculatedPath) === JSON.stringify(gameResult.path);
    const bucketMatches = calculatedBucketIndex === gameResult.bucketIndex;
    const multiplierMatches = Math.abs(calculatedMultiplier - gameResult.multiplier) < 0.01;

    return {
      verified: hashMatches && pathMatches && bucketMatches && multiplierMatches,
      calculatedHash,
      calculatedPath,
      calculatedBucketIndex,
      calculatedMultiplier,
      originalPath: gameResult.path,
      originalBucketIndex: gameResult.bucketIndex,
      originalMultiplier: gameResult.multiplier,
      hashMatches,
      pathMatches,
      bucketMatches,
      multiplierMatches,
      gameId: gameResult.gameId
    };
  }

  /**
   * Generate unique game ID
   * @returns {string} Game ID
   */
  generateGameId() {
    return `plinko_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get game configuration
   * @returns {Object} Game configuration
   */
  getConfig() {
    return {
      ...this.config,
      multiplierConfigs: this.multiplierConfigs
    };
  }

  /**
   * Calculate maximum win amount
   * @param {number} betAmount - Bet amount
   * @param {string} risk - Risk level
   * @returns {number} Maximum win amount
   */
  calculateMaxWin(betAmount, risk) {
    const config = this.multiplierConfigs[risk];
    const maxMultiplier = Math.max(...config.multipliers);
    return betAmount * maxMultiplier;
  }

  /**
   * Get risk level recommendations
   * @returns {Array} Array of risk level descriptions
   */
  getRiskLevels() {
    return [
      {
        level: 'low',
        description: 'Lower volatility, more consistent wins',
        rows: this.multiplierConfigs.low.rows,
        maxMultiplier: Math.max(...this.multiplierConfigs.low.multipliers),
        minMultiplier: Math.min(...this.multiplierConfigs.low.multipliers)
      },
      {
        level: 'medium',
        description: 'Balanced risk and reward',
        rows: this.multiplierConfigs.medium.rows,
        maxMultiplier: Math.max(...this.multiplierConfigs.medium.multipliers),
        minMultiplier: Math.min(...this.multiplierConfigs.medium.multipliers)
      },
      {
        level: 'high',
        description: 'High volatility, potential for big wins',
        rows: this.multiplierConfigs.high.rows,
        maxMultiplier: Math.max(...this.multiplierConfigs.high.multipliers),
        minMultiplier: Math.min(...this.multiplierConfigs.high.multipliers)
      }
    ];
  }

  /**
   * Generate Plinko board layout for frontend
   * @param {number} rows - Number of rows
   * @returns {Object} Board layout data
   */
  generateBoardLayout(rows) {
    const pegs = [];
    const buckets = [];

    // Generate peg positions
    for (let row = 0; row < rows; row++) {
      const pegsInRow = row + 1;
      const rowPegs = [];
      
      for (let peg = 0; peg < pegsInRow; peg++) {
        rowPegs.push({
          row,
          position: peg,
          x: (peg - (pegsInRow - 1) / 2) * 50, // Spacing between pegs
          y: row * 50
        });
      }
      
      pegs.push(rowPegs);
    }

    // Generate bucket positions
    const numBuckets = rows + 1;
    for (let i = 0; i < numBuckets; i++) {
      buckets.push({
        index: i,
        x: (i - (numBuckets - 1) / 2) * 50,
        y: rows * 50 + 50
      });
    }

    return {
      rows,
      pegs,
      buckets,
      width: numBuckets * 50,
      height: (rows + 2) * 50
    };
  }
}

module.exports = PlinkoGame;

