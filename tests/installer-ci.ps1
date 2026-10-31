$ErrorActionPreference = 'Stop'
if ($env:CI -ne 'true' -or -not $env:RUNNER_TEMP) { throw 'Run only on a disposable CI runner.' }
$repo = Split-Path -Parent $PSScriptRoot
$version = (Get-Content (Join-Path $repo 'apps/desktop/src-tauri/tauri.conf.json') -Raw | ConvertFrom-Json).version
$candidate = Join-Path $repo "apps/desktop/src-tauri/target/release/bundle/nsis/VibeHub_${version}_x64-setup.exe"
$base = Join-Path $env:RUNNER_TEMP 'vibehub-install-test'
$install = Join-Path $base 'app'
$baseline = Join-Path $base 'baseline.exe'
$state = 'HKCU:\Software\ahmadkhanloo\VibeHub\Install'
$uninstall = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\VibeHub'
if ((Test-Path $state) -or (Test-Path $uninstall) -or (Test-Path $base)) { throw 'Runner must have no existing VibeHub installation or fixture.' }
New-Item -ItemType Directory -Path $base | Out-Null
Invoke-WebRequest 'https://github.com/ahmadkhanloo/VibeHub/releases/download/v0.2.0/VibeHub-Setup.exe' -OutFile $baseline
if ((Get-FileHash $baseline -Algorithm SHA256).Hash -ne 'DD658155251BB27DEE7D8190CC1371DBB6D163ED7CA3050077625A610EDE8136') { throw 'Baseline installer hash mismatch.' }
function Run-Setup([string]$path, [string]$arguments) {
  $process = Start-Process -FilePath $path -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Setup returned exit code $($process.ExitCode)." }
}
$desktop = [Environment]::GetFolderPath('Desktop')
$programs = [Environment]::GetFolderPath('Programs')
$names = @('ZCode','Qoder','DeepSeek Harness','Antigravity')
Run-Setup $baseline "/S /D=$install"
if (-not (Test-Path (Join-Path $install 'vibehub.exe'))) { throw 'Baseline full installation missing executable.' }
$old = Join-Path $desktop 'Qoder RTL.lnk'
if (-not (Test-Path $old)) { throw 'Baseline did not create its old RTL shortcut.' }
Run-Setup $candidate "/S /UPDATE /D=$install"
foreach ($name in $names) {
  if (Test-Path (Join-Path $desktop "$name RTL.lnk")) { throw "Full upgrade left an RTL desktop shortcut: $name" }
  if (Test-Path (Join-Path $programs "VibeHub\$name RTL.lnk")) { throw "Full upgrade left an RTL Start Menu shortcut: $name" }
}
Run-Setup (Join-Path $install 'uninstall.exe') '/S'
New-Item -Path $state -Force | Out-Null
Set-ItemProperty -Path $state -Name mode -Value 'rtl'
Set-ItemProperty -Path $state -Name rtlComponents -Value 'zcode,qoder,deepseek-harness,antigravity'
Run-Setup $candidate "/S /D=$install"
if (Test-Path (Join-Path $install 'vibehub.exe')) { throw 'RTL-only install contains VibeHub executable.' }
$shell = New-Object -ComObject WScript.Shell
foreach ($item in @(@('ZCode','ZCode'),@('Qoder','Qoder'),@('DeepSeek Harness','DeepSeekHarness'),@('Antigravity','Antigravity'))) {
  $link = Join-Path $desktop ($item[0] + ' RTL.lnk')
  if (-not (Test-Path $link)) { throw "Missing RTL shortcut: $($item[0])" }
  $shortcut = $shell.CreateShortcut($link)
  $expected = Join-Path $install ('apps\' + $item[1] + '\launch.vbs')
  if ($shortcut.TargetPath -ine $expected -or -not (Test-Path $expected)) { throw "Invalid launcher target: $($item[0])" }
  if ($shortcut.IconLocation -notlike '*rtl-shortcut.ico*') { throw "Invalid RTL icon: $($item[0])" }
}
Run-Setup (Join-Path $install 'uninstall.exe') '/S'
foreach ($name in $names) { if (Test-Path (Join-Path $desktop "$name RTL.lnk")) { throw "Uninstall left shortcut: $name" } }
Write-Output 'PASS: actual full baseline install, baseline-to-candidate /UPDATE, RTL-only install and uninstall on disposable Windows runner. Updater signature verification and Windows 10/11 are not covered.'
