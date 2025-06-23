const axios = require('axios');
const crypto = require('crypto');

class ThirdPartyProvider {
  constructor(config) {
    this.config = config;
    this.baseURL = config.baseURL;
    this.apiKey = config.apiKey;
    this.secretKey = config.secretKey;
    this.operatorId = config.operatorId;
  }

  /**
   * Generate authentication signature
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @returns {string} Signature
   */
  generateSignature(method, endpoint, data = {}) {
    const timestamp = Date.now();
    const nonce = crypto.randomBytes(16).toString('hex');
    
    let payload = `${method}${endpoint}${timestamp}${nonce}`;
    
    if (Object.keys(data).length > 0) {
      payload += JSON.stringify(data);
    }
    
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(payload)
      .digest('hex');
    
    return {
      signature,
      timestamp,
      nonce
    };
  }

  /**
   * Make authenticated API request
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @returns {Object} API response
   */
  async makeRequest(method, endpoint, data = {}) {
    try {
      const auth = this.generateSignature(method, endpoint, data);
      
      const headers = {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'X-Operator-ID': this.operatorId,
        'X-Timestamp': auth.timestamp,
        'X-Nonce': auth.nonce,
        'X-Signature': auth.signature
      };

      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers,
        timeout: 30000
      };

      if (method.toLowerCase() !== 'get') {
        config.data = data;
      } else if (Object.keys(data).length > 0) {
        config.params = data;
      }

      const response = await axios(config);
      return response.data;

    } catch (error) {
      console.error(`Provider API error (${this.config.name}):`, error.message);
      throw new Error(`Provider API error: ${error.message}`);
    }
  }
}

class PragmaticPlayProvider extends ThirdPartyProvider {
  constructor(config) {
    super(config);
    this.name = 'Pragmatic Play';
  }

  /**
   * Get available games
   * @returns {Array} List of games
   */
  async getGames() {
    const response = await this.makeRequest('GET', '/games');
    
    return response.games.map(game => ({
      providerId: game.id,
      name: game.name,
      slug: game.game_id,
      category: game.category,
      type: game.type,
      rtp: game.rtp,
      volatility: game.volatility,
      thumbnail: game.thumbnail,
      provider: this.name,
      features: game.features || [],
      minBet: game.min_bet,
      maxBet: game.max_bet,
      currencies: game.currencies || ['USD', 'EUR'],
      languages: game.languages || ['en'],
      devices: game.devices || ['desktop', 'mobile'],
      status: 'active'
    }));
  }

  /**
   * Launch game session
   * @param {string} gameId - Game ID
   * @param {string} userId - User ID
   * @param {string} currency - Currency
   * @param {string} language - Language
   * @param {string} returnUrl - Return URL
   * @returns {Object} Game launch data
   */
  async launchGame(gameId, userId, currency = 'USD', language = 'en', returnUrl = '') {
    const sessionData = {
      game_id: gameId,
      user_id: userId,
      currency,
      language,
      return_url: returnUrl,
      session_id: this.generateSessionId(),
      balance_url: `${process.env.BASE_URL}/api/providers/pragmatic/balance`,
      transaction_url: `${process.env.BASE_URL}/api/providers/pragmatic/transaction`
    };

    const response = await this.makeRequest('POST', '/sessions', sessionData);
    
    return {
      sessionId: response.session_id,
      gameUrl: response.game_url,
      token: response.token,
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 hours
    };
  }

  /**
   * Get user balance
   * @param {string} userId - User ID
   * @param {string} currency - Currency
   * @returns {Object} Balance data
   */
  async getBalance(userId, currency) {
    // This would typically query your user database
    const User = require('../../models/User');
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    const balance = user.wallet.balance[currency] || 0;
    
    return {
      user_id: userId,
      currency,
      balance: balance * 100, // Convert to cents
      session_id: this.generateSessionId()
    };
  }

  /**
   * Process game transaction
   * @param {Object} transactionData - Transaction data
   * @returns {Object} Transaction result
   */
  async processTransaction(transactionData) {
    const {
      user_id,
      session_id,
      transaction_id,
      game_id,
      round_id,
      amount,
      currency,
      transaction_type,
      game_data
    } = transactionData;

    // Import models
    const User = require('../../models/User');
    const Transaction = require('../../models/Transaction');

    try {
      // Check for duplicate transaction
      const existingTransaction = await Transaction.findOne({
        'metadata.providerTransactionId': transaction_id
      });

      if (existingTransaction) {
        return {
          status: 'success',
          transaction_id,
          balance: existingTransaction.metadata.balanceAfter * 100
        };
      }

      const user = await User.findById(user_id);
      if (!user) {
        throw new Error('User not found');
      }

      let newBalance = user.wallet.balance[currency] || 0;
      const amountInMainCurrency = amount / 100; // Convert from cents

      // Process transaction based on type
      if (transaction_type === 'debit') {
        // Bet transaction
        if (newBalance < amountInMainCurrency) {
          throw new Error('Insufficient balance');
        }
        newBalance -= amountInMainCurrency;
      } else if (transaction_type === 'credit') {
        // Win transaction
        newBalance += amountInMainCurrency;
      }

      // Update user balance
      await User.findByIdAndUpdate(user_id, {
        [`wallet.balance.${currency}`]: newBalance
      });

      // Create transaction record
      const transaction = new Transaction({
        userId: user_id,
        type: transaction_type === 'debit' ? 'bet' : 'win',
        amount: amountInMainCurrency,
        currency,
        status: 'completed',
        metadata: {
          provider: this.name,
          providerTransactionId: transaction_id,
          gameId: game_id,
          roundId: round_id,
          sessionId: session_id,
          gameData,
          balanceBefore: user.wallet.balance[currency],
          balanceAfter: newBalance
        }
      });

      await transaction.save();

      return {
        status: 'success',
        transaction_id,
        balance: newBalance * 100 // Convert to cents
      };

    } catch (error) {
      console.error('Transaction processing error:', error);
      return {
        status: 'error',
        error_code: 'TRANSACTION_FAILED',
        message: error.message
      };
    }
  }

