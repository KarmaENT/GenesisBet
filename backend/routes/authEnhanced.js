const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');
const TwoFactorAuth = require('../utils/twoFactorAuth');
const SessionManager = require('../utils/sessionManager');
const { authLimiter, passwordResetLimiter } = require('../middleware/rateLimiting');

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user with enhanced security
// @access  Public
router.post('/register', [
  authLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
  body('username').isLength({ min: 3, max: 20 }).isAlphanumeric(),
  body('dateOfBirth').isISO8601(),
  body('country').isLength({ min: 2, max: 3 }),
  body('acceptTerms').isBoolean().equals('true'),
  body('acceptPrivacy').isBoolean().equals('true')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password, username, dateOfBirth, country, phone, acceptTerms, acceptPrivacy } = req.body;

    // Check if user already exists
    let user = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (user) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email or username'
      });
    }

    // Age verification (must be 18+)
    const birthDate = new Date(dateOfBirth);
    const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    
    if (age < 18) {
      return res.status(400).json({
        success: false,
        message: 'You must be at least 18 years old to register'
      });
    }

    // Check for restricted countries (example list)
    const restrictedCountries = ['US', 'UK', 'FR', 'AU', 'NL'];
    if (restrictedCountries.includes(country.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Registration is not available in your country'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    user = new User({
      email,
      password: hashedPassword,
      username,
      dateOfBirth,
      country: country.toUpperCase(),
      phone,
      profile: {
        tier: 'Bronze',
        totalWagered: 0,
        totalDeposited: 0,
        totalWithdrawn: 0
      },
      kyc: {
        status: 'pending',
        level: 0
      },
      wallet: {
        balance: {
          BTC: 0,
          ETH: 0,
          USDT: 0,
          USD: 0
        }
      },
      metadata: {
        registrationIp: req.ip,
        registrationUserAgent: req.get('User-Agent'),
        acceptedTermsAt: new Date(),
        acceptedPrivacyAt: new Date()
      }
    });

    await user.save();

    // Create session
    const sessionData = await SessionManager.createSession(
      user,
      req.ip,
      req.get('User-Agent')
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      ...sessionData,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        tier: user.profile.tier,
        kycStatus: user.kyc.status,
        twoFactorEnabled: user.security.twoFactorEnabled
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user with enhanced security
// @access  Public
router.post('/login', [
  authLimiter,
  body('login').notEmpty(),
  body('password').exists(),
  body('twoFactorCode').optional().isLength({ min: 6, max: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { login, password, twoFactorCode } = req.body;

    // Find user by email or username
    const user = await User.findOne({
      $or: [
        { email: login },
        { username: login }
      ]
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to failed login attempts'
      });
    }

    // Check if account is active
    if (user.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Account is suspended or inactive'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Increment login attempts
      await user.incLoginAttempts();
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check 2FA if enabled
    if (user.security.twoFactorEnabled) {
      if (!twoFactorCode) {
        return res.status(400).json({
          success: false,
          message: '2FA code required',
          requiresTwoFactor: true
        });
      }

      const isValidToken = TwoFactorAuth.verifyToken(
        twoFactorCode,
        user.security.twoFactorSecret
      );

      if (!isValidToken) {
        // Check if it's a backup code
        const isValidBackupCode = TwoFactorAuth.verifyBackupCode(
          twoFactorCode,
          user.security.backupCodes || []
        );

        if (!isValidBackupCode) {
          await user.incLoginAttempts();
          return res.status(400).json({
            success: false,
            message: 'Invalid 2FA code'
          });
        } else {
          // Remove used backup code
          user.security.backupCodes = TwoFactorAuth.removeBackupCode(
            twoFactorCode,
            user.security.backupCodes
          );
          await user.save();
        }
      }
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Update last login and login history
    user.lastLogin = new Date();
    user.ipAddress = req.ip;
    user.userAgent = req.get('User-Agent');
    
    if (!user.metadata) user.metadata = {};
    if (!user.metadata.loginHistory) user.metadata.loginHistory = [];
    
    user.metadata.loginHistory.push({
      timestamp: new Date(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });

    // Keep only last 10 login records
    if (user.metadata.loginHistory.length > 10) {
      user.metadata.loginHistory = user.metadata.loginHistory.slice(-10);
    }

    await user.save();

    // Create session
    const sessionData = await SessionManager.createSession(
      user,
      req.ip,
      req.get('User-Agent')
    );

    res.json({
      success: true,
      message: 'Login successful',
      ...sessionData,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        tier: user.profile.tier,
        kycStatus: user.kyc.status,
        balance: user.wallet.balance,
        twoFactorEnabled: user.security.twoFactorEnabled
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @route   POST /api/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post('/refresh', [
  body('refreshToken').notEmpty()
], async (req, res) => {
  try {
    const { refreshToken } = req.body;

    const tokenData = await SessionManager.refreshAccessToken(refreshToken);

    res.json({
      success: true,
      ...tokenData
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: error.message || 'Invalid refresh token'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user and invalidate session
// @access  Private
router.post('/logout', auth, async (req, res) => {
  try {
    // Invalidate current session
    if (req.sessionId) {
      await SessionManager.invalidateSession(req.sessionId);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
});

// @route   POST /api/auth/logout-all
// @desc    Logout from all devices
// @access  Private
router.post('/logout-all', auth, async (req, res) => {
  try {
    await SessionManager.invalidateAllUserSessions(req.user.id);

    res.json({
      success: true,
      message: 'Logged out from all devices successfully'
    });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
});

// @route   GET /api/auth/sessions
// @desc    Get active sessions
// @access  Private
router.get('/sessions', auth, async (req, res) => {
  try {
    const sessions = await SessionManager.getUserSessions(req.user.id);

    res.json({
      success: true,
      sessions
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/2fa/setup
// @desc    Setup 2FA for user
// @access  Private
router.post('/2fa/setup', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.security.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is already enabled'
      });
    }

    const secretData = TwoFactorAuth.generateSecret(user.email);
    const qrCodeUrl = await TwoFactorAuth.generateQRCode(secretData.otpauthUrl);

    // Store secret temporarily (not enabled yet)
    user.security.twoFactorSecret = secretData.secret;
    await user.save();

    res.json({
      success: true,
      secret: secretData.secret,
      qrCode: qrCodeUrl,
      message: 'Scan the QR code with your authenticator app and verify with a code'
    });

  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during 2FA setup'
    });
  }
});

// @route   POST /api/auth/2fa/verify
// @desc    Verify and enable 2FA
// @access  Private
router.post('/2fa/verify', [
  auth,
  body('code').isLength({ min: 6, max: 6 })
], async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user.id);

    if (!user.security.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        message: 'No 2FA setup in progress'
      });
    }

    const isValid = TwoFactorAuth.verifyToken(code, user.security.twoFactorSecret);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Generate backup codes
    const backupCodes = TwoFactorAuth.generateBackupCodes();
    const hashedBackupCodes = TwoFactorAuth.hashBackupCodes(backupCodes);

    // Enable 2FA
    user.security.twoFactorEnabled = true;
    user.security.backupCodes = hashedBackupCodes;
    await user.save();

    res.json({
      success: true,
      message: '2FA enabled successfully',
      backupCodes: backupCodes
    });

  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during 2FA verification'
    });
  }
});

// @route   POST /api/auth/2fa/disable
// @desc    Disable 2FA
// @access  Private
router.post('/2fa/disable', [
  auth,
  body('password').notEmpty(),
  body('code').isLength({ min: 6, max: 6 })
], async (req, res) => {
  try {
    const { password, code } = req.body;
    const user = await User.findById(req.user.id);

    if (!user.security.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is not enabled'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Verify 2FA code
    const isCodeValid = TwoFactorAuth.verifyToken(code, user.security.twoFactorSecret);
    if (!isCodeValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid 2FA code'
      });
    }

    // Disable 2FA
    user.security.twoFactorEnabled = false;
    user.security.twoFactorSecret = null;
    user.security.backupCodes = [];
    await user.save();

    // Invalidate all sessions for security
    await SessionManager.invalidateAllUserSessions(req.user.id);

    res.json({
      success: true,
      message: '2FA disabled successfully. Please log in again.'
    });

  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during 2FA disable'
    });
  }
});

module.exports = router;

