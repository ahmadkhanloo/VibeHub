$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$sandbox = Join-Path ([IO.Path]::GetTempPath()) ('vibehub-native-' + [guid]::NewGuid().ToString('N'))
$null = New-Item -Path $sandbox -ItemType Directory
$profileFile = Join-Path $sandbox "profile-' فارسی.ps1"
$adapter = Join-Path $repo 'apps\desktop\src-tauri\src\windows.ps1'
$passed = 0
function Assert($condition, [string]$message) { if (-not $condition) { throw $message }; $script:passed++ }
function Run-Adapter($request) {
    $request.resourceRoot = $repo
    $start = [Diagnostics.ProcessStartInfo]::new('powershell.exe')
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
    $start.StandardInputEncoding = [Text.UTF8Encoding]::new($false)
    $start.EnvironmentVariables['VIBEHUB_TEST_PROFILE'] = $profileFile
    $start.EnvironmentVariables['VIBEHUB_TEST_ADAPTER'] = $adapter
    $start.EnvironmentVariables['LOCALAPPDATA'] = $sandbox
    $start.EnvironmentVariables['PATH'] = "$sandbox;$env:PATH"
    $code = '$PROFILE.CurrentUserAllHosts = $env:VIBEHUB_TEST_PROFILE; & $env:VIBEHUB_TEST_ADAPTER'
    $start.Arguments = '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ' + [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($code))
    $process = [Diagnostics.Process]::Start($start)
    $process.StandardInput.WriteLine((ConvertTo-Json $request -Depth 20 -Compress))
    $process.StandardInput.Close()
    $output = $process.StandardOutput.ReadToEnd()
    $errors = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    $line = ($output -split '\r?\n' | Where-Object { $_.StartsWith('VIBEHUB_JSON:') } | Select-Object -Last 1)
    if (-not $line) { throw "Missing structured result: $errors" }
    $line.Substring(13) | ConvertFrom-Json
}
try {
    $developmentNode = Join-Path $repo 'apps\desktop\src-tauri\windows\payload\node.exe'
    if (Test-Path -LiteralPath $developmentNode -PathType Leaf) {
        . (Join-Path $repo 'apps\rtl-paths.ps1')
        $resolvedNode = Get-RtlNodePath (Join-Path $repo 'apps\Qoder')
        Assert ([IO.Path]::GetFullPath($resolvedNode) -eq [IO.Path]::GetFullPath($developmentNode)) 'RTL development launcher must select its prepared payload runtime'
    }
    [IO.File]::WriteAllText((Join-Path $sandbox 'oh-my-posh.cmd'), "@echo off`r`necho 99.0.0`r`n")
    $initial = "# original فارسی`r`n"
    [IO.File]::WriteAllText($profileFile, $initial, [Text.UTF8Encoding]::new($true))
    $detected = @(Run-Adapter @{operation='detect'})
    Assert ($detected.Count -eq 6) 'Detection must return all six app records'
    Assert (@($detected | Where-Object { $_.installed -isnot [bool] }).Count -eq 0) 'Detection installed flags must be booleans'
    $editors = @(Run-Adapter @{operation='detect-editors'})
    $knownEditorIds = @('vscode','vscode-insiders','antigravity','antigravity-ide','cursor','windsurf','zed','trae','kiro','vscodium')
    Assert (@($editors | Where-Object { $_.id -notin $knownEditorIds -or $_.installed -ne $true -or -not (Test-Path -LiteralPath $_.path -PathType Leaf) }).Count -eq 0) 'Editor scan must return only known apps with existing executable paths'
    Assert (@($editors.id | Select-Object -Unique).Count -eq $editors.Count) 'Editor scan must not return duplicate app records'
    $fakeEditorDir = Join-Path $sandbox 'Programs\Antigravity'
    $fakeEditor = Join-Path $fakeEditorDir 'Antigravity.exe'
    [IO.Directory]::CreateDirectory($fakeEditorDir) | Out-Null
    $probeSource = Join-Path $sandbox 'proxy-probe.rs'
    $probeOutput = Join-Path $fakeEditorDir 'proxy-env.txt'
    $probeCode = 'use std::{env, fs}; fn main() { let proxy = env::var("HTTP_PROXY").unwrap_or_else(|_| "unset".to_string()); fs::write(r#"' + $probeOutput + '"#, proxy).unwrap(); }'
    [IO.File]::WriteAllText($probeSource, $probeCode, [Text.UTF8Encoding]::new($false))
    & rustc --edition=2021 $probeSource -o $fakeEditor
    if ($LASTEXITCODE -ne 0) { throw "Could not compile the temporary editor probe (rustc exit $LASTEXITCODE)" }
    $testEditor = @(Run-Adapter @{operation='detect-editors'} | Where-Object { $_.id -eq 'antigravity' } | Select-Object -First 1)
    Assert ($testEditor.Count -eq 1 -and $testEditor[0].path -eq $fakeEditor) "The proxy launch test must resolve its sandbox editor; received: $($testEditor | ConvertTo-Json -Compress)"
    $priorHttpProxy = $env:HTTP_PROXY
    try {
        $env:HTTP_PROXY = 'socks5h://127.0.0.1:10808'
        & $fakeEditor
        Assert ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $probeOutput)) 'The temporary editor probe must run before testing the adapter launch'
    } finally {
        $env:HTTP_PROXY = $priorHttpProxy
        Remove-Item -LiteralPath $probeOutput -Force -ErrorAction SilentlyContinue
    }
    $proxyLaunch = Run-Adapter @{operation='launch-editor';editorId='antigravity';proxyUrl='socks5h://127.0.0.1:10808';waitForTestExitMs=5000}
    Assert $proxyLaunch.proxyConfigured 'Proxy profile should be passed to the editor launch request'
    Assert (-not $proxyLaunch.proxyRoutingVerified) 'The adapter must not claim that IDE traffic was verified'
    Assert ($proxyLaunch.testProcessCompleted -and $proxyLaunch.testExitCode -eq 0) "The proxy child should exit cleanly; launch result=$($proxyLaunch | ConvertTo-Json -Compress)"
    Assert (Test-Path -LiteralPath $probeOutput) 'The proxy child must record its environment'
    Assert ([IO.File]::ReadAllText($probeOutput) -eq 'socks5h://127.0.0.1:10808') 'The selected proxy should reach the editor child process environment'
    $state = Run-Adapter @{operation='terminal-detect'}
    Assert ($state.profilePath -eq $profileFile) "Test profile must be isolated. Received: $($state | ConvertTo-Json -Compress)"
    $applied = Run-Adapter @{operation='terminal-apply'}
    Assert $applied.ok 'Theme application failed'
    $once = [IO.File]::ReadAllText($profileFile)
    Assert ($once.Contains($initial)) 'Original profile text was lost'
    $null = Run-Adapter @{operation='terminal-apply'}
    Assert ([IO.File]::ReadAllText($profileFile) -eq $once) 'Theme application must be idempotent'
    Assert ([IO.File]::ReadAllText("$profileFile.vibehub.bak") -eq $initial) 'Backup must contain original text'
    [IO.File]::AppendAllText($profileFile, "# later user customization`r`n", [Text.UTF8Encoding]::new($true))
    $undone = Run-Adapter @{operation='terminal-undo'}
    Assert $undone.ok 'Undo failed'
    $after = [IO.File]::ReadAllText($profileFile)
    Assert ($after -eq ($initial + "# later user customization`r`n")) 'Undo must preserve subsequent user edits'
    $bad = Run-Adapter @{operation='font-install';which='untrusted'}
    Assert ([bool]$bad.error) 'Unknown font must fail before downloading'
    $bad = Run-Adapter @{operation='launch';req=@{appId='untrusted';rtl=$false}}
    Assert ([bool]$bad.error) 'Unknown app must fail before starting a process'
    $bad = Run-Adapter @{operation='stop-rtl';state=@{rtl=$true;injectorPid=$PID;injectorPath='not-the-owner.mjs'}}
    Assert ([bool]$bad.error) 'Stop must refuse an unrelated PID'
    Assert ([bool](Get-Process -Id $PID)) 'Unrelated process must remain alive'
    [IO.File]::WriteAllText($profileFile, '# >>> VibeHub managed prompt >>>', [Text.UTF8Encoding]::new($true))
    $bad = Run-Adapter @{operation='terminal-undo'}
    Assert ([bool]$bad.error) 'Malformed managed block must be preserved for inspection'
    "Native Windows behavioral suite: $passed assertions passed. Real user profile untouched."
} finally {
    # The only recursively removed directory was freshly created above under TEMP.
    $resolved = [IO.Path]::GetFullPath($sandbox)
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if ($resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolved) -like 'vibehub-native-*') { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
