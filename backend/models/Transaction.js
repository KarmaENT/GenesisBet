const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'bet', 'win', 'bonus', 'refund'],
    required: true
  },
  currency: {
    type: String,
    enum: ['BTC', 'ETH', 'USDT', 'USD', 'EUR'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  fee: {
    type: Number,
    default: 0,
    min: 0
  },
  netAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'expired'],
    default: 'pending'
  },
  address: {
    type: String,
    trim: true
  },
  txHash: {
    type: String,
    trim: true,
    sparse: true,
    unique: true
  },
  confirmations: {
    type: Number,
    default: 0
  },
  requiredConfirmations: {
    type: Number,
    default: 6
  },
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game'
  },
  sessionId: {
    type: String,
    trim: true
  },
  bonusId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bonus'
  },
  description: {
    type: String,
    trim: true
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    webhook: Boolean,
    provider: String,
    externalId: String,
    notes: String
  },
  processedAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for performance
TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ type: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ currency: 1 });
TransactionSchema.index({ txHash: 1 });
TransactionSchema.index({ gameId: 1 });
TransactionSchema.index({ sessionId: 1 });
TransactionSchema.index({ createdAt: -1 });

// Compound indexes
TransactionSchema.index({ userId: 1, type: 1, status: 1 });
TransactionSchema.index({ userId: 1, currency: 1, createdAt: -1 });

// Virtual for USD equivalent (simplified)
TransactionSchema.virtual('usdEquivalent').get(function() {
  const rates = {
    BTC: 45000,
    ETH: 3000,
    USDT: 1,
    USD: 1,
    EUR: 1.1
  };
  return this.amount * (rates[this.currency] || 1);
});

// Method to mark transaction as completed
TransactionSchema.methods.markCompleted = function() {
  this.status = 'completed';
  this.processedAt = new Date();
  return this.save();
};

// Method to mark transaction as failed
TransactionSchema.methods.markFailed = function(reason) {
  this.status = 'failed';
  this.processedAt = new Date();
  if (reason) {
    this.metadata.notes = reason;
  }
  return this.save();
};

// Static method to get user balance
TransactionSchema.statics.getUserBalance = async function(userId, currency) {
  const result = await this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        currency: currency,
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$netAmount' }
      }
    }
  ]);

  let balance = 0;
  result.forEach(item => {
    if (['deposit', 'win', 'bonus', 'refund'].includes(item._id)) {
      balance += item.total;
    } else if (['withdrawal', 'bet'].includes(item._id)) {
      balance -= item.total;
    }
  });

  return balance;
};

// Static method to get transaction summary
TransactionSchema.statics.getTransactionSummary = async function(userId, period = '30d') {
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
    default:
      startDate.setDate(startDate.getDate() - 30);
  }

  const summary = await this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        status: 'completed',
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalFees: { $sum: '$fee' }
      }
    }
  ]);

  return summary;
};

module.exports = mongoose.model('Transaction', TransactionSchema);

