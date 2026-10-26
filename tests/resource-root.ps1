$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$adapter = Join-Path $repo 'apps\desktop\src-tauri\src\windows.ps1'
function Detect([string]$resourceRoot) {
    $json = @{operation='detect'; resourceRoot=$resourceRoot} | ConvertTo-Json -Compress
    $lines = $json | & powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $adapter
    if ($LASTEXITCODE -ne 0) { throw "Detection failed: $lines" }
    $line = $lines | Where-Object { $_.StartsWith('VIBEHUB_JSON:') } | Select-Object -Last 1
    if (-not $line) { throw 'Missing structured detection result' }
    $result = ConvertFrom-Json $line.Substring(13)
    $failure = $result | Where-Object { $_.PSObject.Properties.Name -contains 'error' }
    if ($failure) { throw $failure.error }
    Write-Output $result
}
$normal = @(Detect $repo)
$extended = @(Detect ('\\?\' + $repo))
if ($normal.Count -ne 6 -or $extended.Count -ne 6) { throw 'Expected all six app records' }
foreach ($app in $normal) {
    $other = $extended | Where-Object { $_.id -eq $app.id }
    if (-not $other -or $app.installed -ne $other.installed -or $app.path -ne $other.path) { throw "Extended resource path changed detection for $($app.id)" }
}
Write-Output 'PASS: normal and Tauri extended-length resource roots detect identical apps'
