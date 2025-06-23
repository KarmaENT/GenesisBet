const User = require('../../models/User');
const GameSession = require('../../models/GameSession');
const Transaction = require('../../models/Transaction');
const { SecurityMonitor } = require('../securityMonitor');

class ResponsibleGaming {
  
  // Check if user has exceeded daily deposit limit
  static async checkDailyDepositLimit(userId, amount) {
    try {
      const user = await User.findById(userId);
      if (!user) return { allowed: false, reason: 'User not found' };

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get today's deposits
      const todayDeposits = await Transaction.aggregate([
        {
          $match: {
            userId: user._id,
            type: 'deposit',
            status: 'completed',
            createdAt: { $gte: today, $lt: tomorrow }
          }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      const todayTotal = todayDeposits[0]?.totalAmount || 0;
      const dailyLimit = user.limits.dailyDeposit;

      if (todayTotal + amount > dailyLimit) {
        await SecurityMonitor.logEvent({
          userId,
          eventType: 'deposit_limit_exceeded',
          severity: 'medium',
          description: `User attempted to exceed daily deposit limit`,
          metadata: {
            attemptedAmount: amount,
            todayTotal,
            dailyLimit,
            exceedBy: (todayTotal + amount) - dailyLimit
          }
        });

        return {
          allowed: false,
          reason: 'Daily deposit limit exceeded',
          currentTotal: todayTotal,
          limit: dailyLimit,
          remaining: Math.max(0, dailyLimit - todayTotal)
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking daily deposit limit:', error);
      return { allowed: false, reason: 'System error' };
    }
  }

  // Check if user has exceeded daily withdrawal limit
  static async checkDailyWithdrawalLimit(userId, amount) {
    try {
      const user = await User.findById(userId);
      if (!user) return { allowed: false, reason: 'User not found' };

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get today's withdrawals
      const todayWithdrawals = await Transaction.aggregate([
        {
          $match: {
            userId: user._id,
            type: 'withdrawal',
            status: { $in: ['completed', 'processing', 'pending'] },
            createdAt: { $gte: today, $lt: tomorrow }
          }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      const todayTotal = todayWithdrawals[0]?.totalAmount || 0;
      const dailyLimit = user.limits.dailyWithdrawal;

      if (todayTotal + amount > dailyLimit) {
        return {
          allowed: false,
          reason: 'Daily withdrawal limit exceeded',
          currentTotal: todayTotal,
          limit: dailyLimit,
          remaining: Math.max(0, dailyLimit - todayTotal)
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking daily withdrawal limit:', error);
      return { allowed: false, reason: 'System error' };
    }
  }

  // Check if user has exceeded session time limit
  static async checkSessionTimeLimit(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return { allowed: false, reason: 'User not found' };

      if (!user.limits.sessionTime || user.limits.sessionTime === 0) {
        return { allowed: true }; // No session limit set
      }

      const sessionStart = user.lastLogin;
      const now = new Date();
      const sessionDuration = (now - sessionStart) / (1000 * 60); // minutes

      if (sessionDuration >= user.limits.sessionTime) {
        await SecurityMonitor.logEvent({
          userId,
          eventType: 'session_time_limit_exceeded',
          severity: 'low',
          description: `User exceeded session time limit`,
          metadata: {
            sessionDuration,
            sessionLimit: user.limits.sessionTime
          }
        });

        return {
          allowed: false,
          reason: 'Session time limit exceeded',
          sessionDuration,
          limit: user.limits.sessionTime
        };
      }

      return { 
        allowed: true,
        sessionDuration,
        limit: user.limits.sessionTime,
        remaining: user.limits.sessionTime - sessionDuration
      };
    } catch (error) {
      console.error('Error checking session time limit:', error);
      return { allowed: false, reason: 'System error' };
    }
  }

  // Check if user is in self-exclusion period
  static async checkSelfExclusion(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return { excluded: true, reason: 'User not found' };

      const now = new Date();

      // Check permanent self-exclusion
      if (user.responsibleGaming.selfExclusion.permanent) {
        return {
          excluded: true,
          reason: 'Permanent self-exclusion',
          type: 'permanent'
        };
      }

      // Check temporary self-exclusion
      if (user.responsibleGaming.selfExclusion.until && 
          user.responsibleGaming.selfExclusion.until > now) {
        return {
          excluded: true,
          reason: 'Temporary self-exclusion',
          type: 'temporary',
          until: user.responsibleGaming.selfExclusion.until
        };
      }

      // Check cooling-off period
      if (user.responsibleGaming.coolingOff.until && 
          user.responsibleGaming.coolingOff.until > now) {
        return {
          excluded: true,
          reason: 'Cooling-off period',
          type: 'cooling-off',
          until: user.responsibleGaming.coolingOff.until
        };
      }

      return { excluded: false };
    } catch (error) {
      console.error('Error checking self-exclusion:', error);
      return { excluded: true, reason: 'System error' };
    }
  }

  // Detect problem gambling patterns
  static async detectProblemGambling(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return { risk: 'unknown', factors: [] };

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const riskFactors = [];
      let riskScore = 0;

      // Check deposit frequency and amounts
      const recentDeposits = await Transaction.find({
        userId,
        type: 'deposit',
        status: 'completed',
        createdAt: { $gte: sevenDaysAgo }
      });

      if (recentDeposits.length > 10) {
        riskFactors.push('High frequency deposits (>10 in 7 days)');
        riskScore += 2;
      }

      const totalDeposits7d = recentDeposits.reduce((sum, tx) => sum + tx.amount, 0);
      const avgDeposit = totalDeposits7d / Math.max(recentDeposits.length, 1);

      if (avgDeposit > 1000) {
        riskFactors.push('High average deposit amount');
        riskScore += 2;
      }

      // Check session patterns
      const recentSessions = await GameSession.find({
        userId,
        createdAt: { $gte: sevenDaysAgo }
      });

      const longSessions = recentSessions.filter(session => {
        const duration = (session.endTime - session.startTime) / (1000 * 60 * 60); // hours
        return duration > 4;
      });

      if (longSessions.length > 3) {
        riskFactors.push('Multiple long gaming sessions (>4 hours)');
        riskScore += 1;
      }

      // Check loss patterns
      const totalLosses = recentSessions.reduce((sum, session) => {
        return sum + Math.max(0, session.betAmount - session.winAmount);
      }, 0);

      if (totalLosses > totalDeposits7d * 0.8) {
        riskFactors.push('High loss ratio compared to deposits');
        riskScore += 2;
      }

      // Check chasing losses pattern
      const chasingPattern = await this.detectChasingLosses(userId, sevenDaysAgo);
      if (chasingPattern.detected) {
        riskFactors.push('Chasing losses pattern detected');
        riskScore += 3;
      }

      // Check time of play patterns
      const nightSessions = recentSessions.filter(session => {
        const hour = session.startTime.getHours();
        return hour >= 23 || hour <= 5;
      });

      if (nightSessions.length > recentSessions.length * 0.5) {
        riskFactors.push('Frequent late-night gambling');
        riskScore += 1;
      }

      // Determine risk level
      let riskLevel;
      if (riskScore >= 6) {
        riskLevel = 'high';
      } else if (riskScore >= 3) {
        riskLevel = 'medium';
      } else if (riskScore >= 1) {
        riskLevel = 'low';
      } else {
        riskLevel = 'minimal';
      }

      // Log if medium or high risk
      if (riskScore >= 3) {
        await SecurityMonitor.logEvent({
          userId,
          eventType: 'problem_gambling_risk',
          severity: riskLevel === 'high' ? 'high' : 'medium',
          description: `Problem gambling risk detected: ${riskLevel}`,
          metadata: {
            riskScore,
            riskFactors,
            riskLevel
          }
        });
      }

      return {
        risk: riskLevel,
        score: riskScore,
        factors: riskFactors,
        recommendations: this.getRiskRecommendations(riskLevel)
      };

    } catch (error) {
      console.error('Error detecting problem gambling:', error);
      return { risk: 'unknown', factors: ['System error'] };
    }
  }

  // Detect chasing losses pattern
  static async detectChasingLosses(userId, since) {
    try {
      const sessions = await GameSession.find({
        userId,
        createdAt: { $gte: since },
        status: 'completed'
      }).sort({ createdAt: 1 });

      let chasingCount = 0;
      let consecutiveLosses = 0;

      for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        const isLoss = session.betAmount > session.winAmount;

        if (isLoss) {
          consecutiveLosses++;
        } else {
          consecutiveLosses = 0;
        }

        // Check if bet amount increased after losses
        if (i > 0 && consecutiveLosses >= 2) {
          const prevSession = sessions[i - 1];
          if (session.betAmount > prevSession.betAmount * 1.5) {
            chasingCount++;
          }
        }
      }

      return {
        detected: chasingCount >= 3,
        count: chasingCount,
        pattern: 'Increasing bet amounts after consecutive losses'
      };

    } catch (error) {
      console.error('Error detecting chasing losses:', error);
      return { detected: false, count: 0 };
    }
  }

  // Get recommendations based on risk level
  static getRiskRecommendations(riskLevel) {
    const recommendations = {
      minimal: [
        'Continue enjoying responsible gaming',
        'Set deposit limits if you haven\'t already'
      ],
      low: [
        'Consider setting session time limits',
        'Review your gaming activity regularly',
        'Take regular breaks during gaming sessions'
      ],
      medium: [
        'Set stricter deposit and session limits',
        'Consider taking a cooling-off period',
        'Review our responsible gaming resources',
        'Contact support if you need assistance'
      ],
      high: [
        'Strongly consider self-exclusion',
        'Seek professional help for gambling addiction',
        'Contact our responsible gaming team immediately',
        'Use our self-exclusion tools',
        'Consider external support organizations'
      ]
    };

    return recommendations[riskLevel] || recommendations.minimal;
  }

  // Send reality check notification
  static async sendRealityCheck(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return false;

      const sessionStart = user.lastLogin;
      const now = new Date();
      const sessionDuration = Math.floor((now - sessionStart) / (1000 * 60)); // minutes

      // Get session statistics
      const sessionStats = await GameSession.aggregate([
        {
          $match: {
            userId: user._id,
            startTime: { $gte: sessionStart }
          }
        },
        {
          $group: {
            _id: null,
            totalBet: { $sum: '$betAmount' },
            totalWin: { $sum: '$winAmount' },
            gamesPlayed: { $sum: 1 }
          }
        }
      ]);

      const stats = sessionStats[0] || { totalBet: 0, totalWin: 0, gamesPlayed: 0 };
      const netResult = stats.totalWin - stats.totalBet;

      await SecurityMonitor.logEvent({
        userId,
        eventType: 'reality_check',
        severity: 'low',
        description: 'Reality check notification sent',
        metadata: {
          sessionDuration,
          gamesPlayed: stats.gamesPlayed,
          totalBet: stats.totalBet,
          totalWin: stats.totalWin,
          netResult
        }
      });

      return {
        sessionDuration,
        gamesPlayed: stats.gamesPlayed,
        totalBet: stats.totalBet,
        totalWin: stats.totalWin,
        netResult
      };

    } catch (error) {
      console.error('Error sending reality check:', error);
      return false;
    }
  }

  // Apply self-exclusion
  static async applySelfExclusion(userId, type, duration = null) {
    try {
      const user = await User.findById(userId);
      if (!user) return { success: false, message: 'User not found' };

      const now = new Date();

      if (type === 'permanent') {
        user.responsibleGaming.selfExclusion.permanent = true;
        user.responsibleGaming.selfExclusion.appliedAt = now;
      } else if (type === 'temporary' && duration) {
        const until = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000); // duration in days
        user.responsibleGaming.selfExclusion.until = until;
        user.responsibleGaming.selfExclusion.appliedAt = now;
      } else if (type === 'cooling-off' && duration) {
        const until = new Date(now.getTime() + duration * 60 * 60 * 1000); // duration in hours
        user.responsibleGaming.coolingOff.until = until;
        user.responsibleGaming.coolingOff.appliedAt = now;
      }

      user.status = 'suspended';
      await user.save();

      await SecurityMonitor.logEvent({
        userId,
        eventType: 'self_exclusion_applied',
        severity: 'high',
        description: `User applied ${type} self-exclusion`,
        metadata: {
          type,
          duration,
          until: type === 'temporary' ? user.responsibleGaming.selfExclusion.until :
                type === 'cooling-off' ? user.responsibleGaming.coolingOff.until : null
        }
      });

      return { success: true, message: 'Self-exclusion applied successfully' };

    } catch (error) {
      console.error('Error applying self-exclusion:', error);
      return { success: false, message: 'System error' };
    }
  }

  // Update user limits
  static async updateLimits(userId, limits) {
    try {
      const user = await User.findById(userId);
      if (!user) return { success: false, message: 'User not found' };

      // Validate limits
      const validLimits = {};
      if (limits.dailyDeposit !== undefined && limits.dailyDeposit >= 0) {
        validLimits['limits.dailyDeposit'] = limits.dailyDeposit;
      }
      if (limits.dailyWithdrawal !== undefined && limits.dailyWithdrawal >= 0) {
        validLimits['limits.dailyWithdrawal'] = limits.dailyWithdrawal;
      }
      if (limits.sessionTime !== undefined && limits.sessionTime >= 0) {
        validLimits['limits.sessionTime'] = limits.sessionTime;
      }

      await User.findByIdAndUpdate(userId, { $set: validLimits });

      await SecurityMonitor.logEvent({
        userId,
        eventType: 'limits_updated',
        severity: 'low',
        description: 'User updated responsible gaming limits',
        metadata: { limits: validLimits }
      });

      return { success: true, message: 'Limits updated successfully' };

    } catch (error) {
      console.error('Error updating limits:', error);
      return { success: false, message: 'System error' };
    }
  }
}

module.exports = ResponsibleGaming;

