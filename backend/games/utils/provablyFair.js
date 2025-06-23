const crypto = require('crypto');

class ProvablyFair {
  /**
   * Generate a cryptographically secure server seed
   * @returns {string} Server seed
   */
  static generateServerSeed() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate server seed hash for client verification
   * @param {string} serverSeed - Server seed
   * @returns {string} SHA-256 hash of server seed
   */
  static generateServerSeedHash(serverSeed) {
    return crypto.createHash('sha256').update(serverSeed).digest('hex');
  }

  /**
   * Generate a default client seed
   * @returns {string} Client seed
   */
  static generateClientSeed() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate game result using provably fair algorithm
   * @param {string} serverSeed - Server seed
   * @param {string} clientSeed - Client seed
   * @param {number} nonce - Game round number
   * @returns {string} SHA-256 hash for result generation
   */
  static generateResult(serverSeed, clientSeed, nonce) {
    const combined = `${serverSeed}:${clientSeed}:${nonce}`;
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Convert hash to float between 0 and 1
   * @param {string} hash - SHA-256 hash
   * @returns {number} Float between 0 and 1
   */
  static hashToFloat(hash) {
    // Use first 8 characters (32 bits) for precision
    const hex = hash.substring(0, 8);
    const decimal = parseInt(hex, 16);
    return decimal / Math.pow(2, 32);
  }

  /**
   * Generate crash multiplier from hash
   * @param {string} hash - SHA-256 hash
   * @returns {number} Crash multiplier
   */
  static generateCrashMultiplier(hash) {
    const float = this.hashToFloat(hash);
    
    // House edge of 1%
    const houseEdge = 0.01;
    
    // Calculate crash point
    if (float < houseEdge) {
      return 1.00; // Instant crash (house edge)
    }
    
    // Generate multiplier between 1.01 and theoretical maximum
    const result = (1 - houseEdge) / (1 - float);
    
    // Cap at reasonable maximum (1000x)
    return Math.min(Math.max(result, 1.01), 1000);
  }

  /**
   * Generate dice result from hash
   * @param {string} hash - SHA-256 hash
   * @param {number} sides - Number of dice sides (default: 100)
   * @returns {number} Dice result (0-99 for 100-sided die)
   */
  static generateDiceResult(hash, sides = 100) {
    const float = this.hashToFloat(hash);
    return Math.floor(float * sides);
  }

  /**
   * Generate Plinko path from hash
   * @param {string} hash - SHA-256 hash
   * @param {number} rows - Number of Plinko rows
   * @returns {Array} Path array (0 = left, 1 = right)
   */
  static generatePlinkoPath(hash, rows = 16) {
    const path = [];
    let currentHash = hash;
    
    for (let i = 0; i < rows; i++) {
      // Use different parts of hash for each row
      const byteIndex = (i * 2) % 64; // 64 hex characters in hash
      const byte = currentHash.substring(byteIndex, byteIndex + 2);
      const value = parseInt(byte, 16);
      
      // 0 = left, 1 = right
      path.push(value % 2);
      
      // Rehash if we've used all bytes
      if (byteIndex >= 62) {
        currentHash = crypto.createHash('sha256').update(currentHash).digest('hex');
      }
    }
    
    return path;
  }

  /**
   * Calculate Plinko multiplier from path
   * @param {Array} path - Plinko path
   * @param {Array} multipliers - Multiplier array for each bucket
   * @returns {number} Multiplier for the final bucket
   */
  static calculatePlinkoMultiplier(path, multipliers = null) {
    if (!multipliers) {
      // Default 16-row Plinko multipliers (17 buckets)
      multipliers = [
        1000, 130, 26, 9, 4, 2, 1.5, 1.2, 1, 1.2, 1.5, 2, 4, 9, 26, 130, 1000
      ];
    }
    
    // Calculate final position
    const rightMoves = path.reduce((sum, move) => sum + move, 0);
    const bucketIndex = rightMoves;
    
    return multipliers[bucketIndex] || 1;
  }

  /**
   * Generate roulette result from hash
   * @param {string} hash - SHA-256 hash
   * @returns {Object} Roulette result with number and color
   */
  static generateRouletteResult(hash) {
    const float = this.hashToFloat(hash);
    const number = Math.floor(float * 37); // 0-36 for European roulette
    
    let color = 'green';
    if (number !== 0) {
      // Red numbers: 1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36
      const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
      color = redNumbers.includes(number) ? 'red' : 'black';
    }
    
    return { number, color };
  }

  /**
   * Generate slot result from hash
   * @param {string} hash - SHA-256 hash
   * @param {number} reels - Number of reels
   * @param {Array} symbols - Array of symbols
   * @returns {Array} Array of symbols for each reel
   */
  static generateSlotResult(hash, reels = 5, symbols = ['A', 'K', 'Q', 'J', '10', '9']) {
    const result = [];
    let currentHash = hash;
    
    for (let i = 0; i < reels; i++) {
      const byteIndex = (i * 2) % 64;
      const byte = currentHash.substring(byteIndex, byteIndex + 2);
      const value = parseInt(byte, 16);
      const symbolIndex = value % symbols.length;
      
      result.push(symbols[symbolIndex]);
      
      // Rehash if needed
      if (byteIndex >= 62) {
        currentHash = crypto.createHash('sha256').update(currentHash).digest('hex');
      }
    }
    
    return result;
  }

  /**
   * Verify game result
   * @param {string} serverSeed - Server seed
   * @param {string} clientSeed - Client seed
   * @param {number} nonce - Game nonce
   * @param {string} expectedHash - Expected result hash
   * @returns {boolean} True if verification passes
   */
  static verifyResult(serverSeed, clientSeed, nonce, expectedHash) {
    const calculatedHash = this.generateResult(serverSeed, clientSeed, nonce);
    return calculatedHash === expectedHash;
  }

  /**
   * Generate game session seeds
   * @returns {Object} Server seed, hash, and client seed
   */
  static generateGameSeeds() {
    const serverSeed = this.generateServerSeed();
    const serverSeedHash = this.generateServerSeedHash(serverSeed);
    const clientSeed = this.generateClientSeed();
    
    return {
      serverSeed,
      serverSeedHash,
      clientSeed
    };
  }

  /**
   * Calculate house edge for different games
   * @param {string} gameType - Type of game
   * @returns {number} House edge percentage
   */
  static getHouseEdge(gameType) {
    const houseEdges = {
      crash: 1.0,
      dice: 1.0,
      plinko: 1.0,
      roulette: 2.7, // European roulette
      blackjack: 0.5,
      baccarat: 1.06,
      slots: 4.0 // Average for slots
    };
    
    return houseEdges[gameType] || 2.0;
  }

  /**
   * Calculate theoretical RTP (Return to Player)
   * @param {string} gameType - Type of game
   * @returns {number} RTP percentage
   */
  static getRTP(gameType) {
    const houseEdge = this.getHouseEdge(gameType);
    return 100 - houseEdge;
  }
}

module.exports = ProvablyFair;

