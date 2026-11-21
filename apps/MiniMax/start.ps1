param([switch]$Gui, [switch]$Discover, [string]$ProxyUrl)
try {
$ErrorActionPreference = 'Stop'
$Dir = Split-Path -Parent $PSCommandPath
. (Join-Path $Dir '..\rtl-paths.ps1')
. (Join-Path $Dir '..\rtl-launch-lib.ps1')
$Port = if ($env:MINIMAX_RTL_PORT) { [int]$env:MINIMAX_RTL_PORT } else { 9240 }
if ($Port -lt 1024 -or $Port -gt 65534) { throw 'Invalid MiniMax Code RTL port.' }
$exe = Get-RtlExecutable 'minimax-code' $Dir
if (-not $exe -and -not $Discover) { $exe = Select-RtlExecutable 'minimax-code' 'MiniMax Code' 'MiniMax Code.exe' }
if (-not $exe) { throw 'MiniMax Code.exe was not found. Install MiniMax Code or select its executable.' }
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
  $running = Get-CimInstance Win32_Process -Filter "Name='MiniMax Code.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -ieq $exe -and $_.CommandLine -notmatch '--type=' }
  if ($running) { throw 'MiniMax Code is already open without the RTL port. Fully quit it, including the tray, and start MiniMax Code RTL.' }
  $launchArgs = "--remote-debugging-address=127.0.0.1 --remote-debugging-port=$Port"
  if ($ProxyUrl) { $launchArgs += ' --proxy-server=' + ($ProxyUrl -replace '^socks5h://','socks5://') }
  Start-Process -FilePath $exe -ArgumentList $launchArgs -WindowStyle Normal | Out-Null
  for ($i=0; $i -lt 120; $i++) {
    Start-Sleep -Milliseconds 250
    $owner = Get-RtlPortOwner $Port
    if ($owner) { break }
  }
  if (-not $owner -or (Get-Process -Id $owner.OwningProcess -ErrorAction Stop).Path -ine $exe) { throw 'MiniMax Code did not expose its own RTL debugging port.' }
}
if (-not (Get-RtlCdpInfo $Port)) { throw 'MiniMax Code did not expose its own RTL debugging port.' }
if (-not (Test-RtlInjectorLock $lockOwner $injector)) {
  $node = Get-RtlNodePath $Dir
  if (-not (Start-RtlInjector ($Port + 1) $node $injector (Join-Path $env:TEMP 'minimax-code-rtl.out.log') (Join-Path $env:TEMP 'minimax-code-rtl.err.log'))) { throw 'MiniMax Code RTL injector did not start.' }
}
Write-Output 'MiniMax Code RTL injector is running; chat rendering requires a loaded application page.'

} catch {
  Add-Content -LiteralPath (Join-Path $env:TEMP 'minimax-code-rtl.launch.log') -Value $_.Exception.Message -ErrorAction SilentlyContinue
  if ($Gui) {
    $shell = New-Object -ComObject WScript.Shell
    $null = $shell.Popup($_.Exception.Message, 12, 'MiniMax Code RTL', 16)
  }
  throw
}
