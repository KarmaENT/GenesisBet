#!/bin/bash

# GenesisBet Deployment Script
# This script handles deployment of the GenesisBet gambling platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="genesisbet"
BACKUP_DIR="./backups"
LOG_FILE="./deployment.log"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi
    
    success "Docker and Docker Compose are installed"
}

# Check if environment file exists
check_env() {
    if [ ! -f ".env.production" ]; then
        warning "Production environment file not found. Creating template..."
        create_env_template
    else
        success "Production environment file found"
    fi
}

# Create environment template
create_env_template() {
    cat > .env.production << 'EOF'
# Database Configuration
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=change_this_password_in_production
REDIS_PASSWORD=change_this_redis_password

# JWT Configuration
JWT_SECRET=change_this_jwt_secret_in_production_minimum_32_characters
JWT_EXPIRY=7d
REFRESH_TOKEN_EXPIRY=30d
SESSION_SECRET=change_this_session_secret_in_production

# Frontend Configuration
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
NEXT_PUBLIC_WS_URL=wss://yourdomain.com
NEXT_PUBLIC_SITE_NAME=GenesisBet
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# Payment Processor Configuration
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
SKRILL_MERCHANT_ID=your_skrill_merchant_id
SKRILL_SECRET_WORD=your_skrill_secret_word

# Cryptocurrency Configuration
COINGATE_API_KEY=your_coingate_api_key
COINBASE_API_KEY=your_coinbase_api_key
COINBASE_API_SECRET=your_coinbase_api_secret

# Security Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EOF

    warning "Please edit .env.production with your actual configuration values before deploying!"
    warning "Make sure to change all default passwords and secrets!"
}

# Backup database
backup_database() {
    if [ "$1" = "production" ]; then
        log "Creating database backup..."
        mkdir -p "$BACKUP_DIR"
        
        # Create backup with timestamp
        BACKUP_FILE="$BACKUP_DIR/mongodb_backup_$(date +%Y%m%d_%H%M%S).tar.gz"
        
        docker-compose -f docker-compose.prod.yml exec -T mongodb mongodump --archive --gzip > "$BACKUP_FILE" 2>/dev/null || {
            warning "Database backup failed or database is empty"
        }
        
        if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
            success "Database backup created: $BACKUP_FILE"
        else
            warning "Database backup is empty or failed"
        fi
    fi
}

# Deploy application
deploy() {
    local environment=$1
    
    log "Starting deployment for $environment environment..."
    
    if [ "$environment" = "production" ]; then
        # Production deployment
        log "Deploying to production..."
        
        # Check if .env.production exists
        if [ ! -f ".env.production" ]; then
            error "Production environment file (.env.production) not found!"
        fi
        
        # Backup existing database
        backup_database production
        
        # Pull latest images and build
        log "Building production images..."
        docker-compose -f docker-compose.prod.yml build --no-cache
        
        # Stop existing containers
        log "Stopping existing containers..."
        docker-compose -f docker-compose.prod.yml down
        
        # Start new containers
        log "Starting production containers..."
        docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
        
    else
        # Development deployment
        log "Deploying to development..."
        
        # Build and start development containers
        log "Building development images..."
        docker-compose build
        
        log "Starting development containers..."
        docker-compose up -d
    fi
    
    # Wait for services to be ready
    log "Waiting for services to be ready..."
    sleep 30
    
    # Check service health
    check_health "$environment"
}

# Check service health
check_health() {
    local environment=$1
    local compose_file="docker-compose.yml"
    
    if [ "$environment" = "production" ]; then
        compose_file="docker-compose.prod.yml"
    fi
    
    log "Checking service health..."
    
    # Check backend health
    if docker-compose -f "$compose_file" exec -T backend curl -f http://localhost:5000/health > /dev/null 2>&1; then
        success "Backend service is healthy"
    else
        error "Backend service is not responding"
    fi
    
    # Check frontend health (if health endpoint exists)
    if docker-compose -f "$compose_file" exec -T frontend curl -f http://localhost:3000 > /dev/null 2>&1; then
        success "Frontend service is healthy"
    else
        warning "Frontend service health check failed (this might be normal)"
    fi
    
    # Check database connection
    if docker-compose -f "$compose_file" exec -T mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        success "Database is accessible"
    else
        error "Database is not accessible"
    fi
    
    # Check Redis connection
    if docker-compose -f "$compose_file" exec -T redis redis-cli ping > /dev/null 2>&1; then
        success "Redis is accessible"
    else
        error "Redis is not accessible"
    fi
}

# Initialize database
init_database() {
    local environment=$1
    local compose_file="docker-compose.yml"
    
    if [ "$environment" = "production" ]; then
        compose_file="docker-compose.prod.yml"
    fi
    
    log "Initializing database..."
    
    # Run database initialization script
    docker-compose -f "$compose_file" exec -T backend npm run db:init || {
        warning "Database initialization failed or already completed"
    }
    
    success "Database initialization completed"
}

# Show logs
show_logs() {
    local environment=$1
    local service=$2
    local compose_file="docker-compose.yml"
    
    if [ "$environment" = "production" ]; then
        compose_file="docker-compose.prod.yml"
    fi
    
    if [ -n "$service" ]; then
        docker-compose -f "$compose_file" logs -f "$service"
    else
        docker-compose -f "$compose_file" logs -f
    fi
}

# Stop services
stop() {
    local environment=$1
    local compose_file="docker-compose.yml"
    
    if [ "$environment" = "production" ]; then
        compose_file="docker-compose.prod.yml"
    fi
    
    log "Stopping services..."
    docker-compose -f "$compose_file" down
    success "Services stopped"
}

# Clean up
cleanup() {
    log "Cleaning up unused Docker resources..."
    docker system prune -f
    docker volume prune -f
    success "Cleanup completed"
}

# Main script
main() {
    case "$1" in
        "deploy")
            check_docker
            check_env
            deploy "${2:-development}"
            init_database "${2:-development}"
            success "Deployment completed successfully!"
            ;;
        "stop")
            stop "${2:-development}"
            ;;
        "logs")
            show_logs "${2:-development}" "$3"
            ;;
        "backup")
            backup_database "${2:-production}"
            ;;
        "cleanup")
            cleanup
            ;;
        "health")
            check_health "${2:-development}"
            ;;
        *)
            echo "Usage: $0 {deploy|stop|logs|backup|cleanup|health} [environment] [service]"
            echo ""
            echo "Commands:"
            echo "  deploy [development|production]  - Deploy the application"
            echo "  stop [development|production]    - Stop the application"
            echo "  logs [development|production] [service] - Show logs"
            echo "  backup [production]              - Backup database"
            echo "  cleanup                          - Clean up Docker resources"
            echo "  health [development|production]  - Check service health"
            echo ""
            echo "Examples:"
            echo "  $0 deploy development            - Deploy to development"
            echo "  $0 deploy production             - Deploy to production"
            echo "  $0 logs production backend       - Show backend logs in production"
            echo "  $0 stop development              - Stop development environment"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"

