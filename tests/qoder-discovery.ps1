$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourceLauncher = Join-Path $repoRoot 'apps\Qoder\start.ps1'
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ('agentrtl-qoder-discovery-' + [guid]::NewGuid().ToString('N'))
$launcherDir = Join-Path $tempRoot 'launcher'
$launcher = Join-Path $launcherDir 'start.ps1'
$originalLocalAppData = $env:LOCALAPPDATA
$originalOverride = $env:QODER_RTL_EXE
$assertions = 0

function Assert-Equal([string]$Expected, [string]$Actual, [string]$Case) {
  if ($Expected -ine $Actual) { throw "$Case`: expected '$Expected', got '$Actual'" }
  $script:assertions++
  Write-Host "PASS $Case"
}

function Add-QoderInstall([string]$Base, [string]$ExeName, [string]$Version = '') {
  $installDir = if ($Version) { Join-Path (Join-Path $Base '.qoder-versions') $Version } else { $Base }
  $resources = Join-Path $installDir 'resources'
  New-Item -ItemType Directory -Path $resources -Force | Out-Null
  New-Item -ItemType File -Path (Join-Path $resources 'app.asar') -Force | Out-Null
  New-Item -ItemType File -Path (Join-Path $installDir $ExeName) -Force | Out-Null
  Join-Path $installDir $ExeName
}

function Invoke-Discover([string]$LocalAppData, [string]$Override = '', [string]$RunningExe = '') {
  $shim = Join-Path $tempRoot 'discover.ps1'
  $shimSource = @"
function Get-CimInstance {
  param([string]`$ClassName, [string]`$Filter, [string]`$ErrorAction)
  if (`$Filter -eq "Name='Qoder.exe' OR Name='Qoder IDE.exe'" -and '$RunningExe') {
    return [pscustomobject]@{ CommandLine = '"$RunningExe"'; ExecutablePath = '$RunningExe'; Name = [IO.Path]::GetFileName('$RunningExe') }
  }
  return `$null
}
`$env:LOCALAPPDATA = '$LocalAppData'
`$env:QODER_RTL_EXE = '$Override'
& '$launcher' -Discover
"@
  Set-Content -LiteralPath $shim -Value $shimSource -Encoding UTF8
  $powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
  $output = @(& $powershell -NoProfile -ExecutionPolicy Bypass -File $shim 2>&1)
  if ($LASTEXITCODE -ne 0) { throw "Discovery failed: $($output -join "`n")" }
  $raw = @($output | Where-Object { $_ -match '^[A-Za-z]:\\' } | Select-Object -Last 1)[0]
  $b64Line = @($output | Where-Object { $_ -match '^RTL_DISCOVER_B64:' } | Select-Object -Last 1)
  $decoded = ''
  if ($b64Line.Count) {
    $decoded = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($b64Line[0] -replace '^RTL_DISCOVER_B64:', '')))
  }
  [pscustomobject]@{ Raw = $raw; B64 = $decoded }
}

try {
  New-Item -ItemType Directory -Path $launcherDir -Force | Out-Null
  Copy-Item -LiteralPath $sourceLauncher -Destination $launcher

  $newRoot = Join-Path $tempRoot 'new-install'
  $newExe = Add-QoderInstall (Join-Path $newRoot 'Programs\Qoder IDE') 'Qoder IDE.exe'
  Assert-Equal $newExe (Invoke-Discover $newRoot).B64 'detect Qoder IDE standard install'

  $oldRoot = Join-Path $tempRoot 'old-install'
  $oldExe = Add-QoderInstall (Join-Path $oldRoot 'Programs\Qoder') 'Qoder.exe'
  Assert-Equal $oldExe (Invoke-Discover $oldRoot).B64 'detect legacy Qoder standard install'

  $versionedRoot = Join-Path $tempRoot 'versioned-install'
  $versionedExe = Add-QoderInstall (Join-Path $versionedRoot 'Programs\Qoder IDE') 'Qoder IDE.exe' '1.25.1'
  Assert-Equal $versionedExe (Invoke-Discover $versionedRoot).B64 'detect versioned Qoder IDE install'

  $runningRoot = Join-Path $tempRoot 'running-install'
  $runningExe = Add-QoderInstall (Join-Path $runningRoot 'custom-location') 'Qoder IDE.exe'
  Assert-Equal $runningExe (Invoke-Discover (Join-Path $tempRoot 'empty-local-appdata') '' $runningExe).B64 'detect running Qoder IDE outside standard paths'

  $customFolder = Join-Path $tempRoot ('custom-' + [char]0x06A9)
  $customExe = Add-QoderInstall $customFolder 'Qoder IDE.exe'
  [IO.File]::WriteAllText((Join-Path $launcherDir 'qoder-path.txt'), $customExe, [Text.UTF8Encoding]::new($false))
  # Regression (Gate 0 defect D1): a legacy console codepage (here IBM437)
  # corrupts the raw Persian character to '?', but the base64 handoff must
  # still return the exact path install.ps1 would consume.
  $prevEncoding = [Console]::OutputEncoding
  [Console]::OutputEncoding = [Text.Encoding]::GetEncoding(437)
  try {
    $legacyResult = Invoke-Discover $newRoot
    Assert-Equal $customExe $legacyResult.B64 'b64 handoff exact for non-ASCII path on legacy codepage'
    if ($legacyResult.Raw -eq $customExe) {
      throw 'raw handoff unexpectedly survived codepage 437; the b64 corruption scenario is no longer exercised'
    }
  } finally {
    [Console]::OutputEncoding = $prevEncoding
  }
  Assert-Equal $customExe (Invoke-Discover $newRoot).B64 'prefer saved custom path'

  [IO.File]::WriteAllText((Join-Path $launcherDir 'qoder-path.txt'), (Join-Path $tempRoot 'missing\Qoder IDE.exe'), [Text.UTF8Encoding]::new($false))
  Assert-Equal $newExe (Invoke-Discover $newRoot).B64 'fall back when saved path becomes stale'

  $envExe = Add-QoderInstall (Join-Path $tempRoot 'environment\Qoder') 'Qoder.exe'
  Assert-Equal $envExe (Invoke-Discover $newRoot $envExe).B64 'environment override has highest priority'

  Write-Host "Passed $assertions Qoder discovery assertions."
} finally {
  if ($null -eq $originalLocalAppData) { Remove-Item Env:LOCALAPPDATA -ErrorAction SilentlyContinue }
  else { $env:LOCALAPPDATA = $originalLocalAppData }
  if ($null -eq $originalOverride) { Remove-Item Env:QODER_RTL_EXE -ErrorAction SilentlyContinue }
  else { $env:QODER_RTL_EXE = $originalOverride }
  Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
