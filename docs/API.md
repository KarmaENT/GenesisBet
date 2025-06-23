# GenesisBet API Documentation

Complete API reference for the GenesisBet gambling platform.

## Base URL

- **Development**: `http://localhost:5000/api`
- **Production**: `https://yourdomain.com/api`

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Authentication Flow

1. Register or login to get access token
2. Include token in subsequent requests
3. Refresh token when expired
4. Logout to invalidate session

## Rate Limiting

API endpoints are rate limited:

- **Authentication**: 5 requests per 15 minutes
- **Games**: 100 requests per 15 minutes  
- **Payments**: 20 requests per 15 minutes
- **General**: 100 requests per 15 minutes
- **Admin**: 200 requests per 15 minutes

## Response Format

All API responses follow this format:

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Success message",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Authentication Endpoints

### Register User

**POST** `/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "dateOfBirth": "1990-01-01",
  "country": "US"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "username": "johndoe",
      "email": "john@example.com",
      "status": "active"
    },
    "token": "jwt_token",
    "refreshToken": "refresh_token"
  }
}
```

### Login User

**POST** `/auth/login`

Authenticate user and get access token.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "username": "johndoe",
      "email": "john@example.com"
    },
    "token": "jwt_token",
    "refreshToken": "refresh_token",
    "expiresIn": "7d"
  }
}
```

### Get Current User

**GET** `/auth/me`

Get current authenticated user information.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "username": "johndoe",
      "email": "john@example.com",
      "wallet": {
        "USD": { "balance": 1000.00 },
        "BTC": { "balance": 0.05 }
      },
      "vip": {
        "level": 2,
        "points": 1500
      }
    }
  }
}
```

### Setup 2FA

**POST** `/auth/2fa/setup`

Setup two-factor authentication.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "secret": "base32_secret",
    "qrCode": "data:image/png;base64,qr_code_data",
    "backupCodes": ["code1", "code2", "..."]
  }
}
```

### Verify 2FA

**POST** `/auth/2fa/verify`

Verify and enable two-factor authentication.

**Request Body:**
```json
{
  "token": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "backupCodes": ["code1", "code2", "..."]
  }
}
```

## User Management Endpoints

### Get User Profile

**GET** `/users/profile`

Get detailed user profile information.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "username": "johndoe",
      "email": "john@example.com",
      "dateOfBirth": "1990-01-01",
      "country": "US",
      "kyc": {
        "status": "verified",
        "level": 2
      },
      "limits": {
        "dailyDeposit": 5000,
        "dailyWithdrawal": 10000,
        "sessionTime": 240
      },
      "responsibleGaming": {
        "selfExclusion": {
          "active": false
        }
      }
    }
  }
}
```

### Update User Profile

**PUT** `/users/profile`

Update user profile information.

**Request Body:**
```json
{
  "username": "newusername",
  "email": "newemail@example.com"
}
```

### Get User Balance

**GET** `/users/balance`

Get user wallet balances.

**Response:**
```json
{
  "success": true,
  "data": {
    "balances": {
      "USD": { "balance": 1000.00, "locked": 50.00 },
      "BTC": { "balance": 0.05, "locked": 0.001 },
      "ETH": { "balance": 2.5, "locked": 0.1 }
    },
    "totalValue": {
      "USD": 15000.00
    }
  }
}
```

## Games Endpoints

### Get Available Games

**GET** `/games`

Get list of available games.

**Query Parameters:**
- `category` (optional): Filter by category (provably-fair, slots, live-dealer)
- `provider` (optional): Filter by provider
- `search` (optional): Search by game name

**Response:**
```json
{
  "success": true,
  "data": {
    "games": [
      {
        "id": "crash",
        "name": "Crash",
        "category": "provably-fair",
        "provider": "GenesisBet",
        "minBet": 0.01,
        "maxBet": 1000,
        "rtp": 99,
        "description": "Real-time multiplayer crash game"
      }
    ]
  }
}
```

### Play Crash Game

**POST** `/games/crash/play`

Start a crash game session.

**Request Body:**
```json
{
  "betAmount": 10.00,
  "autoCashout": 2.0,
  "currency": "USD"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "gameId": "game_session_id",
    "serverSeed": "hashed_server_seed",
    "clientSeed": "client_seed",
    "nonce": 1,
    "betAmount": 10.00,
    "autoCashout": 2.0,
    "gameStarted": true
  }
}
```

### Cashout Crash Game

**POST** `/games/crash/cashout`

Cashout from active crash game.

**Request Body:**
```json
{
  "gameId": "game_session_id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cashedOut": true,
    "multiplier": 1.85,
    "winAmount": 18.50,
    "profit": 8.50
  }
}
```

