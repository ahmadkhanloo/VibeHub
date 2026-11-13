param([switch]$Gui, [switch]$Discover, [string]$ProxyUrl)
try {
  $ErrorActionPreference = 'Stop'
  $Dir = Split-Path -Parent $PSCommandPath
  . (Join-Path $Dir '..\rtl-paths.ps1')
  $compatibility = Get-Content -LiteralPath (Join-Path $Dir 'compatibility.json') -Raw | ConvertFrom-Json
  if (-not $compatibility.testedVersion -or $compatibility.adapterVerified -ne $true) { throw [string]$compatibility.reason }
  $exe = Get-RtlExecutable 'claude-desktop' $Dir
  if (-not $exe -and -not $Discover) { $exe = Select-RtlExecutable 'claude-desktop' 'Claude Desktop' 'Claude.exe' }
  if (-not $exe) { throw 'Claude.exe was not found. Install Claude Desktop from claude.com/download.' }
  if ($Discover) { 'RTL_DISCOVER_B64:' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($exe)); exit 0 }
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
  # No -State Listen filter: on recent Windows builds a loopback-only listener
  # (our node injector lock) reports a Bound state, so filtering by state would
  # never match it. Ownership is verified separately in OwnsInjector.
  function PortOwner([int]$p) { Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue | Select-Object -First 1 }
  function OwnsInjector($owner, [string]$path) {
    if (-not $owner) { return $false }
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($owner.OwningProcess)" -ErrorAction SilentlyContinue
    $proc -and $proc.Name -ieq 'node.exe' -and $proc.CommandLine -match [regex]::Escape($path)
  }
  function Resolve-ClaudeProxy([string]$explicitProxy, [string]$inheritedProxy) {
    $value = if ($explicitProxy) { $explicitProxy } else { $inheritedProxy }
    if (-not $value) { return '' }
    $address = $null
    if (-not [Uri]::TryCreate($value, [UriKind]::Absolute, [ref]$address) -or $address.Scheme -notin @('http','socks5','socks5h') -or -not $address.Host -or $address.UserInfo) { throw 'Use an HTTP or SOCKS5 proxy without embedded credentials.' }
    return $value
  }
  $ProxyUrl = Resolve-ClaudeProxy $ProxyUrl $env:HTTPS_PROXY
  $injector = Join-Path $Dir 'injector.mjs'
  $owner = PortOwner $Port
  $lockOwner = PortOwner ($Port + 1)
  if ($lockOwner -and -not (OwnsInjector $lockOwner $injector)) { throw "Port $($Port + 1) belongs to another program." }
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
      $owner = PortOwner $Port
      if ($owner) { break }
    }
    if (-not $owner -or (Get-Process -Id $owner.OwningProcess -ErrorAction Stop).Path -ine $exe) { throw 'Claude Desktop did not expose its own RTL debugging port.' }
  }
  $null = Invoke-RestMethod "http://127.0.0.1:$Port/json/version" -TimeoutSec 2
  if (-not (OwnsInjector $lockOwner $injector)) {
    $node = Get-RtlNodePath $Dir
    Start-Process -FilePath $node -ArgumentList ('"' + $injector + '"') -WorkingDirectory $Dir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $env:TEMP 'claude-desktop-rtl.out.log') -RedirectStandardError (Join-Path $env:TEMP 'claude-desktop-rtl.err.log') | Out-Null
    for ($i=0; $i -lt 20; $i++) {
      Start-Sleep -Milliseconds 250
      if (OwnsInjector (PortOwner ($Port + 1)) $injector) { break }
    }
    if (-not (OwnsInjector (PortOwner ($Port + 1)) $injector)) { throw 'Claude Desktop RTL injector did not start.' }
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
