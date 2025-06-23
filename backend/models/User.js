const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  country: {
    type: String,
    required: true,
    length: 2 // ISO country code
  },
  roles: [{
    type: String,
    enum: ['user', 'admin', 'moderator', 'support'],
    default: 'user'
  }],
  phone: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'banned', 'pending'],
    default: 'active'
  },
  profile: {
    tier: {
      type: String,
      enum: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'],
      default: 'Bronze'
    },
    avatar: {
      type: String,
      default: null
    },
    totalWagered: {
      type: Number,
      default: 0
    },
    totalDeposited: {
      type: Number,
      default: 0
    },
    totalWithdrawn: {
      type: Number,
      default: 0
    },
    gamesPlayed: {
      type: Number,
      default: 0
    },
    winRate: {
      type: Number,
      default: 0
    }
  },
  kyc: {
    status: {
      type: String,
      enum: ['pending', 'in_review', 'verified', 'rejected'],
      default: 'pending'
    },
    level: {
      type: Number,
      enum: [0, 1, 2, 3],
      default: 0
    },
    documents: {
      idDocument: {
        type: String,
        default: null
      },
      proofOfAddress: {
        type: String,
        default: null
      },
      selfie: {
        type: String,
        default: null
      }
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    rejectionReason: {
      type: String,
      default: null
    }
  },
  wallet: {
    balance: {
      BTC: {
        type: Number,
        default: 0
      },
      ETH: {
        type: Number,
        default: 0
      },
      USDT: {
        type: Number,
        default: 0
      },
      USD: {
        type: Number,
        default: 0
      }
    },
    addresses: {
      BTC: {
        type: String,
        default: null
      },
      ETH: {
        type: String,
        default: null
      },
      USDT: {
        type: String,
        default: null
      }
    }
  },
  security: {
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    twoFactorSecret: {
      type: String,
      default: null
    },
    backupCodes: [{
      type: String
    }],
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: {
      type: Date,
      default: null
    },
    passwordChangedAt: {
      type: Date,
      default: Date.now
    },
    securityQuestions: [{
      question: String,
      answer: String // Should be hashed
    }]
  },
  preferences: {
    currency: {
      type: String,
      enum: ['BTC', 'ETH', 'USDT', 'USD'],
      default: 'USD'
    },
    language: {
      type: String,
      default: 'en'
    },
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'dark'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      },
      push: {
        type: Boolean,
        default: true
      }
    }
  },
  limits: {
    dailyDeposit: {
      type: Number,
      default: 10000 // USD equivalent
    },
    dailyWithdrawal: {
      type: Number,
      default: 5000 // USD equivalent
    },
    sessionTime: {
      type: Number,
      default: 0 // 0 = no limit, in minutes
    },
    coolingOff: {
      type: Date,
      default: null
    },
    selfExclusion: {
      type: Date,
      default: null
    }
  },
  bonuses: {
    welcomeBonus: {
      claimed: {
        type: Boolean,
        default: false
      },
      amount: {
        type: Number,
        default: 0
      },
      wagering: {
        required: {
          type: Number,
          default: 0
        },
        completed: {
          type: Number,
          default: 0
        }
      }
    },
    vipCashback: {
      rate: {
        type: Number,
        default: 0
      },
      accumulated: {
        type: Number,
        default: 0
      }
    }
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  metadata: {
    registrationIp: String,
    registrationUserAgent: String,
    acceptedTermsAt: Date,
    acceptedPrivacyAt: Date,
    statusHistory: [{
      status: String,
      reason: String,
      changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      changedAt: {
        type: Date,
        default: Date.now
      }
    }],
    loginHistory: [{
      timestamp: Date,
      ipAddress: String,
      userAgent: String,
      success: Boolean
    }],
    notes: String
  }
}, {
  timestamps: true
});

// Indexes for performance
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ 'profile.tier': 1 });
UserSchema.index({ 'kyc.status': 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ country: 1 });

// Virtual for account lock status
UserSchema.virtual('isLocked').get(function() {
  return !!(this.security.lockUntil && this.security.lockUntil > Date.now());
});

// Method to increment login attempts
UserSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.security.lockUntil && this.security.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: {
        'security.lockUntil': 1
      },
      $set: {
        'security.loginAttempts': 1
      }
    });
  }
  
  const updates = { $inc: { 'security.loginAttempts': 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.security.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = {
      'security.lockUntil': Date.now() + 2 * 60 * 60 * 1000 // 2 hours
    };
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
UserSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      'security.loginAttempts': 1,
      'security.lockUntil': 1
    }
  });
};

module.exports = mongoose.model('User', UserSchema);