### Play Dice Game

**POST** `/games/dice/play`

Play a dice game.

**Request Body:**
```json
{
  "betAmount": 10.00,
  "target": 50,
  "isOver": true,
  "currency": "USD"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "result": 75.32,
    "isWin": true,
    "payout": 19.60,
    "profit": 9.60,
    "verification": {
      "serverSeed": "server_seed",
      "clientSeed": "client_seed",
      "nonce": 1
    }
  }
}
```

### Verify Game Result

**POST** `/games/verify`

Verify provably fair game result.

**Request Body:**
```json
{
  "serverSeed": "server_seed",
  "clientSeed": "client_seed",
  "nonce": 1,
  "gameType": "dice"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "result": 75.32,
    "calculation": "SHA256(server_seed:client_seed:nonce)"
  }
}
```

### Get Game History

**GET** `/games/history`

Get user's game history.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `gameType` (optional): Filter by game type
- `startDate` (optional): Start date filter
- `endDate` (optional): End date filter

**Response:**
```json
{
  "success": true,
  "data": {
    "games": [
      {
        "id": "game_id",
        "gameType": "dice",
        "betAmount": 10.00,
        "winAmount": 19.60,
        "profit": 9.60,
        "result": { "value": 75.32, "isWin": true },
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 100,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

## Payment Endpoints

### Get Payment Methods

**GET** `/payments/methods`

Get available payment methods.

**Response:**
```json
{
  "success": true,
  "data": {
    "crypto": [
      {
        "currency": "BTC",
        "name": "Bitcoin",
        "minDeposit": 0.001,
        "maxDeposit": 10,
        "confirmations": 3,
        "depositFee": 0,
        "withdrawalFee": 0.0005
      }
    ],
    "fiat": [
      {
        "currency": "USD",
        "name": "US Dollar",
        "methods": ["stripe", "paypal"],
        "minDeposit": 10,
        "maxDeposit": 10000,
        "depositFee": 0.029,
        "withdrawalFee": 0
      }
    ]
  }
}
```

### Generate Deposit Address

**POST** `/payments/deposit/generate`

Generate cryptocurrency deposit address.

**Request Body:**
```json
{
  "currency": "BTC"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "currency": "BTC",
    "qrCode": "data:image/png;base64,qr_code_data",
    "expiresAt": "2024-01-01T01:00:00.000Z"
  }
}
```

### Create Fiat Deposit

**POST** `/payments/deposit/fiat`

Create fiat currency deposit.

**Request Body:**
```json
{
  "amount": 100.00,
  "currency": "USD",
  "method": "stripe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentIntent": "pi_stripe_payment_intent_id",
    "clientSecret": "pi_client_secret",
    "amount": 100.00,
    "currency": "USD"
  }
}
```

### Request Withdrawal

**POST** `/payments/withdraw`

Request cryptocurrency or fiat withdrawal.

**Request Body:**
```json
{
  "amount": 50.00,
  "currency": "BTC",
  "address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "tx_id",
    "amount": 50.00,
    "currency": "BTC",
    "fee": 0.0005,
    "netAmount": 49.9995,
    "status": "pending",
    "estimatedTime": "30 minutes"
  }
}
```

### Get Transaction History

**GET** `/payments/transactions`

Get user's transaction history.

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `type` (optional): Filter by type (deposit, withdrawal)
- `status` (optional): Filter by status
- `currency` (optional): Filter by currency

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "tx_id",
        "type": "deposit",
        "amount": 100.00,
        "currency": "USD",
        "status": "completed",
        "fee": 2.90,
        "netAmount": 97.10,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "completedAt": "2024-01-01T00:05:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 50
    }
  }
}
```

## Compliance Endpoints

### Get Responsible Gaming Settings

**GET** `/compliance/responsible-gaming`

Get user's responsible gaming settings.

**Response:**
```json
{
  "success": true,
  "data": {
    "limits": {
      "dailyDeposit": 1000,
      "dailyWithdrawal": 5000,
      "sessionTime": 120
    },
    "selfExclusion": {
      "active": false,
      "until": null,
      "permanent": false
    },
    "coolingOff": {
      "active": false,
      "until": null
    },
    "realityCheck": {
      "enabled": true,
      "interval": 60
    }
  }
}
```

### Update Limits

**PUT** `/compliance/limits`

Update responsible gaming limits.

**Request Body:**
```json
{
  "dailyDeposit": 500,
  "sessionTime": 60
}
```

### Apply Self-Exclusion

**POST** `/compliance/self-exclusion`

Apply self-exclusion to account.

**Request Body:**
```json
{
  "type": "temporary",
  "duration": 30,
  "reason": "Need a break from gambling"
}
```

