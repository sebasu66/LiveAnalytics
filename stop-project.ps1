# Stop Live Analytics Project (Kills Backend :3000 + Frontend :5173/5174)
# Run: .\stop-project.ps1

function Kill-PortProcess {
    param([int]$Port, [string]$Name)
    
    Write-Host "🛑 Checking $Name (port $Port)..." -NoNewline
    
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($connections) {
            $pidsToKill = $connections.OwningProcess | Select-Object -Unique
            foreach ($pidToKill in $pidsToKill) {
                if ($pidToKill -gt 0) {
                    Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                    Write-Host " Killed PID $pidToKill." -ForegroundColor Green
                }
            }
        } else {
            Write-Host " No active process found." -ForegroundColor Yellow
        }
    } catch {
        Write-Host " Error checking port $Port." -ForegroundColor Red
    }
}

Kill-PortProcess -Port 3000 -Name "Backend"
Kill-PortProcess -Port 5173 -Name "Frontend"
Kill-PortProcess -Port 5174 -Name "Frontend (Alt)"

Write-Host "`n✅ Project stopped! All processes killed." -ForegroundColor Green