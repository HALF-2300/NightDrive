param(
  [int]$Port = 1154
)

Write-Host "==> Killing anything LISTENING on port $Port ..." -ForegroundColor Cyan

$lines = netstat -ano | Select-String ":\b$Port\b\s+.*LISTENING"
if ($lines) {
  $pids = $lines | ForEach-Object { ($_ -split "\s+")[-1] } | Select-Object -Unique
  foreach ($procId in $pids) {
    if ($procId -match '^\d+$') {
      Write-Host "taskkill /PID $procId /F" -ForegroundColor Yellow
      taskkill /PID $procId /F | Out-Null
    }
  }
} else {
  Write-Host "Port $Port is already free." -ForegroundColor Green
}

Write-Host "==> Done." -ForegroundColor Green

