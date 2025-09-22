Param()

Write-Host "Installing dependencies..."
npm install

Write-Host "Running tests..."
npm test

Write-Host "Building Docker image..."
docker compose build

Write-Host "Starting services..."
docker compose up -d

Write-Host "Deployment complete. API available at http://localhost:3000"
