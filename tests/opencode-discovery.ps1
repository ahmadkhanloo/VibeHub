$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$adapter = Join-Path $root 'apps\desktop\src-tauri\src\windows.ps1'
$temp = Join-Path ([IO.Path]::GetTempPath()) ('vibehub-opencode-' + [guid]::NewGuid().ToString('N'))
$old = $env:LOCALAPPDATA
try {
  $env:LOCALAPPDATA = $temp
  $exe = Join-Path $temp 'Programs\ai.opencode.desktop\OpenCode.exe'
  New-Item -ItemType Directory -Force -Path (Split-Path $exe) | Out-Null
  New-Item -ItemType File -Path $exe | Out-Null
  $request = @{operation='detect';resourceRoot=$root} | ConvertTo-Json -Compress
  $result = (($request | powershell.exe -NoProfile -ExecutionPolicy Bypass -File $adapter) -replace '^VIBEHUB_JSON:','') | ConvertFrom-Json
  $found = $result | Where-Object id -eq 'opencode'
  if (-not $found.installed -or $found.path -ine $exe) { throw 'Desktop OpenCode was not detected' }
  Write-Host 'OpenCode desktop detected'
} finally {
  $env:LOCALAPPDATA = $old
  Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
}
