#!/bin/bash

# Enhanced deployment script for Ubuntu 24.04 VPS
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Get server IP
get_server_ip() {
    # Try different methods to get external IP
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipecho.net/plain 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "localhost")
    echo $SERVER_IP
}

# Function to check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root for security reasons."
        error "Please run as a regular user with sudo privileges."
        exit 1
    fi
}

# Function to check Ubuntu version
check_ubuntu_version() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        if [[ "$ID" != "ubuntu" ]]; then
            warn "This script is designed for Ubuntu. Current OS: $ID"
        fi
        if [[ "$VERSION_ID" != "24.04" ]]; then
            warn "This script is optimized for Ubuntu 24.04. Current version: $VERSION_ID"
        fi
    fi
}

# Function to install Docker
install_docker() {
    if ! command -v docker &> /dev/null; then
        log "Installing Docker..."
        
        # Update package index
        sudo apt-get update
        
        # Install prerequisites
        sudo apt-get install -y \
            ca-certificates \
            curl \
            gnupg \
            lsb-release
        
        # Add Docker's official GPG key
        sudo mkdir -p /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        
        # Set up repository
        echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
          $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        
        # Install Docker Engine
        sudo apt-get update
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        
        # Add user to docker group
        sudo usermod -aG docker $USER
        
        log "Docker installed successfully!"
        warn "Please log out and log back in to use Docker without sudo, or run 'newgrp docker'"
    else
        log "Docker is already installed."
    fi
}

# Function to install Docker Compose
install_docker_compose() {
    if ! command -v docker-compose &> /dev/null; then
        log "Installing Docker Compose..."
        
        # Get latest version
        COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d'"' -f4)
        
        # Download and install
        sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        
        # Create symlink for easier access
        sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
        
        log "Docker Compose installed successfully!"
    else
        log "Docker Compose is already installed."
    fi
}

# Function to create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p ./data
    mkdir -p ./logs/nginx
    mkdir -p ./ssl
    mkdir -p ./backups
    
    # Set appropriate permissions
    chmod 755 ./data ./logs ./ssl ./backups
    
    log "Directories created successfully!"
}

# Function to create environment file
create_env_file() {
    if [[ ! -f .env ]]; then
        log "Creating .env file..."
        
        SERVER_IP=$(get_server_ip)
        
        cat > .env << EOF
# Server Configuration
SERVER_IP=${SERVER_IP}
DOMAIN=${DOMAIN:-${SERVER_IP}}

# API Configuration
REACT_APP_API_URL=http://${SERVER_IP}:8000

# Database Configuration
DATABASE_URL=sqlite:///./data/clinic.db

# Production Settings
NODE_ENV=production
PYTHONUNBUFFERED=1

# Security (change these in production!)
SECRET_KEY=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)

# Backup Configuration
BACKUP_RETENTION_DAYS=30

# Logging
LOG_LEVEL=INFO
EOF
        
        log ".env file created successfully!"
        info "Please review and modify .env file as needed"
    else
        log ".env file already exists, skipping creation"
    fi
}

# Function to set up firewall
setup_firewall() {
    read -p "Do you want to configure UFW firewall? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "Configuring firewall..."
        
        # Install UFW if not present
        sudo apt-get install -y ufw
        
        # Reset to defaults
        sudo ufw --force reset
        
        # Default policies
        sudo ufw default deny incoming
        sudo ufw default allow outgoing
        
        # Allow SSH (be careful not to lock yourself out!)
        sudo ufw allow ssh
        sudo ufw allow 22/tcp
        
        # Allow HTTP and HTTPS
        sudo ufw allow 80/tcp
        sudo ufw allow 443/tcp
        
        # Allow specific application ports if needed
        # sudo ufw allow 8000/tcp  # Backend API (if exposing directly)
        
        # Enable firewall
        sudo ufw --force enable
        
        # Show status
        sudo ufw status verbose
        
        log "Firewall configured successfully!"
        warn "Make sure SSH access is working before disconnecting!"
    fi
}

