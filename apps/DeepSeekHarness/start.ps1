param([switch]$Gui, [switch]$Discover)

$ErrorActionPreference = 'Stop'
$Port = if ($env:DEEPSEEK_HARNESS_RTL_PORT) { [int]$env:DEEPSEEK_HARNESS_RTL_PORT } else { 9228 }
$Dir = Split-Path -Parent $PSCommandPath
$RtlHelpers = Join-Path $Dir '..\rtl-paths.ps1'
if (Test-Path -LiteralPath $RtlHelpers) { . $RtlHelpers }
$Log = Join-Path $env:TEMP 'deepseek-harness-rtl.log'

function Say([string]$Message, [int]$Icon = 0) {
  Add-Content -Path $Log -Value "[deepseek-harness-rtl] $((Get-Date -Format 'HH:mm:ss')) $Message" -ErrorAction SilentlyContinue
  if ($Gui) {
    if ($Icon -ne 0) {
      $shell = New-Object -ComObject WScript.Shell
      $null = $shell.Popup($Message, 0, 'DeepSeek Harness RTL', $Icon)
    }
  } else {
    Write-Host "[deepseek-harness-rtl] $Message"
  }
}

function Find-Harness { Get-RtlExecutable 'deepseek-harness' $Dir }

function Get-CdpInfo {
  try { Invoke-RestMethod "http://127.0.0.1:$Port/json/version" -TimeoutSec 2 }
  catch { $null }
}

function PortOwner([int]$p = $Port) {
  try { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction Stop | Select-Object -First 1 }
  catch { $null }
}

function Owns-InjectorLock($Owner, [string]$InjectorPath) {
  if (-not $Owner) { return $false }
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($Owner.OwningProcess)" -ErrorAction SilentlyContinue
  return $proc -and $proc.Name -ieq 'node.exe' -and $proc.CommandLine -match [regex]::Escape($InjectorPath)
}

$exe = Find-Harness
if (-not $exe -and (Get-Command Select-RtlExecutable -ErrorAction SilentlyContinue)) {
  $exe = Select-RtlExecutable 'deepseek-harness' 'DeepSeek Harness' 'DeepSeek Harness.exe'
}
if (-not $exe) {
  Say 'DeepSeek Harness was not found. Install it or choose its executable when prompted.' 16
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
$main = Get-CimInstance Win32_Process -Filter "Name='DeepSeek Harness.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -notmatch '--type=' -and $_.ExecutablePath -ieq $exe } |
  Select-Object -First 1
$owner = PortOwner
$lockOwner = PortOwner ($Port + 1)
$info = Get-CdpInfo

if ($owner) {
  $ownerProcess = Get-Process -Id $owner.OwningProcess -ErrorAction SilentlyContinue
  if (-not $ownerProcess -or $ownerProcess.Path -ine $exe -or -not $info) {
    Say "Port $Port is already used by another program. Close it or set DEEPSEEK_HARNESS_RTL_PORT to another port." 16
    exit 1
  }
  $targets = @()
  try { $targets = Invoke-RestMethod "http://127.0.0.1:$Port/json/list" -TimeoutSec 2 } catch {}
  if (-not ($targets | Where-Object { $_.url -like 'dsh-app://app/*' })) {
    Say "Port $Port is open, but it does not belong to a DeepSeek Harness window." 16
    exit 1
  }
} elseif ($main) {
  Say 'DeepSeek Harness is already running without the DevTools port. Fully quit it, including the tray, then start it with the DeepSeek Harness RTL shortcut.' 48
  exit 1
} else {
  Say "starting DeepSeek Harness with --remote-debugging-port=$Port"
  Start-Process -FilePath $exe -ArgumentList "--remote-debugging-port=$Port" | Out-Null
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Milliseconds 500
    $info = Get-CdpInfo
    if ($info) { break }
  }
  if (-not $info) {
    Say "DeepSeek Harness started but did not open DevTools port $Port. This build may not support runtime RTL injection." 16
    exit 1
  }
  $targets = @()
  try { $targets = Invoke-RestMethod "http://127.0.0.1:$Port/json/list" -TimeoutSec 2 } catch {}
  if (-not ($targets | Where-Object { $_.url -like 'dsh-app://app/*' })) {
    Say "Port $Port opened, but no DeepSeek Harness page was found." 16
    exit 1
  }
}

if ($lockOwner -and -not (Owns-InjectorLock $lockOwner $injector)) {
  Say "Port $($Port + 1) is already used by another program. Close it or set DEEPSEEK_HARNESS_RTL_PORT to a different port." 16
  exit 1
}
if (-not (Owns-InjectorLock $lockOwner $injector)) {
  $out = Join-Path $env:TEMP 'deepseek-harness-rtl-injector.out.log'
  $err = Join-Path $env:TEMP 'deepseek-harness-rtl-injector.err.log'
  Start-Process -FilePath $nodePath -ArgumentList ('"' + $injector + '"') -WorkingDirectory $Dir -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err | Out-Null
  $injectorReady = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 250
    if (Owns-InjectorLock (PortOwner ($Port + 1)) $injector) { $injectorReady = $true; break }
  }
  if (-not $injectorReady) {
    Say "The injector could not acquire port $($Port + 1). Check that port and try again." 16
    exit 1
  }
}
Say "DeepSeek Harness RTL is active on port $Port."
