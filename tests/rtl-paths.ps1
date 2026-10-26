$ErrorActionPreference = 'Stop'
$originalLocalAppData = $env:LOCALAPPDATA
$tempRoot = Join-Path $env:TEMP ("vibehub-rtl-paths-" + [Guid]::NewGuid().ToString('N'))
$exe = Join-Path $tempRoot 'کاربر با فاصله\Qoder\Qoder IDE.exe'
$legacyExe = Join-Path $tempRoot 'کاربر دوم\برنامه‌ها\Qoder.exe'
$legacyInstallDir = Join-Path $tempRoot 'AgentRTL Legacy'
$privateRoot = $null
$privateNode = $null
$appsDir = $null
$adapterDir = $null
$runtimeDir = $null

try {
  [IO.Directory]::CreateDirectory((Split-Path -Parent $exe)) | Out-Null
  [IO.File]::WriteAllBytes($exe, [byte[]]@())
  $env:LOCALAPPDATA = $tempRoot
  . (Join-Path $PSScriptRoot '..\apps\rtl-paths.ps1')

  Save-RtlPath 'qoder' $exe
  $restored = Get-RtlSavedPath 'qoder'
  if ($restored -cne $exe) {
    throw "Unicode path did not round-trip. Expected '$exe', got '$restored'."
  }

  [IO.Directory]::CreateDirectory((Split-Path -Parent $legacyExe)) | Out-Null
  [IO.File]::WriteAllBytes($legacyExe, [byte[]]@())
  $legacyPathFile = Join-Path $legacyInstallDir 'apps\Qoder\qoder-path.txt'
  [IO.Directory]::CreateDirectory((Split-Path -Parent $legacyPathFile)) | Out-Null
  [IO.File]::WriteAllText($legacyPathFile, $legacyExe, [Text.UTF8Encoding]::new($false))
  & (Join-Path $PSScriptRoot '..\apps\migrate-agentrtl-paths.ps1') -LegacyInstallDir $legacyInstallDir

  $restored = Get-RtlSavedPath 'qoder'
  if ($restored -cne $legacyExe) {
    throw "Legacy Qoder path did not migrate. Expected '$legacyExe', got '$restored'."
  }
  $stateFile = Join-Path $tempRoot 'ahmadkhanloo\VibeHub\rtl-paths.json'
  $installRoot = Join-Path $tempRoot 'VibeHub'
  if ([IO.Path]::GetFullPath($stateFile).StartsWith([IO.Path]::GetFullPath($installRoot).TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Personal RTL path settings must be stored outside the install directory.'
  }
  $state = [IO.File]::ReadAllText($stateFile, [Text.Encoding]::UTF8) | ConvertFrom-Json
  if ($state.schemaVersion -ne 1 -or $state.qoder -cne $legacyExe) {
    throw 'The saved RTL path state is missing its schema version or Unicode path.'
  }

  if (Get-RtlSavedPath 'zcode') {
    throw 'An unset tool path must not resolve to another tool path.'
  }

  $bundledNode = Join-Path $PSScriptRoot '..\apps\desktop\src-tauri\windows\payload\node.exe'
  if (Test-Path -LiteralPath $bundledNode -PathType Leaf) {
    $privateRoot = Join-Path (Split-Path -Parent $bundledNode) ("runtime-test-" + [Guid]::NewGuid().ToString('N'))
    $appsDir = Join-Path $privateRoot 'apps'
    $adapterDir = Join-Path $appsDir 'Qoder'
    $runtimeDir = Join-Path $privateRoot 'runtime'
    [IO.Directory]::CreateDirectory($adapterDir) | Out-Null
    [IO.Directory]::CreateDirectory($runtimeDir) | Out-Null
    $privateNode = Join-Path $runtimeDir 'node.exe'
    New-Item -ItemType HardLink -Path $privateNode -Target $bundledNode | Out-Null
    $originalPath = $env:PATH
    try {
      $env:PATH = Join-Path $env:SystemRoot 'System32'
      if (Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue) {
        throw 'The isolated PATH unexpectedly exposes a system Node.js executable.'
      }
      $resolvedNode = Get-RtlNodePath $adapterDir
      $nodeVersion = & $resolvedNode --version
    } finally {
      $env:PATH = $originalPath
    }
    if ($resolvedNode -cne [IO.Path]::GetFullPath($privateNode)) {
      throw "The launcher did not prefer its private Node.js runtime. Got '$resolvedNode'."
    }
    if ($LASTEXITCODE -ne 0 -or $nodeVersion -ne 'v24.22.1') {
      throw "The private Node.js runtime returned an unexpected version: $nodeVersion"
    }
    'Private Node.js runtime resolution: PASS (v24.22.1 works with no system Node on PATH)'
  }

  'RTL executable path persistence: PASS (Unicode path, schemaVersion 1, and AgentRTL Qoder-path migration)'
} finally {
  $env:LOCALAPPDATA = $originalLocalAppData
  $payloadRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\apps\desktop\src-tauri\windows\payload')).TrimEnd('\') + '\'
  if ($privateRoot) {
    $resolvedPrivateRoot = [IO.Path]::GetFullPath($privateRoot)
    $leaf = Split-Path -Leaf $resolvedPrivateRoot
    if ($resolvedPrivateRoot.StartsWith($payloadRoot, [StringComparison]::OrdinalIgnoreCase) -and $leaf -match '^runtime-test-[0-9a-f]{32}$') {
      Remove-Item -LiteralPath $resolvedPrivateRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
  $tempPrefix = [IO.Path]::GetFullPath($env:TEMP).TrimEnd('\') + '\'
  $resolvedTempRoot = [IO.Path]::GetFullPath($tempRoot)
  if ($resolvedTempRoot.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedTempRoot)) {
    Remove-Item -LiteralPath $resolvedTempRoot -Recurse -Force
  }
}
