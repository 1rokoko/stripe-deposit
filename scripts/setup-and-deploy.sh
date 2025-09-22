#!/usr/bin/env bash
set -euo pipefail

echo "Installing dependencies..."
npm install

echo "Running tests..."
npm test

echo "Building Docker image..."
docker compose build

echo "Starting services..."
docker compose up -d

echo "Deployment complete. API available at http://localhost:3000"
