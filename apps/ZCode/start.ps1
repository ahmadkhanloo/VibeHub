param([switch]$Gui, [switch]$Discover)

$ErrorActionPreference = 'Stop'
$Port = if ($env:ZCODE_RTL_PORT) { [int]$env:ZCODE_RTL_PORT } else { 9222 }
$Dir = Split-Path -Parent $PSCommandPath
$RtlHelpers = Join-Path $Dir '..\rtl-paths.ps1'
if (Test-Path -LiteralPath $RtlHelpers) { . $RtlHelpers }
$Log = Join-Path $env:TEMP 'zcode-rtl.log'

function Say([string]$Message, [int]$Icon = 0) {
  Add-Content -Path $Log -Value "[zcode-rtl] $((Get-Date -Format 'HH:mm:ss')) $Message" -ErrorAction SilentlyContinue
  if ($Gui) {
    if ($Icon -ne 0) {
      $shell = New-Object -ComObject WScript.Shell
      $null = $shell.Popup($Message, 0, 'ZCode RTL', $Icon)
    }
  } else {
    Write-Host "[zcode-rtl] $Message"
  }
}

function Find-ZCode { Get-RtlExecutable 'zcode' $Dir }

function Get-CdpInfo {
  try { Invoke-RestMethod "http://127.0.0.1:$Port/json/version" -TimeoutSec 2 }
  catch { $null }
}

function PortOwner([int]$p = $Port) {
  # No -State Listen filter: on recent Windows builds a loopback-only listener
  # (our node injector lock) reports a Bound state, so filtering by state would
  # never match it. Ownership is verified separately in Owns-InjectorLock.
  try { Get-NetTCPConnection -LocalPort $p -ErrorAction Stop | Select-Object -First 1 }
  catch { $null }
}

function Owns-InjectorLock($Owner, [string]$InjectorPath) {
  if (-not $Owner) { return $false }
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($Owner.OwningProcess)" -ErrorAction SilentlyContinue
  return $proc -and $proc.Name -ieq 'node.exe' -and $proc.CommandLine -match [regex]::Escape($InjectorPath)
}

$exe = Find-ZCode
if (-not $exe -and (Get-Command Select-RtlExecutable -ErrorAction SilentlyContinue)) {
  $exe = Select-RtlExecutable 'zcode' 'ZCode' 'ZCode.exe'
}
if (-not $exe) {
  Say 'ZCode.exe was not found. Install ZCode or choose its executable when prompted.' 16
  exit 1
}
if ($Discover) {
  # Codepage-proof handoff; see apps/Qoder/start.ps1 for the rationale.
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($exe))
  Write-Output "RTL_DISCOVER_B64:$b64"
  Say "resolved: $exe"
  exit 0
}

try {
  if (Get-Command Get-RtlNodePath -ErrorAction SilentlyContinue) {
    $nodePath = Get-RtlNodePath $Dir
  } else {
    $node = Get-Command node -ErrorAction Stop
    $nodeVersion = [version]((node --version) -replace '^v', '')
    if ($nodeVersion.Major -lt 21) { throw 'Node.js 21 or newer is required.' }
    $nodePath = $node.Source
  }
} catch {
  Say $_.Exception.Message 16
  exit 1
}

$injector = Join-Path $Dir 'injector.mjs'
$main = Get-CimInstance Win32_Process -Filter "Name='ZCode.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -notmatch '--type=' -and $_.ExecutablePath -ieq $exe } |
  Select-Object -First 1
$owner = PortOwner
$info = Get-CdpInfo

if ($owner) {
  $ownerProcess = Get-Process -Id $owner.OwningProcess -ErrorAction SilentlyContinue
  if (-not $ownerProcess -or $ownerProcess.Path -ine $exe -or -not $info) {
    Say "Port $Port is already used by another program. Close it or set ZCODE_RTL_PORT to another port." 16
    exit 1
  }
  if (-not $main) {
    Say "Port $Port is open, but ZCode could not be identified. Close the conflicting process and try again." 16
    exit 1
  }
  $lockOwner = PortOwner ($Port + 1)
  if (Owns-InjectorLock $lockOwner $injector) {
    Say "ZCode RTL is already active on port $Port."
    exit 0
  }
  if ($lockOwner) {
    Say "Port $($Port + 1) is already used by another program. Close it or set ZCODE_RTL_PORT to a different port." 16
    exit 1
  }
} elseif ($main) {
  if ($main.CommandLine -match [regex]::Escape("--remote-debugging-port=$Port")) {
    # Mid-startup from an earlier RTL launch (its DevTools port opens late);
    # wait for it instead of demanding a full quit.
    Say "ZCode is already starting with its RTL port $Port - waiting for it to open."
    for ($i = 0; $i -lt 60; $i++) {
      Start-Sleep -Milliseconds 500
      $info = Get-CdpInfo
      if ($info) { break }
    }
    if (-not $info) {
      Say "ZCode did not open its RTL port $Port. Fully quit it, including the tray, then start it again with the ZCode RTL shortcut." 48
      exit 1
    }
  } else {
    Say "ZCode is already running without the DevTools port. Fully quit it, including the tray, then start it with the ZCode RTL shortcut." 48
    exit 1
  }
} else {
  Say "starting ZCode with --remote-debugging-port=$Port"
  $launchArgs = "--remote-debugging-port=$Port"
  if ($env:VIBEHUB_PROJECT) { $launchArgs += ' "' + ($env:VIBEHUB_PROJECT.TrimEnd('\') + '\.') + '"' }
  Start-Process -FilePath $exe -ArgumentList $launchArgs | Out-Null
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    $info = Get-CdpInfo
    if ($info) { break }
  }
  if (-not $info) {
    Say "ZCode started but did not open its DevTools port $Port. This build may not support runtime RTL injection." 16
    exit 1
  }
}

$out = Join-Path $env:TEMP 'zcode-rtl-injector.out.log'
$err = Join-Path $env:TEMP 'zcode-rtl-injector.err.log'
Start-Process -FilePath $nodePath -ArgumentList ('"' + $injector + '"') -WorkingDirectory $Dir -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err | Out-Null
$injectorReady = $false
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Milliseconds 250
  if (Owns-InjectorLock (PortOwner ($Port + 1)) $injector) { $injectorReady = $true; break }
}
if (-not $injectorReady) {
  Say "The RTL injector did not start. See $err and $out for details, then try again." 16
  exit 1
}
Say "ZCode RTL is active on port $Port."
