# Starts the Career Crawler Automation Daemon in the background
$rootDir = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $PSScriptRoot "auto_scheduler.js"
$logPath = Join-Path $PSScriptRoot "daemon.log"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "[START] Launching Career Crawler Daemon in Background..." -ForegroundColor Green
Write-Host "Working Directory: $rootDir" -ForegroundColor Yellow
Write-Host "Logs will be written to: $logPath" -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Cyan

# Stop any previous daemon instance first to prevent duplicate crawls
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*auto_scheduler.js*" } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

# Launch Node background process directly with working directory set to project root
$proc = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine = "node `"$scriptPath`""
    CurrentDirectory = $rootDir
}

Write-Host "[OK] Daemon started successfully in background (PID: $($proc.ProcessId))!" -ForegroundColor Green
Write-Host "To view real-time logs: Get-Content scripts\daemon.log -Wait" -ForegroundColor Cyan
Write-Host "To stop the daemon: powershell -File scripts\stop_background.ps1" -ForegroundColor Magenta
