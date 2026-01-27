#!/bin/bash

echo "====================================="
echo "AVADO Priority Support Backend Setup"
echo "====================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 14 or higher."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✅ npm version: $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    
    # Generate secure secrets
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    
    # Update .env with generated secrets
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/your-super-secret-jwt-key-change-this-in-production/$JWT_SECRET/" .env
        sed -i '' "s/your-api-key-change-this-in-production/$API_KEY/" .env
    else
        # Linux
        sed -i "s/your-super-secret-jwt-key-change-this-in-production/$JWT_SECRET/" .env
        sed -i "s/your-api-key-change-this-in-production/$API_KEY/" .env
    fi
    
    echo "✅ .env file created with secure secrets"
    echo ""
    echo "⚠️  IMPORTANT: Save these values securely!"
    echo "JWT_SECRET: $JWT_SECRET"
    echo "API_KEY: $API_KEY"
    echo ""
else
    echo "ℹ️  .env file already exists, skipping..."
    echo ""
fi

# Create data directory
echo "📁 Creating data directory..."
mkdir -p data

# Initialize database
echo "🗄️  Initializing database..."
npm run init-db

if [ $? -ne 0 ]; then
    echo "❌ Failed to initialize database"
    exit 1
fi

echo "✅ Database initialized"
echo ""

echo "====================================="
echo "✅ Setup Complete!"
echo "====================================="
echo ""
echo "Next steps:"
echo "1. Review and update .env file with your settings"
echo "2. Start the server:"
echo "   - Development: npm run dev"
echo "   - Production: npm start"
echo ""
echo "3. Test the API:"
echo "   curl http://localhost:3001/health"
echo ""
echo "4. Configure Shopify webhook (see INTEGRATION.md)"
echo ""
echo "For detailed setup instructions, see README.md"
echo ""
