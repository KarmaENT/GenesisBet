# GenesisBet Deployment Guide

Complete guide for deploying GenesisBet gambling platform to production environments.

## Overview

This guide covers deployment options from development to enterprise-scale production environments, including cloud platforms, security configurations, and monitoring setup.

## Prerequisites

### System Requirements

**Minimum Requirements:**
- CPU: 4 cores
- RAM: 8GB
- Storage: 100GB SSD
- Network: 100 Mbps

**Recommended Production:**
- CPU: 8+ cores
- RAM: 16GB+
- Storage: 500GB+ SSD
- Network: 1 Gbps
- Load Balancer
- CDN

### Software Requirements

- Docker 24.0+
- Docker Compose 2.0+
- Git
- SSL Certificate
- Domain Name

## Quick Deployment

### 1. Clone Repository

```bash
git clone <repository-url>
cd genesisbet
```

### 2. Configure Environment

```bash
cp .env.production.example .env.production
nano .env.production
```

### 3. Deploy

```bash
./deploy.sh deploy production
```

## Environment Configuration

### Production Environment Variables

Create `.env.production` with the following configuration:

```env
# Database Configuration
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=your_secure_mongo_password
REDIS_PASSWORD=your_secure_redis_password

# Application Security
JWT_SECRET=your_super_secure_jwt_secret_minimum_32_characters
SESSION_SECRET=your_secure_session_secret
ENCRYPTION_KEY=your_32_character_encryption_key

# Domain Configuration
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
NEXT_PUBLIC_SITE_NAME=GenesisBet
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# Payment Processors
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
PAYPAL_CLIENT_ID=your_paypal_live_client_id
PAYPAL_CLIENT_SECRET=your_paypal_live_client_secret
SKRILL_MERCHANT_ID=your_skrill_merchant_id
SKRILL_SECRET_WORD=your_skrill_secret_word

# Cryptocurrency APIs
COINGATE_API_KEY=your_coingate_live_api_key
COINBASE_API_KEY=your_coinbase_live_api_key
COINBASE_API_SECRET=your_coinbase_live_api_secret

# Email Configuration
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your_smtp_password

# Security Settings
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
BCRYPT_ROUNDS=12

# Monitoring
SENTRY_DSN=your_sentry_dsn
LOG_LEVEL=info
```

### Security Checklist

**Required Security Configurations:**

- [ ] Change all default passwords
- [ ] Generate secure JWT secret (32+ characters)
- [ ] Configure SSL certificates
- [ ] Set up firewall rules
- [ ] Enable fail2ban
- [ ] Configure backup encryption
- [ ] Set up monitoring alerts
- [ ] Review CORS settings
- [ ] Configure rate limiting
- [ ] Enable audit logging

## Deployment Methods

### Method 1: Docker Compose (Recommended)

**Advantages:**
- Simple setup
- Consistent environments
- Easy scaling
- Built-in networking

**Steps:**

1. **Prepare Environment:**
```bash
# Create production directory
mkdir -p /opt/genesisbet
cd /opt/genesisbet

# Clone repository
git clone <repository-url> .

# Configure environment
cp .env.production.example .env.production
nano .env.production
```

2. **Deploy Application:**
```bash
# Deploy to production
./deploy.sh deploy production

# Check status
./deploy.sh health production

# View logs
./deploy.sh logs production
```

3. **Configure Nginx (Optional):**
```bash
# Create nginx configuration
mkdir -p nginx
cat > nginx/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server frontend:3000;
    }
    
    upstream backend {
        server backend:5000;
    }
    
    server {
        listen 80;
        server_name yourdomain.com;
        return 301 https://$server_name$request_uri;
    }
    
    server {
        listen 443 ssl http2;
        server_name yourdomain.com;
        
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        
        location /api/ {
            proxy_pass http://backend/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
EOF
```

### Method 2: Kubernetes

**Advantages:**
- Auto-scaling
- High availability
- Rolling updates
- Service discovery

**Prerequisites:**
- Kubernetes cluster
- kubectl configured
- Helm (optional)

**Deployment:**

1. **Create Namespace:**
```bash
kubectl create namespace genesisbet
```

2. **Create Secrets:**
```bash
kubectl create secret generic genesisbet-secrets \
  --from-env-file=.env.production \
  -n genesisbet
```

3. **Deploy with Helm:**
```bash
# Add custom Helm chart
helm install genesisbet ./helm/genesisbet \
  --namespace genesisbet \
  --values values.production.yaml
```

### Method 3: Cloud Platforms

#### AWS ECS

1. **Create Task Definition:**
```json
{
  "family": "genesisbet",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "2048",
  "memory": "4096",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "your-registry/genesisbet-backend:latest",
      "portMappings": [
        {
          "containerPort": 5000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ]
    }
  ]
}
```

2. **Create Service:**
```bash
aws ecs create-service \
  --cluster genesisbet-cluster \
  --service-name genesisbet-backend \
  --task-definition genesisbet:1 \
  --desired-count 2 \
  --launch-type FARGATE
```

#### Google Cloud Run

