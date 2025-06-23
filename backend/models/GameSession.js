const mongoose = require('mongoose');

const GameSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled', 'error'],
    default: 'active'
  },
  betAmount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    enum: ['BTC', 'ETH', 'USDT', 'USD', 'EUR'],
    required: true
  },
  result: {
    outcome: {
      type: String,
      enum: ['win', 'loss', 'push'],
      default: null
    },
    payout: {
      type: Number,
      default: 0,
      min: 0
    },
    profit: {
      type: Number,
      default: 0
    },
    multiplier: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  provablyFair: {
    serverSeed: {
      type: String,
      required: true
    },
    serverSeedHash: {
      type: String,
      required: true
    },
    clientSeed: {
      type: String,
      default: null
    },
    nonce: {
      type: Number,
      default: 0
    },
    revealed: {
      type: Boolean,
      default: false
    }
  },
  gameData: {
    // Flexible field for game-specific data
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    device: String,
    platform: String
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  duration: {
    type: Number, // milliseconds
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
GameSessionSchema.index({ userId: 1, createdAt: -1 });
GameSessionSchema.index({ gameId: 1 });
GameSessionSchema.index({ sessionId: 1 });
GameSessionSchema.index({ status: 1 });
GameSessionSchema.index({ 'result.outcome': 1 });
GameSessionSchema.index({ startedAt: -1 });

// Compound indexes
GameSessionSchema.index({ userId: 1, gameId: 1, createdAt: -1 });
GameSessionSchema.index({ userId: 1, status: 1 });

// Virtual for session duration in seconds
GameSessionSchema.virtual('durationSeconds').get(function() {
  return Math.round(this.duration / 1000);
});

// Virtual for RTP calculation
GameSessionSchema.virtual('rtp').get(function() {
  if (this.betAmount === 0) return 0;
  return (this.result.payout / this.betAmount) * 100;
});

// Method to complete session
GameSessionSchema.methods.complete = function(outcome, payout, gameData = {}) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.duration = this.completedAt - this.startedAt;
  this.result.outcome = outcome;
  this.result.payout = payout;
  this.result.profit = payout - this.betAmount;
  this.result.multiplier = this.betAmount > 0 ? payout / this.betAmount : 0;
  this.gameData = { ...this.gameData, ...gameData };
  
  return this.save();
};

// Method to cancel session
GameSessionSchema.methods.cancel = function(reason) {
  this.status = 'cancelled';
  this.completedAt = new Date();
  this.duration = this.completedAt - this.startedAt;
  this.gameData.cancelReason = reason;
  
  return this.save();
};

// Method to reveal provably fair seeds
GameSessionSchema.methods.revealSeeds = function() {
  this.provablyFair.revealed = true;
  return this.save();
};

// Static method to get user session statistics
GameSessionSchema.statics.getUserStats = async function(userId, period = '30d') {
  const startDate = new Date();
  
  switch (period) {
    case '24h':
      startDate.setDate(startDate.getDate() - 1);
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
  }

  const stats = await this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        status: 'completed',
        startedAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        totalWagered: { $sum: '$betAmount' },
        totalPayout: { $sum: '$result.payout' },
        totalProfit: { $sum: '$result.profit' },
        wins: {
          $sum: {
            $cond: [{ $eq: ['$result.outcome', 'win'] }, 1, 0]
          }
        },
        losses: {
          $sum: {
            $cond: [{ $eq: ['$result.outcome', 'loss'] }, 1, 0]
          }
        },
        avgBet: { $avg: '$betAmount' },
        maxWin: { $max: '$result.payout' },
        avgDuration: { $avg: '$duration' }
      }
    },
    {
      $addFields: {
        winRate: {
          $cond: {
            if: { $gt: ['$totalSessions', 0] },
            then: { $multiply: [{ $divide: ['$wins', '$totalSessions'] }, 100] },
            else: 0
          }
        },
        rtp: {
          $cond: {
            if: { $gt: ['$totalWagered', 0] },
            then: { $multiply: [{ $divide: ['$totalPayout', '$totalWagered'] }, 100] },
            else: 0
          }
        }
      }
    }
  ]);

  return stats[0] || {
    totalSessions: 0,
    totalWagered: 0,
    totalPayout: 0,
    totalProfit: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    rtp: 0,
    avgBet: 0,
    maxWin: 0,
    avgDuration: 0
  };
};

// Static method to get game popularity
GameSessionSchema.statics.getGamePopularity = async function(period = '7d') {
  const startDate = new Date();
  
  switch (period) {
    case '24h':
      startDate.setDate(startDate.getDate() - 1);
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
  }

  return this.aggregate([
    {
      $match: {
        status: 'completed',
        startedAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$gameId',
        sessions: { $sum: 1 },
        totalWagered: { $sum: '$betAmount' },
        totalPayout: { $sum: '$result.payout' },
        uniqueUsers: { $addToSet: '$userId' }
      }
    },
    {
      $addFields: {
        uniqueUserCount: { $size: '$uniqueUsers' },
        houseEdge: {
          $cond: {
            if: { $gt: ['$totalWagered', 0] },
            then: {
              $multiply: [
                {
                  $divide: [
                    { $subtract: ['$totalWagered', '$totalPayout'] },
                    '$totalWagered'
                  ]
                },
                100
              ]
            },
            else: 0
          }
        }
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
      $sort: { sessions: -1 }
    },
    {
      $limit: 20
    }
  ]);
};

module.exports = mongoose.model('GameSession', GameSessionSchema);

