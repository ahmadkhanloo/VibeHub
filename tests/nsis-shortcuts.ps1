$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$base = Join-Path ([IO.Path]::GetTempPath()) ('vibehub-nsis-test-' + [guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($base) | Out-Null
$source = [IO.File]::ReadAllText((Join-Path $repo 'apps/desktop/src-tauri/windows/installer.nsi'))
$remove = [regex]::Match($source, '(?s)!macro RemoveBrokenFullRtlShortcut\b.*?!macroend').Value
$create = [regex]::Match($source, '(?s)!macro CreateOwnedRtlShortcut\b.*?!macroend').Value
if (-not $remove -or -not $create) { throw 'Shortcut macros missing' }
$utils = Join-Path $repo 'apps/desktop/src-tauri/target/release/nsis/x64/utils.nsh'
$script = @'
Unicode true
RequestExecutionLevel user
SilentInstall silent
OutFile "__OUT__"
!include LogicLib.nsh
!include "__UTILS__"
!include "Win\COM.nsh"
__REMOVE__
__CREATE__
Section
  StrCpy $INSTDIR "$EXEDIR\install"
  CreateDirectory "$INSTDIR\apps\Qoder"
  FileOpen $0 "$INSTDIR\apps\Qoder\launch.vbs" w
  FileClose $0
  CreateShortcut "$EXEDIR\broken.lnk" "$INSTDIR\resources\apps\Qoder\launch.vbs"
  !insertmacro RemoveBrokenFullRtlShortcut "$EXEDIR\broken.lnk" "Qoder"
  ${If} ${FileExists} "$EXEDIR\broken.lnk"
    SetErrorLevel 11
    Quit
  ${EndIf}
  CreateShortcut "$EXEDIR\foreign.lnk" "$WINDIR\notepad.exe"
  !insertmacro CreateOwnedRtlShortcut "$EXEDIR\foreign.lnk" "$INSTDIR\apps\Qoder\launch.vbs" "$INSTDIR\apps\Qoder\rtl-shortcut.ico"
  !insertmacro IsShortcutTarget "$EXEDIR\foreign.lnk" "$WINDIR\notepad.exe"
  Pop $0
  ${If} $0 != 1
    SetErrorLevel 12
    Quit
  ${EndIf}
  !insertmacro CreateOwnedRtlShortcut "$EXEDIR\new.lnk" "$INSTDIR\apps\Qoder\launch.vbs" "$INSTDIR\apps\Qoder\rtl-shortcut.ico"
  !insertmacro IsShortcutTarget "$EXEDIR\new.lnk" "$INSTDIR\apps\Qoder\launch.vbs"
  Pop $0
  ${If} $0 != 1
    SetErrorLevel 13
    Quit
  ${EndIf}
  SetErrorLevel 0
SectionEnd
'@
$script = $script.Replace('__OUT__', (Join-Path $base 'test.exe')).Replace('__UTILS__', $utils).Replace('__REMOVE__', $remove).Replace('__CREATE__', $create)
$nsi = Join-Path $base 'test.nsi'
[IO.File]::WriteAllText($nsi, $script, [Text.UTF8Encoding]::new($false))
$compiler = Join-Path $env:LOCALAPPDATA 'tauri/NSIS/makensis.exe'
& $compiler /V2 $nsi
if ($LASTEXITCODE -ne 0) { throw 'NSIS test compilation failed' }
$process = Start-Process -FilePath (Join-Path $base 'test.exe') -ArgumentList '/S' -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "Shortcut macro test failed: $($process.ExitCode); fixture: $base" }
'PASS: NSIS removes the owned broken shortcut, preserves an unrelated shortcut, and creates an owned shortcut.'
