const mongoose = require('mongoose');

// Security Event Schema
const SecurityEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  eventType: {
    type: String,
    enum: [
      'login_success',
      'login_failure',
      'password_change',
      '2fa_enabled',
      '2fa_disabled',
      'account_locked',
      'suspicious_activity',
      'session_hijack_attempt',
      'multiple_device_login',
      'admin_action',
      'kyc_update',
      'large_transaction',
      'withdrawal_request',
      'api_abuse'
    ],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  description: {
    type: String,
    required: true
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    location: {
      country: String,
      city: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    },
    deviceFingerprint: String,
    sessionId: String,
    additionalData: mongoose.Schema.Types.Mixed
  },
  resolved: {
    type: Boolean,
    default: false
  },
  resolvedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolution: String
}, {
  timestamps: true
});

// Indexes
SecurityEventSchema.index({ userId: 1, createdAt: -1 });
SecurityEventSchema.index({ eventType: 1 });
SecurityEventSchema.index({ severity: 1 });
SecurityEventSchema.index({ resolved: 1 });
SecurityEventSchema.index({ createdAt: -1 });

const SecurityEvent = mongoose.model('SecurityEvent', SecurityEventSchema);

class SecurityMonitor {
  /**
   * Log a security event
   * @param {Object} eventData - Security event data
   */
  static async logEvent(eventData) {
    try {
      const event = new SecurityEvent(eventData);
      await event.save();

      // Send alerts for high severity events
      if (eventData.severity === 'high' || eventData.severity === 'critical') {
        await this.sendAlert(event);
      }

      return event;
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Log login attempt
   * @param {string} userId - User ID
   * @param {boolean} success - Whether login was successful
   * @param {Object} req - Express request object
   */
  static async logLoginAttempt(userId, success, req) {
    const eventType = success ? 'login_success' : 'login_failure';
    const severity = success ? 'low' : 'medium';

    await this.logEvent({
      userId,
      eventType,
      severity,
      description: `User ${success ? 'successfully logged in' : 'failed to log in'}`,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: req.sessionId
      }
    });
  }

  /**
   * Log suspicious activity
   * @param {string} userId - User ID
   * @param {string} reason - Reason for suspicion
   * @param {Object} req - Express request object
   * @param {string} severity - Event severity
   */
  static async logSuspiciousActivity(userId, reason, req, severity = 'medium') {
    await this.logEvent({
      userId,
      eventType: 'suspicious_activity',
      severity,
      description: `Suspicious activity detected: ${reason}`,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: req.sessionId,
        additionalData: {
          reason,
          timestamp: new Date().toISOString()
        }
      }
    });
  }

