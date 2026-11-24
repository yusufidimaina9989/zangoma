# Frees the Angular (4200) and Netlify Dev (8888) ports by stopping only
# processes that belong to THIS project. Safe to run repeatedly.
param([int[]]$Ports = @(4200, 8888))

$ErrorActionPreference = 'SilentlyContinue'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$killed = @()

foreach ($port in $Ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen
    foreach ($conn in $connections) {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($conn.OwningProcess)"
        if ($proc -and $proc.CommandLine -and $proc.CommandLine.Contains($projectRoot)) {
            Stop-Process -Id $proc.ProcessId -Force
            $killed += "$port (PID $($proc.ProcessId))"
        }
    }
}

if ($killed.Count -gt 0) {
    Write-Host "Freed stale dev process(es): $($killed -join ', ')"
} else {
    Write-Host 'Dev ports already free.'
}
