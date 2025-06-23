// Security Configuration for GenesisBet Platform

module.exports = {
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRY || '7d',
    issuer: 'genesisbet',
    audience: 'genesisbet-users',
    algorithm: 'HS256'
  },

  // Session Management
  session: {
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '30d',
    sessionTimeout: 7 * 24 * 60 * 60, // 7 days in seconds
    maxConcurrentSessions: 5,
    deviceFingerprintRequired: true
  },

  // Password Policy
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    specialChars: '@$!%*?&',
    preventCommonPasswords: true,
    preventUserInfoInPassword: true,
    saltRounds: 12
  },

  // Account Lockout Policy
  lockout: {
    maxAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes in milliseconds
    progressiveDelay: true, // Increase delay with each failed attempt
    resetOnSuccess: true
  },

  // Rate Limiting Configuration
  rateLimiting: {
    general: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      message: 'Too many requests from this IP, please try again later.'
    },
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5,
      skipSuccessfulRequests: true
    },
    passwordReset: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3
    },
    games: {
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 60
    },
    payments: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 10
    },
    admin: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 200
    }
  },

  // 2FA Configuration
  twoFactor: {
    issuer: 'GenesisBet',
    window: 2, // Allow 2 time steps before/after current
    backupCodesCount: 10,
    backupCodeLength: 8,
    secretLength: 32
  },

  // Security Headers
  headers: {
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    }
  },

  // CORS Configuration
  cors: {
    production: {
      origin: ['https://genesisbet.com', 'https://www.genesisbet.com'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
    },
    development: {
      origin: '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
    }
  },

  // Suspicious Activity Detection
  suspiciousActivity: {
    rapidLocationChange: {
      enabled: true,
      timeWindow: 30 * 60 * 1000, // 30 minutes
      severity: 'medium'
    },
    rapidUserAgentChange: {
      enabled: true,
      timeWindow: 10 * 60 * 1000, // 10 minutes
      severity: 'medium'
    },
    multipleFailedLogins: {
      enabled: true,
      threshold: 3,
      timeWindow: 60 * 60 * 1000, // 1 hour
      severity: 'high'
    },
    rapidSuccessiveLogins: {
      enabled: true,
      threshold: 3,
      timeWindow: 60 * 60 * 1000, // 1 hour
      maxAvgTimeBetween: 5 * 60 * 1000, // 5 minutes
      severity: 'high'
    },
    knownMaliciousIPs: {
      enabled: true,
      severity: 'high'
    }
  },

  // Transaction Monitoring
  transactionMonitoring: {
    largeTransactionThresholds: {
      BTC: 0.1,
      ETH: 1,
      USDT: 1000,
      USD: 1000
    },
    rapidTransactionAlert: {
      enabled: true,
      threshold: 5, // Number of transactions
      timeWindow: 5 * 60 * 1000, // 5 minutes
      severity: 'medium'
    },
    unusualPatternDetection: {
      enabled: true,
      severity: 'medium'
    }
  },

  // Compliance Settings
  compliance: {
    ageVerification: {
      minimumAge: 18,
      required: true
    },
    kycRequirements: {
      level1: {
        maxDailyDeposit: 100, // USD equivalent
        maxDailyWithdrawal: 100,
        documentsRequired: ['email_verification']
      },
      level2: {
        maxDailyDeposit: 1000,
        maxDailyWithdrawal: 1000,
        documentsRequired: ['id_document', 'address_proof']
      },
      level3: {
        maxDailyDeposit: 10000,
        maxDailyWithdrawal: 10000,
        documentsRequired: ['id_document', 'address_proof', 'source_of_funds']
      }
    },
    restrictedCountries: [
      'US', 'UK', 'FR', 'AU', 'NL', 'BE', 'ES', 'IT', 'DE'
    ],
    responsibleGambling: {
      defaultLimits: {
        dailyDeposit: 500,
        weeklyDeposit: 2000,
        monthlyDeposit: 5000,
        sessionTime: 4 * 60 * 60 * 1000, // 4 hours
        dailyLoss: 1000
      },
      selfExclusion: {
        minPeriod: 24 * 60 * 60 * 1000, // 24 hours
        maxPeriod: 365 * 24 * 60 * 60 * 1000, // 1 year
        coolingOffPeriods: [
          24 * 60 * 60 * 1000, // 24 hours
          7 * 24 * 60 * 60 * 1000, // 7 days
          30 * 24 * 60 * 60 * 1000 // 30 days
        ]
      }
    }
  },

  // Audit and Logging
  audit: {
    logLevel: process.env.LOG_LEVEL || 'info',
    retentionPeriod: 90 * 24 * 60 * 60 * 1000, // 90 days
    sensitiveDataMasking: true,
    realTimeAlerts: {
      enabled: true,
      severityThreshold: 'high',
      channels: ['console', 'file'] // Could include 'email', 'slack', 'webhook'
    }
  },

  // Encryption Settings
  encryption: {
    algorithm: 'aes-256-gcm',
    keyDerivation: 'pbkdf2',
    iterations: 100000,
    saltLength: 32,
    ivLength: 16
  },

  // API Security
  api: {
    maxRequestSize: '10mb',
    requestTimeout: 30000, // 30 seconds
    enableEtag: false, // Disable to prevent cache-based attacks
    trustProxy: process.env.NODE_ENV === 'production',
    webhookSignatureValidation: true
  },

  // Development vs Production Settings
  environment: {
    development: {
      logSensitiveData: true,
      bypassRateLimiting: false,
      mockExternalServices: true
    },
    production: {
      logSensitiveData: false,
      bypassRateLimiting: false,
      mockExternalServices: false,
      requireHttps: true,
      secureSessionCookies: true
    }
  },

  // Feature Flags for Security Features
  features: {
    twoFactorAuth: true,
    sessionManagement: true,
    deviceFingerprinting: true,
    suspiciousActivityDetection: true,
    realTimeMonitoring: true,
    automaticAccountLockout: true,
    progressiveDelay: true,
    geoLocationTracking: false, // Requires external service
    biometricAuth: false, // Future feature
    hardwareSecurityKeys: false // Future feature
  }
};

// Validation function to ensure all required environment variables are set
function validateSecurityConfig() {
  const requiredEnvVars = [
    'JWT_SECRET',
    'NODE_ENV'
  ];

  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  // Validate JWT secret strength in production
  if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length < 32) {
      console.error('JWT_SECRET must be at least 32 characters long in production');
      process.exit(1);
    }
  }

  console.log('Security configuration validated successfully');
}

module.exports.validateSecurityConfig = validateSecurityConfig;

