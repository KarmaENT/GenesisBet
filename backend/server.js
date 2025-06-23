const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Import security middleware
const { 
  generalLimiter, 
  speedLimiter, 
  suspiciousActivityDetector 
} = require('./middleware/rateLimiting');
const SessionManager = require('./utils/sessionManager');

// Initialize session manager
SessionManager.initRedis().catch(err => {
  console.warn('Redis connection failed, session management will use JWT only:', err.message);
});

// Security middleware (applied first)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
app.use(generalLimiter);
app.use(speedLimiter);
app.use(suspiciousActivityDetector);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://genesisbet.com', 'https://www.genesisbet.com']
    : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));

// Request logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook signature verification
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/genesisbet')
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Import specific rate limiters
const { 
  authLimiter, 
  gameLimiter, 
  paymentLimiter, 
  adminLimiter 
} = require('./middleware/rateLimiting');

// API Routes with specific rate limiting
app.use('/api/auth', authLimiter, require('./routes/authEnhanced'));
app.use('/api/users', require('./routes/users'));
app.use('/api/games', gameLimiter, require('./routes/games'));
app.use('/api/payments', paymentLimiter, require('./routes/payments'));
app.use('/api/providers', require('./routes/providers'));
app.use('/api/admin', adminLimiter, require('./routes/admin'));
app.use('/api/compliance', generalLimiter, require('./routes/compliance'));

// Security monitoring endpoint
app.get('/api/security/events', require('./middleware/authEnhanced'), async (req, res) => {
  try {
    // Only allow admins to view security events
    if (!req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { SecurityMonitor } = require('./utils/securityMonitor');
    const events = await SecurityMonitor.getUserEvents(req.query.userId, req.query);
    
    res.json({
      success: true,
      events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Log security event for suspicious errors
  if (err.name === 'ValidationError' || err.message.includes('injection')) {
    const { SecurityMonitor } = require('./utils/securityMonitor');
    SecurityMonitor.logEvent({
      userId: req.user?.id || null,
      eventType: 'api_abuse',
      severity: 'medium',
      description: `Suspicious error: ${err.message}`,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        additionalData: {
          url: req.url,
          method: req.method,
          error: err.message
        }
      }
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;

