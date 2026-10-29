$ErrorActionPreference = 'Stop'

$version = '24.22.1'
$archiveName = "node-v$version-win-x64.zip"
$archiveHash = 'D2046D28C2C3DCD211AC5145C0BF30E2047EF9DFB306693C8C6E2ECCD8B95FA5'
$nodeHash = 'D702DAA815EABBFF763C7D3808E235CF031CF2CA70211B56847BC72F51E240E5'
$root = Split-Path -Parent $PSScriptRoot
$payload = Join-Path $root 'apps\desktop\src-tauri\windows\payload'
$temp = Join-Path ([IO.Path]::GetTempPath()) ("vibehub-node-" + [Guid]::NewGuid().ToString('N'))
$archive = Join-Path $temp $archiveName

try {
  [IO.Directory]::CreateDirectory($payload) | Out-Null
  [IO.Directory]::CreateDirectory($temp) | Out-Null
  Invoke-WebRequest -Uri "https://nodejs.org/download/release/v$version/$archiveName" -OutFile $archive -TimeoutSec 180
  if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $archiveHash) {
    throw 'Node.js archive SHA-256 mismatch.'
  }
  Expand-Archive -LiteralPath $archive -DestinationPath $temp
  $nodeSource = Join-Path $temp "node-v$version-win-x64\node.exe"
  if ((Get-FileHash -LiteralPath $nodeSource -Algorithm SHA256).Hash -ne $nodeHash) {
    throw 'Node.js executable SHA-256 mismatch.'
  }
  Copy-Item -LiteralPath $nodeSource -Destination (Join-Path $payload 'node.exe') -Force
  Copy-Item -LiteralPath (Join-Path (Split-Path -Parent $nodeSource) 'LICENSE') -Destination (Join-Path $payload 'NODE-LICENSE.md') -Force

  $files = @{
    ZCode = @('rtl.ico', 'start.ps1', 'launch.vbs', 'injector.mjs')
    Qoder = @('rtl.ico', 'start.ps1', 'launch.vbs', 'injector.mjs', 'style.mjs', 'doctor.mjs', 'LICENSE')
    Antigravity = @('rtl.ico', 'start.ps1', 'launch.vbs', 'injector.mjs', 'style.mjs')
    DeepSeekHarness = @('rtl.ico', 'start.ps1', 'launch.vbs', 'injector.mjs')
  }
  foreach ($id in $files.Keys) {
    $destination = Join-Path $payload $id
    if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Recurse -Force }
    [IO.Directory]::CreateDirectory($destination) | Out-Null
    foreach ($file in $files[$id]) {
      Copy-Item -LiteralPath (Join-Path $root "apps\$id\$file") -Destination $destination
    }
    if ($id -in @('Qoder', 'DeepSeekHarness')) {
      Copy-Item -LiteralPath (Join-Path $root "apps\$id\assets") -Destination $destination -Recurse
    }
  }
  Copy-Item -LiteralPath (Join-Path $root 'apps\rtl-paths.ps1') -Destination (Join-Path $payload 'rtl-paths.ps1') -Force
  Copy-Item -LiteralPath (Join-Path $root 'apps\rtl-direction.mjs') -Destination (Join-Path $payload 'rtl-direction.mjs') -Force
  Copy-Item -LiteralPath (Join-Path $root 'apps\migrate-agentrtl-paths.ps1') -Destination (Join-Path $payload 'migrate-agentrtl-paths.ps1') -Force
  Copy-Item -LiteralPath (Join-Path $root 'cleanup.ps1') -Destination (Join-Path $payload 'cleanup.ps1') -Force
  Copy-Item -LiteralPath (Join-Path $root 'LICENSE') -Destination (Join-Path $payload 'LICENSE') -Force
  Copy-Item -LiteralPath (Join-Path $root 'docs\legal\THIRD_PARTY_LICENSES.md') -Destination (Join-Path $payload 'THIRD_PARTY_LICENSES.md') -Force
  Write-Output "Prepared Node.js v$version and RTL payloads at $payload"
} finally {
  if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
}