  /**
   * Generate session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    return `pp_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

class EvolutionGamingProvider extends ThirdPartyProvider {
  constructor(config) {
    super(config);
    this.name = 'Evolution Gaming';
  }

  /**
   * Get available live dealer games
   * @returns {Array} List of live games
   */
  async getGames() {
    const response = await this.makeRequest('GET', '/live-games');
    
    return response.games.map(game => ({
      providerId: game.id,
      name: game.name,
      slug: game.game_code,
      category: 'live_dealer',
      type: 'live',
      gameType: game.game_type, // roulette, blackjack, baccarat, etc.
      thumbnail: game.thumbnail,
      provider: this.name,
      minBet: game.limits.min,
      maxBet: game.limits.max,
      currencies: game.currencies,
      languages: game.languages,
      devices: ['desktop', 'mobile'],
      features: {
        chat: game.features.chat,
        statistics: game.features.statistics,
        roadmaps: game.features.roadmaps
      },
      status: 'active'
    }));
  }

  /**
   * Launch live game
   * @param {string} gameCode - Game code
   * @param {string} userId - User ID
   * @param {string} currency - Currency
   * @param {string} language - Language
   * @returns {Object} Game launch data
   */
  async launchGame(gameCode, userId, currency = 'USD', language = 'en') {
    const sessionData = {
      game_code: gameCode,
      user_id: userId,
      currency,
      language,
      session_id: this.generateSessionId(),
      integration_url: `${process.env.BASE_URL}/api/providers/evolution`
    };

    const response = await this.makeRequest('POST', '/launch', sessionData);
    
    return {
      sessionId: response.session_id,
      gameUrl: response.entry_url,
      token: response.token,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) // 8 hours for live games
    };
  }

  /**
   * Get game statistics
   * @param {string} gameCode - Game code
   * @param {string} tableId - Table ID (optional)
   * @returns {Object} Game statistics
   */
  async getGameStats(gameCode, tableId = null) {
    const params = { game_code: gameCode };
    if (tableId) params.table_id = tableId;

    const response = await this.makeRequest('GET', '/stats', params);
    
    return {
      gameCode,
      tableId,
      statistics: response.stats,
      lastUpdate: response.timestamp
    };
  }

  /**
   * Generate session ID for Evolution
   * @returns {string} Session ID
   */
  generateSessionId() {
    return `evo_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

class NetEntProvider extends ThirdPartyProvider {
  constructor(config) {
    super(config);
    this.name = 'NetEnt';
  }

  /**
   * Get available slot games
   * @returns {Array} List of slot games
   */
  async getGames() {
    const response = await this.makeRequest('GET', '/catalog');
    
    return response.games.map(game => ({
      providerId: game.game_id,
      name: game.title,
      slug: game.game_key,
      category: 'slots',
      type: 'slot',
      rtp: game.rtp,
      volatility: game.variance,
      thumbnail: game.thumbnail_url,
      provider: this.name,
      features: {
        freeSpins: game.features.free_spins,
        bonus: game.features.bonus_game,
        jackpot: game.features.jackpot,
        multiplier: game.features.multiplier
      },
      paylines: game.paylines,
      reels: game.reels,
      minBet: game.min_bet,
      maxBet: game.max_bet,
      currencies: game.supported_currencies,
      languages: game.supported_languages,
      devices: game.supported_devices,
      status: 'active'
    }));
  }

  /**
   * Launch slot game
   * @param {string} gameKey - Game key
   * @param {string} userId - User ID
   * @param {string} currency - Currency
   * @param {string} language - Language
   * @param {string} mode - Game mode (real/demo)
   * @returns {Object} Game launch data
   */
  async launchGame(gameKey, userId, currency = 'USD', language = 'en', mode = 'real') {
    const sessionData = {
      game_key: gameKey,
      user_id: userId,
      currency,
      language,
      mode,
      session_id: this.generateSessionId(),
      callback_url: `${process.env.BASE_URL}/api/providers/netent/callback`
    };

    const response = await this.makeRequest('POST', '/game-session', sessionData);
    
    return {
      sessionId: response.session_id,
      gameUrl: response.game_url,
      token: response.access_token,
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000) // 6 hours
    };
  }

  /**
   * Generate session ID for NetEnt
   * @returns {string} Session ID
   */
  generateSessionId() {
    return `ne_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

class ProviderManager {
  constructor() {
    this.providers = new Map();
    this.initializeProviders();
  }

  /**
   * Initialize all game providers
   */
  initializeProviders() {
    // Pragmatic Play configuration
    if (process.env.PRAGMATIC_API_KEY) {
      this.providers.set('pragmatic', new PragmaticPlayProvider({
        name: 'Pragmatic Play',
        baseURL: process.env.PRAGMATIC_BASE_URL || 'https://api.pragmaticplay.net',
        apiKey: process.env.PRAGMATIC_API_KEY,
        secretKey: process.env.PRAGMATIC_SECRET_KEY,
        operatorId: process.env.PRAGMATIC_OPERATOR_ID
      }));
    }

    // Evolution Gaming configuration
    if (process.env.EVOLUTION_API_KEY) {
      this.providers.set('evolution', new EvolutionGamingProvider({
        name: 'Evolution Gaming',
        baseURL: process.env.EVOLUTION_BASE_URL || 'https://api.evolutiongaming.com',
        apiKey: process.env.EVOLUTION_API_KEY,
        secretKey: process.env.EVOLUTION_SECRET_KEY,
        operatorId: process.env.EVOLUTION_OPERATOR_ID
      }));
    }

    // NetEnt configuration
    if (process.env.NETENT_API_KEY) {
      this.providers.set('netent', new NetEntProvider({
        name: 'NetEnt',
        baseURL: process.env.NETENT_BASE_URL || 'https://api.netent.com',
        apiKey: process.env.NETENT_API_KEY,
        secretKey: process.env.NETENT_SECRET_KEY,
        operatorId: process.env.NETENT_OPERATOR_ID
      }));
    }

    console.log(`Initialized ${this.providers.size} game providers`);
  }

  /**
   * Get provider by name
   * @param {string} providerName - Provider name
   * @returns {Object} Provider instance
   */
  getProvider(providerName) {
    const provider = this.providers.get(providerName.toLowerCase());
    if (!provider) {
      throw new Error(`Provider ${providerName} not found or not configured`);
    }
    return provider;
  }

  /**
   * Get all available providers
   * @returns {Array} List of provider names
   */
  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }

  /**
   * Sync games from all providers
   * @returns {Object} Sync results
   */
  async syncAllGames() {
    const results = {
      success: [],
      errors: [],
      totalGames: 0
    };

    for (const [providerName, provider] of this.providers) {
      try {
        console.log(`Syncing games from ${provider.name}...`);
        const games = await provider.getGames();
        
        // Save games to database
        const Game = require('../../models/Game');
        
        for (const gameData of games) {
          await Game.findOneAndUpdate(
            { slug: gameData.slug, provider: gameData.provider },
            gameData,
            { upsert: true, new: true }
          );
        }

        results.success.push({
          provider: provider.name,
          gamesCount: games.length
        });
        
        results.totalGames += games.length;
        console.log(`Synced ${games.length} games from ${provider.name}`);

      } catch (error) {
        console.error(`Error syncing games from ${provider.name}:`, error);
        results.errors.push({
          provider: provider.name,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Launch game from any provider
   * @param {string} providerName - Provider name
   * @param {string} gameId - Game ID
   * @param {string} userId - User ID
   * @param {Object} options - Launch options
   * @returns {Object} Game launch data
   */
  async launchGame(providerName, gameId, userId, options = {}) {
    const provider = this.getProvider(providerName);
    
    const {
      currency = 'USD',
      language = 'en',
      mode = 'real',
      returnUrl = ''
    } = options;

    return await provider.launchGame(gameId, userId, currency, language, mode, returnUrl);
  }

  /**
   * Process transaction from any provider
   * @param {string} providerName - Provider name
   * @param {Object} transactionData - Transaction data
   * @returns {Object} Transaction result
   */
  async processTransaction(providerName, transactionData) {
    const provider = this.getProvider(providerName);
    
    if (typeof provider.processTransaction === 'function') {
      return await provider.processTransaction(transactionData);
    } else {
      throw new Error(`Provider ${providerName} does not support transaction processing`);
    }
  }

  /**
   * Get balance from any provider
   * @param {string} providerName - Provider name
   * @param {string} userId - User ID
   * @param {string} currency - Currency
   * @returns {Object} Balance data
   */
  async getBalance(providerName, userId, currency) {
    const provider = this.getProvider(providerName);
    
    if (typeof provider.getBalance === 'function') {
      return await provider.getBalance(userId, currency);
    } else {
      throw new Error(`Provider ${providerName} does not support balance queries`);
    }
  }
}

module.exports = {
  ProviderManager,
  PragmaticPlayProvider,
  EvolutionGamingProvider,
  NetEntProvider
};

