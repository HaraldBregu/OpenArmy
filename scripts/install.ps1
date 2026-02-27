$ErrorActionPreference = "Stop"

Write-Host "ℹ Installing OpenArmy..." -ForegroundColor Cyan

# Check if Node.js is installed
$NodeVersion = & {
  try {
    node --version
  } catch {
    $null
  }
}

if (-not $NodeVersion) {
  Write-Host "⚠ Node.js not found. Installing Node.js LTS..." -ForegroundColor Yellow

  # Use winget to install Node.js
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install OpenJS.NodeJS.LTS --accept-source-agreements
  } else {
    Write-Host "✗ winget not found. Please install Node.js 18+ manually." -ForegroundColor Red
    exit 1
  }

  # Refresh PATH
  $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
}

# Check Node version is >= 18
$NodeVersionOutput = node -v
$MajorVersion = [int]($NodeVersionOutput -replace 'v(\d+)\..*', '$1')
if ($MajorVersion -lt 18) {
  Write-Host "✗ Node.js 18 or higher required. Current version: $NodeVersionOutput" -ForegroundColor Red
  exit 1
}

Write-Host "ℹ Installing openarmy via npm..." -ForegroundColor Cyan
npm install -g openarmy

Write-Host "✓ OpenArmy installed successfully!" -ForegroundColor Green
Write-Host "✓ Try running: oa --help" -ForegroundColor Green
