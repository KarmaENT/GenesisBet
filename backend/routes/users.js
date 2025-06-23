const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -security.twoFactorSecret');
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', [
  auth,
  body('phone').optional().isMobilePhone(),
  body('preferences.currency').optional().isIn(['BTC', 'ETH', 'USDT', 'USD']),
  body('preferences.language').optional().isLength({ min: 2, max: 5 }),
  body('preferences.theme').optional().isIn(['light', 'dark'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { phone, preferences } = req.body;
    const updateFields = {};

    if (phone !== undefined) updateFields.phone = phone;
    if (preferences) {
      if (preferences.currency) updateFields['preferences.currency'] = preferences.currency;
      if (preferences.language) updateFields['preferences.language'] = preferences.language;
      if (preferences.theme) updateFields['preferences.theme'] = preferences.theme;
      if (preferences.notifications) {
        if (preferences.notifications.email !== undefined) 
          updateFields['preferences.notifications.email'] = preferences.notifications.email;
        if (preferences.notifications.sms !== undefined) 
          updateFields['preferences.notifications.sms'] = preferences.notifications.sms;
        if (preferences.notifications.push !== undefined) 
          updateFields['preferences.notifications.push'] = preferences.notifications.push;
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true }
    ).select('-password -security.twoFactorSecret');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/users/balance
// @desc    Get user wallet balance
// @access  Private
router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('wallet.balance');
    
    res.json({
      success: true,
      balance: user.wallet.balance
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/users/limits
// @desc    Update user limits (self-imposed)
// @access  Private
router.put('/limits', [
  auth,
  body('dailyDeposit').optional().isNumeric().isFloat({ min: 0 }),
  body('dailyWithdrawal').optional().isNumeric().isFloat({ min: 0 }),
  body('sessionTime').optional().isNumeric().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { dailyDeposit, dailyWithdrawal, sessionTime } = req.body;
    const updateFields = {};

    if (dailyDeposit !== undefined) updateFields['limits.dailyDeposit'] = dailyDeposit;
    if (dailyWithdrawal !== undefined) updateFields['limits.dailyWithdrawal'] = dailyWithdrawal;
    if (sessionTime !== undefined) updateFields['limits.sessionTime'] = sessionTime;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true }
    ).select('limits');

    res.json({
      success: true,
      message: 'Limits updated successfully',
      limits: user.limits
    });
  } catch (error) {
    console.error('Update limits error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/users/self-exclusion
// @desc    Set self-exclusion period
// @access  Private
router.post('/self-exclusion', [
  auth,
  body('period').isIn(['24h', '7d', '30d', '90d', '180d', '365d', 'permanent'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { period } = req.body;
    let exclusionDate;

    const now = new Date();
    switch (period) {
      case '24h':
        exclusionDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case '7d':
        exclusionDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        exclusionDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        exclusionDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        break;
      case '180d':
        exclusionDate = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
        break;
      case '365d':
        exclusionDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
        break;
      case 'permanent':
        exclusionDate = new Date('2099-12-31');
        break;
    }

    await User.findByIdAndUpdate(req.user.id, {
      $set: {
        'limits.selfExclusion': exclusionDate,
        status: 'suspended'
      }
    });

    res.json({
      success: true,
      message: `Self-exclusion set for ${period}`,
      exclusionUntil: exclusionDate
    });
  } catch (error) {
    console.error('Self-exclusion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/users/cooling-off
// @desc    Set cooling-off period
// @access  Private
router.post('/cooling-off', [
  auth,
  body('hours').isInt({ min: 1, max: 168 }) // 1 hour to 7 days
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { hours } = req.body;
    const coolingOffUntil = new Date(Date.now() + hours * 60 * 60 * 1000);

    await User.findByIdAndUpdate(req.user.id, {
      $set: {
        'limits.coolingOff': coolingOffUntil
      }
    });

    res.json({
      success: true,
      message: `Cooling-off period set for ${hours} hours`,
      coolingOffUntil
    });
  } catch (error) {
    console.error('Cooling-off error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/users/stats
// @desc    Get user statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('profile');
    
    res.json({
      success: true,
      stats: {
        tier: user.profile.tier,
        totalWagered: user.profile.totalWagered,
        totalDeposited: user.profile.totalDeposited,
        totalWithdrawn: user.profile.totalWithdrawn,
        gamesPlayed: user.profile.gamesPlayed,
        winRate: user.profile.winRate
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