  /**
   * Log admin action
   * @param {string} adminId - Admin user ID
   * @param {string} targetUserId - Target user ID
   * @param {string} action - Action performed
   * @param {Object} req - Express request object
   */
  static async logAdminAction(adminId, targetUserId, action, req) {
    await this.logEvent({
      userId: targetUserId,
      eventType: 'admin_action',
      severity: 'medium',
      description: `Admin action: ${action}`,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        additionalData: {
          adminId,
          action,
          timestamp: new Date().toISOString()
        }
      }
    });
  }

  /**
   * Log large transaction
   * @param {string} userId - User ID
   * @param {string} transactionType - Type of transaction
   * @param {number} amount - Transaction amount
   * @param {string} currency - Currency
   */
  static async logLargeTransaction(userId, transactionType, amount, currency) {
    const threshold = this.getLargeTransactionThreshold(currency);
    
    if (amount >= threshold) {
      await this.logEvent({
        userId,
        eventType: 'large_transaction',
        severity: amount >= threshold * 5 ? 'high' : 'medium',
        description: `Large ${transactionType}: ${amount} ${currency}`,
        metadata: {
          additionalData: {
            transactionType,
            amount,
            currency,
            threshold
          }
        }
      });
    }
  }

  /**
   * Get security events for user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Array} Security events
   */
  static async getUserEvents(userId, options = {}) {
    const {
      limit = 50,
      skip = 0,
      eventType,
      severity,
      startDate,
      endDate
    } = options;

    const query = { userId };

    if (eventType) query.eventType = eventType;
    if (severity) query.severity = severity;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    return SecurityEvent.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .populate('resolvedBy', 'username email');
  }

  /**
   * Get security dashboard statistics
   * @param {Object} options - Query options
   * @returns {Object} Dashboard statistics
   */
  static async getDashboardStats(options = {}) {
    const { startDate = new Date(Date.now() - 24 * 60 * 60 * 1000) } = options;

    const stats = await SecurityEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            eventType: '$eventType',
            severity: '$severity'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.eventType',
          severityBreakdown: {
            $push: {
              severity: '$_id.severity',
              count: '$count'
            }
          },
          totalCount: { $sum: '$count' }
        }
      }
    ]);

    // Get unresolved high/critical events
    const unresolvedCritical = await SecurityEvent.countDocuments({
      severity: { $in: ['high', 'critical'] },
      resolved: false,
      createdAt: { $gte: startDate }
    });

    // Get top suspicious IPs
    const suspiciousIPs = await SecurityEvent.aggregate([
      {
        $match: {
          eventType: 'suspicious_activity',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$metadata.ipAddress',
          count: { $sum: 1 },
          lastSeen: { $max: '$createdAt' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);

    return {
      eventStats: stats,
      unresolvedCritical,
      suspiciousIPs,
      generatedAt: new Date()
    };
  }

  /**
   * Detect anomalies in user behavior
   * @param {string} userId - User ID
   * @returns {Array} Detected anomalies
   */
  static async detectAnomalies(userId) {
    const anomalies = [];
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Check for multiple failed logins
    const failedLogins = await SecurityEvent.countDocuments({
      userId,
      eventType: 'login_failure',
      createdAt: { $gte: last24Hours }
    });

    if (failedLogins >= 5) {
      anomalies.push({
        type: 'multiple_failed_logins',
        severity: 'high',
        description: `${failedLogins} failed login attempts in last 24 hours`
      });
    }

    // Check for logins from multiple locations
    const uniqueIPs = await SecurityEvent.distinct('metadata.ipAddress', {
      userId,
      eventType: 'login_success',
      createdAt: { $gte: last24Hours }
    });

    if (uniqueIPs.length >= 3) {
      anomalies.push({
        type: 'multiple_locations',
        severity: 'medium',
        description: `Logins from ${uniqueIPs.length} different IP addresses`
      });
    }

    // Check for rapid successive logins
    const recentLogins = await SecurityEvent.find({
      userId,
      eventType: 'login_success',
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
    }).sort({ createdAt: 1 });

    if (recentLogins.length >= 3) {
      const timeDiffs = [];
      for (let i = 1; i < recentLogins.length; i++) {
        const diff = recentLogins[i].createdAt - recentLogins[i-1].createdAt;
        timeDiffs.push(diff / 1000 / 60); // Convert to minutes
      }

      const avgTimeBetweenLogins = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
      if (avgTimeBetweenLogins < 5) {
        anomalies.push({
          type: 'rapid_successive_logins',
          severity: 'high',
          description: `${recentLogins.length} logins in last hour with avg ${avgTimeBetweenLogins.toFixed(1)} minutes between`
        });
      }
    }

    return anomalies;
  }

  /**
   * Send alert for high severity events
   * @param {Object} event - Security event
   */
  static async sendAlert(event) {
    // In production, this would send alerts via email, Slack, etc.
    console.warn('SECURITY ALERT:', {
      eventType: event.eventType,
      severity: event.severity,
      description: event.description,
      userId: event.userId,
      timestamp: event.createdAt
    });

    // Could integrate with services like:
    // - Email notifications
    // - Slack webhooks
    // - PagerDuty
    // - SMS alerts
  }

  /**
   * Get large transaction threshold for currency
   * @param {string} currency - Currency code
   * @returns {number} Threshold amount
   */
  static getLargeTransactionThreshold(currency) {
    const thresholds = {
      BTC: 0.1,
      ETH: 1,
      USDT: 1000,
      USD: 1000
    };

    return thresholds[currency] || 1000;
  }

  /**
   * Mark security event as resolved
   * @param {string} eventId - Event ID
   * @param {string} resolvedBy - Admin user ID
   * @param {string} resolution - Resolution description
   */
  static async resolveEvent(eventId, resolvedBy, resolution) {
    await SecurityEvent.findByIdAndUpdate(eventId, {
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy,
      resolution
    });
  }

  /**
   * Clean up old security events
   * @param {number} daysToKeep - Number of days to keep events
   */
  static async cleanupOldEvents(daysToKeep = 90) {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    const result = await SecurityEvent.deleteMany({
      createdAt: { $lt: cutoffDate },
      severity: { $in: ['low', 'medium'] },
      resolved: true
    });

    console.log(`Cleaned up ${result.deletedCount} old security events`);
    return result.deletedCount;
  }
}

module.exports = { SecurityMonitor, SecurityEvent };

