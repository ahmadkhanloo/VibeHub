# Fixed local adapter. Request data arrives as JSON on stdin, never as PowerShell code.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
$root = [string]$request.resourceRoot
# Tauri can return extended-length paths; Windows PowerShell providers reject them.
if ($root.StartsWith('\\?\UNC\', [StringComparison]::OrdinalIgnoreCase)) { $root = '\\' + $root.Substring(8) }
elseif ($root.StartsWith('\\?\', [StringComparison]::Ordinal)) { $root = $root.Substring(4) }
$helpers = Join-Path $root 'apps\rtl-paths.ps1'
if (Test-Path -LiteralPath $helpers) { . $helpers }
$utf8 = [Text.UTF8Encoding]::new($true)
$begin = '# >>> VibeHub managed prompt >>>'
$end = '# <<< VibeHub managed prompt <<<'

function ProfilePath { $PROFILE.CurrentUserAllHosts }
function ProfileText { $p = ProfilePath; if (Test-Path -LiteralPath $p) { [IO.File]::ReadAllText($p) } else { '' } }
function ThemeBlockPattern { '(?ms)^' + [regex]::Escape($begin) + '\r?\n.*?^' + [regex]::Escape($end) + '(?:\r?\n)?' }

function Read-UninstallEntries {
    if ($null -eq $script:UninstallEntries) { $script:UninstallEntries = @(Read-UninstallEntriesUncached) }
    $script:UninstallEntries
}

function Read-UninstallEntriesUncached {
    $views = @(
        @{ hive = [Microsoft.Win32.RegistryHive]::CurrentUser; view = [Microsoft.Win32.RegistryView]::Registry64 },
        @{ hive = [Microsoft.Win32.RegistryHive]::CurrentUser; view = [Microsoft.Win32.RegistryView]::Registry32 },
        @{ hive = [Microsoft.Win32.RegistryHive]::LocalMachine; view = [Microsoft.Win32.RegistryView]::Registry64 },
        @{ hive = [Microsoft.Win32.RegistryHive]::LocalMachine; view = [Microsoft.Win32.RegistryView]::Registry32 }
    )
    foreach ($view in $views) {
        $baseKey = $null
        $uninstallKey = $null
        try {
            $baseKey = [Microsoft.Win32.RegistryKey]::OpenBaseKey($view.hive, $view.view)
            $uninstallKey = $baseKey.OpenSubKey('Software\Microsoft\Windows\CurrentVersion\Uninstall')
            if (-not $uninstallKey) { continue }
            foreach ($name in $uninstallKey.GetSubKeyNames()) {
                $entryKey = $uninstallKey.OpenSubKey($name)
                if (-not $entryKey) { continue }
                try {
                    $displayName = [string]$entryKey.GetValue('DisplayName')
                    if (-not $displayName) { continue }
                    [pscustomobject]@{
                        DisplayName = $displayName
                        InstallLocation = [string]$entryKey.GetValue('InstallLocation')
                        DisplayIcon = [string]$entryKey.GetValue('DisplayIcon')
                        UninstallString = [string]$entryKey.GetValue('UninstallString')
                        DisplayVersion = [string]$entryKey.GetValue('DisplayVersion')
                    }
                } finally {
                    $entryKey.Dispose()
                }
            }
        } catch {
            # Restricted registry views must not block path-based detection.
        } finally {
            if ($uninstallKey) { $uninstallKey.Dispose() }
            if ($baseKey) { $baseKey.Dispose() }
        }
    }
}

function Find-RegisteredAppPath([string]$id) {
    $pattern = switch ($id) {
        'zcode' { '^ZCode(?:\s+.*)?$' }
        'qoder' { '^Qoder(?:\s+.*)?$' }
        'deepseek-harness' { '^DeepSeek Harness(?:\s+.*)?$' }
        default { return $null }
    }
    $exeNames = switch ($id) {
        'zcode' { @('ZCode.exe') }
        'qoder' { @('Qoder IDE.exe', 'Qoder.exe') }
        'deepseek-harness' { @('DeepSeek Harness.exe') }
    }
    $registrations = @(Read-UninstallEntries | Where-Object { $_.DisplayName -match $pattern })
    foreach ($entry in $registrations) {
        $bases = [Collections.Generic.List[string]]::new()
        if ($entry.InstallLocation) {
            $location = [Environment]::ExpandEnvironmentVariables(([string]$entry.InstallLocation).Trim('"'))
            if (Test-Path -LiteralPath $location -PathType Container) { $bases.Add($location) }
        }
        foreach ($raw in @($entry.DisplayIcon, $entry.UninstallString)) {
            if ([string]::IsNullOrWhiteSpace([string]$raw)) { continue }
            $value = [Environment]::ExpandEnvironmentVariables([string]$raw)
            $registeredPath = $null
            if ($value -match '^\s*"(?<path>[^"]+\.(?:exe|ico))"') {
                $registeredPath = $Matches.path
            } elseif ($value -match '^\s*(?<path>.*?\.(?:exe|ico))(?:,\d+)?(?:\s|$)') {
                $registeredPath = $Matches.path.Trim('"')
            }
            if (-not $registeredPath) { continue }
            if ($raw -eq $entry.DisplayIcon -and [IO.Path]::GetExtension($registeredPath) -ieq '.exe' -and [IO.Path]::GetFileName($registeredPath) -in $exeNames -and (Test-Path -LiteralPath $registeredPath -PathType Leaf)) {
                return $registeredPath
            }
            $base = Split-Path -Parent $registeredPath
            if ($base -and (Test-Path -LiteralPath $base -PathType Container)) { $bases.Add($base) }
        }
        foreach ($base in ($bases | Select-Object -Unique)) {
            if ($id -eq 'qoder') {
                $versions = Get-ChildItem -LiteralPath (Join-Path $base '.qoder-versions') -Directory -ErrorAction SilentlyContinue |
                    Where-Object { $_.Name -match '^\d+(\.\d+){2,3}$' -and (Test-Path -LiteralPath (Join-Path $_.FullName 'resources\app.asar')) } |
                    Sort-Object { [version]$_.Name } -Descending
                foreach ($version in $versions) {
                    foreach ($name in $exeNames) {
                        $candidate = Join-Path $version.FullName $name
                        if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
                    }
                }
            }
            foreach ($name in $exeNames) {
                $candidate = Join-Path $base $name
                if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
            }
        }
    }
    return $null
}

function Find-DesktopProduct([string]$id, [switch]$All) {
    $names = if ($id -eq 'antigravity') { @('Antigravity.exe') } else { @('ChatGPT.exe','Codex.exe') }
    $pattern = if ($id -eq 'antigravity') { '^Antigravity(?: \d[\w.-]*)?$' } else { '^(?:OpenAI )?(?:ChatGPT|Codex)(?: \(User\))?$' }
    $locations = if ($id -eq 'antigravity') { @("$env:LOCALAPPDATA\Programs\Antigravity", "$env:LOCALAPPDATA\Programs\antigravity") } else { @("$env:LOCALAPPDATA\Programs\ChatGPT", "$env:LOCALAPPDATA\Programs\Codex", "$env:LOCALAPPDATA\Programs\OpenAI Codex", "$env:ProgramFiles\ChatGPT", "$env:ProgramFiles\Codex") }
    $candidates = [Collections.Generic.List[string]]::new()
    foreach ($location in $locations) { foreach ($name in $names) {
        $candidate = Join-Path $location $name
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { $candidates.Add($candidate) }
    } }
    foreach ($entry in (Read-UninstallEntries | Where-Object { $_.DisplayName -match $pattern })) {
        if ($entry.InstallLocation) { $locations += [Environment]::ExpandEnvironmentVariables($entry.InstallLocation).Trim('"') }
        if ($entry.DisplayIcon -match '^\s*"?([^"]+?\.exe)(?:"|,|$)') {
            $candidate = [Environment]::ExpandEnvironmentVariables($Matches[1])
            if ([IO.Path]::GetFileName($candidate) -in $names -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { $candidates.Add($candidate) }
        }
    }
    if ($id -eq 'chatgpt') {
        foreach ($package in (Get-AppxPackage -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^OpenAI\.(ChatGPT|Codex)' })) {
            $locations += $package.InstallLocation
            $locations += Join-Path $package.InstallLocation 'app'
        }
    }
    foreach ($location in ($locations | Select-Object -Unique)) { foreach ($name in $names) {
        $candidate = Join-Path $location $name
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { $candidates.Add($candidate) }
    } }
    $found = @($candidates | Select-Object -Unique)
    if ($All) { return $found }
    if ($id -eq 'chatgpt') {
        $running = Get-Process -Name ChatGPT,Codex -ErrorAction SilentlyContinue | Where-Object { try { $_.Path -in $found } catch { $false } } | Select-Object -First 1
        if ($running) { return $running.Path }
    }
    if ($found.Count) { return $found[0] }
    return $null
}

function Codex-DesktopState {
    $paths = @(Find-DesktopProduct 'chatgpt' -All)
    $processes = @(Get-Process -Name ChatGPT,Codex -ErrorAction SilentlyContinue)
    $known = @($processes | Where-Object { try { $_.Path -in $paths } catch { $false } })
    $unknown = @($processes | Where-Object { try { $_.MainWindowHandle -ne 0 -and $_.Path -notin $paths } catch { $true } })
    $runningPaths = @($known | ForEach-Object { $_.Path } | Select-Object -Unique)
    $selected = if ($runningPaths.Count) { $runningPaths[0] } elseif ($paths.Count) { $paths[0] } else { $null }
    @{installed=($paths.Count -gt 0);running=($known.Count -gt 0 -or $unknown.Count -gt 0);ambiguous=($runningPaths.Count -gt 1 -or $unknown.Count -gt 0);launchPath=$selected}
}

function Invoke-HubRtlLauncher([string]$launcherPath) {
    $launcherOutput = @()
    $failed = $false
    try {
        $global:LASTEXITCODE = 0
        # Hub errors belong in the app design system, not a blocking Windows popup.
        $launcherOutput = @(& $launcherPath *>&1)
        $failed = $LASTEXITCODE -ne 0
    } catch {
        $failed = $true
        $launcherOutput += $_.Exception.Message
    }
    if ($failed) {
        $detail = ($launcherOutput | ForEach-Object { [string]$_ }) -join "`n"
        if ($detail -match '(?is)port.{0,100}(already used|belongs|in use|busy)') { throw 'VIBEHUB_LAUNCH_PORT_BUSY' }
        if ($detail -match '(?is)already (running|open)') { throw 'VIBEHUB_LAUNCH_ALREADY_OPEN' }
        throw 'VIBEHUB_RTL_LAUNCH_FAILED'
    }
}

function Find-App([string]$id) {
    if (Get-Command Get-RtlSavedPath -ErrorAction SilentlyContinue) { $saved = Get-RtlSavedPath $id; if ($saved) { return $saved } }
    if ($id -in @('antigravity','chatgpt')) { return Find-DesktopProduct $id }
    if ($id -in @('qoder','zcode','deepseek-harness') -and (Get-Command Get-RtlExecutable -ErrorAction SilentlyContinue)) {
        $folder = switch ($id) { 'qoder' {'Qoder'} 'zcode' {'ZCode'} 'deepseek-harness' {'DeepSeekHarness'} }
        $resolved = Get-RtlExecutable $id (Join-Path $root "apps\$folder")
        if ($resolved) { return $resolved }
    }
    $candidates = @()
    switch ($id) {
        'qoder' {
            foreach ($base in @("$env:LOCALAPPDATA\Programs\Qoder IDE", "$env:LOCALAPPDATA\Programs\Qoder")) {
                $versions = Get-ChildItem -LiteralPath "$base\.qoder-versions" -Directory -ErrorAction SilentlyContinue |
                    Where-Object { $_.Name -match '^\d+(\.\d+){2,3}$' } | Sort-Object { [version]$_.Name } -Descending
                foreach ($version in $versions) { foreach ($name in @('Qoder IDE.exe', 'Qoder.exe')) {
                    if (Test-Path -LiteralPath "$($version.FullName)\resources\app.asar") { $candidates += Join-Path $version.FullName $name }
                } }
                if (Test-Path -LiteralPath "$base\resources\app.asar") { $candidates += "$base\Qoder IDE.exe"; $candidates += "$base\Qoder.exe" }
            }
        }
        'zcode' { $candidates = @("$env:ProgramFiles\ZCode\ZCode.exe", "${env:ProgramFiles(x86)}\ZCode\ZCode.exe", "$env:LOCALAPPDATA\Programs\ZCode\ZCode.exe") }
        'deepseek-harness' { $candidates = @("$env:LOCALAPPDATA\Programs\DeepSeek Harness\DeepSeek Harness.exe") }
        default {
            # Native file checks avoid module discovery for missing CLI commands.
            foreach ($directory in ($env:PATH -split ';')) {
                if (-not $directory) { continue }
                foreach ($extension in ($env:PATHEXT -split ';')) {
                    if (-not $extension) { continue }
                    try { $candidate = [IO.Path]::Combine([Environment]::ExpandEnvironmentVariables($directory.Trim('"')), "$id$extension") } catch { continue }
                    if ([IO.File]::Exists($candidate)) { return $candidate }
                }
            }
        }
    }
    $found = $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
    if ($found) { return $found }
    Find-RegisteredAppPath $id
}

function Detect-Apps {
    @('zcode','qoder','deepseek-harness','opencode','mimocode','freebuff','antigravity','chatgpt') | ForEach-Object {
        $path = Find-App $_
        $result = @{ id = $_; installed = [bool]$path; via = 'standard-path-or-PATH' }
        if ($path) { $result.path = $path; $version = (Get-Item -LiteralPath $path).VersionInfo.ProductVersion; if ($version) { $result.version = $version } }
        $result
    }
}

function Detect-Editors { @() }

function Get-LaunchState($state, [string]$appId = '') {
    if ($state.phase -eq 'failed') { return $state }
    if ($state.rtl) {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$state.injectorPid)" -ErrorAction SilentlyContinue
        $alive = $proc -and $proc.Name -ieq 'node.exe' -and $proc.CommandLine -match [regex]::Escape([string]$state.injectorPath)
    } else { $alive = $state.pid -and [bool](Get-Process -Id ([int]$state.pid) -ErrorAction SilentlyContinue) }
    if ($alive) { return @{phase='running';rtl=[bool]$state.rtl;since=$state.since;port=$state.port} }
    if ($appId) {
        $exe = Find-App $appId
        if ($exe) {
            if ($null -eq $script:LaunchProcesses) { $script:LaunchProcesses = @(Get-Process -ErrorAction SilentlyContinue) }
            $running = $script:LaunchProcesses | Where-Object { try { $_.Path -ieq $exe } catch { $false } } | Select-Object -First 1
            if ($running) { return @{phase='running';rtl=$false;since=$running.StartTime.ToUniversalTime().ToString('o')} }
        }
    }
    @{phase='idle'}
}

function Terminal-State {
    $omp = Get-Command oh-my-posh -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    $fonts = @('HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts','HKLM:\Software\Microsoft\Windows NT\CurrentVersion\Fonts')
    $hasFont = $false
    foreach ($fontRoot in $fonts) {
        if (Test-Path -LiteralPath $fontRoot) {
            $names = (Get-Item -LiteralPath $fontRoot).GetValueNames()
            if ($names -match 'JetBrainsMono.*Nerd.*Mono') { $hasFont = $true }
        }
    }
    $profilePathValue = ProfilePath
    $result = @{ hasOhMyPosh = [bool]$omp; hasNerdFont = $hasFont; profilePath = $profilePathValue; themeApplied = [bool]([regex]::IsMatch((ProfileText), (ThemeBlockPattern))) }
    if ($omp) { $version = & $omp.Source version 2>$null; if ($LASTEXITCODE -eq 0) { $result.ohMyPoshVersion = [string]($version | Select-Object -First 1) } }
    if ($hasFont) { $result.nerdFontName = 'JetBrainsMono Nerd Font Mono' }
    if (Test-Path -LiteralPath "$profilePathValue.vibehub.bak") { $result.backupPath = "$profilePathValue.vibehub.bak" }
    $result
}

try {
    $result = switch ($request.operation) {
        'account-app-state' {
            $accountId = [string]$request.appId
            if ($accountId -notin @('qoder','zcode')) { throw 'Unknown account app' }
            $folder = if ($accountId -eq 'qoder') { 'Qoder' } else { 'ZCode' }
            $accountExe = Join-Path $env:LOCALAPPDATA "Programs\$folder\$folder.exe"
            if (-not (Test-Path -LiteralPath $accountExe)) { throw 'Account application was not found' }
            $processes = @(Get-Process -Name $folder -ErrorAction SilentlyContinue | Where-Object { try { $_.Path -ieq $accountExe } catch { $false } })
            @{running=($processes.Count -gt 0);path=$accountExe;version=(Get-Item -LiteralPath $accountExe).VersionInfo.ProductVersion}
        }
        'account-app-close' {
            $accountId = [string]$request.appId
            if ($accountId -notin @('qoder','zcode')) { throw 'Unknown account app' }
            $folder = if ($accountId -eq 'qoder') { 'Qoder' } else { 'ZCode' }
            $accountExe = Join-Path $env:LOCALAPPDATA "Programs\$folder\$folder.exe"
            $processes = @(Get-Process -Name $folder -ErrorAction SilentlyContinue | Where-Object { try { $_.Path -ieq $accountExe } catch { $false } })
            foreach ($proc in $processes) { if ($proc.MainWindowHandle -ne 0) { [void]$proc.CloseMainWindow() } }
            $deadline = [DateTime]::UtcNow.AddSeconds(10)
            do {
                $remaining = @(Get-Process -Name $folder -ErrorAction SilentlyContinue | Where-Object { try { $_.Path -ieq $accountExe } catch { $false } })
                if (-not $remaining.Count) { break }
                Start-Sleep -Milliseconds 150
            } while ([DateTime]::UtcNow -lt $deadline)
            if ($remaining.Count) { throw 'accounts:closeRequired' }
            @{ok=$true}
        }
        'account-app-open' {
            $accountId = [string]$request.appId
            if ($accountId -notin @('qoder','zcode')) { throw 'Unknown account app' }
            $folder = if ($accountId -eq 'qoder') { 'Qoder' } else { 'ZCode' }
            $accountExe = Join-Path $env:LOCALAPPDATA "Programs\$folder\$folder.exe"
            Start-Process -FilePath $accountExe -WindowStyle Hidden
            @{ok=$true}
        }
        'codex-desktop' { Codex-DesktopState }
        'codex-desktop-close' {
            $state = Codex-DesktopState
            if ($state.ambiguous -or -not $state.launchPath) { throw 'Close other or unrecognized Codex desktop installations before switching.' }
            $exe = $state.launchPath
            $processes = @(Get-Process -Name ChatGPT,Codex -ErrorAction SilentlyContinue | Where-Object { try { $_.Path -ieq $exe } catch { $false } })
            foreach ($proc in $processes) { if ($proc.MainWindowHandle -ne 0) { [void]$proc.CloseMainWindow() } }
            $deadline = [DateTime]::UtcNow.AddSeconds(10)
            do {
                $alive = @(Get-Process -Name ChatGPT,Codex -ErrorAction SilentlyContinue | Where-Object { try { $_.Path -ieq $exe } catch { $false } })
                if ($alive.Count -eq 0) { break }
                Start-Sleep -Milliseconds 100
            } while ([DateTime]::UtcNow -lt $deadline)
            if ($alive.Count -gt 0) { throw 'Codex desktop is still open; finish ongoing work and close it before switching.' }
            @{ok=$true}
        }
        'codex-desktop-open' {
            $paths = @(Find-DesktopProduct 'chatgpt' -All)
            $exe = if ($request.path -and $request.path -in $paths) { [string]$request.path } else { Find-DesktopProduct 'chatgpt' }
            if (-not $exe) { throw 'Codex desktop executable could not be identified.' }
            $null = Start-Process -FilePath $exe -PassThru
            @{ok=$true}
        }
        'pick-account-json' {
            Add-Type -AssemblyName System.Windows.Forms
            $picker = New-Object System.Windows.Forms.OpenFileDialog
            try {
                $picker.Filter = 'Codex account JSON (*.json)|*.json'
                $picker.Multiselect = $false
                $picker.CheckFileExists = $true
                $picker.Title = 'Import Codex account JSON'
                if ($picker.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { @{path=$picker.FileName} }
                else { @{path=$null} }
            } finally { $picker.Dispose() }
        }
        'detect' { @(Detect-Apps) }
        'detect-editors' { ,@(Detect-Editors) }
        'launch-editor' {
            $id = [string]$request.editorId
            if ($id -notin @('vscode','vscode-insiders','antigravity','antigravity-ide','cursor','windsurf','zed','trae','kiro','vscodium')) { throw 'Unknown detected editor.' }
            $editor = Detect-Editors | Where-Object { $_.id -eq $id } | Select-Object -First 1
            if (-not $editor) { throw 'This editor is no longer installed at a recognized path. Refresh the app list.' }
            $expectedExe = switch ($id) {
                'vscode' { 'Code.exe' }
                'vscode-insiders' { 'Code - Insiders.exe' }
                'antigravity' { 'Antigravity.exe' }
                'antigravity-ide' { 'Antigravity IDE.exe' }
                'cursor' { 'Cursor.exe' }
                'windsurf' { 'Windsurf.exe' }
                'zed' { 'Zed.exe' }
                'trae' { 'Trae.exe' }
                'kiro' { 'Kiro.exe' }
                'vscodium' { 'VSCodium.exe' }
            }
            if ([IO.Path]::GetFileName([string]$editor.path) -ine $expectedExe) { throw 'Detected editor executable did not match its product.' }
            if ($request.rtl) {
                if ($id -ne 'antigravity') { throw 'RTL is unavailable for this editor.' }
                if ($request.proxyUrl) { foreach ($name in @('HTTP_PROXY','HTTPS_PROXY','ALL_PROXY')) { [Environment]::SetEnvironmentVariable($name, [string]$request.proxyUrl, 'Process') }; $env:NO_PROXY='localhost,127.0.0.1,::1' }
                elseif ($request.direct) { foreach ($name in @('HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY')) { [Environment]::SetEnvironmentVariable($name,$null,'Process') } }
                $env:ANTIGRAVITY_RTL_EXE = [string]$editor.path
                & (Join-Path $root 'apps\Antigravity\start.ps1') -Gui -ProxyUrl ([string]$request.proxyUrl)
                $port = if ($env:ANTIGRAVITY_RTL_PORT) { [int]$env:ANTIGRAVITY_RTL_PORT } else { 9231 }
                $injector = Join-Path $root 'apps\Antigravity\injector.mjs'
                $owner = Get-NetTCPConnection -LocalPort ($port+1) -State Listen -ErrorAction Stop | Select-Object -First 1
                $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($owner.OwningProcess)"
                if ($proc.Name -ine 'node.exe' -or $proc.CommandLine -notmatch [regex]::Escape($injector)) { throw 'RTL injector ownership verification failed.' }
                @{ok=$true;id=$id;rtl=$true;port=$port;injectorPid=$proc.ProcessId;injectorPath=$injector;since=[DateTime]::UtcNow.ToString('o');detail='Standalone Antigravity RTL injector started; live rendering is experimental.'}
                break
            }
            $cwd = [Environment]::GetFolderPath('UserProfile')
            $startInfo = [Diagnostics.ProcessStartInfo]::new()
            $startInfo.FileName = [string]$editor.path
            $startInfo.WorkingDirectory = $cwd
            $startInfo.UseShellExecute = $false
            if ($request.proxyUrl -and $id -in @('vscode','vscode-insiders','antigravity','antigravity-ide','cursor','windsurf','trae','kiro','vscodium')) {
                $chromiumProxy = ([string]$request.proxyUrl) -replace '^socks5h://','socks5://'
                $startInfo.Arguments = "--proxy-server=$chromiumProxy"
            }
            if ($request.proxyUrl) {
                foreach ($name in @('HTTP_PROXY','HTTPS_PROXY','ALL_PROXY')) { $startInfo.EnvironmentVariables[$name] = [string]$request.proxyUrl }
                $startInfo.EnvironmentVariables['NO_PROXY'] = 'localhost,127.0.0.1,::1'
            } elseif ($request.direct) {
                foreach ($name in @('HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY')) { $startInfo.EnvironmentVariables.Remove($name) }
            }
            $proc = [Diagnostics.Process]::Start($startInfo)
            $detail = if ($request.proxyUrl) { 'Opened the detected IDE with proxy settings requested; IDE proxy routing is not verified.' } else { 'Opened the detected IDE' }
            $launchResult = @{ok=$true;id=$id;pid=$proc.Id;rtl=$false;since=[DateTime]::UtcNow.ToString('o');proxyConfigured=[bool]$request.proxyUrl;proxyRoutingVerified=$false;detail=$detail}
            if ($request.waitForTestExitMs -is [int] -and $request.waitForTestExitMs -ge 1 -and $request.waitForTestExitMs -le 5000) {
                $launchResult.testProcessCompleted = $proc.WaitForExit($request.waitForTestExitMs)
                if ($launchResult.testProcessCompleted) { $launchResult.testExitCode = $proc.ExitCode }
            }
            $launchResult
        }
        'terminal-detect' { Terminal-State }
        'terminal-apply' {
            if (-not (Get-Command oh-my-posh -CommandType Application -ErrorAction SilentlyContinue)) { throw 'Install Oh My Posh before applying the theme.' }
            $profilePathValue = ProfilePath
            $text = ProfileText
            $theme = Join-Path $root 'themes\terminal\mak-devline.omp.json'
            if (-not (Test-Path -LiteralPath $theme -PathType Leaf)) { throw 'Bundled terminal theme is missing.' }
            if ([regex]::IsMatch($text, (ThemeBlockPattern))) { @{ ok=$true; detail='Theme already applied'; backupPath="$profilePathValue.vibehub.bak" }; break }
            if ($text.Contains($begin) -or $text.Contains($end)) { throw 'Incomplete VibeHub block found. Profile preserved for manual inspection.' }
            [IO.Directory]::CreateDirectory((Split-Path -Parent $profilePathValue)) | Out-Null
            if (-not (Test-Path -LiteralPath "$profilePathValue.vibehub.bak")) { [IO.File]::WriteAllText("$profilePathValue.vibehub.bak", $text, $utf8) }
            $quotedTheme = $theme.Replace("'", "''")
            $block = "$begin`r`noh-my-posh init pwsh --config '$quotedTheme' | Invoke-Expression`r`n$end`r`n"
            $separator = if ($text -and -not $text.EndsWith("`n")) { "`r`n" } else { '' }
            [IO.File]::WriteAllText($profilePathValue, ($text + $separator + $block), $utf8)
            @{ ok=$true; backupPath="$profilePathValue.vibehub.bak"; detail='Managed prompt applied to Windows PowerShell CurrentUserAllHosts profile' }
        }
        'terminal-undo' {
            $text = ProfileText
            $pattern = ThemeBlockPattern
            if (($text.Contains($begin) -or $text.Contains($end)) -and -not [regex]::IsMatch($text,$pattern)) { throw 'Incomplete VibeHub block. Profile preserved.' }
            if ([regex]::IsMatch($text,$pattern)) { [IO.File]::WriteAllText((ProfilePath), [regex]::Replace($text,$pattern,''), $utf8) }
            @{ ok=$true; detail='Only the managed VibeHub prompt block was removed; other customizations and installed fonts remain' }
        }
        'font-install' {
            $font = switch ($request.which) {
                'nerd' { @{name='JetBrainsMonoNLNerdFontMono-Regular.ttf'; title='JetBrainsMono Nerd Font Mono Regular (TrueType)'; url='https://raw.githubusercontent.com/ryanoasis/nerd-fonts/v3.4.0/patched-fonts/JetBrainsMono/NoLigatures/Regular/JetBrainsMonoNLNerdFontMono-Regular.ttf'; hash='D83B3639F2A78E6D6DA2CC2A7DE4C2FC6817819A2199A6213790B3F7573710D1'} }
                'vazirmatn' { @{name='Vazirmatn-Regular.ttf'; title='Vazirmatn Regular (TrueType)'; url='https://raw.githubusercontent.com/rastikerdar/vazirmatn/v33.003/fonts/ttf/Vazirmatn-Regular.ttf'; hash='B69FD4C680B8F3F225FEABCC655A2C585D97627B8F5F5C0F9985E894069F3A56'} }
                default { throw 'Unknown font' }
            }
            $dir = Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Fonts'
            [IO.Directory]::CreateDirectory($dir) | Out-Null
            $target = Join-Path $dir $font.name
            $download = Join-Path ([IO.Path]::GetTempPath()) ([IO.Path]::GetRandomFileName())
            try {
                [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
                Invoke-WebRequest -UseBasicParsing -Uri $font.url -OutFile $download -TimeoutSec 60
                if ((Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash -ne $font.hash) { throw 'Font SHA-256 mismatch' }
                if (Test-Path -LiteralPath $target) {
                    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $font.hash) { throw 'Existing font differs. Refusing overwrite.' }
                } else { Copy-Item -LiteralPath $download -Destination $target }
                $key = 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts'
                New-Item -Path $key -Force | Out-Null
                New-ItemProperty -LiteralPath $key -Name $font.title -Value $target -PropertyType String -Force | Out-Null
                Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class VibeHubFont { [DllImport("gdi32.dll",CharSet=CharSet.Unicode)] public static extern int AddFontResourceEx(string path,uint flags,IntPtr reserved); }'
                if ([VibeHubFont]::AddFontResourceEx($target,0,[IntPtr]::Zero) -eq 0) { throw 'Windows could not load the font. Registry entry remains for the next sign-in.' }
                @{ok=$true; name=$font.title; detail='Checksum-verified font installed for the current user. Restart terminals to refresh font lists.'}
            } finally { if (Test-Path -LiteralPath $download) { Remove-Item -LiteralPath $download } }
        }
        'app-path' {
            $names = @{qoder=@('Qoder.exe','QoderAI.exe');zcode=@('ZCode.exe');'deepseek-harness'=@('DeepSeek Harness.exe','DeepSeek.exe');antigravity=@('Antigravity.exe')}
            $id = [string]$request.appId
            $path = [string]$request.path
            if (-not $names.ContainsKey($id) -or -not [IO.Path]::IsPathRooted($path) -or -not (Test-Path -LiteralPath $path -PathType Leaf) -or [IO.Path]::GetFileName($path) -notin $names[$id]) { throw 'Select the executable belonging to this application.' }
            Save-RtlPath $id $path
            @{ok=$true}
        }
        'focus-app' {
            $id = [string]$request.appId
            if ($id -notin @('zcode','qoder','deepseek-harness','opencode','mimocode','freebuff','antigravity','chatgpt')) { throw 'Unknown app' }
            $exe = Find-App $id
            $target = Get-Process -ErrorAction SilentlyContinue | Where-Object { try { $_.Path -ieq $exe -and $_.MainWindowHandle -ne 0 } catch { $false } } | Select-Object -First 1
            if (-not $exe -or -not $target) { throw 'No application window was found.' }
            Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class HubWindow { [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h,int n); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); }'
            [HubWindow]::ShowWindowAsync($target.MainWindowHandle,9) | Out-Null
            if (-not [HubWindow]::SetForegroundWindow($target.MainWindowHandle)) { throw 'Windows did not activate the application window.' }
            @{ok=$true;rtl=$false;detail='Application window activated'}
        }
        'launch' {
            $id = [string]$request.req.appId
            if ($id -notin @('zcode','qoder','deepseek-harness','opencode','mimocode','freebuff','antigravity','chatgpt')) { throw 'Unknown app' }
            $exe = Find-App $id
            if (-not $exe -and -not $request.req.rtl) { throw 'App is not installed in a recognized location.' }
            $cwd = if ($request.req.cwd) { [string]$request.req.cwd } else { [Environment]::GetFolderPath('UserProfile') }
            if (-not (Test-Path -LiteralPath $cwd -PathType Container)) { throw 'Working directory does not exist.' }
            $env:VIBEHUB_PROJECT = if ($request.req.cwd) { $cwd } else { '' }
            if ($request.proxyUrl) { $env:HTTP_PROXY=$request.proxyUrl; $env:HTTPS_PROXY=$request.proxyUrl; $env:ALL_PROXY=$request.proxyUrl; $env:NO_PROXY='localhost,127.0.0.1,::1' }
            elseif ($request.direct) { foreach ($name in @('HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY')) { [Environment]::SetEnvironmentVariable($name,$null,'Process') } }
            if ($request.req.rtl) {
                $folder = switch ($id) { 'zcode' {'ZCode'} 'qoder' {'Qoder'} 'deepseek-harness' {'DeepSeekHarness'} 'antigravity' {'Antigravity'} default {throw 'RTL is unavailable for this app'} }
                $port = switch ($id) { 'zcode' {9222} 'qoder' {9225} 'deepseek-harness' {9228} 'antigravity' {9231} }
                $script = Join-Path $root "apps\$folder\start.ps1"
                if ($id -eq 'antigravity') { $env:ANTIGRAVITY_RTL_EXE = $exe }
                $alreadyRtl = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
                Invoke-HubRtlLauncher $script
                if ($alreadyRtl -and $request.req.cwd) { Start-Process -FilePath $exe -ArgumentList ('"' + ($cwd.TrimEnd('\') + '\.') + '"') -WorkingDirectory $cwd | Out-Null }
                $injector = Join-Path $root "apps\$folder\injector.mjs"
                $owner = Get-NetTCPConnection -LocalPort ($port+1) -State Listen -ErrorAction Stop | Select-Object -First 1
                $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($owner.OwningProcess)"
                if ($proc.Name -ine 'node.exe' -or $proc.CommandLine -notmatch [regex]::Escape($injector)) { throw 'RTL injector ownership verification failed' }
                @{ok=$true; rtl=$true; port=$port; injectorPid=$proc.ProcessId; injectorPath=$injector; since=[DateTime]::UtcNow.ToString('o'); detail='RTL launcher and owned injector are running'}
            } elseif ($id -in @('opencode','mimocode','freebuff')) {
                # Visible shell is the requested product UI. No user text is parsed as code.
                $quotedExe = $exe.Replace("'", "''")
                $code = "& '$quotedExe'"
                $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($code))
                $proc = Start-Process -FilePath powershell.exe -ArgumentList @('-NoLogo','-NoExit','-EncodedCommand',$encoded) -WorkingDirectory $cwd -PassThru
                $detail = if ($request.proxyUrl) { 'Opened CLI in a terminal with proxy settings requested; tool routing is not verified.' } else { 'Opened CLI in a terminal' }
                @{ok=$true;rtl=$false;pid=$proc.Id;since=[DateTime]::UtcNow.ToString('o');proxyConfigured=[bool]$request.proxyUrl;proxyRoutingVerified=$false;detail=$detail}
            } else {
                $startInfo = [Diagnostics.ProcessStartInfo]::new()
                $startInfo.FileName = $exe
                $startInfo.WorkingDirectory = $cwd
                $startInfo.UseShellExecute = $false
                if ($request.req.cwd) { $startInfo.Arguments = '"' + ($cwd.TrimEnd('\') + '\.') + '"' }
                if ($request.proxyUrl) { $startInfo.Arguments += ' --proxy-server=' + (([string]$request.proxyUrl) -replace '^socks5h://','socks5://') }
                $proc = [Diagnostics.Process]::Start($startInfo)
                $detail = if ($request.proxyUrl) { 'Application started with proxy settings requested; app routing is not verified.' } else { 'Application process started' }
                $launchResult = @{ok=$true;rtl=$false;pid=$proc.Id;since=[DateTime]::UtcNow.ToString('o');proxyConfigured=[bool]$request.proxyUrl;proxyRoutingVerified=$false;detail=$detail}
                if ($request.waitForTestExitMs -is [int] -and $request.waitForTestExitMs -ge 1 -and $request.waitForTestExitMs -le 5000) {
                    $launchResult.testProcessCompleted = $proc.WaitForExit($request.waitForTestExitMs)
                    if ($launchResult.testProcessCompleted) { $launchResult.testExitCode = $proc.ExitCode }
                }
                $launchResult
            }
        }
        'launch-state' { Get-LaunchState $request.state }
        'launch-states' {
            $states = @{}
            foreach ($entry in $request.states.PSObject.Properties) {
                $states[$entry.Name] = Get-LaunchState $entry.Value $entry.Name
            }
            $states
        }
        'stop-rtl' {
            $state = $request.state
            if (-not $state.rtl) { $false; break }
            $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$state.injectorPid)" -ErrorAction SilentlyContinue
            if ($proc) {
                if ($proc.Name -ine 'node.exe' -or $proc.CommandLine -notmatch [regex]::Escape([string]$state.injectorPath)) { throw 'PID no longer belongs to the managed injector. Refusing stop.' }
                Stop-Process -Id $proc.ProcessId -ErrorAction Stop
            }
            $true
        }
        'doctor' {
            foreach ($name in @('node','winget')) {
                $cmd = Get-Command $name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
                @{id=$name;label=@{en=$name;fa=$name};status=$(if($cmd){'pass'}else{'fail'});detail=$(if($cmd){$cmd.Source}else{'Not found on PATH'})}
            }

        }
        default { throw 'Unknown native operation' }
    }
    [Console]::Out.WriteLine('VIBEHUB_JSON:' + (ConvertTo-Json -InputObject $result -Depth 30 -Compress))
} catch {
    [Console]::Out.WriteLine('VIBEHUB_JSON:' + (ConvertTo-Json -InputObject @{error=$_.Exception.Message} -Compress))
    exit 1
}
