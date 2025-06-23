const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/authEnhanced');
const { ProviderManager } = require('../games/providers/providerManager');
const Game = require('../models/Game');
const { SecurityMonitor } = require('../utils/securityMonitor');

const router = express.Router();
const providerManager = new ProviderManager();

// @route   GET /api/providers/list
// @desc    Get list of available providers
// @access  Public
router.get('/list', (req, res) => {
  try {
    const providers = providerManager.getAvailableProviders();
    
    res.json({
      success: true,
      providers
    });

  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/providers/sync-games
// @desc    Sync games from all providers
// @access  Private (Admin only)
router.post('/sync-games', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const results = await providerManager.syncAllGames();
    
    res.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Error syncing games:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/providers/:provider/launch
// @desc    Launch game from specific provider
// @access  Private
router.post('/:provider/launch', [
  auth,
  body('gameId').notEmpty(),
  body('currency').optional().isIn(['BTC', 'ETH', 'USDT', 'USD']),
  body('language').optional().isString(),
  body('mode').optional().isIn(['real', 'demo'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { provider } = req.params;
    const { gameId, currency = 'USD', language = 'en', mode = 'real' } = req.body;
    const userId = req.user.id;

    // Check if game exists
    const game = await Game.findOne({ 
      slug: gameId, 
      provider: provider,
      status: 'active' 
    });

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found'
      });
    }

    // Launch game
    const launchData = await providerManager.launchGame(provider, gameId, userId, {
      currency,
      language,
      mode,
      returnUrl: `${process.env.FRONTEND_URL}/games`
    });

    // Log game launch
    await SecurityMonitor.logEvent({
      userId,
      eventType: 'game_launch',
      severity: 'low',
      description: `Launched ${provider} game: ${gameId}`,
      metadata: {
        additionalData: {
          provider,
          gameId,
          currency,
          mode
        }
      }
    });

    res.json({
      success: true,
      ...launchData
    });

  } catch (error) {
    console.error('Error launching game:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/providers/pragmatic/balance
// @desc    Get user balance for Pragmatic Play
// @access  Provider callback
router.post('/pragmatic/balance', async (req, res) => {
  try {
    const { user_id, currency, session_id } = req.body;

    // Validate request signature (implement signature validation)
    // This is a simplified version - in production, validate the signature

    const balanceData = await providerManager.getBalance('pragmatic', user_id, currency);
    
    res.json(balanceData);

  } catch (error) {
    console.error('Pragmatic balance error:', error);
    res.status(400).json({
      error_code: 'BALANCE_ERROR',
      message: error.message
    });
  }
});

// @route   POST /api/providers/pragmatic/transaction
// @desc    Process transaction for Pragmatic Play
// @access  Provider callback
router.post('/pragmatic/transaction', async (req, res) => {
  try {
    const transactionData = req.body;

    // Validate request signature (implement signature validation)
    // This is a simplified version - in production, validate the signature

    const result = await providerManager.processTransaction('pragmatic', transactionData);
    
    res.json(result);

  } catch (error) {
    console.error('Pragmatic transaction error:', error);
    res.status(400).json({
      status: 'error',
      error_code: 'TRANSACTION_ERROR',
      message: error.message
    });
  }
});

// @route   POST /api/providers/evolution/authenticate
// @desc    Authenticate user for Evolution Gaming
// @access  Provider callback
router.post('/evolution/authenticate', async (req, res) => {
  try {
    const { token, user_id } = req.body;

    // Validate token and get user data
    const User = require('../models/User');
    const user = await User.findById(user_id);

    if (!user) {
      return res.status(404).json({
        status: 'FAILED',
        uuid: user_id,
        currency: 'USD',
        cash: 0,
        bonus: 0,
        error: {
          code: 1,
          message: 'User not found'
        }
      });
    }

    res.json({
      status: 'OK',
      uuid: user_id,
      currency: 'USD',
      cash: Math.round((user.wallet.balance.USD || 0) * 100), // Convert to cents
      bonus: 0, // Implement bonus balance if needed
      session: {
        id: token,
        ip: req.ip
      }
    });

  } catch (error) {
    console.error('Evolution authentication error:', error);
    res.status(500).json({
      status: 'FAILED',
      error: {
        code: 99,
        message: 'Internal server error'
      }
    });
  }
});

// @route   POST /api/providers/evolution/balance
// @desc    Get user balance for Evolution Gaming
// @access  Provider callback
router.post('/evolution/balance', async (req, res) => {
  try {
    const { uuid } = req.body;

    const balanceData = await providerManager.getBalance('evolution', uuid, 'USD');
    
    res.json({
      status: 'OK',
      uuid,
      currency: 'USD',
      cash: balanceData.balance,
      bonus: 0
    });

  } catch (error) {
    console.error('Evolution balance error:', error);
    res.status(400).json({
      status: 'FAILED',
      error: {
        code: 2,
        message: error.message
      }
    });
  }
});

// @route   POST /api/providers/evolution/debit
// @desc    Process debit transaction for Evolution Gaming
// @access  Provider callback
router.post('/evolution/debit', async (req, res) => {
  try {
    const { uuid, transaction, game } = req.body;

    const transactionData = {
      user_id: uuid,
      transaction_id: transaction.id,
      amount: transaction.amount,
      currency: 'USD',
      transaction_type: 'debit',
      game_id: game.id,
      round_id: transaction.refId,
      game_data: game
    };

    const result = await providerManager.processTransaction('evolution', transactionData);
    
    if (result.status === 'success') {
      res.json({
        status: 'OK',
        uuid,
        currency: 'USD',
        cash: result.balance,
        bonus: 0,
        transaction: {
          id: transaction.id,
          refId: transaction.refId
        }
      });
    } else {
      res.status(400).json({
        status: 'FAILED',
        error: {
          code: 3,
          message: result.message
        }
      });
    }

  } catch (error) {
    console.error('Evolution debit error:', error);
    res.status(400).json({
      status: 'FAILED',
      error: {
        code: 3,
        message: error.message
      }
    });
  }
});

// @route   POST /api/providers/evolution/credit
// @desc    Process credit transaction for Evolution Gaming
// @access  Provider callback
router.post('/evolution/credit', async (req, res) => {
  try {
    const { uuid, transaction, game } = req.body;

    const transactionData = {
      user_id: uuid,
      transaction_id: transaction.id,
      amount: transaction.amount,
      currency: 'USD',
      transaction_type: 'credit',
      game_id: game.id,
      round_id: transaction.refId,
      game_data: game
    };

    const result = await providerManager.processTransaction('evolution', transactionData);
    
    if (result.status === 'success') {
      res.json({
        status: 'OK',
        uuid,
        currency: 'USD',
        cash: result.balance,
        bonus: 0,
        transaction: {
          id: transaction.id,
          refId: transaction.refId
        }
      });
    } else {
      res.status(400).json({
        status: 'FAILED',
        error: {
          code: 4,
          message: result.message
        }
      });
    }

  } catch (error) {
    console.error('Evolution credit error:', error);
    res.status(400).json({
      status: 'FAILED',
      error: {
        code: 4,
        message: error.message
      }
    });
  }
});

// @route   POST /api/providers/netent/callback
// @desc    Handle NetEnt game callbacks
// @access  Provider callback
router.post('/netent/callback', async (req, res) => {
  try {
    const { method, params } = req.body;

    switch (method) {
      case 'balance':
        const balanceData = await providerManager.getBalance('netent', params.userId, params.currency);
        res.json({
          jsonrpc: '2.0',
          result: {
            balance: balanceData.balance,
            currency: params.currency
          },
          id: req.body.id
        });
        break;

      case 'debit':
        const debitResult = await providerManager.processTransaction('netent', {
          user_id: params.userId,
          transaction_id: params.transactionId,
          amount: params.amount,
          currency: params.currency,
          transaction_type: 'debit',
          game_id: params.gameId,
          round_id: params.roundId
        });

        res.json({
          jsonrpc: '2.0',
          result: {
            balance: debitResult.balance,
            transactionId: params.transactionId
          },
          id: req.body.id
        });
        break;

      case 'credit':
        const creditResult = await providerManager.processTransaction('netent', {
          user_id: params.userId,
          transaction_id: params.transactionId,
          amount: params.amount,
          currency: params.currency,
          transaction_type: 'credit',
          game_id: params.gameId,
          round_id: params.roundId
        });

        res.json({
          jsonrpc: '2.0',
          result: {
            balance: creditResult.balance,
            transactionId: params.transactionId
          },
          id: req.body.id
        });
        break;

      default:
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: 'Method not found'
          },
          id: req.body.id
        });
    }

  } catch (error) {
    console.error('NetEnt callback error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error'
      },
      id: req.body.id
    });
  }
});

// @route   GET /api/providers/:provider/games
// @desc    Get games from specific provider
// @access  Public
router.get('/:provider/games', async (req, res) => {
  try {
    const { provider } = req.params;
    const { category, limit = 50, page = 1 } = req.query;

    const query = { 
      provider: provider,
      status: 'active'
    };

    if (category) {
      query.category = category;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [games, total] = await Promise.all([
      Game.find(query)
        .sort({ popularity: -1, name: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Game.countDocuments(query)
    ]);

    res.json({
      success: true,
      games,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching provider games:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/providers/games/search
// @desc    Search games across all providers
// @access  Public
router.get('/games/search', async (req, res) => {
  try {
    const { 
      q, 
      provider, 
      category, 
      type,
      limit = 20,
      page = 1 
    } = req.query;

    const query = { status: 'active' };

    if (q) {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { slug: { $regex: q, $options: 'i' } }
      ];
    }

    if (provider) query.provider = provider;
    if (category) query.category = category;
    if (type) query.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [games, total] = await Promise.all([
      Game.find(query)
        .sort({ popularity: -1, name: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Game.countDocuments(query)
    ]);

    res.json({
      success: true,
      games,
      query: { q, provider, category, type },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error searching games:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/providers/games/popular
// @desc    Get popular games across all providers
// @access  Public
router.get('/games/popular', async (req, res) => {
  try {
    const { limit = 20, category } = req.query;

    const query = { status: 'active' };
    if (category) query.category = category;

    const games = await Game.find(query)
      .sort({ popularity: -1, 'statistics.totalPlayed': -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      games
    });

  } catch (error) {
    console.error('Error fetching popular games:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/providers/games/new
// @desc    Get newest games across all providers
// @access  Public
router.get('/games/new', async (req, res) => {
  try {
    const { limit = 20, category } = req.query;

    const query = { status: 'active' };
    if (category) query.category = category;

    const games = await Game.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      games
    });

  } catch (error) {
    console.error('Error fetching new games:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

