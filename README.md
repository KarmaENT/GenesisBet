# GenesisBet - Complete Gambling Platform

A fully functional clone of Stake.com built with modern technologies, featuring provably fair games, cryptocurrency payments, comprehensive admin tools, and regulatory compliance.

## 🎯 Project Overview

GenesisBet is an enterprise-grade online gambling platform that provides:

- **Provably Fair Gaming**: Crash, Dice, and Plinko games with cryptographic verification
- **Multi-Currency Support**: Bitcoin, Ethereum, USDT, and traditional fiat currencies
- **Advanced Security**: 2FA, session management, fraud detection, and compliance tools
- **Admin Dashboard**: Real-time analytics, user management, and financial reporting
- **Regulatory Compliance**: Responsible gaming tools, geolocation restrictions, and KYC/AML
- **Modern UI/UX**: Dark-themed, mobile-responsive interface with real-time updates

## 🏗️ Architecture

### Technology Stack

**Frontend:**
- Next.js 14 with TypeScript
- Tailwind CSS for styling
- Framer Motion for animations
- Redux Toolkit for state management
- Socket.io for real-time updates

**Backend:**
- Node.js with Express.js
- MongoDB with Mongoose ODM
- Redis for session management
- JWT authentication
- Socket.io for WebSocket connections

**Infrastructure:**
- Docker & Docker Compose
- Nginx reverse proxy
- MongoDB for data persistence
- Redis for caching and sessions

### System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (Next.js)     │◄──►│   (Express.js)  │◄──►│   (MongoDB)     │
│   Port: 3000    │    │   Port: 5000    │    │   Port: 27017   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └──────────────►│   Redis Cache   │◄─────────────┘
                        │   Port: 6379    │
                        └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ and npm/pnpm
- Docker and Docker Compose
- Git

### Development Setup

1. **Clone the repository:**
```bash
git clone <repository-url>
cd genesisbet
```

2. **Start development environment:**
```bash
./deploy.sh deploy development
```

3. **Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Admin Panel: http://localhost:3000/admin

### Production Deployment

1. **Configure environment:**
```bash
cp .env.production.example .env.production
# Edit .env.production with your actual values
```

2. **Deploy to production:**
```bash
./deploy.sh deploy production
```

## 📁 Project Structure

```
genesisbet/
├── frontend/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/             # App router pages
│   │   ├── components/      # Reusable components
│   │   └── lib/             # Utilities and configurations
│   ├── public/              # Static assets
│   └── package.json
├── backend/                 # Express.js backend API
│   ├── routes/              # API route handlers
│   ├── models/              # Database models
│   ├── middleware/          # Custom middleware
│   ├── utils/               # Utility functions
│   ├── games/               # Game engines
│   ├── payments/            # Payment processors
│   ├── compliance/          # Compliance tools
│   ├── database/            # Database scripts
│   ├── tests/               # Test suites
│   └── server.js            # Main server file
├── docker-compose.yml       # Development environment
├── docker-compose.prod.yml  # Production environment
├── deploy.sh               # Deployment script
└── README.md               # This file
```

## 🎮 Features

### Core Gaming Features

**Provably Fair Games:**
- **Crash Game**: Real-time multiplayer with auto-cashout
- **Dice Game**: Classic dice betting with customizable odds
- **Plinko Game**: Multi-risk level Plinko with visual paths

**Third-Party Integrations:**
- Pragmatic Play slots
- Evolution Gaming live dealer
- NetEnt game portfolio

### Payment System

**Cryptocurrency Support:**
- Bitcoin (BTC)
- Ethereum (ETH)
- Tether (USDT)
- Litecoin (LTC)
- Bitcoin Cash (BCH)
- Dogecoin (DOGE)

**Fiat Payment Methods:**
- Credit/Debit Cards (Stripe)
- PayPal
- Skrill
- Bank Transfers

### Security Features

**Authentication & Authorization:**
- JWT-based authentication
- Two-factor authentication (2FA)
- Role-based access control
- Session management with Redis

**Security Monitoring:**
- Real-time fraud detection
- Suspicious activity alerts
- Rate limiting and DDoS protection
- Comprehensive audit logging

### Compliance & Responsible Gaming

**Regulatory Compliance:**
- KYC/AML verification
- Geolocation restrictions
- Age verification (18+)
- Jurisdiction blocking

**Responsible Gaming Tools:**
- Self-exclusion options
- Deposit/withdrawal limits
- Session time limits
- Problem gambling detection
- Reality checks

### Admin Dashboard

**User Management:**
- User search and filtering
- Account status management
- KYC approval workflow
- VIP tier management

**Financial Reporting:**
- Real-time revenue analytics
- Transaction monitoring
- Payment processor management
- Profit/loss reporting

**System Monitoring:**
- Live user activity
- Game performance metrics
- Security event tracking
- System health monitoring

## 🔧 Configuration

### Environment Variables

**Database Configuration:**
```env
MONGO_URI=mongodb://localhost:27017/genesisbet
REDIS_URL=redis://localhost:6379
```

**Authentication:**
```env
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRY=7d
REFRESH_TOKEN_EXPIRY=30d
```

