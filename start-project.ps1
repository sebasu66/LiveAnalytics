param(
    [switch]$Debug
)

# Toggle Debug Mode in config
$configPath = "debug.config.json"
$debugEnabled = $Debug.IsPresent
if (Test-Path $configPath) {
    $config = Get-Content $configPath -Raw | ConvertFrom-Json
} else {
    $config = @{}
}
$config.debugMode = $debugEnabled
$config.autoLoadKey = $debugEnabled  # Also toggle auto-load
$config | ConvertTo-Json -Depth 10 | Set-Content $configPath
if ($debugEnabled) { Write-Host "[Debug] Debug mode: ENABLED" -ForegroundColor Green } else { Write-Host "[Debug] Debug mode: DISABLED" -ForegroundColor Gray }

# Start Live Analytics Project (Backend + Frontend)
# Run: .\start-project.ps1
# Opens two new PowerShell terminals: Backend (:3000) and Frontend (:5173+)

# Check if project is already running by checking ports
function Test-PortOpen {
    param([int]$Port)
    $tcp = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    return $tcp -ne $null
}

if ((Test-PortOpen 3000) -or (Test-PortOpen 5173)) {
    Write-Host "Project already running. Stopping existing processes..." -ForegroundColor Yellow
    & .\stop-project.ps1
    
    # Wait for ports to clear
    Write-Host "Waiting for ports to clear..." -NoNewline
    $retries = 0
    while (((Test-PortOpen 3000) -or (Test-PortOpen 5173)) -and ($retries -lt 10)) {
        Start-Sleep -Seconds 1
        Write-Host "." -NoNewline
        $retries++
    }
    Write-Host ""
    
    if ((Test-PortOpen 3000) -or (Test-PortOpen 5173)) {
        Write-Host "⚠️ Warning: Some ports could not be cleared. Starting anyway..." -ForegroundColor Red
    } else {
        Write-Host "✅ Ports cleared. Starting fresh..." -ForegroundColor Green
    }
}

Write-Host "Starting Backend (http://localhost:3000)..." -ForegroundColor Green
Start-Process powershell.exe -WorkingDirectory "c:\DEV\live analytics" -ArgumentList '-NoExit', '-Command', 'Write-Host "Backend ready on http://localhost:3000"; npm start'

Write-Host "Starting Frontend (http://localhost:5173)..." -ForegroundColor Green
Start-Process powershell.exe -WorkingDirectory "c:\DEV\live analytics\client" -ArgumentList '-NoExit', '-Command', 'Write-Host "Frontend ready on http://localhost:5173+"; npm run dev'

Write-Host "`nProject started! Open http://localhost:5173 (or next port) in browser." -ForegroundColor Green
Write-Host "Use .\stop-project.ps1 to stop both servers cleanly." -ForegroundColor Yellow