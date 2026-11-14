# Qoder RTL - launcher
#
#   normal:  powershell -ExecutionPolicy Bypass -File start.ps1
#   hidden:  launch.vbs calls this with -Gui (no console window at all)
#   override: $env:QODER_RTL_EXE="C:\path\Qoder.exe", $env:QODER_RTL_PORT=9225
param([switch]$Gui, [switch]$Discover)

$ErrorActionPreference = 'Stop'
$Port   = if ($env:QODER_RTL_PORT) { [int]$env:QODER_RTL_PORT } else { 9225 }
$Dir    = Split-Path -Parent $PSCommandPath
$RtlHelpers = Join-Path $Dir '..\rtl-paths.ps1'
if (Test-Path -LiteralPath $RtlHelpers) { . $RtlHelpers }
. (Join-Path $Dir '..\rtl-launch-lib.ps1')
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

function Has-QoderTarget {
  try {
    $owner = Get-RtlPortOwner $Port
    $process = if ($owner) { Get-Process -Id $owner.OwningProcess -ErrorAction SilentlyContinue } else { $null }
    if (-not $process -or $process.Path -ine $exe) { return $false }
    $targets = Invoke-RestMethod "http://127.0.0.1:$Port/json/list" -TimeoutSec 2
    return [bool]($targets | Where-Object { $_.type -eq 'page' -and $_.url -like 'qoder-app://renderer/*' })
  } catch { return $false }
}

function Get-RunningQoder {
  Get-CimInstance Win32_Process -Filter "Name='Qoder.exe' OR Name='Qoder IDE.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -notmatch '--type=' }
}

# --- locate the activated build: only a folder whose resources\app.asar exists
#     can start (0.4.7 / 0.4.8 here hold app.asar.qoder-pending and would fail) ---
function Find-Qoder { Get-RtlExecutable 'qoder' $Dir }

try {
  $exe = Find-Qoder
} catch {
  $exe = $null
}
if (-not $exe -and (Get-Command Select-RtlExecutable -ErrorAction SilentlyContinue)) {
  $exe = Select-RtlExecutable 'qoder' 'Qoder' 'Qoder.exe|Qoder IDE.exe'
}
if (-not $exe) {
  Say 'Qoder was not found. Install Qoder or choose Qoder.exe / Qoder IDE.exe when prompted.' 16
  exit 1
}

if ($Discover) {
  # Machine-readable handoff for install.ps1: base64(UTF-8) survives consoles
  # whose codepage cannot represent characters in the path (e.g. Persian user
  # folders) - raw text gets corrupted to '?' across the process boundary.
  Write-Output (ConvertTo-RtlDiscoverLine $exe)
  Write-Output $exe
  exit 0
}

try {
  if (Get-Command Get-RtlNodePath -ErrorAction SilentlyContinue) {
    $nodePath = Get-RtlNodePath $Dir
  } else {
    $node = Get-Command node -ErrorAction Stop
    $nodeVersion = & $node.Source --version
    if ($LASTEXITCODE -ne 0 -or [version](($nodeVersion -replace '^v', '')) -lt [version]'21.0') { throw 'Node.js 21 or newer is required.' }
    $nodePath = $node.Source
  }
} catch {
  Say $_.Exception.Message 16
  exit 1
}

# --- already RTL? then only revive the injector if it died ---
$injector = Join-Path $Dir 'injector.mjs'
$owner = Get-RtlPortOwner $Port
if ($owner) {
  if (-not (Has-QoderTarget)) {
    Say "Port $Port is already used by another program. Close it or set QODER_RTL_PORT to another port." 16
    exit 1
  }
  $lockOwner = Get-RtlPortOwner ($Port + 1)
  if (Test-RtlInjectorLock $lockOwner $injector) {
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
    if ($main.CommandLine -match [regex]::Escape("--remote-debugging-port=$Port")) {
      # Mid-startup from an earlier RTL launch (its DevTools port opens late);
      # wait for it instead of demanding a full quit.
      Say "Qoder is already starting with its RTL port $Port - waiting for it to open."
      for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Milliseconds 500
        $owner = Get-RtlPortOwner $Port
        if ($owner) { break }
      }
      if (-not $owner) {
        Say "Qoder did not open its RTL port $Port. Fully quit Qoder (window + tray), then start it again with the Qoder RTL shortcut." 48
        exit 1
      }
    } else {
      Say "Qoder is already running without the DevTools port, so a second start would just re-use it.`n`nFully quit Qoder (window + tray), then start it again with the Qoder RTL shortcut." 48
      exit 1
    }
  } else {
    Say "starting Qoder with --remote-debugging-port=$Port"
    $launchArgs = "--remote-debugging-port=$Port"
    if ($env:VIBEHUB_PROJECT) { $launchArgs += ' "' + ($env:VIBEHUB_PROJECT.TrimEnd('\') + '\.') + '"' }
    Start-Process -FilePath $exe -ArgumentList $launchArgs | Out-Null
    for ($i = 0; $i -lt 40; $i++) {
      Start-Sleep -Milliseconds 500
      $owner = Get-RtlPortOwner $Port
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
}

$out = Join-Path $env:TEMP 'qoder-rtl-injector.out.log'
$err = Join-Path $env:TEMP 'qoder-rtl-injector.err.log'
if (-not (Start-RtlInjector ($Port + 1) $nodePath $injector $out $err)) {
  Say "The RTL injector did not start. See $err and $out for details, then try again." 16
  exit 1
}

Say "done. Port $Port open, injector launched. Persian text in the chat should be right-aligned now."
Say "verify any time with: node `"$Dir\doctor.mjs`" --check"
