const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const redis = require('redis');

class SessionManager {
  constructor() {
    this.redisClient = null;
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtExpiry = process.env.JWT_EXPIRY || '7d';
    this.refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || '30d';
    this.redisDisabled = process.env.DISABLE_REDIS === 'true' || process.env.NODE_ENV === 'test';
  }

  /**
   * Initialize Redis connection for session storage
   */
  async initRedis() {
    if (this.redisDisabled) {
      console.log('Redis disabled for test environment');
      return;
    }

    if (!this.redisClient) {
      this.redisClient = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      this.redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });

      try {
        await this.redisClient.connect();
      } catch (error) {
        console.warn('Redis connection failed, continuing without Redis:', error.message);
        this.redisDisabled = true;
      }
    }
  }

  /**
   * Generate JWT access token
   * @param {Object} payload - Token payload
   * @returns {string} JWT token
   */
  generateAccessToken(payload) {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiry,
      issuer: 'genesisbet',
      audience: 'genesisbet-users'
    });
  }

  /**
   * Generate refresh token
   * @param {string} userId - User ID
   * @returns {string} Refresh token
   */
  generateRefreshToken(userId) {
    const token = crypto.randomBytes(64).toString('hex');
    return `${userId}.${token}`;
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token to verify
   * @returns {Object} Decoded token payload
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret, {
        issuer: 'genesisbet',
        audience: 'genesisbet-users'
      });
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Create user session
   * @param {Object} user - User object
   * @param {string} ipAddress - Client IP address
   * @param {string} userAgent - Client user agent
   * @returns {Object} Session tokens
   */
  async createSession(user, ipAddress, userAgent) {
    const sessionId = crypto.randomUUID();
    const deviceFingerprint = this.generateDeviceFingerprint(ipAddress, userAgent);
    
    const payload = {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        roles: user.roles || ['user']
      },
      sessionId,
      deviceFingerprint,
      iat: Math.floor(Date.now() / 1000)
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(user._id);

    // Store session in Redis if available
    if (this.redisClient && !this.redisDisabled) {
      const sessionData = {
        userId: user._id,
        sessionId,
        deviceFingerprint,
        ipAddress,
        userAgent,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        isActive: true
      };

      await this.redisClient.setEx(
        `session:${sessionId}`,
        7 * 24 * 60 * 60, // 7 days
        JSON.stringify(sessionData)
      );

      await this.redisClient.setEx(
        `refresh:${refreshToken}`,
        30 * 24 * 60 * 60, // 30 days
        JSON.stringify({ userId: user._id, sessionId })
      );
    }

    return {
      accessToken,
      refreshToken,
      sessionId,
      expiresIn: this.jwtExpiry
    };
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Object} New access token
   */
  async refreshAccessToken(refreshToken) {
    if (!this.redisClient || this.redisDisabled) {
      throw new Error('Session storage not available');
    }

    const refreshData = await this.redisClient.get(`refresh:${refreshToken}`);
    if (!refreshData) {
      throw new Error('Invalid or expired refresh token');
    }

    const { userId, sessionId } = JSON.parse(refreshData);
    
    // Check if session is still active
    const sessionData = await this.redisClient.get(`session:${sessionId}`);
    if (!sessionData) {
      throw new Error('Session expired');
    }

    const session = JSON.parse(sessionData);
    if (!session.isActive) {
      throw new Error('Session is inactive');
    }

    // Get user data (in production, this would come from database)
    const User = require('../models/User');
    const user = await User.findById(userId).select('-password');
    
    if (!user || user.status !== 'active') {
      throw new Error('User not found or inactive');
    }

    const payload = {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        roles: user.roles || ['user']
      },
      sessionId,
      deviceFingerprint: session.deviceFingerprint,
      iat: Math.floor(Date.now() / 1000)
    };

    const newAccessToken = this.generateAccessToken(payload);

    // Update last activity
    session.lastActivity = new Date().toISOString();
    await this.redisClient.setEx(
      `session:${sessionId}`,
      7 * 24 * 60 * 60,
      JSON.stringify(session)
    );

    return {
      accessToken: newAccessToken,
      expiresIn: this.jwtExpiry
    };
  }

  /**
   * Invalidate session
   * @param {string} sessionId - Session ID to invalidate
   */
  async invalidateSession(sessionId) {
    if (!this.redisClient) return;

    const sessionData = await this.redisClient.get(`session:${sessionId}`);
    if (sessionData) {
      const session = JSON.parse(sessionData);
      session.isActive = false;
      
      await this.redisClient.setEx(
        `session:${sessionId}`,
        60 * 60, // Keep for 1 hour for audit purposes
        JSON.stringify(session)
      );
    }
  }

  /**
   * Invalidate all user sessions
   * @param {string} userId - User ID
   */
  async invalidateAllUserSessions(userId) {
    if (!this.redisClient) return;

    const keys = await this.redisClient.keys(`session:*`);
    
    for (const key of keys) {
      const sessionData = await this.redisClient.get(key);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session.userId === userId) {
          session.isActive = false;
          await this.redisClient.setEx(key, 60 * 60, JSON.stringify(session));
        }
      }
    }

    // Also invalidate refresh tokens
    const refreshKeys = await this.redisClient.keys(`refresh:*`);
    for (const key of refreshKeys) {
      const refreshData = await this.redisClient.get(key);
      if (refreshData) {
        const { userId: tokenUserId } = JSON.parse(refreshData);
        if (tokenUserId === userId) {
          await this.redisClient.del(key);
        }
      }
    }
  }

  /**
   * Get active sessions for user
   * @param {string} userId - User ID
   * @returns {Array} Active sessions
   */
  async getUserSessions(userId) {
    if (!this.redisClient) return [];

    const keys = await this.redisClient.keys(`session:*`);
    const sessions = [];

    for (const key of keys) {
      const sessionData = await this.redisClient.get(key);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session.userId === userId && session.isActive) {
          sessions.push({
            sessionId: session.sessionId,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity
          });
        }
      }
    }

    return sessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
  }

  /**
   * Generate device fingerprint
   * @param {string} ipAddress - Client IP
   * @param {string} userAgent - Client user agent
   * @returns {string} Device fingerprint
   */
  generateDeviceFingerprint(ipAddress, userAgent) {
    const data = `${ipAddress}:${userAgent}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Validate session
   * @param {string} sessionId - Session ID
   * @param {string} deviceFingerprint - Device fingerprint
   * @returns {boolean} Session validity
   */
  async validateSession(sessionId, deviceFingerprint) {
    if (!this.redisClient) return true; // Fallback to JWT validation only

    const sessionData = await this.redisClient.get(`session:${sessionId}`);
    if (!sessionData) return false;

    const session = JSON.parse(sessionData);
    
    return session.isActive && 
           session.deviceFingerprint === deviceFingerprint;
  }

  /**
   * Update session activity
   * @param {string} sessionId - Session ID
   */
  async updateSessionActivity(sessionId) {
    if (!this.redisClient) return;

    const sessionData = await this.redisClient.get(`session:${sessionId}`);
    if (sessionData) {
      const session = JSON.parse(sessionData);
      session.lastActivity = new Date().toISOString();
      
      await this.redisClient.setEx(
        `session:${sessionId}`,
        7 * 24 * 60 * 60,
        JSON.stringify(session)
      );
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    if (!this.redisClient) return;

    const keys = await this.redisClient.keys(`session:*`);
    const now = new Date();
    let cleanedCount = 0;

    for (const key of keys) {
      const sessionData = await this.redisClient.get(key);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        const lastActivity = new Date(session.lastActivity);
        const daysSinceActivity = (now - lastActivity) / (1000 * 60 * 60 * 24);

        // Remove sessions inactive for more than 30 days
        if (daysSinceActivity > 30) {
          await this.redisClient.del(key);
          cleanedCount++;
        }
      }
    }

    console.log(`Cleaned up ${cleanedCount} expired sessions`);
  }
}

module.exports = new SessionManager();

