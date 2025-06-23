const mongoose = require('mongoose');

const BonusSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['welcome', 'deposit', 'reload', 'cashback', 'free_spins', 'tournament', 'vip'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'expired'],
    default: 'active'
  },
  description: {
    type: String,
    trim: true
  },
  terms: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    min: 0
  },
  percentage: {
    type: Number,
    min: 0,
    max: 100
  },
  maxAmount: {
    type: Number,
    min: 0
  },
  minDeposit: {
    type: Number,
    min: 0,
    default: 0
  },
  wageringRequirement: {
    type: Number,
    min: 1,
    default: 35
  },
  currencies: [{
    type: String,
    enum: ['BTC', 'ETH', 'USDT', 'USD', 'EUR']
  }],
  eligibility: {
    newUsersOnly: {
      type: Boolean,
      default: false
    },
    minTier: {
      type: String,
      enum: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'],
      default: 'Bronze'
    },
    countries: [{
      type: String,
      length: 2
    }],
    excludedCountries: [{
      type: String,
      length: 2
    }]
  },
  validity: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    claimPeriod: {
      type: Number, // hours
      default: 24
    }
  },
  usage: {
    totalClaimed: {
      type: Number,
      default: 0
    },
    maxClaims: {
      type: Number,
      default: 0 // 0 = unlimited
    },
    claimsPerUser: {
      type: Number,
      default: 1
    }
  },
  games: {
    eligible: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game'
    }],
    excluded: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game'
    }],
    categories: [{
      type: String,
      enum: ['slots', 'live_casino', 'provably_fair', 'sportsbook', 'table_games']
    }]
  }
}, {
  timestamps: true
});

// Indexes
BonusSchema.index({ type: 1 });
BonusSchema.index({ status: 1 });
BonusSchema.index({ 'validity.startDate': 1, 'validity.endDate': 1 });

// Virtual for active status
BonusSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.status === 'active' && 
         this.validity.startDate <= now && 
         this.validity.endDate >= now &&
         (this.usage.maxClaims === 0 || this.usage.totalClaimed < this.usage.maxClaims);
});

// Method to check user eligibility
BonusSchema.methods.isEligibleUser = function(user) {
  // Check new users only
  if (this.eligibility.newUsersOnly && user.profile.totalDeposited > 0) {
    return false;
  }

  // Check tier requirement
  const tierOrder = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
  const userTierIndex = tierOrder.indexOf(user.profile.tier);
  const minTierIndex = tierOrder.indexOf(this.eligibility.minTier);
  
  if (userTierIndex < minTierIndex) {
    return false;
  }

  // Check country eligibility
  if (this.eligibility.countries.length > 0 && 
      !this.eligibility.countries.includes(user.country)) {
    return false;
  }

  // Check excluded countries
  if (this.eligibility.excludedCountries.includes(user.country)) {
    return false;
  }

  return true;
};

module.exports = mongoose.model('Bonus', BonusSchema);

