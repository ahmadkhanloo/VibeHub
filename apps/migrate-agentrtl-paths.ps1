param([Parameter(Mandatory = $true)][string]$LegacyInstallDir)

$ErrorActionPreference = 'Stop'
$legacyPathFile = Join-Path $LegacyInstallDir 'apps\Qoder\qoder-path.txt'
if (-not (Test-Path -LiteralPath $legacyPathFile -PathType Leaf)) { exit 0 }

try {
  $candidate = [IO.File]::ReadAllText($legacyPathFile, [Text.Encoding]::UTF8).Trim()
  if ([IO.Path]::GetFileName($candidate) -notin @('Qoder.exe', 'Qoder IDE.exe')) { exit 0 }
  if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { exit 0 }
  . (Join-Path $PSScriptRoot 'rtl-paths.ps1')
  Save-RtlPath 'qoder' $candidate
} catch {
  exit 0
}
