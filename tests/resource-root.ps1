$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$adapter = Join-Path $repo 'apps\desktop\src-tauri\src\windows.ps1'
function Detect([string]$resourceRoot) {
    $json = @{operation='detect'; resourceRoot=$resourceRoot} | ConvertTo-Json -Compress
    $lines = $json | & powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $adapter
    if ($LASTEXITCODE -ne 0) { throw "Detection failed: $lines" }
    $line = $lines | Where-Object { $_.StartsWith('VIBEHUB_JSON:') } | Select-Object -Last 1
    if (-not $line) { throw 'Missing structured detection result' }
    $result = ConvertFrom-Json $line.Substring(13) -NoEnumerate
    if ($result -isnot [array]) {
        if ($result.error) { throw $result.error }
        throw "Expected app detection to return an array for $resourceRoot"
    }
    Write-Output $result
}
$normal = @(Detect $repo)
$extended = @(Detect ('\\?\' + $repo))
$normalIds = @($normal.id | Sort-Object -Unique)
$extendedIds = @($extended.id | Sort-Object -Unique)
if (-not $normal.Count -or $normal.Count -ne $normalIds.Count -or $extended.Count -ne $extendedIds.Count) {
    throw 'Detection must return a nonempty list of unique app IDs for both paths.'
}
if (($normalIds -join ',') -cne ($extendedIds -join ',')) { throw 'Extended resource path changed the detected app IDs.' }
foreach ($app in $normal) {
    $other = $extended | Where-Object { $_.id -eq $app.id }
    if ($app.installed -ne $other.installed -or $app.path -ne $other.path) { throw "Extended resource path changed detection for $($app.id)" }
}
Write-Output 'PASS: normal and Tauri extended-length resource roots detect identical apps'
