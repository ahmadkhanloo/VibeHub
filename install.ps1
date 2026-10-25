# Create desktop shortcuts for a source checkout.
param([string]$Apps = 'zcode', [switch]$Uninstall, [switch]$WhatIf)

$ErrorActionPreference = 'Stop'
$zcodeExe = @(
  "$env:ProgramFiles\ZCode\ZCode.exe",
  "${env:ProgramFiles(x86)}\ZCode\ZCode.exe",
  "$env:LOCALAPPDATA\Programs\ZCode\ZCode.exe"
) | Where-Object { Test-Path -PathType Leaf $_ } | Select-Object -First 1
$definitions = @{
  zcode = @{ Name = 'ZCode RTL'; Dir = 'ZCode'; Exe = $zcodeExe }
  qoder = @{ Name = 'Qoder RTL'; Dir = 'Qoder'; Exe = $null }
  deepseek = @{ Name = 'DeepSeek Harness RTL'; Dir = 'DeepSeekHarness'; Exe = "$env:LOCALAPPDATA\Programs\DeepSeek Harness\DeepSeek Harness.exe" }
}
$desktop = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell
$wscript = Join-Path $env:SystemRoot 'System32\wscript.exe'

function Test-OwnedShortcut([string]$Path, [string]$Launcher) {
  if (-not (Test-Path -LiteralPath $Path)) { return $false }
  $shortcut = $shell.CreateShortcut($Path)
  if ($shortcut.TargetPath -ine $wscript) { return $false }
  $target = $shortcut.Arguments.Trim().Trim('"')
  try { return [IO.Path]::GetFullPath($target) -ieq [IO.Path]::GetFullPath($Launcher) }
  catch { return $false }
}

if ($Uninstall) {
  $cleanup = Join-Path $PSScriptRoot 'cleanup.ps1'
  if (Test-Path -LiteralPath $cleanup) {
    if ($WhatIf) { Write-Host "would stop injectors owned by: $PSScriptRoot" }
    else { & (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -NoProfile -ExecutionPolicy Bypass -File $cleanup -Root $PSScriptRoot }
  }
  foreach ($app in $definitions.Values) {
    $shortcut = Join-Path $desktop ($app.Name + '.lnk')
    $launcher = Join-Path (Join-Path $PSScriptRoot ("apps\" + $app.Dir)) 'launch.vbs'
    if (Test-OwnedShortcut $shortcut $launcher) {
      if ($WhatIf) { Write-Host "would remove: $shortcut" }
      else { Remove-Item -LiteralPath $shortcut -Force; Write-Host "Removed: $shortcut" }
    } elseif (Test-Path -LiteralPath $shortcut) {
      Write-Host "Skipped shortcut owned by another install: $shortcut"
    }
  }
  exit 0
}

$requested = @($Apps -split '[,\s]+' | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ } | ForEach-Object { if ($_ -eq 'deepseek-harness') { 'deepseek' } else { $_ } } | Select-Object -Unique)
if (-not $requested.Count) { throw 'Choose at least one app with -Apps zcode,qoder,deepseek.' }
foreach ($name in $requested) {
  if (-not $definitions.ContainsKey($name)) { throw "Unknown app '$name'. Choose zcode, qoder, or deepseek." }
}

try {
  $node = Get-Command node -ErrorAction Stop
  $version = [version]((node --version) -replace '^v', '')
  if ($version.Major -lt 21) { throw "Node.js 21 or newer is required (found v$version)." }
} catch {
  throw 'Node.js 21 or newer is required. Install it from https://nodejs.org.'
}

$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
foreach ($name in $requested) {
  $app = $definitions[$name]
  $folder = Join-Path $PSScriptRoot ("apps\" + $app.Dir)
  foreach ($file in 'launch.vbs', 'start.ps1', 'injector.mjs') {
    if (-not (Test-Path -LiteralPath (Join-Path $folder $file))) { throw "Missing $file for $name in $folder." }
  }
  if ($name -eq 'qoder') {
    $discovery = @(& $powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $folder 'start.ps1') -Discover 2>&1)
    # Prefer the base64 handoff: raw path text is corrupted to '?' whenever the
    # console codepage cannot represent a character (Persian user folders).
    $b64Line = @($discovery | Where-Object { $_ -match '^RTL_DISCOVER_B64:' } | Select-Object -Last 1)
    if ($b64Line.Count) {
      try { $app.Exe = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($b64Line[0] -replace '^RTL_DISCOVER_B64:', ''))) }
      catch { $app.Exe = $null }
    }
    if (-not $app.Exe) {
      $resolved = @($discovery | Where-Object { $_ -match '^[A-Za-z]:\\' } | Select-Object -Last 1)
      if ($resolved.Count) { $app.Exe = $resolved[0].Trim() }
    }
  }
  if (-not $app.Exe -or -not (Test-Path -PathType Leaf $app.Exe)) {
    throw "$($app.Name) was selected, but its app was not found. Install it first."
  }
}

foreach ($name in $requested) {
  $app = $definitions[$name]
  $folder = Join-Path $PSScriptRoot ("apps\" + $app.Dir)
  $shortcut = Join-Path $desktop ($app.Name + '.lnk')
  $launcher = Join-Path $folder 'launch.vbs'
  if ($WhatIf) {
    Write-Host "would create: $shortcut"
    Write-Host "  Launcher: $launcher"
    Write-Host "  Icon:     $($app.Exe), 0"
  } else {
    if ((Test-Path -LiteralPath $shortcut) -and -not (Test-OwnedShortcut $shortcut $launcher)) {
      throw "Shortcut already points to another install: $shortcut. Remove or rename it before installing from this checkout."
    }
    $link = $shell.CreateShortcut($shortcut)
    $link.TargetPath = $wscript
    $link.Arguments = '"' + $launcher + '"'
    $link.IconLocation = "$($app.Exe),0"
    $link.WorkingDirectory = $folder
    $link.Description = "Run $($app.Name)"
    $link.Save()
    Write-Host "Created: $shortcut"
  }
}
