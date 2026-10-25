# Qoder RTL - launcher
#
#   normal:  powershell -ExecutionPolicy Bypass -File start.ps1
#   hidden:  launch.vbs calls this with -Gui (no console window at all)
#   override: $env:QODER_RTL_EXE="C:\path\Qoder.exe", $env:QODER_RTL_PORT=9225
param([switch]$Gui, [switch]$Discover)

$ErrorActionPreference = 'Stop'
$Port   = if ($env:QODER_RTL_PORT) { [int]$env:QODER_RTL_PORT } else { 9225 }
$Dir    = Split-Path -Parent $PSCommandPath
$Log    = Join-Path $env:TEMP 'qoder-rtl.log'

function Say([string]$msg, [int]$icon = 0) {
  $line = "[qoder-rtl] $((Get-Date -Format 'HH:mm:ss')) $msg"
  Add-Content -Path $Log -Value $line -ErrorAction SilentlyContinue
  if ($Gui) {
    if ($icon -ne 0) {
      $w = New-Object -ComObject WScript.Shell
      $null = $w.Popup($msg, 0, 'Qoder RTL', $icon)
    }
  } else {
    Write-Host $line
  }
}

function PortOwner([int]$p) {
  try { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction Stop | Select-Object -First 1 }
  catch { $null }
}

function Has-QoderTarget {
  try {
    $owner = PortOwner $Port
    $process = if ($owner) { Get-Process -Id $owner.OwningProcess -ErrorAction SilentlyContinue } else { $null }
    if (-not $process -or $process.Path -ine $exe) { return $false }
    $targets = Invoke-RestMethod "http://127.0.0.1:$Port/json/list" -TimeoutSec 2
    return [bool]($targets | Where-Object { $_.type -eq 'page' -and $_.url -like 'qoder-app://renderer/*' })
  } catch { return $false }
}

function Owns-InjectorLock($Owner, [string]$InjectorPath) {
  if (-not $Owner) { return $false }
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($Owner.OwningProcess)" -ErrorAction SilentlyContinue
  return $proc -and $proc.Name -ieq 'node.exe' -and $proc.CommandLine -match [regex]::Escape($InjectorPath)
}

function Get-RunningQoder {
  Get-CimInstance Win32_Process -Filter "Name='Qoder.exe' OR Name='Qoder IDE.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -notmatch '--type=' }
}

# --- locate the activated build: only a folder whose resources\app.asar exists
#     can start (0.4.7 / 0.4.8 here hold app.asar.qoder-pending and would fail) ---
function Find-Qoder {
  if ($env:QODER_RTL_EXE) {
    if (Test-Path -PathType Leaf $env:QODER_RTL_EXE) { return $env:QODER_RTL_EXE }
    throw "QODER_RTL_EXE is set but not a file: $env:QODER_RTL_EXE"
  }
  $savedPathFile = Join-Path $Dir 'qoder-path.txt'
  if (Test-Path -LiteralPath $savedPathFile) {
    try { $savedPath = ([System.IO.File]::ReadAllText($savedPathFile, [System.Text.Encoding]::UTF8)).Trim() }
    catch { $savedPath = '' }
    if ($savedPath -and (Test-Path -PathType Leaf $savedPath)) { return $savedPath }
  }
  $running = Get-RunningQoder | Select-Object -First 1
  if ($running) {
    $root = Split-Path -Parent $running.ExecutablePath
    if (Test-Path (Join-Path $root 'resources\app.asar')) { return $running.ExecutablePath }
  }
  foreach ($base in @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Qoder IDE'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Qoder')
  )) {
    $versions = Get-ChildItem (Join-Path $base '.qoder-versions') -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match '^\d+(\.\d+){2,3}$' } |
      Where-Object { Test-Path (Join-Path $_.FullName 'resources\app.asar') } |
      Sort-Object { [version]$_.Name } -Descending
    foreach ($version in $versions) {
      foreach ($name in @('Qoder IDE.exe', 'Qoder.exe')) {
        $candidate = Join-Path $version.FullName $name
        if (Test-Path -PathType Leaf $candidate) { return $candidate }
      }
    }
    foreach ($name in @('Qoder IDE.exe', 'Qoder.exe')) {
      $flat = Join-Path $base $name
      if ((Test-Path -PathType Leaf $flat) -and (Test-Path (Join-Path $base 'resources\app.asar'))) { return $flat }
    }
  }
  throw 'Qoder was not found. Set QODER_RTL_EXE to its full path.'
}