### Problem Gambling Assessment

**POST** `/compliance/assessment`

Submit problem gambling self-assessment.

**Request Body:**
```json
{
  "answers": [1, 2, 1, 3, 2, 1, 2, 1]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "score": 8,
    "risk": "moderate",
    "recommendations": [
      "Consider setting deposit limits",
      "Enable reality checks",
      "Take regular breaks"
    ]
  }
}
```

## Admin Endpoints

### Get Dashboard Statistics

**GET** `/admin/dashboard/stats`

Get admin dashboard statistics.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 10000,
      "active": 2500,
      "new": 150
    },
    "revenue": {
      "today": 50000,
      "week": 300000,
      "month": 1200000
    },
    "games": {
      "sessions": 5000,
      "totalBets": 250000,
      "totalWins": 225000
    }
  }
}
```

### Get Users List

**GET** `/admin/users`

Get paginated list of users.

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `search`: Search by username/email
- `status`: Filter by status
- `kyc`: Filter by KYC status

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user_id",
        "username": "johndoe",
        "email": "john@example.com",
        "status": "active",
        "kyc": { "status": "verified" },
        "balance": 1000.00,
        "lastLogin": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 100,
      "totalItems": 10000
    }
  }
}
```

### Update User Status

**PUT** `/admin/users/:userId/status`

Update user account status.

**Request Body:**
```json
{
  "status": "suspended",
  "reason": "Violation of terms"
}
```

### Get Financial Reports

**GET** `/admin/reports/financial`

Get financial reports.

**Query Parameters:**
- `startDate`: Start date
- `endDate`: End date
- `currency`: Filter by currency
- `type`: Report type (revenue, deposits, withdrawals)

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalRevenue": 1000000,
      "totalDeposits": 5000000,
      "totalWithdrawals": 4500000,
      "netRevenue": 500000
    },
    "breakdown": [
      {
        "date": "2024-01-01",
        "revenue": 50000,
        "deposits": 250000,
        "withdrawals": 200000
      }
    ]
  }
}
```

## WebSocket Events

### Connection

Connect to WebSocket server:

```javascript
const socket = io('ws://localhost:5000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Game Events

**Crash Game Events:**

```javascript
// Join crash game
socket.emit('crash:join');

// Game started
socket.on('crash:started', (data) => {
  console.log('Game started:', data);
});

// Multiplier update
socket.on('crash:multiplier', (data) => {
  console.log('Current multiplier:', data.multiplier);
});

// Game crashed
socket.on('crash:crashed', (data) => {
  console.log('Game crashed at:', data.multiplier);
});

// Player cashed out
socket.on('crash:cashout', (data) => {
  console.log('Player cashed out:', data);
});
```

### Notification Events

```javascript
// Balance update
socket.on('balance:updated', (data) => {
  console.log('Balance updated:', data);
});

// Transaction update
socket.on('transaction:update', (data) => {
  console.log('Transaction update:', data);
});

// Security alert
socket.on('security:alert', (data) => {
  console.log('Security alert:', data);
});
```

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 422 | Unprocessable Entity - Validation errors |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |

## SDK Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

class GenesisBetAPI {
  constructor(baseURL, token) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async getBalance() {
    const response = await this.client.get('/users/balance');
    return response.data;
  }

  async playDice(betAmount, target, isOver) {
    const response = await this.client.post('/games/dice/play', {
      betAmount,
      target,
      isOver,
      currency: 'USD'
    });
    return response.data;
  }
}

// Usage
const api = new GenesisBetAPI('http://localhost:5000/api', 'your-token');
const balance = await api.getBalance();
const gameResult = await api.playDice(10, 50, true);
```

### Python

```python
import requests

class GenesisBetAPI:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def get_balance(self):
        response = requests.get(
            f'{self.base_url}/users/balance',
            headers=self.headers
        )
        return response.json()
    
    def play_dice(self, bet_amount, target, is_over):
        data = {
            'betAmount': bet_amount,
            'target': target,
            'isOver': is_over,
            'currency': 'USD'
        }
        response = requests.post(
            f'{self.base_url}/games/dice/play',
            json=data,
            headers=self.headers
        )
        return response.json()

# Usage
api = GenesisBetAPI('http://localhost:5000/api', 'your-token')
balance = api.get_balance()
game_result = api.play_dice(10, 50, True)
```

## Postman Collection

Import the Postman collection for easy API testing:

```json
{
  "info": {
    "name": "GenesisBet API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{jwt_token}}",
        "type": "string"
      }
    ]
  },
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:5000/api"
    }
  ]
}
```

---

For more information, visit our [GitHub repository](https://github.com/genesisbet/platform) or contact our support team.

