param([switch]$Gui, [switch]$Discover, [string]$ProxyUrl)
try {
$ErrorActionPreference = 'Stop'
$Dir = Split-Path -Parent $PSCommandPath
. (Join-Path $Dir '..\rtl-paths.ps1')
$Port = if ($env:ANTIGRAVITY_RTL_PORT) { [int]$env:ANTIGRAVITY_RTL_PORT } else { 9231 }
if ($Port -lt 1024 -or $Port -gt 65534) { throw 'Invalid Antigravity RTL port.' }
$exe = Get-RtlExecutable 'antigravity' $Dir
if (-not $exe -and -not $Discover) { $exe = Select-RtlExecutable 'antigravity' 'Antigravity' 'Antigravity.exe' }
if (-not $exe) { throw 'Antigravity.exe was not found. Install standalone Antigravity or select its executable.' }
if ($Discover) { 'RTL_DISCOVER_B64:' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($exe)); exit 0 }
function Resolve-AntigravityProxy([string]$explicitProxy, [string]$inheritedProxy) {
  $value = if ($explicitProxy) { $explicitProxy } else { $inheritedProxy }
  if (-not $value) { return '' }
  $proxyAddress = $null
  if (-not [Uri]::TryCreate($value, [UriKind]::Absolute, [ref]$proxyAddress) -or $proxyAddress.Scheme -notin @('http','socks5','socks5h') -or -not $proxyAddress.Host -or $proxyAddress.UserInfo) { throw 'Use an HTTP or SOCKS5 proxy without embedded credentials.' }
  return $value
}
$ProxyUrl = Resolve-AntigravityProxy $ProxyUrl $env:HTTPS_PROXY
function PortOwner([int]$p) {
  Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
}
function OwnsInjector($owner, [string]$path) {
  if (-not $owner) { return $false }
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($owner.OwningProcess)" -ErrorAction SilentlyContinue
  $proc -and $proc.Name -ieq 'node.exe' -and $proc.CommandLine -match [regex]::Escape($path)
}
$injector = Join-Path $Dir 'injector.mjs'
$owner = PortOwner $Port
$lockOwner = PortOwner ($Port + 1)
if ($lockOwner -and -not (OwnsInjector $lockOwner $injector)) { throw "Port $($Port + 1) belongs to another program." }
if ($owner) {
  $hostProcess = Get-Process -Id $owner.OwningProcess -ErrorAction Stop
  if ($hostProcess.Path -ine $exe) { throw "Port $Port belongs to another program." }
} else {
  $running = Get-CimInstance Win32_Process -Filter "Name='Antigravity.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -ieq $exe -and $_.CommandLine -notmatch '--type=' }
  if ($running) { throw 'Antigravity is already open without the RTL port. Fully quit it, including the tray, and start Antigravity RTL.' }
  $launchArgs = "--remote-debugging-address=127.0.0.1 --remote-debugging-port=$Port"
  if ($ProxyUrl) { $launchArgs += ' --proxy-server=' + ($ProxyUrl -replace '^socks5h://','socks5://') }
  if ($env:VIBEHUB_PROJECT) { $launchArgs += ' "' + ($env:VIBEHUB_PROJECT.TrimEnd('\') + '\.') + '"' }
  Start-Process -FilePath $exe -ArgumentList $launchArgs -WindowStyle Hidden | Out-Null
  for ($i=0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 250
    $owner = PortOwner $Port
    if ($owner) { break }
  }
  if (-not $owner -or (Get-Process -Id $owner.OwningProcess -ErrorAction Stop).Path -ine $exe) { throw 'Antigravity did not expose its own RTL debugging port.' }
}
$null = Invoke-RestMethod "http://127.0.0.1:$Port/json/version" -TimeoutSec 2
if (-not (OwnsInjector $lockOwner $injector)) {
  $node = Get-RtlNodePath $Dir
  Start-Process -FilePath $node -ArgumentList ('"' + $injector + '"') -WorkingDirectory $Dir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $env:TEMP 'antigravity-rtl.out.log') -RedirectStandardError (Join-Path $env:TEMP 'antigravity-rtl.err.log') | Out-Null
  for ($i=0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 250
    if (OwnsInjector (PortOwner ($Port + 1)) $injector) { break }
  }
  if (-not (OwnsInjector (PortOwner ($Port + 1)) $injector)) { throw 'Antigravity RTL injector did not start.' }
}
Write-Output 'Antigravity RTL injector is running; chat rendering requires a loaded application page.'

} catch {
  Add-Content -LiteralPath (Join-Path $env:TEMP 'antigravity-rtl.launch.log') -Value $_.Exception.Message -ErrorAction SilentlyContinue
  if ($Gui) {
    $shell = New-Object -ComObject WScript.Shell
    $null = $shell.Popup($_.Exception.Message, 12, 'Antigravity RTL', 16)
  }
  throw
}
