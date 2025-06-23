const express = require('express');
const { body, validationResult } = require('express-validator');
const ResponsibleGaming = require('../utils/compliance/responsibleGaming');
const GeolocationCompliance = require('../utils/compliance/geolocation');
const User = require('../models/User');
const auth = require('../middleware/authEnhanced');

const router = express.Router();

// Apply auth middleware to all compliance routes
router.use(auth);

// @route   GET /api/compliance/responsible-gaming/status
// @desc    Get user's responsible gaming status
// @access  Private
router.get('/responsible-gaming/status', async (req, res) => {
  try {
    const userId = req.user.id;

    // Check self-exclusion status
    const exclusionStatus = await ResponsibleGaming.checkSelfExclusion(userId);
    
    // Check session time limit
    const sessionStatus = await ResponsibleGaming.checkSessionTimeLimit(userId);
    
    // Get problem gambling risk assessment
    const riskAssessment = await ResponsibleGaming.detectProblemGambling(userId);
    
    // Get user limits
    const user = await User.findById(userId).select('limits responsibleGaming');

    res.json({
      success: true,
      data: {
        selfExclusion: exclusionStatus,
        sessionStatus,
        riskAssessment,
        limits: user.limits,
        responsibleGaming: user.responsibleGaming
      }
    });

  } catch (error) {
    console.error('Error getting responsible gaming status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/compliance/responsible-gaming/limits
// @desc    Update user's responsible gaming limits
// @access  Private
router.post('/responsible-gaming/limits', [
  body('dailyDeposit').optional().isFloat({ min: 0 }),
  body('dailyWithdrawal').optional().isFloat({ min: 0 }),
  body('sessionTime').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const limits = req.body;

    const result = await ResponsibleGaming.updateLimits(userId, limits);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    console.error('Error updating limits:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/compliance/responsible-gaming/self-exclusion
// @desc    Apply self-exclusion
// @access  Private
router.post('/responsible-gaming/self-exclusion', [
  body('type').isIn(['temporary', 'permanent', 'cooling-off']),
  body('duration').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { type, duration } = req.body;

    // Validate duration requirements
    if (type === 'temporary' && (!duration || duration < 1)) {
      return res.status(400).json({
        success: false,
        message: 'Duration is required for temporary self-exclusion (minimum 1 day)'
      });
    }

    if (type === 'cooling-off' && (!duration || duration < 1)) {
      return res.status(400).json({
        success: false,
        message: 'Duration is required for cooling-off period (minimum 1 hour)'
      });
    }

    const result = await ResponsibleGaming.applySelfExclusion(userId, type, duration);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    console.error('Error applying self-exclusion:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/compliance/responsible-gaming/reality-check
// @desc    Get reality check information
// @access  Private
router.get('/responsible-gaming/reality-check', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const realityCheck = await ResponsibleGaming.sendRealityCheck(userId);

    if (realityCheck) {
      res.json({
        success: true,
        data: realityCheck
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Unable to generate reality check'
      });
    }

  } catch (error) {
    console.error('Error getting reality check:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/compliance/geolocation/verify
// @desc    Verify user's geolocation
// @access  Private
router.post('/geolocation/verify', async (req, res) => {
  try {
    const userId = req.user.id;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    const validation = await GeolocationCompliance.validateUserAccess(
      userId, 
      ipAddress, 
      userAgent
    );

    if (validation.allowed) {
      res.json({
        success: true,
        data: {
          allowed: true,
          location: validation.location,
          highRisk: validation.highRisk || false,
          warning: validation.warning || null
        }
      });
    } else {
      res.status(403).json({
        success: false,
        message: validation.reason,
        data: {
          allowed: false,
          location: validation.location || null,
          restricted: validation.restricted || false,
          requiresManualReview: validation.requiresManualReview || false
        }
      });
    }

  } catch (error) {
    console.error('Error verifying geolocation:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/compliance/geolocation/requirements
// @desc    Get compliance requirements for user's location
// @access  Private
router.get('/geolocation/requirements', async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('country');
    
    if (!user || !user.country) {
      return res.status(400).json({
        success: false,
        message: 'User country not found'
      });
    }

    const requirements = GeolocationCompliance.getComplianceRequirements(user.country);

    res.json({
      success: true,
      data: {
        country: user.country,
        requirements
      }
    });

  } catch (error) {
    console.error('Error getting compliance requirements:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/compliance/age-verification/status
// @desc    Get age verification status
// @access  Private
router.get('/age-verification/status', async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('dateOfBirth kyc');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const now = new Date();
    const birthDate = new Date(user.dateOfBirth);
    const age = Math.floor((now - birthDate) / (365.25 * 24 * 60 * 60 * 1000));

    const isVerified = age >= 18 && user.kyc.status === 'approved';
    const requiresVerification = age < 18 || user.kyc.status !== 'approved';

    res.json({
      success: true,
      data: {
        age,
        isVerified,
        requiresVerification,
        kycStatus: user.kyc.status,
        minimumAge: 18
      }
    });

  } catch (error) {
    console.error('Error checking age verification:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/compliance/deposit-limit-check
// @desc    Check if deposit is within limits
// @access  Private
router.post('/deposit-limit-check', [
  body('amount').isFloat({ min: 0.01 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { amount } = req.body;

    const limitCheck = await ResponsibleGaming.checkDailyDepositLimit(userId, amount);

    res.json({
      success: true,
      data: limitCheck
    });

  } catch (error) {
    console.error('Error checking deposit limit:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/compliance/withdrawal-limit-check
// @desc    Check if withdrawal is within limits
// @access  Private
router.post('/withdrawal-limit-check', [
  body('amount').isFloat({ min: 0.01 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { amount } = req.body;

    const limitCheck = await ResponsibleGaming.checkDailyWithdrawalLimit(userId, amount);

    res.json({
      success: true,
      data: limitCheck
    });

  } catch (error) {
    console.error('Error checking withdrawal limit:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/compliance/problem-gambling/resources
// @desc    Get problem gambling resources and support information
// @access  Private
router.get('/problem-gambling/resources', async (req, res) => {
  try {
    const resources = {
      helplines: [
        {
          name: 'National Problem Gambling Helpline',
          phone: '1-800-522-4700',
          website: 'https://www.ncpgambling.org',
          description: '24/7 confidential support for problem gambling'
        },
        {
          name: 'Gamblers Anonymous',
          phone: '1-855-222-5542',
          website: 'https://www.gamblersanonymous.org',
          description: 'Fellowship of men and women who share their experience'
        },
        {
          name: 'GamCare',
          phone: '0808 8020 133',
          website: 'https://www.gamcare.org.uk',
          description: 'UK-based gambling support and information'
        }
      ],
      selfAssessment: {
        title: 'Problem Gambling Self-Assessment',
        questions: [
          'Do you spend more time or money gambling than you can afford?',
          'Do you need to gamble with increasing amounts of money?',
          'Have you tried to stop gambling but been unable to?',
          'Do you feel restless or irritable when trying to cut down?',
          'Do you gamble to escape problems or negative feelings?',
          'Do you chase losses with more gambling?',
          'Have you lied about your gambling activities?',
          'Has gambling caused problems in relationships or work?'
        ],
        scoring: {
          '0-2': 'Low risk - Continue to gamble responsibly',
          '3-4': 'Moderate risk - Consider setting limits',
          '5-6': 'High risk - Seek professional help',
          '7-8': 'Very high risk - Contact support immediately'
        }
      },
      tools: [
        {
          name: 'Deposit Limits',
          description: 'Set daily, weekly, or monthly deposit limits'
        },
        {
          name: 'Session Time Limits',
          description: 'Limit how long you can play in one session'
        },
        {
          name: 'Reality Checks',
          description: 'Regular reminders of time and money spent'
        },
        {
          name: 'Cooling-off Period',
          description: 'Take a break from gambling for 24 hours to 6 weeks'
        },
        {
          name: 'Self-Exclusion',
          description: 'Exclude yourself from gambling for 6 months to 5 years'
        }
      ]
    };

    res.json({
      success: true,
      data: resources
    });

  } catch (error) {
    console.error('Error getting problem gambling resources:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/compliance/problem-gambling/self-assessment
// @desc    Submit problem gambling self-assessment
// @access  Private
router.post('/problem-gambling/self-assessment', [
  body('answers').isArray({ min: 8, max: 8 }),
  body('answers.*').isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { answers } = req.body;

    // Calculate score
    const score = answers.filter(answer => answer === true).length;

    // Determine risk level
    let riskLevel, recommendation;
    if (score <= 2) {
      riskLevel = 'low';
      recommendation = 'Continue to gamble responsibly. Set limits to maintain control.';
    } else if (score <= 4) {
      riskLevel = 'moderate';
      recommendation = 'Consider setting stricter limits and taking regular breaks.';
    } else if (score <= 6) {
      riskLevel = 'high';
      recommendation = 'We recommend seeking professional help and considering self-exclusion.';
    } else {
      riskLevel = 'very_high';
      recommendation = 'Please contact our support team immediately and consider self-exclusion.';
    }

    // Update user record
    await User.findByIdAndUpdate(userId, {
      $set: {
        'responsibleGaming.lastAssessment': {
          date: new Date(),
          score,
          riskLevel,
          answers
        }
      }
    });

    // Log assessment
    await SecurityMonitor.logEvent({
      userId,
      eventType: 'problem_gambling_assessment',
      severity: riskLevel === 'very_high' ? 'high' : 
               riskLevel === 'high' ? 'medium' : 'low',
      description: `Problem gambling self-assessment completed`,
      metadata: {
        score,
        riskLevel,
        totalQuestions: answers.length
      }
    });

    res.json({
      success: true,
      data: {
        score,
        riskLevel,
        recommendation,
        maxScore: 8
      }
    });

  } catch (error) {
    console.error('Error processing self-assessment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

