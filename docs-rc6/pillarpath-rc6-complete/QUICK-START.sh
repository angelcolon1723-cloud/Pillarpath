#!/bin/bash
set -e

# PillarPath RC6 — Quick Start Setup Script
# This script automates the deployment setup for all platforms

echo "🚀 PillarPath RC6 — Quick Start"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running from correct directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found${NC}"
    echo "Please run this script from the pillarpath-work directory:"
    echo "  cd pillarpath-work && bash ../QUICK-START.sh"
    exit 1
fi

echo -e "${BLUE}Step 1: Choose deployment method${NC}"
echo "=================================="
echo "1) Docker Compose (Recommended for dev/staging)"
echo "2) Local Node.js (Development only)"
echo "3) Vercel (Production - requires GitHub)"
echo ""
read -p "Select option (1-3): " DEPLOY_METHOD

# Generate JWT secret
generate_jwt_secret() {
    if command -v openssl &> /dev/null; then
        openssl rand -base64 32
    else
        # Fallback for systems without openssl
        head -c 32 /dev/urandom | base64
    fi
}

case $DEPLOY_METHOD in
    1)
        echo ""
        echo -e "${BLUE}Setting up Docker Compose...${NC}"
        
        # Check if Docker is installed
        if ! command -v docker &> /dev/null; then
            echo -e "${RED}❌ Docker not found. Install from https://docs.docker.com/get-docker/${NC}"
            exit 1
        fi
        
        # Create .env.local if it doesn't exist
        if [ ! -f ".env.local" ]; then
            echo -e "${YELLOW}Creating .env.local...${NC}"
            JWT_SECRET=$(generate_jwt_secret)
            
            cat > .env.local <<EOF
DATABASE_URL=postgresql://pillarpath:pillarpath-dev-password-change-in-prod@postgres:5432/pillarpath
JWT_SECRET=$JWT_SECRET
AUTH_URL=http://localhost:8080
NODE_ENV=development
PORT=8080
EOF
            echo -e "${GREEN}✅ .env.local created${NC}"
            echo "   ⚠️  Change the password in .env.local for production!"
        else
            echo -e "${GREEN}✅ .env.local already exists${NC}"
        fi
        
        # Copy docker-compose.yml if needed
        if [ ! -f "docker-compose.yml" ]; then
            echo -e "${YELLOW}Copying docker-compose.yml...${NC}"
            cp ../docker-compose.yml .
        fi
        
        # Start Docker services
        echo -e "${BLUE}Starting Docker containers...${NC}"
        docker compose up -d
        
        echo -e "${GREEN}✅ Docker containers started!${NC}"
        echo ""
        echo "Waiting for services to be ready..."
        sleep 5
        
        # Check if containers are running
        if docker compose ps | grep -q "pillarpath-app"; then
            echo -e "${GREEN}✅ App is running!${NC}"
            echo "🌐 Open: http://localhost:8080"
            echo ""
            echo "Useful commands:"
            echo "  docker compose logs -f          # View logs"
            echo "  docker compose down             # Stop all services"
            echo "  docker compose ps               # View status"
        else
            echo -e "${RED}❌ Container failed to start${NC}"
            echo "View logs with: docker compose logs app"
            exit 1
        fi
        ;;
        
    2)
        echo ""
        echo -e "${BLUE}Setting up local Node.js development...${NC}"
        
        # Check Node version
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -lt 18 ]; then
            echo -e "${RED}❌ Node.js 18+ required. You have $(node -v)${NC}"
            exit 1
        fi
        
        # Create .env.local
        if [ ! -f ".env.local" ]; then
            echo -e "${YELLOW}Creating .env.local...${NC}"
            JWT_SECRET=$(generate_jwt_secret)
            
            cat > .env.local <<EOF
DATABASE_URL=postgresql://user:password@localhost:5432/pillarpath
JWT_SECRET=$JWT_SECRET
AUTH_URL=http://localhost:8080
NODE_ENV=development
PORT=8080
EOF
            echo -e "${GREEN}✅ .env.local created${NC}"
            echo ""
            echo -e "${YELLOW}⚠️  Important: You need a PostgreSQL database${NC}"
            echo "Install options:"
            echo "  1. Docker: docker run -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:17"
            echo "  2. Local: brew install postgresql && pg_ctl -D /usr/local/var/postgres start"
            echo "  3. Cloud: Use AWS RDS, DigitalOcean, Railway, etc."
            echo ""
            read -p "Press enter when PostgreSQL is ready..."
        fi
        
        # Install dependencies
        echo -e "${BLUE}Installing dependencies...${NC}"
        npm install
        
        # Run migrations
        echo -e "${BLUE}Running database migrations...${NC}"
        npm run db:migrate
        
        # Start dev server
        echo -e "${BLUE}Starting development server...${NC}"
        npm run dev
        ;;
        
    3)
        echo ""
        echo -e "${BLUE}Setting up Vercel deployment...${NC}"
        
        # Check if Vercel CLI is installed
        if ! command -v vercel &> /dev/null; then
            echo -e "${YELLOW}Installing Vercel CLI...${NC}"
            npm install -g vercel
        fi
        
        echo -e "${YELLOW}Follow the steps below:${NC}"
        echo ""
        echo "1. Push your code to GitHub"
        echo "2. Log in to Vercel:"
        vercel login
        
        echo ""
        echo "3. Deploy:"
        vercel deploy --prod
        
        echo ""
        echo "4. Add environment variables in Vercel dashboard:"
        echo "   - DATABASE_URL (Vercel Postgres or external)"
        echo "   - JWT_SECRET"
        echo "   - STRIPE_SECRET_KEY (optional)"
        echo ""
        echo "5. Redeploy after adding env vars:"
        vercel deploy --prod
        
        echo -e "${GREEN}✅ Deployment guide complete!${NC}"
        ;;
        
    *)
        echo -e "${RED}❌ Invalid option${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Create an account at http://localhost:8080 (if local)"
echo "  2. Add child profiles"
echo "  3. Start creating projects in the studio"
echo "  4. Configure Stripe for marketplace (optional)"
echo ""
echo "Documentation: See RC6-BUILD-GUIDE.md"
echo "Support: Check troubleshooting section in build guide"
