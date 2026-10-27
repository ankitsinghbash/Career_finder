# Gracefully stops the background Career Crawler daemon
$found = $false
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*auto_scheduler.js*" } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force
    Write-Host "[OK] Stopped daemon process (PID: $($_.ProcessId))" -ForegroundColor Green
    $found = $true
}

if (-not $found) {
    Write-Host "[INFO] No running background crawler daemon was found." -ForegroundColor Yellow
} else {
    Write-Host "[SUCCESS] Career Crawler background daemon stopped successfully." -ForegroundColor Magenta
}
