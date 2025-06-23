const mongoose = require('mongoose');

const walletAddressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  currency: {
    type: String,
    required: true,
    enum: ['BTC', 'ETH', 'USDT', 'LTC', 'BCH', 'DOGE', 'USD'],
    index: true
  },
  address: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  privateKey: {
    type: String,
    required: true // Encrypted
  },
  network: {
    type: String,
    required: true,
    enum: ['bitcoin', 'ethereum', 'litecoin', 'bitcoin-cash', 'dogecoin', 'fiat']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'compromised'],
    default: 'active',
    index: true
  },
  metadata: {
    derivationPath: String,
    publicKey: String,
    addressType: {
      type: String,
      enum: ['legacy', 'segwit', 'native_segwit', 'erc20', 'bep20']
    },
    contractAddress: String, // For tokens like USDT
    decimals: {
      type: Number,
      default: 18
    }
  },
  statistics: {
    totalDeposits: {
      type: Number,
      default: 0
    },
    totalWithdrawals: {
      type: Number,
      default: 0
    },
    transactionCount: {
      type: Number,
      default: 0
    },
    lastUsed: Date
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes
walletAddressSchema.index({ userId: 1, currency: 1 });
walletAddressSchema.index({ address: 1, currency: 1 });
walletAddressSchema.index({ status: 1, currency: 1 });

// Update timestamp on save
walletAddressSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance methods
walletAddressSchema.methods.updateStatistics = function(type, amount) {
  if (type === 'deposit') {
    this.statistics.totalDeposits += amount;
  } else if (type === 'withdrawal') {
    this.statistics.totalWithdrawals += amount;
  }
  
  this.statistics.transactionCount += 1;
  this.statistics.lastUsed = new Date();
  
  return this.save();
};

walletAddressSchema.methods.deactivate = function() {
  this.status = 'inactive';
  return this.save();
};

walletAddressSchema.methods.markCompromised = function() {
  this.status = 'compromised';
  return this.save();
};

// Static methods
walletAddressSchema.statics.findByUser = function(userId, currency = null) {
  const query = { userId, status: 'active' };
  if (currency) {
    query.currency = currency;
  }
  return this.find(query);
};

walletAddressSchema.statics.findByAddress = function(address, currency = null) {
  const query = { address, status: 'active' };
  if (currency) {
    query.currency = currency;
  }
  return this.findOne(query);
};

walletAddressSchema.statics.getActiveAddresses = function(currency = null) {
  const query = { status: 'active' };
  if (currency) {
    query.currency = currency;
  }
  return this.find(query);
};

// Virtual for net balance
walletAddressSchema.virtual('netBalance').get(function() {
  return this.statistics.totalDeposits - this.statistics.totalWithdrawals;
});

// Ensure virtual fields are serialized
walletAddressSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    // Remove sensitive data from JSON output
    delete ret.privateKey;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('WalletAddress', walletAddressSchema);

