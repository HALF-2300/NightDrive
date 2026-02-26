param(
  [int]$Port = 1154
)

$projectRoot = (Resolve-Path ".").Path

Write-Host "========================================" -ForegroundColor DarkGray
Write-Host " AutoElite DEV BOOT (hard reset) " -ForegroundColor White
Write-Host " Project: $projectRoot" -ForegroundColor DarkGray
Write-Host " Port:    $Port" -ForegroundColor DarkGray
Write-Host "========================================" -ForegroundColor DarkGray

Write-Host "`n[1/3] Freeing port $Port ..." -ForegroundColor Cyan
& "$projectRoot\scripts\kill-port.ps1" -Port $Port
& "$projectRoot\scripts\kill-port.ps1" -Port 1554

Write-Host "`n[2/3] Killing stray node servers from this project path ..." -ForegroundColor Cyan
$escaped = [Regex]::Escape($projectRoot)
$procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -match $escaped -and $_.CommandLine -match "server\.js" }

if ($procs) {
  $procs | ForEach-Object {
    Write-Host "Stopping PID $($_.ProcessId)" -ForegroundColor Yellow
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
} else {
  Write-Host "No stray node servers found for this project." -ForegroundColor Green
}

Write-Host "`n[3/3] Starting server ..." -ForegroundColor Cyan
$env:PORT = "$Port"
node server.js