**Payment Processors:**
```env
STRIPE_SECRET_KEY=sk_live_...
PAYPAL_CLIENT_ID=your_paypal_client_id
COINGATE_API_KEY=your_coingate_api_key
```

**Security Settings:**
```env
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
SESSION_SECRET=your-session-secret
```

### Database Initialization

```bash
# Initialize database with seed data
npm run db:init

# Run database migrations
npm run db:migrate:up

# Check migration status
npm run db:migrate:status
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Test Coverage

The test suite covers:
- Authentication and authorization
- Game logic and provably fair verification
- Payment processing
- Responsible gaming compliance
- Database models and relationships
- API endpoints and middleware

## 📊 Monitoring & Logging

### Health Checks

```bash
# Check service health
./deploy.sh health production

# View service logs
./deploy.sh logs production backend
./deploy.sh logs production frontend
```

### Monitoring Endpoints

- **Backend Health**: `GET /health`
- **Database Status**: `GET /api/admin/system/status`
- **Redis Status**: Included in system status

### Log Management

Logs are automatically rotated and managed:
- Maximum file size: 10MB
- Maximum files: 3 per service
- JSON format for structured logging

## 🔒 Security

### Security Measures

**Application Security:**
- Helmet.js for security headers
- CORS configuration
- Input validation and sanitization
- SQL injection prevention
- XSS protection

**Authentication Security:**
- bcrypt password hashing (12 rounds)
- JWT token validation
- Session hijacking protection
- Device fingerprinting
- Concurrent session limits

**Infrastructure Security:**
- Non-root Docker containers
- Secret management
- Network isolation
- SSL/TLS encryption ready
- Regular security updates

### Security Monitoring

**Real-time Detection:**
- Failed login attempts
- Suspicious betting patterns
- Rapid location changes
- Multiple account creation
- Payment fraud indicators

**Automated Responses:**
- Account lockout
- IP blocking
- Transaction holds
- Admin notifications
- Compliance reporting

## 🌍 Compliance

### Regulatory Features

**KYC/AML Compliance:**
- Document verification
- Identity validation
- Source of funds verification
- Enhanced due diligence
- Ongoing monitoring

**Geolocation Compliance:**
- IP-based location detection
- VPN/proxy detection
- Jurisdiction restrictions
- High-risk country monitoring
- Compliance reporting

**Data Protection:**
- GDPR compliance
- Data retention policies
- Right to be forgotten
- Data portability
- Privacy by design

### Responsible Gaming

**Self-Exclusion Options:**
- Cooling-off periods (24h - 6 weeks)
- Temporary exclusion (6 months - 5 years)
- Permanent exclusion
- Account closure

**Limit Management:**
- Daily deposit limits
- Daily withdrawal limits
- Session time limits
- Loss limits
- Bet size limits

**Problem Gambling Detection:**
- Behavioral pattern analysis
- Chasing loss detection
- Excessive play time monitoring
- Rapid deposit patterns
- Professional assessment tools

## 📈 Performance

### Optimization Features

**Frontend Performance:**
- Next.js static generation
- Image optimization
- Code splitting
- Lazy loading
- Service worker caching

**Backend Performance:**
- Database indexing
- Redis caching
- Connection pooling
- Query optimization
- Rate limiting

**Infrastructure Performance:**
- Docker multi-stage builds
- Nginx reverse proxy
- Load balancing ready
- CDN integration ready
- Auto-scaling capable

### Performance Metrics

**Target Performance:**
- Page load time: < 2 seconds
- API response time: < 200ms
- Game response time: < 100ms
- Concurrent users: 10,000+
- Uptime: 99.9%

## 🚀 Deployment

### Deployment Options

**Development:**
```bash
./deploy.sh deploy development
```

**Production:**
```bash
./deploy.sh deploy production
```

**Cloud Deployment:**
- AWS ECS/EKS
- Google Cloud Run
- Azure Container Instances
- DigitalOcean App Platform

### Scaling Considerations

**Horizontal Scaling:**
- Load balancer configuration
- Database clustering
- Redis clustering
- CDN integration
- Auto-scaling groups

**Vertical Scaling:**
- CPU and memory optimization
- Database performance tuning
- Cache optimization
- Connection pooling
- Query optimization

## 🤝 Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Ensure all tests pass
6. Submit a pull request

### Code Standards

- ESLint configuration
- Prettier formatting
- TypeScript strict mode
- Comprehensive testing
- Documentation updates

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation

- [API Documentation](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Security Guide](docs/SECURITY.md)
- [User Manual](docs/USER_MANUAL.md)

### Getting Help

- Create an issue for bugs
- Use discussions for questions
- Check existing documentation
- Review troubleshooting guide

## 🎯 Roadmap

### Upcoming Features

**Q1 2024:**
- Mobile app development
- Additional game providers
- Advanced analytics
- Multi-language support

**Q2 2024:**
- Sportsbook integration
- Live streaming
- Social features
- Affiliate system

**Q3 2024:**
- NFT integration
- DeFi features
- Advanced AI/ML
- Global expansion

---

**GenesisBet** - The Future of Online Gaming 🎰

Built with ❤️ by the GenesisBet Team

