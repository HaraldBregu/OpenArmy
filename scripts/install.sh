#!/bin/bash
set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}ℹ${NC} Installing OpenArmy..."

# Check Node.js version
if ! command -v node &> /dev/null; then
  echo -e "${YELLOW}⚠${NC} Node.js not found. Installing Node.js LTS..."

  # Install nvm if not present
  if ! command -v nvm &> /dev/null; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.nsh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  fi

  nvm install lts/*
  nvm use lts/*
fi

# Check Node version is >= 18
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}✗${NC} Node.js 18 or higher required. Current version: $(node -v)"
  exit 1
fi

# Install openarmy globally
echo -e "${BLUE}ℹ${NC} Installing openarmy via npm..."
npm install -g openarmy

echo -e "${GREEN}✓${NC} OpenArmy installed successfully!"
echo -e "${GREEN}✓${NC} Try running: ${BLUE}oa --help${NC}"
