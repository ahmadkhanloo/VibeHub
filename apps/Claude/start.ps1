param([switch]$Gui, [switch]$Discover, [string]$ProxyUrl)
try {
  $ErrorActionPreference = 'Stop'
  $Dir = Split-Path -Parent $PSCommandPath
  . (Join-Path $Dir '..\rtl-paths.ps1')
  . (Join-Path $Dir '..\rtl-launch-lib.ps1')
  $compatibility = Get-Content -LiteralPath (Join-Path $Dir 'compatibility.json') -Raw | ConvertFrom-Json
  if (-not $compatibility.testedVersion -or $compatibility.adapterVerified -ne $true) { throw [string]$compatibility.reason }
  $exe = Get-RtlExecutable 'claude-desktop' $Dir
  if (-not $exe -and -not $Discover) { $exe = Select-RtlExecutable 'claude-desktop' 'Claude Desktop' 'Claude.exe' }
  if (-not $exe) { throw 'Claude.exe was not found. Install Claude Desktop from claude.com/download.' }
  if ($Discover) { ConvertTo-RtlDiscoverLine $exe; exit 0 }
  $signature = Get-AuthenticodeSignature -FilePath $exe
  if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Anthropic') {
    throw 'Claude Desktop RTL requires a valid Anthropic-signed Claude.exe.'
  }
  $observedVersion = [string](Get-Item -LiteralPath $exe).VersionInfo.ProductVersion
  if ($observedVersion -cne [string]$compatibility.testedVersion) {
    throw "Claude Desktop RTL was verified for '$($compatibility.testedVersion)', but the installed app reports '$observedVersion'."
  }

  $Port = if ($env:CLAUDE_RTL_PORT) { [int]$env:CLAUDE_RTL_PORT } else { 9237 }
  if ($Port -lt 1024 -or $Port -gt 65534) { throw 'Invalid Claude Desktop RTL port.' }
  $ProxyUrl = Resolve-RtlProxy $ProxyUrl $env:HTTPS_PROXY
  $injector = Join-Path $Dir 'injector.mjs'
  $owner = Get-RtlPortOwner $Port
  $lockOwner = Get-RtlPortOwner ($Port + 1)
  if ($lockOwner -and -not (Test-RtlInjectorLock $lockOwner $injector)) { throw "Port $($Port + 1) belongs to another program." }
  if ($owner) {
    $hostProcess = Get-Process -Id $owner.OwningProcess -ErrorAction Stop
    if ($hostProcess.Path -ine $exe) { throw "Port $Port belongs to another program." }
  } else {
    $running = Get-CimInstance Win32_Process -Filter "Name='Claude.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.ExecutablePath -ieq $exe -and $_.CommandLine -notmatch '--type=' }
    if ($running) { throw 'Claude Desktop is already open without the RTL port. Fully quit it, including the tray, and start Claude Desktop RTL.' }
    $launchArgs = "--remote-debugging-address=127.0.0.1 --remote-debugging-port=$Port"
    if ($ProxyUrl) { $launchArgs += ' --proxy-server=' + ($ProxyUrl -replace '^socks5h://','socks5://') }
    Start-Process -FilePath $exe -ArgumentList $launchArgs -WindowStyle Normal | Out-Null
    for ($i=0; $i -lt 40; $i++) {
      Start-Sleep -Milliseconds 250
      $owner = Get-RtlPortOwner $Port
      if ($owner) { break }
    }
    if (-not $owner -or (Get-Process -Id $owner.OwningProcess -ErrorAction Stop).Path -ine $exe) { throw 'Claude Desktop did not expose its own RTL debugging port.' }
  }
  if (-not (Get-RtlCdpInfo $Port)) { throw 'Claude Desktop did not expose its own RTL debugging port.' }
  if (-not (Test-RtlInjectorLock $lockOwner $injector)) {
    $node = Get-RtlNodePath $Dir
    if (-not (Start-RtlInjector ($Port + 1) $node $injector (Join-Path $env:TEMP 'claude-desktop-rtl.out.log') (Join-Path $env:TEMP 'claude-desktop-rtl.err.log'))) { throw 'Claude Desktop RTL injector did not start.' }
  }
  Write-Output 'Claude Desktop RTL injector is running.'
} catch {
  Add-Content -LiteralPath (Join-Path $env:TEMP 'claude-desktop-rtl.launch.log') -Value $_.Exception.Message -ErrorAction SilentlyContinue
  if ($Gui) {
    $shell = New-Object -ComObject WScript.Shell
    $null = $shell.Popup($_.Exception.Message, 12, 'Claude Desktop RTL', 16)
  }
  throw
}
