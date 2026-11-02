$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$desktopManifestPath = Join-Path $repo 'content\apps\freebuff-desktop.json'
$cliManifestPath = Join-Path $repo 'content\apps\freebuff.json'
if (-not (Test-Path -LiteralPath $desktopManifestPath -PathType Leaf)) { throw 'Freebuff Desktop catalog record is missing.' }
$desktop = [IO.File]::ReadAllText($desktopManifestPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
$cli = [IO.File]::ReadAllText($cliManifestPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
if ($desktop.id -ne 'freebuff-desktop' -or $desktop.kind -ne 'desktop_agent') { throw 'Freebuff Desktop must keep its own desktop identity.' }
if ($cli.id -ne 'freebuff' -or $cli.kind -ne 'cli_agent') { throw 'The existing Freebuff CLI identity changed.' }

# Discover registrations from Windows metadata only. Never promote the freebuff CLI shim to Desktop.
$registered = [Collections.Generic.List[object]]::new()
foreach ($root in @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
)) {
  if (-not (Test-Path -LiteralPath $root)) { continue }
  foreach ($key in (Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue)) {
    $entry = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction SilentlyContinue
    if ($entry.DisplayName -match '^Freebuff Desktop(?: \(User\))?$') { $registered.Add($entry) }
  }
}
$packages = @(Get-AppxPackage -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^Freebuff(?:\.|$)' })
$startApps = @(Get-StartApps -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^Freebuff Desktop(?:$| )' })
$processes = @(Get-Process -Name Freebuff -ErrorAction SilentlyContinue | Where-Object { $_.Path })
$cliCommands = @(Get-Command freebuff,freebuff.exe -CommandType Application -ErrorAction SilentlyContinue)
Write-Host ("Freebuff Desktop registrations={0}; AppX={1}; Start Apps={2}; running Freebuff process={3}; CLI shims on PATH={4}" -f $registered.Count,$packages.Count,$startApps.Count,$processes.Count,$cliCommands.Count)
if (-not $registered.Count -and -not $packages.Count -and -not $startApps.Count -and -not $processes.Count) {
  Write-Host 'No Freebuff Desktop executable/window was available for live renderer inspection; CLI commands were not treated as Desktop.'
}
