# GenesisBet Backend

A comprehensive Node.js/Express backend for a crypto gambling platform, featuring user management, game sessions, payment processing, and administrative tools.

## Features

- **User Authentication**: JWT-based auth with 2FA support
- **Game Management**: Provably fair games and third-party integrations
- **Payment Processing**: Multi-currency crypto and fiat support
- **Admin Panel**: User management and financial reporting
- **Compliance**: KYC, AML, responsible gambling features
- **Security**: Rate limiting, encryption, audit logging

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js 4.x
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT + bcrypt
- **Validation**: express-validator
- **Security**: Helmet, CORS
- **Logging**: Morgan

## Prerequisites

- Node.js 20 or higher
- MongoDB 6.0 or higher
- npm or yarn package manager

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd genesisbet/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your configuration:
   ```env
   # Database
   MONGO_URI=mongodb://localhost:27017/genesisbet
   
   # Authentication
   JWT_SECRET=your-super-secret-jwt-key
   
   # Server
   PORT=5000
   NODE_ENV=development
   
   # Webhooks
   WEBHOOK_SECRET=your-webhook-secret
   ```

4. **Database Setup**
   ```bash
   # Initialize database with seed data
   npm run db:init
   
   # Run migrations (if any)
   npm run db:migrate:up
   ```

## Database Schema

### Core Collections

- **users**: User accounts, profiles, wallets, KYC data
- **games**: Game catalog with metadata and statistics
- **transactions**: Financial transactions (deposits, withdrawals, bets)
- **gamesessions**: Individual game sessions and results
- **bonuses**: Bonus definitions and rules
- **userbonuses**: User bonus claims and wagering progress

### Key Features

- **Indexes**: Optimized for high-performance queries
- **Validation**: Schema-level data validation
- **Relationships**: Proper foreign key relationships
- **Aggregation**: Complex analytics pipelines
- **TTL**: Automatic cleanup of expired data

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user

### User Management
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `GET /api/users/balance` - Get wallet balance
- `PUT /api/users/limits` - Update gambling limits
- `POST /api/users/self-exclusion` - Set self-exclusion

### Games
- `GET /api/games/list` - Get available games
- `POST /api/games/session/start` - Start game session
- `POST /api/games/provably-fair/crash` - Play crash game
- `POST /api/games/provably-fair/dice` - Play dice game
- `POST /api/games/verify` - Verify provably fair result

### Payments
- `POST /api/payments/deposit/crypto` - Create deposit address
- `POST /api/payments/withdraw/crypto` - Request withdrawal
- `GET /api/payments/transactions` - Get transaction history
- `POST /api/payments/webhook/deposit` - Deposit webhook

### Admin (Requires admin role)
- `GET /api/admin/dashboard` - Admin dashboard stats
- `GET /api/admin/users` - List users with filters
- `PUT /api/admin/user/:id/status` - Update user status
- `PUT /api/admin/user/:id/kyc` - Update KYC status
- `GET /api/admin/transactions` - All transactions
- `GET /api/admin/financial-report` - Financial reports

## Running the Application

### Development Mode
```bash
npm run dev
```
Server runs on http://localhost:5000 with auto-reload.

### Production Mode
```bash
npm start
```

### Database Operations
```bash
# Initialize database with seed data
npm run db:init

# Check migration status
npm run db:migrate:status

# Apply pending migrations
npm run db:migrate:up

# Rollback to specific version
npm run db:migrate down 1.0.0
```

## Security Features

### Authentication & Authorization
- JWT tokens with configurable expiration
- Role-based access control (RBAC)
- Password hashing with bcrypt (12 rounds)
- Account lockout after failed attempts

### Data Protection
- Input validation and sanitization
- SQL/NoSQL injection prevention
- XSS protection with Helmet
- CORS configuration
- Rate limiting

### Compliance
- KYC verification workflow
- AML transaction monitoring
- Geolocation restrictions
- Responsible gambling tools
- Audit logging

## Provably Fair Gaming

The platform implements provably fair algorithms for internal games:

### Algorithm
1. **Server Seed**: Generated randomly for each game
2. **Client Seed**: Provided by user or auto-generated
3. **Nonce**: Incremental counter for each bet
4. **Result**: Generated using SHA-256 hash of combined seeds

### Verification
Users can verify game results using the `/api/games/verify` endpoint with:
- Server seed (revealed after game)
- Client seed
- Nonce
- Game type

## Error Handling

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Monitoring & Logging

### Request Logging
All requests are logged using Morgan with:
- HTTP method and URL
- Response status and time
- User agent and IP address
- Response time

### Error Logging
Errors are logged with:
- Stack trace
- Request context
- User information
- Timestamp

### Performance Monitoring
- Database query performance
- API response times
- Memory usage
- Connection pool metrics

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Load Testing
```bash
npm run test:load
```

## Deployment

### Docker
```bash
# Build image
docker build -t genesisbet-backend .

# Run container
docker run -p 5000:5000 -e MONGO_URI=mongodb://mongo:27017/genesisbet genesisbet-backend
```

### Environment Variables
Required for production:
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret (256-bit)
- `NODE_ENV=production`
- `WEBHOOK_SECRET` - Webhook verification secret

### Health Checks
- `GET /health` - Basic health check
- Returns server status and uptime

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Code Style
- Use ESLint configuration
- Follow Airbnb style guide
- Add JSDoc comments for functions
- Write tests for new features

## License

This project is licensed under the ISC License.

## Support

For support and questions:
- Create an issue on GitHub
- Contact development team
- Check documentation in `/docs`

## Changelog

### v1.0.0
- Initial release
- User authentication and management
- Game sessions and provably fair games
- Payment processing
- Admin panel
- Compliance features