```bash
# Build and push images
docker build -t gcr.io/your-project/genesisbet-backend ./backend
docker push gcr.io/your-project/genesisbet-backend

# Deploy to Cloud Run
gcloud run deploy genesisbet-backend \
  --image gcr.io/your-project/genesisbet-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

#### Azure Container Instances

```bash
# Create resource group
az group create --name genesisbet-rg --location eastus

# Deploy container
az container create \
  --resource-group genesisbet-rg \
  --name genesisbet-backend \
  --image your-registry/genesisbet-backend:latest \
  --cpu 2 \
  --memory 4 \
  --ports 5000
```

## Database Setup

### MongoDB Configuration

**Production MongoDB Setup:**

1. **Install MongoDB:**
```bash
# Ubuntu/Debian
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
```

2. **Configure Security:**
```javascript
// Connect to MongoDB
mongosh

// Create admin user
use admin
db.createUser({
  user: "admin",
  pwd: "your_secure_password",
  roles: ["userAdminAnyDatabase", "dbAdminAnyDatabase", "readWriteAnyDatabase"]
})

// Create application user
use genesisbet
db.createUser({
  user: "genesisbet_user",
  pwd: "your_app_password",
  roles: ["readWrite"]
})
```

3. **Enable Authentication:**
```bash
# Edit MongoDB configuration
sudo nano /etc/mongod.conf

# Add security section
security:
  authorization: enabled
```

### Redis Configuration

**Production Redis Setup:**

1. **Install Redis:**
```bash
sudo apt-get install redis-server
```

2. **Configure Security:**
```bash
# Edit Redis configuration
sudo nano /etc/redis/redis.conf

# Set password
requirepass your_secure_redis_password

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command DEBUG ""
```

### Database Initialization

```bash
# Initialize database with seed data
docker-compose -f docker-compose.prod.yml exec backend npm run db:init

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend npm run db:migrate:up
```

## SSL/TLS Configuration

### Let's Encrypt (Free SSL)

1. **Install Certbot:**
```bash
sudo apt-get install certbot python3-certbot-nginx
```

2. **Generate Certificate:**
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

3. **Auto-renewal:**
```bash
sudo crontab -e
# Add line:
0 12 * * * /usr/bin/certbot renew --quiet
```

### Custom SSL Certificate

1. **Upload Certificate Files:**
```bash
mkdir -p nginx/ssl
cp your-cert.pem nginx/ssl/cert.pem
cp your-key.pem nginx/ssl/key.pem
chmod 600 nginx/ssl/key.pem
```

2. **Configure Nginx:**
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # SSL Security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
}
```

## Monitoring & Logging

### Application Monitoring

**Sentry Integration:**

1. **Configure Sentry:**
```bash
# Add to .env.production
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

2. **Backend Integration:**
```javascript
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});
```

### System Monitoring

**Prometheus + Grafana:**

1. **Add Monitoring Stack:**
```yaml
# docker-compose.monitoring.yml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      
  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
```

2. **Configure Metrics:**
```javascript
// Add to backend
const promClient = require('prom-client');
const register = new promClient.Registry();

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});

register.registerMetric(httpRequestDuration);
```

### Log Management

**ELK Stack (Elasticsearch, Logstash, Kibana):**

```yaml
# docker-compose.logging.yml
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
      
  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    volumes:
      - ./logging/logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    ports:
      - "5044:5044"
      
  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
```

## Backup & Recovery

### Automated Backups

1. **Database Backup Script:**
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)
MONGO_BACKUP="$BACKUP_DIR/mongodb_$DATE.tar.gz"
REDIS_BACKUP="$BACKUP_DIR/redis_$DATE.rdb"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup MongoDB
docker-compose exec -T mongodb mongodump --archive --gzip > $MONGO_BACKUP

# Backup Redis
docker-compose exec -T redis redis-cli --rdb $REDIS_BACKUP

# Upload to cloud storage (optional)
aws s3 cp $MONGO_BACKUP s3://your-backup-bucket/mongodb/
aws s3 cp $REDIS_BACKUP s3://your-backup-bucket/redis/

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
find $BACKUP_DIR -name "*.rdb" -mtime +30 -delete
```

2. **Schedule Backups:**
```bash
# Add to crontab
0 2 * * * /opt/genesisbet/backup.sh
```

### Recovery Procedures

**Database Recovery:**

1. **MongoDB Recovery:**
```bash
# Stop application
./deploy.sh stop production

# Restore from backup
docker-compose exec -T mongodb mongorestore --archive --gzip < backup_file.tar.gz

# Start application
./deploy.sh deploy production
```

2. **Redis Recovery:**
```bash
# Stop Redis
docker-compose stop redis

# Copy backup file
docker cp backup_file.rdb redis_container:/data/dump.rdb

# Start Redis
docker-compose start redis
```

## Performance Optimization

### Database Optimization

**MongoDB Indexing:**
```javascript
// Create performance indexes
db.users.createIndex({ "email": 1 }, { unique: true })
db.users.createIndex({ "username": 1 }, { unique: true })
db.transactions.createIndex({ "userId": 1, "createdAt": -1 })
db.gameSessions.createIndex({ "userId": 1, "createdAt": -1 })
db.gameSessions.createIndex({ "gameType": 1, "status": 1 })
```

