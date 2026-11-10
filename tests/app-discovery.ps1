$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$adapter = Join-Path $repo 'apps\desktop\src-tauri\src\windows.ps1'
$temp = Join-Path ([IO.Path]::GetTempPath()) ('vibehub-apps-' + [guid]::NewGuid().ToString('N'))
$oldLocal = $env:LOCALAPPDATA
$oldProfile = $env:USERPROFILE
$oldPath = $env:PATH
try {
  $env:LOCALAPPDATA = $temp
  $env:USERPROFILE = $temp
  function Invoke-Adapter($request) {
    $request.resourceRoot = $repo
    $raw = ($request | ConvertTo-Json -Compress -Depth 8) | powershell.exe -NoProfile -ExecutionPolicy Bypass -File $adapter
    $value = (($raw | Where-Object { $_ -like 'VIBEHUB_JSON:*' }) -replace '^VIBEHUB_JSON:','') | ConvertFrom-Json
    if ($value -isnot [array] -and $value.error) { throw $value.error }; return $value
  }
  $custom = Join-Path $temp 'custom folder\mimocode.cmd'
  New-Item -ItemType Directory -Force (Split-Path $custom) | Out-Null
  Set-Content -LiteralPath $custom -Value '@echo off'
  Invoke-Adapter @{operation='app-path';appId='mimocode';path=$custom} | Out-Null
  $apps = @(Invoke-Adapter @{operation='detect'})
  if ((@($apps | Where-Object id -eq 'mimocode')[0]).path -ne $custom) { throw 'Saved CLI path not detected' }
  $invalid = Join-Path $temp 'custom folder\other.cmd'
  Set-Content -LiteralPath $invalid -Value '@echo off'
  $rejected = $false
  try { Invoke-Adapter @{operation='app-path';appId='mimocode';path=$invalid} | Out-Null } catch { $rejected = $true }
  if (-not $rejected) { throw 'Wrong executable name was accepted' }
  $apps = @(Invoke-Adapter @{operation='detect'})
  if ((@($apps | Where-Object id -eq 'mimocode')[0]).path -ne $custom) { throw 'Rejected path changed saved setting' }
  $claude = Join-Path $temp '.local\bin\claude.exe'
  New-Item -ItemType Directory -Force (Split-Path $claude) | Out-Null
  New-Item -ItemType File $claude | Out-Null
  $apps = @(Invoke-Adapter @{operation='detect'})
  if ((@($apps | Where-Object id -eq 'claude-code')[0]).path -ne $claude) { throw 'Claude CLI not detected' }
  $manual = Join-Path $temp 'another folder\claude.exe'
  New-Item -ItemType Directory -Force (Split-Path $manual) | Out-Null
  New-Item -ItemType File $manual | Out-Null
  Invoke-Adapter @{operation='app-path';appId='claude-code';path=$manual} | Out-Null
  $apps = @(Invoke-Adapter @{operation='detect'})
  if ((@($apps | Where-Object id -eq 'claude-code')[0]).path -ne $manual) { throw 'Saved path did not take precedence' }
  Remove-Item -LiteralPath $manual
  $apps = @(Invoke-Adapter @{operation='detect'})
  if ((@($apps | Where-Object id -eq 'claude-code')[0]).path -ne $claude) { throw 'Missing saved path did not fall back' }

  $desktop = Join-Path $temp 'Programs\@codebufffreebuff-desktop\Freebuff.exe'
  New-Item -ItemType Directory -Force (Join-Path (Split-Path $desktop) 'resources') | Out-Null
  New-Item -ItemType File $desktop, (Join-Path (Split-Path $desktop) 'resources\app.asar') | Out-Null
  $apps = @(Invoke-Adapter @{operation='detect'})
  if ((@($apps | Where-Object id -eq 'freebuff-desktop')[0]).path -ne $desktop) { throw 'Freebuff Desktop standard path not detected' }
  $manualDesktop = Join-Path $temp 'custom Freebuff\Freebuff.exe'
  New-Item -ItemType Directory -Force (Join-Path (Split-Path $manualDesktop) 'resources') | Out-Null
  New-Item -ItemType File $manualDesktop, (Join-Path (Split-Path $manualDesktop) 'resources\app.asar') | Out-Null
  Invoke-Adapter @{operation='app-path';appId='freebuff-desktop';path=$manualDesktop} | Out-Null
  $apps = @(Invoke-Adapter @{operation='detect'})
  if ((@($apps | Where-Object id -eq 'freebuff-desktop')[0]).path -ne $manualDesktop) { throw 'Freebuff Desktop manual path not detected' }
  Remove-Item -LiteralPath $manualDesktop
  $apps = @(Invoke-Adapter @{operation='detect'})
  if ((@($apps | Where-Object id -eq 'freebuff-desktop')[0]).path -ne $desktop) { throw 'Missing Freebuff Desktop path did not fall back' }

  $copilot = Join-Path $temp 'copilot.cmd'
  Set-Content -LiteralPath $copilot -Value '@echo off'
  $env:PATH = "$temp;$env:PATH"
  $apps = @(Invoke-Adapter @{operation='detect'})
  if ((@($apps | Where-Object id -eq 'copilot-cli')[0]).path -ne $copilot) { throw 'Copilot CLI command was not detected' }
  Write-Host 'App path, Freebuff Desktop and Copilot detection passed'

} finally { $env:LOCALAPPDATA = $oldLocal; $env:USERPROFILE = $oldProfile; $env:PATH = $oldPath; $resolved=[IO.Path]::GetFullPath($temp); if ($resolved.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()),[StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolved) -like 'vibehub-apps-*') { Remove-Item -LiteralPath $resolved -Recurse -Force -ErrorAction SilentlyContinue } }

