const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SessionManager = require('../utils/sessionManager');

module.exports = async (req, res, next) => {
  // Get token from header
  const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');

  // Check if no token
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token, authorization denied'
    });
  }

  try {
    // Verify token
    const decoded = SessionManager.verifyAccessToken(token);
    
    // Get user from database
    const user = await User.findById(decoded.user.id).select('-password -security.twoFactorSecret');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token is not valid - user not found'
      });
    }

    // Check if user account is active
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Account is suspended or inactive'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to failed login attempts'
      });
    }

    // Validate session if session management is enabled
    if (decoded.sessionId && decoded.deviceFingerprint) {
      const currentDeviceFingerprint = SessionManager.generateDeviceFingerprint(
        req.ip,
        req.get('User-Agent')
      );

      // Check if device fingerprint matches (security measure)
      if (decoded.deviceFingerprint !== currentDeviceFingerprint) {
        return res.status(401).json({
          success: false,
          message: 'Session invalid - device mismatch'
        });
      }

      // Validate session in Redis
      const isValidSession = await SessionManager.validateSession(
        decoded.sessionId,
        decoded.deviceFingerprint
      );

      if (!isValidSession) {
        return res.status(401).json({
          success: false,
          message: 'Session expired or invalid'
        });
      }

      // Update session activity
      await SessionManager.updateSessionActivity(decoded.sessionId);
    }

    // Check if password was changed after token was issued
    if (user.security.passwordChangedAt) {
      const passwordChangedTimestamp = Math.floor(user.security.passwordChangedAt.getTime() / 1000);
      if (decoded.iat < passwordChangedTimestamp) {
        return res.status(401).json({
          success: false,
          message: 'Token invalid - password was changed'
        });
      }
    }

    // Check for suspicious activity patterns
    const suspiciousActivity = await checkSuspiciousActivity(user, req);
    if (suspiciousActivity.isSuspicious) {
      console.warn('Suspicious activity detected:', {
        userId: user._id,
        reason: suspiciousActivity.reason,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      // For high-risk activities, require re-authentication
      if (suspiciousActivity.severity === 'high') {
        return res.status(401).json({
          success: false,
          message: 'Re-authentication required due to suspicious activity',
          requiresReauth: true
        });
      }
    }

    // Add user data to request
    req.user = decoded.user;
    req.userDoc = user;
    req.sessionId = decoded.sessionId;
    req.deviceFingerprint = decoded.deviceFingerprint;

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    
    // Handle specific JWT errors
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        expired: true
      });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    res.status(401).json({
      success: false,
      message: 'Token is not valid'
    });
  }
};

// Helper function to check for suspicious activity
async function checkSuspiciousActivity(user, req) {
  const result = {
    isSuspicious: false,
    reason: '',
    severity: 'low'
  };

  // Check for rapid location changes
  if (user.ipAddress && user.ipAddress !== req.ip) {
    // In production, you would use a geolocation service to check distance
    const timeSinceLastLogin = Date.now() - user.lastLogin.getTime();
    const minutesSinceLastLogin = timeSinceLastLogin / (1000 * 60);

    // If IP changed within 30 minutes, it might be suspicious
    if (minutesSinceLastLogin < 30) {
      result.isSuspicious = true;
      result.reason = 'Rapid IP address change';
      result.severity = 'medium';
    }
  }

  // Check for unusual user agent
  if (user.userAgent && user.userAgent !== req.get('User-Agent')) {
    const timeSinceLastLogin = Date.now() - user.lastLogin.getTime();
    const minutesSinceLastLogin = timeSinceLastLogin / (1000 * 60);

    // If user agent changed within 10 minutes, it might be suspicious
    if (minutesSinceLastLogin < 10) {
      result.isSuspicious = true;
      result.reason = 'Rapid user agent change';
      result.severity = 'medium';
    }
  }

  // Check for multiple failed login attempts in history
  if (user.metadata && user.metadata.loginHistory) {
    const recentFailures = user.metadata.loginHistory
      .filter(login => !login.success && 
        Date.now() - login.timestamp.getTime() < 60 * 60 * 1000) // Last hour
      .length;

    if (recentFailures >= 3) {
      result.isSuspicious = true;
      result.reason = 'Multiple recent failed login attempts';
      result.severity = 'high';
    }
  }

  // Check for access from known malicious IPs (in production, use threat intelligence)
  const knownMaliciousIPs = [
    // Add known malicious IP ranges
  ];

  if (knownMaliciousIPs.includes(req.ip)) {
    result.isSuspicious = true;
    result.reason = 'Access from known malicious IP';
    result.severity = 'high';
  }

  return result;
}