try {
  $exe = Find-Qoder
} catch {
  Say $_.Exception.Message 16
  exit 1
}

if ($Discover) {
  # Machine-readable handoff for install.ps1: base64(UTF-8) survives consoles
  # whose codepage cannot represent characters in the path (e.g. Persian user
  # folders) - raw text gets corrupted to '?' across the process boundary.
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($exe))
  Write-Output "RTL_DISCOVER_B64:$b64"
  Write-Output $exe
  exit 0
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Say 'Node.js is not on PATH. Install Node 21 or newer.' 16
  exit 1
}

# --- already RTL? then only revive the injector if it died ---
$injector = Join-Path $Dir 'injector.mjs'
$owner = PortOwner $Port
$lockOwner = PortOwner ($Port + 1)
if ($owner) {
  if (-not (Has-QoderTarget)) {
    Say "Port $Port is already used by another program. Close it or set QODER_RTL_PORT to another port." 16
    exit 1
  }
  if (Owns-InjectorLock $lockOwner $injector) {
    Say "already running with RTL (port $Port, injector pid $($lockOwner.OwningProcess))."
    exit 0
  }
  if ($lockOwner) {
    Say "Port $($Port + 1) is already used by another program. Close it or set QODER_RTL_PORT to a different port." 16
    exit 1
  }
  Say "port $Port is open but the injector died - restarting it."
} else {
  $main = Get-RunningQoder | Where-Object { $_.ExecutablePath -ieq $exe }
  if ($main) {
    Say "Qoder is already running without the DevTools port, so a second start would just re-use it.`n`nFully quit Qoder (window + tray), then start it again with the Qoder RTL shortcut." 48
    exit 1
  }

  Say "starting Qoder with --remote-debugging-port=$Port"
  Start-Process -FilePath $exe -ArgumentList "--remote-debugging-port=$Port" | Out-Null
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    $owner = PortOwner $Port
    if ($owner) { break }
  }
  if (-not $owner) {
    Say "Qoder started but nothing listens on port $Port.`n`nThis Qoder build ignores --remote-debugging-port; the RTL injector cannot work." 16
    exit 1
  }
  $qoderReady = $false
  for ($i = 0; $i -lt 40; $i++) {
    if (Has-QoderTarget) { $qoderReady = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $qoderReady) {
    Say "Port $Port is open, but it does not belong to a Qoder window." 16
    exit 1
  }
}

$node = (Get-Command node).Source
Start-Process -FilePath $node -ArgumentList ( '"' + (Join-Path $Dir 'injector.mjs') + '"' ) `
  -WorkingDirectory $Dir -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $env:TEMP 'qoder-rtl-injector.out.log') `
  -RedirectStandardError (Join-Path $env:TEMP 'qoder-rtl-injector.err.log') | Out-Null

$injectorReady = $false
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Milliseconds 250
  if (Owns-InjectorLock (PortOwner ($Port + 1)) $injector) { $injectorReady = $true; break }
}
if (-not $injectorReady) {
  Say "The injector could not acquire port $($Port + 1). Check that port and try again." 16
  exit 1
}

Say "done. Port $Port open, injector launched. Persian text in the chat should be right-aligned now."
Say "verify any time with: node `"$Dir\doctor.mjs`" --check"
