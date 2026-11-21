param([switch]$Gui, [switch]$Discover, [string]$ProxyUrl)
try {
$ErrorActionPreference = 'Stop'
$Dir = Split-Path -Parent $PSCommandPath
. (Join-Path $Dir '..\rtl-paths.ps1')
. (Join-Path $Dir '..\rtl-launch-lib.ps1')
$Port = if ($env:OPENCODE_RTL_PORT) { [int]$env:OPENCODE_RTL_PORT } else { 9234 }
if ($Port -lt 1024 -or $Port -gt 65534) { throw 'Invalid OpenCode RTL port.' }
$exe = Get-RtlExecutable 'opencode' $Dir
if (-not $exe -and -not $Discover) { $exe = Select-RtlExecutable 'opencode' 'OpenCode' 'OpenCode.exe' }
if (-not $exe) { throw 'OpenCode.exe was not found. Install standalone OpenCode or select its executable.' }
if ($Discover) { ConvertTo-RtlDiscoverLine $exe; exit 0 }
$ProxyUrl = Resolve-RtlProxy $ProxyUrl $env:HTTPS_PROXY
$injector = Join-Path $Dir 'injector.mjs'
$owner = Get-RtlPortOwner $Port
$lockOwner = Get-RtlPortOwner ($Port + 1)
if ($lockOwner -and -not (Test-RtlInjectorLock $lockOwner $injector)) { throw "Port $($Port + 1) belongs to another program." }
if ($owner) {
  $hostProcess = Get-Process -Id $owner.OwningProcess -ErrorAction Stop
  if ($hostProcess.Path -ine $exe) { throw "Port $Port belongs to another program." }
} else {
  $running = Get-CimInstance Win32_Process -Filter "Name='OpenCode.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -ieq $exe -and $_.CommandLine -notmatch '--type=' }
  if ($running) { throw 'OpenCode is already open without the RTL port. Fully quit it, including the tray, and start OpenCode RTL.' }
  $launchArgs = "--remote-debugging-address=127.0.0.1 --remote-debugging-port=$Port"
  if ($ProxyUrl) { $launchArgs += ' --proxy-server=' + ($ProxyUrl -replace '^socks5h://','socks5://') }
  if ($env:VIBEHUB_PROJECT) { $launchArgs += ' "' + ($env:VIBEHUB_PROJECT.TrimEnd('\') + '\.') + '"' }
  Start-Process -FilePath $exe -ArgumentList $launchArgs -WindowStyle Hidden | Out-Null
  for ($i=0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 250
    $owner = Get-RtlPortOwner $Port
    if ($owner) { break }
  }
  if (-not $owner -or (Get-Process -Id $owner.OwningProcess -ErrorAction Stop).Path -ine $exe) { throw 'OpenCode did not expose its own RTL debugging port.' }
}
if (-not (Get-RtlCdpInfo $Port)) { throw 'OpenCode did not expose its own RTL debugging port.' }
if (-not (Test-RtlInjectorLock $lockOwner $injector)) {
  $node = Get-RtlNodePath $Dir
  if (-not (Start-RtlInjector ($Port + 1) $node $injector (Join-Path $env:TEMP 'opencode-rtl.out.log') (Join-Path $env:TEMP 'opencode-rtl.err.log'))) { throw 'OpenCode RTL injector did not start.' }
}
Write-Output 'OpenCode RTL injector is running; chat rendering requires a loaded application page.'

} catch {
  Add-Content -LiteralPath (Join-Path $env:TEMP 'opencode-rtl.launch.log') -Value $_.Exception.Message -ErrorAction SilentlyContinue
  if ($Gui) {
    $shell = New-Object -ComObject WScript.Shell
    $null = $shell.Popup($_.Exception.Message, 12, 'OpenCode RTL', 16)
  }
  throw
}
