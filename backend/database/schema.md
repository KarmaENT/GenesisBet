# GenesisBet Database Schema Documentation

## Overview
The GenesisBet platform uses MongoDB as the primary database with Mongoose ODM for data modeling. The database is designed to handle high-volume gambling operations with proper indexing for performance and data integrity.

## Collections

### 1. Users Collection
**Purpose**: Store user account information, profiles, wallets, and compliance data.

**Key Fields**:
- `email` (String, unique): User's email address
- `username` (String, unique): User's display name
- `password` (String): Hashed password using bcrypt
- `dateOfBirth` (Date): For age verification (18+ requirement)
- `country` (String): ISO country code for compliance
- `roles` (Array): User roles ['user', 'admin', 'moderator', 'support']
- `status` (String): Account status ['active', 'suspended', 'banned', 'pending']

**Nested Objects**:
- `profile`: User statistics and tier information
- `kyc`: KYC verification status and documents
- `wallet`: Multi-currency balance and addresses
- `security`: 2FA settings and login attempt tracking
- `preferences`: User settings and notifications
- `limits`: Responsible gambling limits
- `bonuses`: Bonus tracking and wagering progress

**Indexes**:
- `email` (unique)
- `username` (unique)
- `profile.tier`
- `kyc.status`
- `status`
- `country`

### 2. Games Collection
**Purpose**: Store game catalog with metadata and statistics.

**Key Fields**:
- `name` (String): Game display name
- `slug` (String, unique): URL-friendly identifier
- `category` (String): Game category ['slots', 'live_casino', 'provably_fair', 'sportsbook', 'table_games']
- `provider` (String): Game provider ['pragmatic_play', 'netent', 'evolution_gaming', 'hacksaw_gaming', 'internal']
- `rtp` (Number): Return to Player percentage
- `minBet`/`maxBet` (Number): Betting limits
- `status` (String): Game availability ['active', 'inactive', 'maintenance']

**Statistics**:
- `totalPlays`: Number of game sessions
- `totalWagered`: Total amount wagered
- `totalPayout`: Total amount paid out
- `popularity`: Popularity score

**Indexes**:
- `category`
- `provider`
- `status`
- `popularity` (descending)
- `slug` (unique)
- `tags`

### 3. Transactions Collection
**Purpose**: Track all financial transactions including deposits, withdrawals, bets, and wins.

**Key Fields**:
- `userId` (ObjectId): Reference to user
- `type` (String): Transaction type ['deposit', 'withdrawal', 'bet', 'win', 'bonus', 'refund']
- `currency` (String): Currency code ['BTC', 'ETH', 'USDT', 'USD', 'EUR']
- `amount` (Number): Transaction amount
- `fee` (Number): Transaction fee
- `netAmount` (Number): Net amount after fees
- `status` (String): Transaction status ['pending', 'completed', 'failed', 'cancelled', 'expired']
- `address` (String): Crypto address for deposits/withdrawals
- `txHash` (String): Blockchain transaction hash

**Indexes**:
- `userId` + `createdAt` (compound, descending)
- `type`
- `status`
- `currency`
- `txHash` (unique, sparse)
- `gameId`
- `sessionId`

### 4. GameSessions Collection
**Purpose**: Track individual game sessions and betting history.

**Key Fields**:
- `sessionId` (String, unique): Unique session identifier
- `userId` (ObjectId): Reference to user
- `gameId` (ObjectId): Reference to game
- `betAmount` (Number): Amount wagered
- `currency` (String): Currency used
- `status` (String): Session status ['active', 'completed', 'cancelled', 'error']

**Result Object**:
- `outcome` (String): Game result ['win', 'loss', 'push']
- `payout` (Number): Amount won
- `profit` (Number): Net profit/loss
- `multiplier` (Number): Win multiplier

**Provably Fair**:
- `serverSeed` (String): Server seed for fairness
- `serverSeedHash` (String): Hashed server seed
- `clientSeed` (String): Client-provided seed
- `nonce` (Number): Round number
- `revealed` (Boolean): Whether seeds are revealed

**Indexes**:
- `userId` + `createdAt` (compound, descending)
- `gameId`
- `sessionId` (unique)
- `status`
- `result.outcome`

### 5. Bonuses Collection
**Purpose**: Define available bonus offers and promotions.

**Key Fields**:
- `name` (String): Bonus display name
- `type` (String): Bonus type ['welcome', 'deposit', 'reload', 'cashback', 'free_spins', 'tournament', 'vip']
- `status` (String): Bonus availability ['active', 'inactive', 'expired']
- `amount`/`percentage` (Number): Bonus value
- `wageringRequirement` (Number): Wagering multiplier
- `currencies` (Array): Eligible currencies

