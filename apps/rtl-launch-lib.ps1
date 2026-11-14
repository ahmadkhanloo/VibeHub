# Shared RTL launcher primitives used by every apps/<App>/start.ps1.
# Dot-source next to rtl-paths.ps1: . (Join-Path $Dir '..\rtl-launch-lib.ps1')

function Get-RtlPortOwner([int]$p) {
  # No -State Listen filter: on recent Windows builds a loopback-only listener
  # (our node injector lock) reports a Bound state, so filtering by state would
  # never match it. Ownership is verified separately by Test-RtlInjectorLock.
  try { Get-NetTCPConnection -LocalPort $p -ErrorAction Stop | Select-Object -First 1 }
  catch { $null }
}

function Test-RtlInjectorLock($Owner, [string]$InjectorPath) {
  if (-not $Owner) { return $false }
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($Owner.OwningProcess)" -ErrorAction SilentlyContinue
  return $proc -and $proc.Name -ieq 'node.exe' -and $proc.CommandLine -match [regex]::Escape($InjectorPath)
}

function Get-RtlCdpInfo([int]$port) {
  try { Invoke-RestMethod "http://127.0.0.1:$port/json/version" -TimeoutSec 2 }
  catch { $null }
}

function Resolve-RtlProxy([string]$explicitProxy, [string]$inheritedProxy) {
  $value = if ($explicitProxy) { $explicitProxy } else { $inheritedProxy }
  if (-not $value) { return '' }
  $proxyAddress = $null
  if (-not [Uri]::TryCreate($value, [UriKind]::Absolute, [ref]$proxyAddress) -or $proxyAddress.Scheme -notin @('http','socks5','socks5h') -or -not $proxyAddress.Host -or $proxyAddress.UserInfo) { throw 'Use an HTTP or SOCKS5 proxy without embedded credentials.' }
  return $value
}

function ConvertTo-RtlDiscoverLine([string]$path) {
  # Codepage-proof handoff: base64(UTF-8) survives consoles whose codepage
  # cannot represent characters in the path (e.g. Persian user folders).
  'RTL_DISCOVER_B64:' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($path))
}

# Starts the node injector hidden and returns $true only once it owns its lock
# port (CDP port + 1). All launchers waited the same 20 x 250ms before this.
function Start-RtlInjector([int]$lockPort, [string]$nodePath, [string]$injectorPath, [string]$outLog, [string]$errLog) {
  Start-Process -FilePath $nodePath -ArgumentList ('"' + $injectorPath + '"') -WorkingDirectory (Split-Path -Parent $injectorPath) -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errLog | Out-Null
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 250
    if (Test-RtlInjectorLock (Get-RtlPortOwner $lockPort) $injectorPath) { return $true }
  }
  return $false
}
