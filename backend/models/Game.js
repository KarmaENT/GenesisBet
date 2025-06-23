const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  category: {
    type: String,
    required: true,
    enum: ['slots', 'live_casino', 'provably_fair', 'sportsbook', 'table_games']
  },
  provider: {
    type: String,
    required: true,
    enum: ['pragmatic_play', 'netent', 'evolution_gaming', 'hacksaw_gaming', 'internal']
  },
  description: {
    type: String,
    trim: true
  },
  thumbnail: {
    type: String,
    required: true
  },
  rtp: {
    type: Number,
    min: 0,
    max: 100,
    default: 96
  },
  volatility: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  minBet: {
    type: Number,
    required: true,
    min: 0.01
  },
  maxBet: {
    type: Number,
    required: true,
    min: 0.01
  },
  maxWin: {
    type: Number,
    default: 0
  },
  features: [{
    type: String,
    enum: ['free_spins', 'bonus_rounds', 'multipliers', 'wilds', 'scatters', 'progressive_jackpot']
  }],
  paylines: {
    type: Number,
    default: 0
  },
  reels: {
    type: Number,
    default: 0
  },
  gameUrl: {
    type: String,
    trim: true
  },
  mobileSupported: {
    type: Boolean,
    default: true
  },
  currencies: [{
    type: String,
    enum: ['BTC', 'ETH', 'USDT', 'USD', 'EUR']
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  },
  popularity: {
    type: Number,
    default: 0
  },
  totalPlays: {
    type: Number,
    default: 0
  },
  totalWagered: {
    type: Number,
    default: 0
  },
  totalPayout: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  releaseDate: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
GameSchema.index({ category: 1 });
GameSchema.index({ provider: 1 });
GameSchema.index({ status: 1 });
GameSchema.index({ popularity: -1 });
GameSchema.index({ slug: 1 });
GameSchema.index({ tags: 1 });

// Virtual for actual RTP (including house edge)
GameSchema.virtual('actualRtp').get(function() {
  if (this.totalWagered > 0) {
    return (this.totalPayout / this.totalWagered) * 100;
  }
  return this.rtp;
});

// Method to update game statistics
GameSchema.methods.updateStats = function(wagered, payout) {
  this.totalPlays += 1;
  this.totalWagered += wagered;
  this.totalPayout += payout;
  this.popularity += 1;
  this.lastUpdated = new Date();
  return this.save();
};

module.exports = mongoose.model('Game', GameSchema);

