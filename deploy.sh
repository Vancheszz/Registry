#!/bin/bash

# Deployment script for Ubuntu VPS
set -e

echo "🚀 Starting deployment of Clinic Registry Platform..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "✅ Docker installed. Please log out and log back in to use Docker without sudo."
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Installing..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose installed."
fi

# Create necessary directories
echo "📁 Creating directories..."
sudo mkdir -p /var/log/clinic-registry
sudo mkdir -p ./ssl
mkdir -p ./data

# Set up environment variables
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Database
DATABASE_URL=sqlite:///./data/clinic.db

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000

# Frontend Configuration
REACT_APP_API_URL=http://$(curl -s ifconfig.me):8000

# Production settings
NODE_ENV=production
EOF
    echo "✅ .env file created. Please review and modify as needed."
fi

# Build and start services
echo "🔨 Building and starting services..."
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Check service health
echo "🔍 Checking service health..."
if curl -f http://localhost:8000/ > /dev/null 2>&1; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend health check failed"
fi

if curl -f http://localhost:3000/ > /dev/null 2>&1; then
    echo "✅ Frontend is healthy"
else
    echo "❌ Frontend health check failed"
fi

# Setup firewall (optional)
read -p "Do you want to configure UFW firewall? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔥 Configuring firewall..."
    sudo ufw allow ssh
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw --force enable
    echo "✅ Firewall configured."
fi

# Setup auto-start on boot
echo "🔄 Setting up auto-start on boot..."
sudo tee /etc/systemd/system/clinic-registry.service > /dev/null <<EOF
[Unit]
Description=Clinic Registry Platform
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$(pwd)
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable clinic-registry.service
echo "✅ Auto-start configured."

# Show status
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "🎉 Deployment completed!"
echo "📱 Frontend: http://$(curl -s ifconfig.me):3000"
echo "🔧 Backend API: http://$(curl -s ifconfig.me):8000"
echo "📚 API Docs: http://$(curl -s ifconfig.me):8000/docs"
echo ""
echo "📝 To manage the application:"
echo "   Start: docker-compose up -d"
echo "   Stop: docker-compose down"
echo "   Logs: docker-compose logs -f"
echo "   Update: ./deploy.sh"
echo ""
echo "🔒 For production use, consider:"
echo "   - Setting up SSL certificates"
echo "   - Configuring a proper domain name"
echo "   - Setting up database backups"
echo "   - Configuring monitoring"