**Eligibility Rules**:
- `newUsersOnly` (Boolean): First-time users only
- `minTier` (String): Minimum VIP tier required
- `countries`/`excludedCountries` (Array): Geographic restrictions

**Validity Period**:
- `startDate`/`endDate` (Date): Bonus availability window
- `claimPeriod` (Number): Hours to claim after trigger

**Indexes**:
- `type`
- `status`
- `validity.startDate` + `validity.endDate`

### 6. UserBonuses Collection
**Purpose**: Track individual bonus claims and wagering progress.

**Key Fields**:
- `userId` (ObjectId): Reference to user
- `bonusId` (ObjectId): Reference to bonus
- `status` (String): Claim status ['active', 'completed', 'forfeited', 'expired']
- `amount` (Number): Bonus amount received
- `currency` (String): Bonus currency

**Wagering Progress**:
- `required` (Number): Total wagering required
- `completed` (Number): Wagering completed
- `remaining` (Number): Wagering remaining

**Timestamps**:
- `claimedAt` (Date): When bonus was claimed
- `expiresAt` (Date): When bonus expires
- `completedAt` (Date): When wagering completed

**Indexes**:
- `userId` + `status`
- `bonusId`
- `expiresAt`
- `userId` + `bonusId` (compound)

## Data Relationships

### User → Transactions (1:N)
- Users can have multiple transactions
- Transactions reference userId

### User → GameSessions (1:N)
- Users can have multiple game sessions
- Sessions reference userId

### Game → GameSessions (1:N)
- Games can have multiple sessions
- Sessions reference gameId

### User → UserBonuses (1:N)
- Users can claim multiple bonuses
- UserBonuses reference userId

### Bonus → UserBonuses (1:N)
- Bonuses can be claimed by multiple users
- UserBonuses reference bonusId

## Performance Considerations

### Indexing Strategy
1. **Compound Indexes**: Used for common query patterns
2. **Sparse Indexes**: For optional unique fields (txHash)
3. **TTL Indexes**: For automatic cleanup of expired data
4. **Text Indexes**: For search functionality

### Query Optimization
1. **Aggregation Pipelines**: For complex analytics
2. **Projection**: Limit returned fields
3. **Pagination**: Limit result sets
4. **Caching**: Redis for frequently accessed data

### Scaling Considerations
1. **Sharding**: By userId for horizontal scaling
2. **Read Replicas**: For analytics and reporting
3. **Connection Pooling**: Optimize database connections
4. **Batch Operations**: For bulk data processing

## Security Measures

### Data Protection
1. **Encryption**: Sensitive fields encrypted at rest
2. **Hashing**: Passwords hashed with bcrypt (12 rounds)
3. **Validation**: Input validation at model level
4. **Sanitization**: Prevent NoSQL injection

### Access Control
1. **Authentication**: JWT token validation
2. **Authorization**: Role-based access control
3. **Rate Limiting**: Prevent abuse
4. **Audit Logging**: Track sensitive operations

## Compliance Features

### Responsible Gambling
1. **Deposit Limits**: Daily/weekly/monthly limits
2. **Session Limits**: Time-based restrictions
3. **Self-Exclusion**: Temporary or permanent bans
4. **Cooling-Off**: Short-term breaks

### Regulatory Compliance
1. **KYC Tracking**: Identity verification status
2. **AML Monitoring**: Transaction pattern analysis
3. **Geo-Blocking**: Country-based restrictions
4. **Audit Trails**: Immutable transaction records

## Backup and Recovery

### Backup Strategy
1. **Daily Backups**: Full database backup
2. **Point-in-Time Recovery**: Transaction log backups
3. **Geographic Redundancy**: Multi-region backups
4. **Automated Testing**: Regular restore testing

### Disaster Recovery
1. **RTO**: 15 minutes (Recovery Time Objective)
2. **RPO**: 5 minutes (Recovery Point Objective)
3. **Failover**: Automatic failover to secondary
4. **Data Validation**: Integrity checks after recovery

## Monitoring and Maintenance

### Performance Monitoring
1. **Query Performance**: Slow query logging
2. **Index Usage**: Index effectiveness analysis
3. **Connection Metrics**: Pool utilization
4. **Storage Metrics**: Disk usage and growth

### Maintenance Tasks
1. **Index Optimization**: Regular index analysis
2. **Data Archival**: Move old data to cold storage
3. **Statistics Update**: Keep query planner current
4. **Cleanup Jobs**: Remove expired sessions/tokens

