const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/authEnhanced');
const Game = require('../models/Game');
const GameSession = require('../models/GameSession');
const GameManager = require('../games/gameManager');
const { SecurityMonitor } = require('../utils/securityMonitor');

const router = express.Router();

// Initialize game manager
const gameManager = new GameManager();

// @route   GET /api/games/list
// @desc    Get list of available games
// @access  Public
router.get('/list', async (req, res) => {
  try {
    const { category, provider, status = 'active' } = req.query;
    
    const query = { status };
    if (category) query.category = category;
    if (provider) query.provider = provider;

    const games = await Game.find(query)
      .select('-statistics.serverSeed') // Don't expose server seeds
      .sort({ popularity: -1, name: 1 });

    res.json({
      success: true,
      games,
      total: games.length
    });

  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/games/:slug
// @desc    Get game details
// @access  Public
router.get('/:slug', async (req, res) => {
  try {
    const game = await Game.findOne({ 
      slug: req.params.slug,
      status: 'active'
    }).select('-statistics.serverSeed');

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found'
      });
    }

    res.json({
      success: true,
      game
    });

  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/games/crash/play
// @desc    Play crash game
// @access  Private
router.post('/crash/play', [
  auth,
  body('betAmount').isFloat({ min: 0.01, max: 1000 }),
  body('currency').isIn(['BTC', 'ETH', 'USDT', 'USD']),
  body('autoCashOut').optional().isFloat({ min: 1.01, max: 1000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { betAmount, currency, autoCashOut } = req.body;
    const userId = req.user.id;

    const result = await gameManager.playCrash(userId, betAmount, currency, autoCashOut);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Error playing crash:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/games/crash/cashout
// @desc    Cash out from crash game
// @access  Private
router.post('/crash/cashout', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await gameManager.crashCashOut(userId);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Error cashing out:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/games/crash/state
// @desc    Get current crash game state
// @access  Public
router.get('/crash/state', (req, res) => {
  try {
    const gameState = gameManager.getCrashGameState();
    
    res.json({
      success: true,
      gameState
    });

  } catch (error) {
    console.error('Error getting crash state:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/games/dice/play
// @desc    Play dice game
// @access  Private
router.post('/dice/play', [
  auth,
  body('betAmount').isFloat({ min: 0.01, max: 1000 }),
  body('currency').isIn(['BTC', 'ETH', 'USDT', 'USD']),
  body('target').isFloat({ min: 0, max: 100 }),
  body('direction').isIn(['over', 'under']),
  body('clientSeed').optional().isString(),
  body('nonce').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { betAmount, currency, target, direction, clientSeed, nonce = 0 } = req.body;
    const userId = req.user.id;

    const result = await gameManager.playDice(
      userId, 
      betAmount, 
      currency, 
      target, 
      direction, 
      clientSeed, 
      nonce
    );

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Error playing dice:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/games/plinko/play
// @desc    Play Plinko game
// @access  Private
router.post('/plinko/play', [
  auth,
  body('betAmount').isFloat({ min: 0.01, max: 100 }),
  body('currency').isIn(['BTC', 'ETH', 'USDT', 'USD']),
  body('risk').isIn(['low', 'medium', 'high']),
  body('clientSeed').optional().isString(),
  body('nonce').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { betAmount, currency, risk, clientSeed, nonce = 0 } = req.body;
    const userId = req.user.id;

    const result = await gameManager.playPlinko(
      userId, 
      betAmount, 
      currency, 
      risk, 
      clientSeed, 
      nonce
    );

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Error playing Plinko:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/games/verify
// @desc    Verify provably fair game result
// @access  Public
router.post('/verify', [
  body('gameType').isIn(['crash', 'dice', 'plinko']),
  body('gameResult').isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { gameType, gameResult } = req.body;
    
    const verification = gameManager.verifyGameResult(gameType, gameResult);

    res.json({
      success: true,
      verification
    });

  } catch (error) {
    console.error('Error verifying game:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/games/history
// @desc    Get user's game history
// @access  Private
router.get('/history', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      gameType, 
      outcome,
      startDate,
      endDate 
    } = req.query;

    const query = { userId: req.user.id, status: 'completed' };
    
    if (gameType) {
      // Find game by slug
      const game = await Game.findOne({ slug: gameType });
      if (game) {
        query.gameId = game._id;
      }
    }
    
    if (outcome) {
      query['result.outcome'] = outcome;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [sessions, total] = await Promise.all([
      GameSession.find(query)
        .populate('gameId', 'name slug category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      GameSession.countDocuments(query)
    ]);

    res.json({
      success: true,
      sessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching game history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/games/stats
// @desc    Get game statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const { gameType, period = '30d' } = req.query;
    const userId = req.user.id;

    const stats = await gameManager.getGameStats(gameType, userId);

    res.json({
      success: true,
      stats,
      period
    });

  } catch (error) {
    console.error('Error fetching game stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/games/leaderboard
// @desc    Get game leaderboard
// @access  Public
router.get('/leaderboard', async (req, res) => {
  try {
    const { 
      gameType, 
      period = '24h', 
      metric = 'profit',
      limit = 10 
    } = req.query;

    let startDate = new Date();
    switch (period) {
      case '1h':
        startDate.setHours(startDate.getHours() - 1);
        break;
      case '24h':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate.setDate(startDate.getDate() - 1);
    }

    const matchStage = {
      status: 'completed',
      createdAt: { $gte: startDate }
    };

    if (gameType) {
      const game = await Game.findOne({ slug: gameType });
      if (game) {
        matchStage.gameId = game._id;
      }
    }

    const leaderboard = await GameSession.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$userId',
          totalProfit: { $sum: '$result.profit' },
          totalWagered: { $sum: '$betAmount' },
          totalWon: { $sum: '$result.payout' },
          gamesPlayed: { $sum: 1 },
          biggestWin: { $max: '$result.payout' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          username: '$user.username',
          totalProfit: 1,
          totalWagered: 1,
          totalWon: 1,
          gamesPlayed: 1,
          biggestWin: 1,
          winRate: {
            $cond: {
              if: { $gt: ['$gamesPlayed', 0] },
              then: { $multiply: [{ $divide: ['$totalWon', '$totalWagered'] }, 100] },
              else: 0
            }
          }
        }
      },
      { $sort: { [metric]: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      leaderboard,
      period,
      metric
    });

  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/games/recent-wins
// @desc    Get recent big wins
// @access  Public
router.get('/recent-wins', async (req, res) => {
  try {
    const { limit = 10, minAmount = 10 } = req.query;

    const recentWins = await GameSession.find({
      status: 'completed',
      'result.outcome': 'win',
      'result.payout': { $gte: parseFloat(minAmount) }
    })
    .populate('userId', 'username')
    .populate('gameId', 'name slug')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .select('userId gameId result.payout result.multiplier betAmount currency createdAt');

    // Anonymize usernames for privacy
    const anonymizedWins = recentWins.map(win => ({
      username: win.userId.username.substring(0, 3) + '***',
      game: win.gameId.name,
      betAmount: win.betAmount,
      payout: win.result.payout,
      multiplier: win.result.multiplier,
      currency: win.currency,
      timestamp: win.createdAt
    }));

    res.json({
      success: true,
      recentWins: anonymizedWins
    });

  } catch (error) {
    console.error('Error fetching recent wins:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/games/config/:gameType
// @desc    Get game configuration
// @access  Public
router.get('/config/:gameType', (req, res) => {
  try {
    const { gameType } = req.params;
    let config;

    switch (gameType) {
      case 'dice':
        config = gameManager.diceGame.getConfig();
        break;
      case 'plinko':
        config = gameManager.plinkoGame.getConfig();
        break;
      case 'crash':
        config = gameManager.crashGame.config;
        break;
      default:
        return res.status(404).json({
          success: false,
          message: 'Game type not found'
        });
    }

    res.json({
      success: true,
      config
    });

  } catch (error) {
    console.error('Error fetching game config:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