# Function to build and deploy
deploy_application() {
    log "Deploying Clinic Registry Platform..."
    
    # Stop existing containers
    docker-compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
    
    # Remove old images to free space
    docker system prune -f
    
    # Build and start services
    log "Building application..."
    docker-compose -f docker-compose.prod.yml build --no-cache
    
    log "Starting services..."
    docker-compose -f docker-compose.prod.yml up -d
    
    # Wait for services to be ready
    log "Waiting for services to start..."
    sleep 60
    
    # Check service health
    log "Checking service health..."
    
    if curl -f http://localhost:8000/health > /dev/null 2>&1; then
        log "✅ Backend is healthy"
    else
        error "❌ Backend health check failed"
        docker-compose -f docker-compose.prod.yml logs backend
    fi
    
    if curl -f http://localhost:80/health > /dev/null 2>&1; then
        log "✅ Frontend/Nginx is healthy"
    else
        error "❌ Frontend/Nginx health check failed"
        docker-compose -f docker-compose.prod.yml logs nginx
    fi
}

# Function to set up systemd service
setup_systemd_service() {
    log "Setting up systemd service..."
    
    sudo tee /etc/systemd/system/clinic-registry.service > /dev/null <<EOF
[Unit]
Description=Clinic Registry Platform
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
User=$USER
Group=docker
WorkingDirectory=$(pwd)
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and enable service
    sudo systemctl daemon-reload
    sudo systemctl enable clinic-registry.service
    
    log "Systemd service configured successfully!"
}

# Function to create backup script
create_backup_script() {
    log "Creating backup script..."
    
    cat > backup.sh << 'EOF'
#!/bin/bash

# Backup script for Clinic Registry Platform
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="clinic_registry_backup_${DATE}.tar.gz"

echo "Creating backup: $BACKUP_FILE"

# Create backup
tar -czf "${BACKUP_DIR}/${BACKUP_FILE}" \
    --exclude='./backups' \
    --exclude='./logs' \
    --exclude='./.git' \
    ./data ./ssl .env docker-compose.prod.yml

echo "Backup created: ${BACKUP_DIR}/${BACKUP_FILE}"

# Clean old backups (keep last 30 days)
find "${BACKUP_DIR}" -name "clinic_registry_backup_*.tar.gz" -mtime +30 -delete

echo "Old backups cleaned up"
EOF
    
    chmod +x backup.sh
    
    # Set up daily backup cron job
    (crontab -l 2>/dev/null; echo "0 2 * * * $(pwd)/backup.sh") | crontab -
    
    log "Backup script and cron job created successfully!"
}

# Function to show final status
show_status() {
    SERVER_IP=$(get_server_ip)
    
    echo ""
    log "🎉 Deployment completed successfully!"
    echo ""
    echo "📊 Service Status:"
    docker-compose -f docker-compose.prod.yml ps
    echo ""
    echo "🌐 Access URLs:"
    echo "   Frontend:     http://${SERVER_IP}"
    echo "   Backend API:  http://${SERVER_IP}:8000"
    echo "   API Docs:     http://${SERVER_IP}:8000/docs"
    echo "   Health Check: http://${SERVER_IP}/health"
    echo ""
    echo "🔧 Management Commands:"
    echo "   Start:    docker-compose -f docker-compose.prod.yml up -d"
    echo "   Stop:     docker-compose -f docker-compose.prod.yml down"
    echo "   Restart:  docker-compose -f docker-compose.prod.yml restart"
    echo "   Logs:     docker-compose -f docker-compose.prod.yml logs -f"
    echo "   Update:   ./deploy-vps.sh"
    echo "   Backup:   ./backup.sh"
    echo ""
    echo "📁 Important Directories:"
    echo "   Database: ./data/clinic.db"
    echo "   Logs:     ./logs/"
    echo "   SSL:      ./ssl/"
    echo "   Backups:  ./backups/"
    echo ""
    echo "🔒 Security Recommendations:"
    echo "   - Set up SSL certificates for HTTPS"
    echo "   - Configure proper domain name"
    echo "   - Review and update .env file"
    echo "   - Monitor logs regularly"
    echo "   - Keep system updated"
    echo ""
    echo "🚀 Default Admin Login:"
    echo "   Username: Sideffect"
    echo "   Password: Sid@ffect101"
    echo ""
}

# Main execution
main() {
    log "🚀 Starting deployment of Clinic Registry Platform on Ubuntu 24.04..."
    
    # Perform checks
    check_root
    check_ubuntu_version
    
    # Install dependencies
    install_docker
    install_docker_compose
    
    # Setup environment
    create_directories
    create_env_file
    
    # Configure security
    setup_firewall
    
    # Deploy application
    deploy_application
    
    # Setup services
    setup_systemd_service
    create_backup_script
    
    # Show final status
    show_status
    
    log "✅ Deployment process completed!"
}

# Run main function
main "$@"
