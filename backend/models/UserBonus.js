const mongoose = require('mongoose');

const UserBonusSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bonusId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bonus',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'forfeited', 'expired'],
    default: 'active'
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    enum: ['BTC', 'ETH', 'USDT', 'USD', 'EUR'],
    required: true
  },
  wagering: {
    required: {
      type: Number,
      required: true,
      min: 0
    },
    completed: {
      type: Number,
      default: 0,
      min: 0
    },
    remaining: {
      type: Number,
      required: true,
      min: 0
    }
  },
  claimedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  completedAt: {
    type: Date
  },
  forfeitedAt: {
    type: Date
  },
  forfeitReason: {
    type: String,
    trim: true
  },
  metadata: {
    triggerTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction'
    },
    originalBonus: {
      name: String,
      type: String,
      terms: String
    }
  }
}, {
  timestamps: true
});

// Indexes
UserBonusSchema.index({ userId: 1, status: 1 });
UserBonusSchema.index({ bonusId: 1 });
UserBonusSchema.index({ status: 1 });
UserBonusSchema.index({ expiresAt: 1 });
UserBonusSchema.index({ userId: 1, createdAt: -1 });

// Compound indexes
UserBonusSchema.index({ userId: 1, bonusId: 1 });

// Virtual for completion percentage
UserBonusSchema.virtual('completionPercentage').get(function() {
  if (this.wagering.required === 0) return 100;
  return Math.min(100, (this.wagering.completed / this.wagering.required) * 100);
});

// Virtual for is expired
UserBonusSchema.virtual('isExpired').get(function() {
  return this.expiresAt < new Date();
});

// Method to update wagering progress
UserBonusSchema.methods.updateWagering = function(amount) {
  this.wagering.completed += amount;
  this.wagering.remaining = Math.max(0, this.wagering.required - this.wagering.completed);
  
  // Check if wagering is complete
  if (this.wagering.remaining === 0 && this.status === 'active') {
    this.status = 'completed';
    this.completedAt = new Date();
  }
  
  return this.save();
};

// Method to forfeit bonus
UserBonusSchema.methods.forfeit = function(reason) {
  this.status = 'forfeited';
  this.forfeitedAt = new Date();
  this.forfeitReason = reason;
  return this.save();
};

// Static method to get active bonuses for user
UserBonusSchema.statics.getActiveBonuses = function(userId) {
  return this.find({
    userId: userId,
    status: 'active',
    expiresAt: { $gt: new Date() }
  }).populate('bonusId');
};

// Static method to check if user has claimed specific bonus
UserBonusSchema.statics.hasUserClaimedBonus = function(userId, bonusId) {
  return this.findOne({
    userId: userId,
    bonusId: bonusId
  });
};

// Pre-save middleware to update remaining wagering
UserBonusSchema.pre('save', function(next) {
  if (this.isModified('wagering.completed') || this.isModified('wagering.required')) {
    this.wagering.remaining = Math.max(0, this.wagering.required - this.wagering.completed);
  }
  next();
});

module.exports = mongoose.model('UserBonus', UserBonusSchema);