**Redis Optimization:**
```bash
# Configure Redis for performance
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### Application Optimization

**Node.js Performance:**
```javascript
// Enable compression
app.use(compression());

// Connection pooling
mongoose.connect(mongoUri, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});

// Redis connection pooling
const redis = new Redis({
  host: 'redis',
  port: 6379,
  maxRetriesPerRequest: 3,
  lazyConnect: true
});
```

### CDN Configuration

**CloudFlare Setup:**

1. **Add Domain to CloudFlare**
2. **Configure DNS Records:**
```
Type: A
Name: @
Content: your-server-ip
Proxy: Enabled

Type: CNAME
Name: www
Content: yourdomain.com
Proxy: Enabled
```

3. **Configure Page Rules:**
```
URL: yourdomain.com/api/*
Settings: Cache Level = Bypass

URL: yourdomain.com/*
Settings: Cache Level = Standard
```

## Security Hardening

### Server Security

1. **Firewall Configuration:**
```bash
# UFW firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

2. **Fail2Ban Setup:**
```bash
# Install fail2ban
sudo apt-get install fail2ban

# Configure jail
sudo nano /etc/fail2ban/jail.local
```

3. **System Updates:**
```bash
# Auto-updates
sudo apt-get install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

### Application Security

**Security Headers:**
```javascript
// Helmet.js configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

**Rate Limiting:**
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

## Scaling Strategies

### Horizontal Scaling

**Load Balancer Configuration:**
```nginx
upstream backend {
    least_conn;
    server backend1:5000 weight=3;
    server backend2:5000 weight=3;
    server backend3:5000 weight=2;
}

upstream frontend {
    least_conn;
    server frontend1:3000;
    server frontend2:3000;
    server frontend3:3000;
}
```

**Database Scaling:**

1. **MongoDB Replica Set:**
```javascript
// Replica set configuration
rs.initiate({
  _id: "genesisbet-rs",
  members: [
    { _id: 0, host: "mongo1:27017" },
    { _id: 1, host: "mongo2:27017" },
    { _id: 2, host: "mongo3:27017" }
  ]
});
```

2. **Redis Cluster:**
```bash
# Redis cluster setup
redis-cli --cluster create \
  redis1:6379 redis2:6379 redis3:6379 \
  redis4:6379 redis5:6379 redis6:6379 \
  --cluster-replicas 1
```

### Auto-Scaling

**Kubernetes HPA:**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: genesisbet-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: genesisbet-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Troubleshooting

### Common Issues

**1. Database Connection Issues:**
```bash
# Check MongoDB status
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Check logs
docker-compose logs mongodb
```

**2. Redis Connection Issues:**
```bash
# Check Redis status
docker-compose exec redis redis-cli ping

# Check memory usage
docker-compose exec redis redis-cli info memory
```

**3. Application Errors:**
```bash
# Check application logs
docker-compose logs backend
docker-compose logs frontend

# Check system resources
docker stats
```

### Performance Issues

**1. Slow Database Queries:**
```javascript
// Enable MongoDB profiling
db.setProfilingLevel(2, { slowms: 100 });

// Check slow queries
db.system.profile.find().sort({ ts: -1 }).limit(5);
```

**2. High Memory Usage:**
```bash
# Check memory usage
free -h
docker stats

# Optimize Redis memory
redis-cli config set maxmemory-policy allkeys-lru
```

### Health Checks

**Application Health:**
```bash
# Check all services
./deploy.sh health production

# Individual service checks
curl -f http://localhost:5000/health
curl -f http://localhost:3000/api/health
```

**Database Health:**
```bash
# MongoDB health
docker-compose exec mongodb mongosh --eval "db.runCommand({ping: 1})"

# Redis health
docker-compose exec redis redis-cli ping
```

## Maintenance

### Regular Maintenance Tasks

**Daily:**
- Check application logs
- Monitor system resources
- Verify backup completion

**Weekly:**
- Review security logs
- Update dependencies
- Performance analysis

**Monthly:**
- Security audit
- Database optimization
- Capacity planning

### Update Procedures

**Application Updates:**
```bash
# Backup before update
./deploy.sh backup production

# Pull latest code
git pull origin main

# Deploy update
./deploy.sh deploy production

# Verify deployment
./deploy.sh health production
```

**Security Updates:**
```bash
# System updates
sudo apt-get update && sudo apt-get upgrade

# Docker image updates
docker-compose pull
docker-compose up -d
```

## Support & Documentation

### Additional Resources

- [API Documentation](API.md)
- [Security Guide](SECURITY.md)
- [User Manual](USER_MANUAL.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)

### Getting Help

- GitHub Issues: Report bugs and feature requests
- Documentation: Comprehensive guides and tutorials
- Community: Discord server for discussions
- Support: Email support for enterprise customers

---

This deployment guide provides comprehensive instructions for deploying GenesisBet in production environments. For specific questions or issues, please refer to the troubleshooting section or contact our support team.

