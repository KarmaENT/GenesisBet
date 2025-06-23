const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Game = require('../models/Game');
const GameSession = require('../models/GameSession');
const { SecurityMonitor } = require('../utils/securityMonitor');
const auth = require('../middleware/authEnhanced');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// Apply auth middleware to all admin routes
router.use(auth);
router.use(adminAuth);

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin)
router.get('/dashboard', async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    
    // Calculate time range
    const now = new Date();
    let startTime;
    
    switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // User statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ 
      lastLogin: { $gte: startTime } 
    });
    const newUsers = await User.countDocuments({ 
      createdAt: { $gte: startTime } 
    });

    // Transaction statistics
    const transactionStats = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startTime },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const totalRevenue = transactionStats
      .filter(stat => stat._id === 'deposit')
      .reduce((sum, stat) => sum + stat.totalAmount, 0);

    const totalWithdrawals = transactionStats
      .filter(stat => stat._id === 'withdrawal')
      .reduce((sum, stat) => sum + stat.totalAmount, 0);

    // Game statistics
    const gameStats = await GameSession.aggregate([
      {
        $match: {
          createdAt: { $gte: startTime },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$gameId',
          plays: { $sum: 1 },
          totalBet: { $sum: '$betAmount' },
          totalWin: { $sum: '$winAmount' },
          revenue: { $sum: { $subtract: ['$betAmount', '$winAmount'] } }
        }
      },
      {
        $lookup: {
          from: 'games',
          localField: '_id',
          foreignField: '_id',
          as: 'game'
        }
      },
      {
        $unwind: '$game'
      },
      {
        $project: {
          name: '$game.name',
          plays: 1,
          totalBet: 1,
          totalWin: 1,
          revenue: 1
        }
      },
      {
        $sort: { revenue: -1 }
      }
    ]);

    // Security alerts
    const securityAlerts = await SecurityMonitor.getRecentAlerts(50);

    // Pending actions
    const pendingWithdrawals = await Transaction.countDocuments({
      type: 'withdrawal',
      status: 'pending'
    });

    const pendingKyc = await User.countDocuments({
      'kyc.status': 'pending'
    });

    // Revenue over time
    const revenueOverTime = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startTime },
          status: 'completed',
          type: 'deposit'
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: timeRange === '1h' ? '%H:%M' : 
                     timeRange === '24h' ? '%H:00' :
                     timeRange === '7d' ? '%Y-%m-%d' : '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          activeUsers,
          newUsers,
          totalRevenue,
          totalWithdrawals,
          netRevenue: totalRevenue - totalWithdrawals,
          pendingWithdrawals,
          pendingKyc,
          securityAlertsCount: securityAlerts.filter(alert => alert.severity === 'high').length
        },
        gameStats,
        revenueOverTime,
        securityAlerts: securityAlerts.slice(0, 10), // Latest 10 alerts
        timeRange
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get users with filtering and pagination
// @access  Private (Admin)
router.get('/users', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      kycStatus,
      vipLevel,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Apply filters
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.status = status;
    }

    if (kycStatus) {
      query['kyc.status'] = kycStatus;
    }

    if (vipLevel) {
      query['vip.level'] = parseInt(vipLevel);
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const users = await User.find(query)
      .select('-password -security.twoFactorSecret -security.backupCodes')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/users/:id
// @desc    Get detailed user information
// @access  Private (Admin)
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select('-password -security.twoFactorSecret -security.backupCodes');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's transaction history
    const transactions = await Transaction.find({ userId: id })
      .sort({ createdAt: -1 })
      .limit(50);

    // Get user's game sessions
    const gameSessions = await GameSession.find({ userId: id })
      .populate('gameId', 'name category')
      .sort({ createdAt: -1 })
      .limit(50);

    // Get user's security events
    const securityEvents = await SecurityMonitor.getUserEvents(id, 20);

    res.json({
      success: true,
      data: {
        user,
        transactions,
        gameSessions,
        securityEvents
      }
    });

  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user information
// @access  Private (Admin)
router.put('/users/:id', [
  body('status').optional().isIn(['active', 'suspended', 'banned']),
  body('kyc.status').optional().isIn(['pending', 'approved', 'rejected']),
  body('vip.level').optional().isInt({ min: 0, max: 10 }),
  body('limits.dailyDeposit').optional().isFloat({ min: 0 }),
  body('limits.dailyWithdrawal').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updates = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -security.twoFactorSecret -security.backupCodes');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Log admin action
    await SecurityMonitor.logEvent({
      userId: req.user.id,
      eventType: 'admin_user_update',
      severity: 'medium',
      description: `Admin updated user ${user.username}`,
      metadata: {
        targetUserId: id,
        updates,
        adminId: req.user.id
      }
    });

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/transactions
// @desc    Get transactions with filtering and pagination
// @access  Private (Admin)
router.get('/transactions', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      type,
      status,
      currency,
      userId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Apply filters
    if (type) query.type = type;
    if (status) query.status = status;
    if (currency) query.currency = currency;
    if (userId) query.userId = userId;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const transactions = await Transaction.find(query)
      .populate('userId', 'username email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(query);

    // Get summary statistics
    const summary = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        transactions,
        summary: summary[0] || { totalAmount: 0, count: 0, avgAmount: 0 },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/admin/transactions/:id
// @desc    Update transaction status
// @access  Private (Admin)
router.put('/transactions/:id', [
  body('status').isIn(['pending', 'processing', 'completed', 'failed', 'cancelled']),
  body('adminNotes').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    const oldStatus = transaction.status;
    transaction.status = status;
    if (adminNotes) {
      transaction.adminNotes = adminNotes;
    }
    transaction.updatedAt = new Date();

    await transaction.save();

    // Log admin action
    await SecurityMonitor.logEvent({
      userId: req.user.id,
      eventType: 'admin_transaction_update',
      severity: 'medium',
      description: `Admin updated transaction ${id} status from ${oldStatus} to ${status}`,
      metadata: {
        transactionId: id,
        oldStatus,
        newStatus: status,
        adminNotes,
        adminId: req.user.id
      }
    });

    res.json({
      success: true,
      data: { transaction }
    });

  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/games/sessions
// @desc    Get game sessions with filtering
// @access  Private (Admin)
router.get('/games/sessions', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      gameId,
      userId,
      status,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    if (gameId) query.gameId = gameId;
    if (userId) query.userId = userId;
    if (status) query.status = status;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const sessions = await GameSession.find(query)
      .populate('gameId', 'name category provider')
      .populate('userId', 'username')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await GameSession.countDocuments(query);

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching game sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/security/events
// @desc    Get security events
// @access  Private (Admin)
router.get('/security/events', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      severity,
      eventType,
      userId,
      startDate,
      endDate
    } = req.query;

    const filters = {
      severity,
      eventType,
      userId,
      startDate,
      endDate,
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const events = await SecurityMonitor.getEvents(filters);

    res.json({
      success: true,
      data: events
    });

  } catch (error) {
    console.error('Error fetching security events:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/reports/revenue
// @desc    Generate revenue report
// @access  Private (Admin)
router.get('/reports/revenue', async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    let dateFormat;
    switch (groupBy) {
      case 'hour':
        dateFormat = '%Y-%m-%d %H:00';
        break;
      case 'day':
        dateFormat = '%Y-%m-%d';
        break;
      case 'week':
        dateFormat = '%Y-W%U';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
      default:
        dateFormat = '%Y-%m-%d';
    }

    const revenueReport = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: dateFormat,
                date: '$createdAt'
              }
            },
            type: '$type',
            currency: '$currency'
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          deposits: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'deposit'] }, '$totalAmount', 0]
            }
          },
          withdrawals: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'withdrawal'] }, '$totalAmount', 0]
            }
          },
          depositCount: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'deposit'] }, '$count', 0]
            }
          },
          withdrawalCount: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'withdrawal'] }, '$count', 0]
            }
          }
        }
      },
      {
        $addFields: {
          netRevenue: { $subtract: ['$deposits', '$withdrawals'] }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        report: revenueReport,
        summary: {
          totalDeposits: revenueReport.reduce((sum, item) => sum + item.deposits, 0),
          totalWithdrawals: revenueReport.reduce((sum, item) => sum + item.withdrawals, 0),
          netRevenue: revenueReport.reduce((sum, item) => sum + item.netRevenue, 0),
          totalTransactions: revenueReport.reduce((sum, item) => sum + item.depositCount + item.withdrawalCount, 0)
        },
        period: { startDate: start, endDate: end, groupBy }
      }
    });

  } catch (error) {
    console.error('Error generating revenue report:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/admin/system/maintenance
// @desc    Toggle maintenance mode
// @access  Private (Admin)
router.post('/system/maintenance', [
  body('enabled').isBoolean(),
  body('message').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { enabled, message } = req.body;

    // In a real implementation, this would update a system configuration
    // For now, we'll just log the action
    await SecurityMonitor.logEvent({
      userId: req.user.id,
      eventType: 'admin_maintenance_toggle',
      severity: 'high',
      description: `Admin ${enabled ? 'enabled' : 'disabled'} maintenance mode`,
      metadata: {
        enabled,
        message,
        adminId: req.user.id
      }
    });

    res.json({
      success: true,
      data: {
        maintenanceMode: enabled,
        message: message || 'System maintenance in progress'
      }
    });

  } catch (error) {
    console.error('Error toggling maintenance mode:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

