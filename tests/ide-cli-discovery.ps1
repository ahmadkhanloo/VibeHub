$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$adapter=Join-Path $repo 'apps/desktop/src-tauri/src/windows.ps1'
$sandbox=Join-Path ([IO.Path]::GetTempPath()) ('vibehub-replacements-'+[guid]::NewGuid().ToString('N'))
$oldLocal=$env:LOCALAPPDATA
$oldProfile=$env:USERPROFILE
$terminalPid=$null
function Run-Adapter($request) {
  $request.resourceRoot=$repo
  $raw=($request|ConvertTo-Json -Depth 8 -Compress)|powershell.exe -NoProfile -ExecutionPolicy Bypass -File $adapter
  return (($raw|Where-Object {$_ -like 'VIBEHUB_JSON:*'}) -replace '^VIBEHUB_JSON:','')|ConvertFrom-Json
}
try {
  $env:LOCALAPPDATA=$sandbox
  $env:USERPROFILE=$sandbox
  $ideFolder=Join-Path $sandbox 'Programs/Antigravity IDE'
  New-Item -ItemType Directory -Path (Join-Path $ideFolder 'resources/app') -Force|Out-Null
  New-Item -ItemType File -Path (Join-Path $ideFolder 'Antigravity IDE.exe')|Out-Null
  Set-Content -LiteralPath (Join-Path $ideFolder 'resources/app/product.json') -Value '{"applicationName":"antigravity-ide","nameShort":"Antigravity IDE"}'
  $cliFolder=Join-Path $sandbox '.local/bin'
  New-Item -ItemType Directory -Path $cliFolder -Force|Out-Null
  New-Item -ItemType File -Path (Join-Path $cliFolder 'claude.exe')|Out-Null
  $apps=@(Run-Adapter @{operation='detect'})
  if (@($apps|Where-Object id -eq 'antigravity').Count) {throw 'Retired Antigravity entry was detected'}
  if (@($apps|Where-Object id -eq 'claude-desktop').Count -ne 1) {throw 'Claude Desktop detection result missing'}
  $result=Run-Adapter @{operation='launch';req=@{appId='claude-desktop';rtl=$true}}
  if ($result.error -notmatch 'RTL is not verified') {throw 'Unverified Claude Desktop RTL was accepted'}
  if (@($apps|Where-Object {$_.id -eq 'antigravity-ide' -and $_.installed -and $_.path -eq (Join-Path $ideFolder 'Antigravity IDE.exe')}).Count -ne 1) {throw 'IDE not identified separately'}
  if (@($apps|Where-Object {$_.id -eq 'claude-code' -and $_.installed -and $_.path -eq (Join-Path $cliFolder 'claude.exe')}).Count -ne 1) {throw 'Native Claude CLI not found'}
  $wrong=Join-Path $sandbox 'Antigravity.exe'; New-Item -ItemType File -Path $wrong|Out-Null
  $result=Run-Adapter @{operation='app-path';appId='antigravity-ide';path=$wrong}
  if (-not $result.error) {throw 'Standalone App accepted as IDE'}
  # Matching the executable name alone must not accept a renamed standalone build.
  Set-Content -LiteralPath (Join-Path $ideFolder 'resources/app/product.json') -Value '{"applicationName":"antigravity","nameShort":"Antigravity"}'
  $result=Run-Adapter @{operation='app-path';appId='antigravity-ide';path=(Join-Path $ideFolder 'Antigravity IDE.exe')}
  if (-not $result.error) {throw 'Non-IDE product metadata accepted'}
  $result=Run-Adapter @{operation='launch';req=@{appId='claude-code';rtl=$false};proxyUrl='socks5://127.0.0.1:1'}
  if ($result.error -notmatch 'HTTP|SOCKS') {throw 'Claude SOCKS profile was not rejected clearly'}
  $result=Run-Adapter @{operation='launch';req=@{appId='claude-code';rtl=$true}}
  if (-not $result.error) {throw 'Unverified CLI RTL was accepted'}
  $shimFolder=Join-Path $sandbox "custom's folder"
  New-Item -ItemType Directory -Path $shimFolder -Force|Out-Null
  $shim=Join-Path $shimFolder 'claude.cmd'
  [IO.File]::WriteAllText($shim,"@echo off`r`n(echo %HTTP_PROXY%&cd&echo args:%*) > `"%~dp0probe.txt`"`r`n")
  $null=Run-Adapter @{operation='app-path';appId='claude-code';path=$shim}
  $project=Join-Path $sandbox 'project with spaces'
  New-Item -ItemType Directory -Path $project -Force|Out-Null
  $result=Run-Adapter @{operation='launch';req=@{appId='claude-code';rtl=$false;cwd=$project};proxyUrl='http://127.0.0.1:1'}
  if (-not $result.ok -or $result.proxyRoutingVerified) {throw 'CLI launch must accept settings without claiming verified routing'}
  $terminalPid=$result.pid
  $probe=Join-Path $shimFolder 'probe.txt'
  $deadline=[DateTime]::UtcNow.AddSeconds(10)
  while (-not (Test-Path -LiteralPath $probe) -and [DateTime]::UtcNow -lt $deadline) {Start-Sleep -Milliseconds 100}
  $lines=Get-Content -LiteralPath $probe
  if ($lines[0] -ne 'http://127.0.0.1:1' -or $lines[1] -ne $project -or $lines[2] -ne 'args:') {throw 'CLI did not receive its proxy/project exactly, or received desktop-only flags'}
  Stop-Process -Id $terminalPid -Force
  $terminalPid=$null
  $npmDir=Join-Path $shimFolder 'node_modules/@anthropic-ai/claude-code'
  New-Item -ItemType Directory -Path $npmDir -Force|Out-Null
  Set-Content -LiteralPath (Join-Path $npmDir 'cli.js') -Value "require('node:fs').writeFileSync(require('node:path').join(__dirname,'probe.json'),JSON.stringify({runtime:process.version,proxy:process.env.HTTPS_PROXY,cwd:process.cwd()}));"
  $result=Run-Adapter @{operation='launch';req=@{appId='claude-code';rtl=$false;cwd=$project};proxyUrl='http://127.0.0.1:2'}
  $terminalPid=$result.pid
  $npmProbe=Join-Path $npmDir 'probe.json'
  $deadline=[DateTime]::UtcNow.AddSeconds(15)
  while (-not (Test-Path -LiteralPath $npmProbe) -and [DateTime]::UtcNow -lt $deadline) {Start-Sleep -Milliseconds 100}
  $value=Get-Content -LiteralPath $npmProbe -Raw|ConvertFrom-Json
  if ($value.proxy -ne 'http://127.0.0.1:2' -or $value.cwd -ne $project) {throw 'Private-runtime CLI launch lost its proxy/project'}
  $privateNode=Join-Path $repo 'apps/desktop/src-tauri/windows/payload/node.exe'
  if (Test-Path -LiteralPath $privateNode) {if ($value.runtime -ne (& $privateNode --version)) {throw 'npm CLI did not use the bundled runtime'}}
  'IDE/CLI replacement discovery and proxy guard passed'
} finally {
  if ($terminalPid -and $terminalPid -ne $PID) {
    $terminal=Get-Process -Id $terminalPid -ErrorAction SilentlyContinue
    if ($terminal -and $terminal.ProcessName -eq 'powershell') {Stop-Process -Id $terminalPid -Force}
  }
  $env:LOCALAPPDATA=$oldLocal; $env:USERPROFILE=$oldProfile
  $resolved=[IO.Path]::GetFullPath($sandbox)
  if ($resolved.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()),[StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolved) -like 'vibehub-replacements-*') {Remove-Item -LiteralPath $resolved -Recurse -Force}
}
