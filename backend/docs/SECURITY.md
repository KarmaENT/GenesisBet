# GenesisBet Security Documentation

## Overview

The GenesisBet platform implements enterprise-grade security measures to protect user data, prevent fraud, and ensure compliance with gambling regulations. This document outlines all security features and their implementation.

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Session Management](#session-management)
3. [Two-Factor Authentication (2FA)](#two-factor-authentication-2fa)
4. [Rate Limiting & DDoS Protection](#rate-limiting--ddos-protection)
5. [Suspicious Activity Detection](#suspicious-activity-detection)
6. [Security Monitoring & Logging](#security-monitoring--logging)
7. [Data Protection](#data-protection)
8. [Compliance Features](#compliance-features)
9. [API Security](#api-security)
10. [Deployment Security](#deployment-security)

## Authentication & Authorization

### JWT-Based Authentication

The platform uses JSON Web Tokens (JWT) for stateless authentication with the following features:

- **Algorithm**: HS256 (HMAC with SHA-256)
- **Expiry**: 7 days (configurable)
- **Issuer/Audience**: Validated for additional security
- **Payload**: Contains user ID, roles, session ID, and device fingerprint

### Password Security

- **Hashing**: bcrypt with 12 salt rounds
- **Policy**: Minimum 8 characters, requires uppercase, lowercase, numbers, and special characters
- **Validation**: Prevents common passwords and user information in passwords
- **Change Tracking**: Invalidates existing tokens when password changes

### Role-Based Access Control (RBAC)

- **Roles**: `user`, `admin`, `moderator`, `support`
- **Middleware**: Automatic role validation for protected endpoints
- **Granular Permissions**: Different access levels for different operations

## Session Management

### Redis-Based Sessions

- **Storage**: Redis for high-performance session storage
- **Fallback**: JWT-only mode if Redis unavailable
- **Concurrent Sessions**: Maximum 5 active sessions per user
- **Device Tracking**: Unique device fingerprinting

### Session Features

- **Automatic Expiry**: 7-day session timeout
- **Activity Tracking**: Updates last activity timestamp
- **Device Fingerprinting**: IP + User-Agent based fingerprinting
- **Session Invalidation**: Logout from single device or all devices
- **Suspicious Activity**: Automatic session termination on suspicious behavior

### Session API Endpoints

```javascript
// Create session (login)
POST /api/auth/login

// Refresh access token
POST /api/auth/refresh

// Logout current session
POST /api/auth/logout

// Logout all sessions
POST /api/auth/logout-all

// Get active sessions
GET /api/auth/sessions
```

## Two-Factor Authentication (2FA)

### TOTP Implementation

- **Algorithm**: Time-based One-Time Password (RFC 6238)
- **Library**: Speakeasy for TOTP generation and verification
- **Window**: 2-step tolerance for clock drift
- **Secret Length**: 32 characters (256-bit entropy)

### Setup Process

1. **Generate Secret**: Server generates unique secret for user
2. **QR Code**: Generated for easy authenticator app setup
3. **Verification**: User must verify with valid TOTP code
4. **Backup Codes**: 10 single-use backup codes generated
5. **Activation**: 2FA enabled only after successful verification

### Backup Codes

- **Generation**: 10 random 8-character codes
- **Storage**: SHA-256 hashed in database
- **Usage**: Single-use, removed after consumption
- **Recovery**: Can be used instead of TOTP code

### 2FA API Endpoints

```javascript
// Setup 2FA (get QR code)
POST /api/auth/2fa/setup

// Verify and enable 2FA
POST /api/auth/2fa/verify

// Disable 2FA
POST /api/auth/2fa/disable
```

## Rate Limiting & DDoS Protection

### Multi-Layer Rate Limiting

1. **General API**: 100 requests per 15 minutes per IP
2. **Authentication**: 5 attempts per 15 minutes per IP
3. **Password Reset**: 3 attempts per hour per IP
4. **Games**: 60 requests per minute per IP
5. **Payments**: 10 requests per 5 minutes per IP
6. **Admin**: 200 requests per 15 minutes per IP

### Progressive Delay

- **Speed Limiter**: Adds delay after 50 requests in 15 minutes
- **Escalating Delay**: 500ms per request, max 20 seconds
- **Bypass Options**: Health checks and static files excluded

### Account Lockout

- **Failed Attempts**: Account locked after 5 failed login attempts
- **Lockout Duration**: 15 minutes (configurable)
- **Progressive Lockout**: Longer lockouts for repeated failures
- **Reset on Success**: Counter resets on successful login

## Suspicious Activity Detection

### Real-Time Monitoring

The platform continuously monitors for suspicious patterns:

#### Location-Based Detection
- **Rapid IP Changes**: Flags logins from different IPs within 30 minutes
- **Geolocation Tracking**: Detects impossible travel patterns
- **VPN/Proxy Detection**: Identifies known proxy services

#### Behavioral Analysis
- **Login Patterns**: Detects unusual login times or frequencies
- **Device Changes**: Flags rapid user-agent changes
- **Session Anomalies**: Identifies session hijacking attempts

#### Transaction Monitoring
- **Large Transactions**: Alerts for transactions above thresholds
- **Rapid Transactions**: Flags multiple transactions in short time
- **Pattern Recognition**: Detects money laundering patterns

### Automated Responses

- **Session Termination**: Automatic logout on high-risk activity
- **Account Suspension**: Temporary suspension for critical threats
- **Admin Alerts**: Real-time notifications for security team
- **Rate Limiting**: Dynamic rate limit adjustments

## Security Monitoring & Logging

### Event Logging

All security events are logged with the following information:

- **Event Type**: Login, logout, 2FA, suspicious activity, etc.
- **Severity**: Low, medium, high, critical
- **User Context**: User ID, IP address, user agent
- **Metadata**: Additional context-specific data
- **Timestamp**: Precise event timing

### Security Events

```javascript
// Event types tracked
const eventTypes = [
  'login_success',
  'login_failure', 
  'password_change',
  '2fa_enabled',
  '2fa_disabled',
  'account_locked',
  'suspicious_activity',
  'session_hijack_attempt',
  'multiple_device_login',
  'admin_action',
  'kyc_update',
  'large_transaction',
  'withdrawal_request',
  'api_abuse'
];
```

### Dashboard & Analytics

- **Real-Time Dashboard**: Live security event monitoring
- **Trend Analysis**: Historical security metrics
- **Anomaly Detection**: Machine learning-based threat detection
- **Compliance Reporting**: Automated regulatory reports

### Alert System

- **Severity-Based**: Alerts triggered by event severity
- **Multi-Channel**: Console, file, email, Slack integration
- **Escalation**: Automatic escalation for unresolved critical events
- **Suppression**: Prevents alert spam for known issues

## Data Protection

### Encryption

#### At Rest
- **Database**: MongoDB encryption at rest
- **Sensitive Fields**: Additional AES-256-GCM encryption
- **Key Management**: Separate encryption keys for different data types

#### In Transit
- **HTTPS**: TLS 1.3 for all communications
- **Certificate Pinning**: Prevents man-in-the-middle attacks
- **HSTS**: HTTP Strict Transport Security headers

### Data Minimization

- **Collection**: Only collect necessary data
- **Retention**: Automatic deletion of old data
- **Anonymization**: Remove PII from analytics data
- **Pseudonymization**: Replace identifiers with pseudonyms

### Privacy Controls

- **Data Export**: Users can export their data
- **Data Deletion**: Right to be forgotten implementation
- **Consent Management**: Granular privacy preferences
- **Audit Trail**: Complete data access logging

## Compliance Features

### KYC (Know Your Customer)

#### Verification Levels
- **Level 0**: Email verification only
- **Level 1**: Basic identity verification
- **Level 2**: Enhanced due diligence
- **Level 3**: Source of funds verification

#### Document Verification
- **ID Documents**: Passport, driver's license, national ID
- **Address Proof**: Utility bills, bank statements
- **Source of Funds**: Income verification, bank statements
- **Biometric Verification**: Liveness detection for selfies

### AML (Anti-Money Laundering)

#### Transaction Monitoring
- **Pattern Recognition**: Unusual transaction patterns
- **Velocity Checks**: Rapid deposit/withdrawal detection
- **Amount Thresholds**: Large transaction reporting
- **Sanctions Screening**: Check against OFAC and other lists

#### Risk Scoring
- **User Risk**: Based on behavior, location, transaction history
- **Transaction Risk**: Real-time risk assessment
- **Dynamic Limits**: Adjust limits based on risk score
- **Manual Review**: Flag high-risk transactions for review

### Responsible Gambling

#### Deposit Limits
- **Daily Limits**: Maximum daily deposit amounts
- **Weekly/Monthly**: Longer-term spending controls
- **Currency-Specific**: Different limits per currency
- **Cooling-Off**: 24-hour delay for limit increases

#### Self-Exclusion
- **Temporary**: 24 hours to 30 days
- **Extended**: Up to 1 year
- **Permanent**: Indefinite exclusion
- **Cross-Platform**: Exclusion across all services

#### Session Controls
- **Time Limits**: Maximum session duration
- **Loss Limits**: Maximum loss per session/day
- **Reality Checks**: Periodic time/spending reminders
- **Forced Breaks**: Mandatory breaks after long sessions

## API Security

### Input Validation

- **Schema Validation**: Strict input validation using express-validator
- **Sanitization**: Remove/escape dangerous characters
- **Type Checking**: Ensure correct data types
- **Length Limits**: Prevent buffer overflow attacks

### Output Security

- **Data Sanitization**: Remove sensitive data from responses
- **Error Handling**: Generic error messages to prevent information leakage
- **Response Headers**: Security headers on all responses
- **Content-Type**: Proper MIME type validation

### Webhook Security

- **Signature Verification**: HMAC-SHA256 signature validation
- **Timestamp Validation**: Prevent replay attacks
- **IP Whitelisting**: Only accept webhooks from known sources
- **Idempotency**: Handle duplicate webhook deliveries

## Deployment Security

### Environment Configuration

```bash
# Required environment variables
JWT_SECRET=your-256-bit-secret
MONGO_URI=mongodb://localhost:27017/genesisbet
REDIS_URL=redis://localhost:6379
NODE_ENV=production

# Optional security settings
RATE_LIMIT_ENABLED=true
SESSION_TIMEOUT=604800
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=900000
```

### Production Checklist

#### Server Security
- [ ] HTTPS/TLS 1.3 enabled
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Firewall rules configured
- [ ] Regular security updates
- [ ] Intrusion detection system

#### Database Security
- [ ] Authentication enabled
- [ ] Encryption at rest
- [ ] Network isolation
- [ ] Regular backups
- [ ] Access logging
- [ ] Connection encryption

#### Application Security
- [ ] Environment variables secured
- [ ] Secrets management
- [ ] Dependency scanning
- [ ] Code signing
- [ ] Container security
- [ ] Log aggregation

### Monitoring & Alerting

#### Security Metrics
- Failed login attempts per hour
- Suspicious activity events
- Large transaction alerts
- Account lockout frequency
- 2FA adoption rate
- Session anomalies

#### Performance Metrics
- API response times
- Rate limit hit rates
- Database query performance
- Memory/CPU usage
- Error rates
- Uptime monitoring

### Incident Response

#### Preparation
- **Playbooks**: Documented response procedures
- **Team**: Designated security response team
- **Tools**: Incident management platform
- **Communication**: Stakeholder notification procedures

#### Detection & Analysis
- **Monitoring**: 24/7 security monitoring
- **Triage**: Severity assessment and prioritization
- **Investigation**: Forensic analysis capabilities
- **Documentation**: Detailed incident logging

#### Containment & Recovery
- **Isolation**: Ability to isolate affected systems
- **Mitigation**: Automated threat response
- **Recovery**: Backup and restore procedures
- **Validation**: Security testing after recovery

#### Post-Incident
- **Review**: Post-mortem analysis
- **Improvements**: Security enhancement recommendations
- **Reporting**: Regulatory compliance reporting
- **Training**: Team education and awareness

## Security Best Practices

### For Developers

1. **Secure Coding**: Follow OWASP guidelines
2. **Input Validation**: Validate all user inputs
3. **Error Handling**: Don't expose sensitive information
4. **Dependency Management**: Keep dependencies updated
5. **Code Review**: Security-focused code reviews
6. **Testing**: Include security testing in CI/CD

### For Operations

1. **Access Control**: Principle of least privilege
2. **Monitoring**: Comprehensive logging and alerting
3. **Updates**: Regular security patches
4. **Backups**: Secure, tested backup procedures
5. **Network Security**: Proper firewall configuration
6. **Incident Response**: Prepared response procedures

### For Users

1. **Strong Passwords**: Use unique, complex passwords
2. **2FA**: Enable two-factor authentication
3. **Device Security**: Keep devices updated and secure
4. **Phishing Awareness**: Verify website authenticity
5. **Session Management**: Log out when finished
6. **Suspicious Activity**: Report unusual account activity

## Compliance Standards

### Regulatory Compliance

- **GDPR**: European data protection regulation
- **CCPA**: California Consumer Privacy Act
- **PCI DSS**: Payment card industry standards
- **SOX**: Sarbanes-Oxley financial reporting
- **ISO 27001**: Information security management

### Gambling Regulations

- **MGA**: Malta Gaming Authority
- **UKGC**: UK Gambling Commission
- **Curacao**: Curacao Gaming License
- **KYC/AML**: Know Your Customer and Anti-Money Laundering
- **Responsible Gambling**: Player protection measures

## Security Contacts

### Reporting Security Issues

- **Email**: security@genesisbet.com
- **Bug Bounty**: HackerOne program
- **Emergency**: 24/7 security hotline
- **PGP Key**: Available for encrypted communications

### Security Team

- **CISO**: Chief Information Security Officer
- **Security Engineers**: Application security specialists
- **Compliance Officer**: Regulatory compliance expert
- **Incident Response**: 24/7 response team

