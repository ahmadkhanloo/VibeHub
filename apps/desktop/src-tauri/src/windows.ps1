# Fixed local adapter. Request data arrives as JSON on stdin, never as PowerShell code.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
$root = [string]$request.resourceRoot
# Tauri can return extended-length paths; Windows PowerShell providers reject them.
if ($root.StartsWith('\\?\UNC\', [StringComparison]::OrdinalIgnoreCase)) { $root = '\\' + $root.Substring(8) }
elseif ($root.StartsWith('\\?\', [StringComparison]::Ordinal)) { $root = $root.Substring(4) }
$utf8 = [Text.UTF8Encoding]::new($true)
$begin = '# >>> VibeHub managed prompt >>>'
$end = '# <<< VibeHub managed prompt <<<'

function ProfilePath { $PROFILE.CurrentUserAllHosts }
function ProfileText { $p = ProfilePath; if (Test-Path -LiteralPath $p) { [IO.File]::ReadAllText($p) } else { '' } }
function ThemeBlockPattern { '(?ms)^' + [regex]::Escape($begin) + '\r?\n.*?^' + [regex]::Escape($end) + '(?:\r?\n)?' }

function Read-UninstallEntries {
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

function Find-App([string]$id) {
    if ($id -in @('qoder','zcode','deepseek-harness')) {
        $folder = switch ($id) { 'qoder' {'Qoder'} 'zcode' {'ZCode'} 'deepseek-harness' {'DeepSeekHarness'} }
        $legacy = Join-Path $root "apps\$folder\start.ps1"
        if (Test-Path -LiteralPath $legacy) {
            $lines = & powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $legacy -Discover 2>$null
            $encoded = $lines | Where-Object { $_ -like 'RTL_DISCOVER_B64:*' } | Select-Object -First 1
            if ($encoded) {
                $resolvedExe = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded.Substring(17)))
                if (Test-Path -LiteralPath $resolvedExe -PathType Leaf) { return $resolvedExe }
            }
        }
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
            $command = Get-Command $id -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($command) { $candidates = @($command.Source) }
        }
    }
    $found = $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
    if ($found) { return $found }
    Find-RegisteredAppPath $id
}

function Detect-Apps {
    @('zcode','qoder','deepseek-harness','opencode','mimocode','freebuff') | ForEach-Object {
        $path = Find-App $_
        $result = @{ id = $_; installed = [bool]$path; via = 'standard-path-or-PATH' }
        if ($path) { $result.path = $path; $version = (Get-Item -LiteralPath $path).VersionInfo.ProductVersion; if ($version) { $result.version = $version } }
        $result
    }
}

function Detect-Editors {
    $registrations = @(Read-UninstallEntries | Where-Object { $_.DisplayName })
    $specs = @(
        @{ id='vscode'; name='Visual Studio Code'; pattern='^Microsoft Visual Studio Code(?: \(User\))?$'; exe='Code.exe'; paths=@("$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe", "$env:ProgramFiles\Microsoft VS Code\Code.exe") },
        @{ id='vscode-insiders'; name='Visual Studio Code Insiders'; pattern='^(?:Microsoft )?Visual Studio Code Insiders(?: \(User\))?$'; exe='Code - Insiders.exe'; paths=@("$env:LOCALAPPDATA\Programs\Microsoft VS Code Insiders\Code - Insiders.exe") },
        @{ id='antigravity'; name='Antigravity'; pattern='^Antigravity(?: \d[\w.-]*)?$'; exe='Antigravity.exe'; paths=@("$env:LOCALAPPDATA\Programs\Antigravity\Antigravity.exe", "$env:LOCALAPPDATA\Programs\antigravity\Antigravity.exe") },
        @{ id='antigravity-ide'; name='Antigravity IDE'; pattern='^Antigravity IDE(?: \(User\))?$'; exe='Antigravity IDE.exe'; paths=@("$env:LOCALAPPDATA\Programs\Antigravity IDE\Antigravity IDE.exe") },
        @{ id='cursor'; name='Cursor'; pattern='^Cursor(?: \(User\))?$'; exe='Cursor.exe'; paths=@("$env:LOCALAPPDATA\Programs\Cursor\Cursor.exe") },
        @{ id='windsurf'; name='Windsurf'; pattern='^Windsurf(?: \(User\))?$'; exe='Windsurf.exe'; paths=@("$env:LOCALAPPDATA\Programs\Windsurf\Windsurf.exe") },
        @{ id='zed'; name='Zed'; pattern='^Zed(?: \(User\))?$'; exe='Zed.exe'; paths=@("$env:LOCALAPPDATA\Programs\Zed\Zed.exe") },
        @{ id='trae'; name='Trae'; pattern='^Trae(?: \(User\))?$'; exe='Trae.exe'; paths=@("$env:LOCALAPPDATA\Programs\Trae\Trae.exe") },
        @{ id='kiro'; name='Kiro'; pattern='^Kiro(?: \(User\))?$'; exe='Kiro.exe'; paths=@("$env:LOCALAPPDATA\Programs\Kiro\Kiro.exe") },
        @{ id='vscodium'; name='VSCodium'; pattern='^VSCodium(?: \(User\))?$'; exe='VSCodium.exe'; paths=@("$env:LOCALAPPDATA\Programs\VSCodium\VSCodium.exe", "$env:ProgramFiles\VSCodium\VSCodium.exe") }
    )

    foreach ($spec in $specs) {
        $candidates = [Collections.Generic.List[object]]::new()
        foreach ($path in $spec.paths) { $candidates.Add(@{ path=$path; via='standard-path' }) }
        foreach ($entry in ($registrations | Where-Object { $_.DisplayName -match $spec.pattern })) {
            if ($entry.DisplayIcon) {
                $icon = [Environment]::ExpandEnvironmentVariables([string]$entry.DisplayIcon)
                if ($icon -match '^\s*"(?<path>[^"]+\.exe)"') { $candidates.Add(@{ path=$Matches.path; via='registry' }) }
                elseif ($icon -match '^\s*(?<path>.*?\.exe)(?:,\d+)?\s*$') { $candidates.Add(@{ path=$Matches.path.Trim('"'); via='registry' }) }
            }
            if ($entry.InstallLocation) {
                $location = [Environment]::ExpandEnvironmentVariables([string]$entry.InstallLocation).Trim('"')
                $candidates.Add(@{ path=(Join-Path $location $spec.exe); via='registry' })
            }
        }
        $found = $candidates | Where-Object { $_.path -and (Test-Path -LiteralPath $_.path -PathType Leaf) } | Select-Object -First 1
        if ($found) {
            $version = (Get-Item -LiteralPath $found.path).VersionInfo.ProductVersion
            if (-not $version) {
                $version = ($registrations | Where-Object { $_.DisplayName -match $spec.pattern } | Select-Object -First 1).DisplayVersion
            }
            @{ id=$spec.id; name=$spec.name; installed=$true; path=$found.path; via=$found.via; version=$version }
        }
    }
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
        'detect' { @(Detect-Apps) }
        'detect-editors' { @(Detect-Editors) }
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
            $launchResult = @{ok=$true;id=$id;pid=$proc.Id;proxyConfigured=[bool]$request.proxyUrl;proxyRoutingVerified=$false;detail=$detail}
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
        'launch' {
            $id = [string]$request.req.appId
            if ($id -notin @('zcode','qoder','deepseek-harness','opencode','mimocode','freebuff')) { throw 'Unknown app' }
            $exe = Find-App $id
            if (-not $exe -and -not $request.req.rtl) { throw 'App is not installed in a recognized location.' }
            $cwd = if ($request.req.cwd) { [string]$request.req.cwd } else { [Environment]::GetFolderPath('UserProfile') }
            if (-not (Test-Path -LiteralPath $cwd -PathType Container)) { throw 'Working directory does not exist.' }
            if ($request.proxyUrl) { $env:HTTP_PROXY=$request.proxyUrl; $env:HTTPS_PROXY=$request.proxyUrl; $env:ALL_PROXY=$request.proxyUrl; $env:NO_PROXY='localhost,127.0.0.1,::1' }
            elseif ($request.direct) { foreach ($name in @('HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY')) { [Environment]::SetEnvironmentVariable($name,$null,'Process') } }
            if ($request.req.rtl) {
                $folder = switch ($id) { 'zcode' {'ZCode'} 'qoder' {'Qoder'} 'deepseek-harness' {'DeepSeekHarness'} default {throw 'RTL is unavailable for this app'} }
                $port = switch ($id) { 'zcode' {9222} 'qoder' {9225} 'deepseek-harness' {9228} }
                $script = Join-Path $root "apps\$folder\start.ps1"
                & $script -Gui
                if ($LASTEXITCODE -ne 0) { throw 'RTL launcher failed. Review the app RTL log.' }
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
                $proc = Start-Process -FilePath $exe -WorkingDirectory $cwd -PassThru
                $detail = if ($request.proxyUrl) { 'Application started with proxy settings requested; app routing is not verified.' } else { 'Application process started' }
                @{ok=$true;rtl=$false;pid=$proc.Id;since=[DateTime]::UtcNow.ToString('o');proxyConfigured=[bool]$request.proxyUrl;proxyRoutingVerified=$false;detail=$detail}
            }
        }
        'launch-state' {
            if ($request.state.rtl) {
                $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$request.state.injectorPid)" -ErrorAction SilentlyContinue
                $alive = $proc -and $proc.Name -ieq 'node.exe' -and $proc.CommandLine -match [regex]::Escape([string]$request.state.injectorPath)
            } else { $alive = [bool](Get-Process -Id ([int]$request.state.pid) -ErrorAction SilentlyContinue) }
            if ($alive) { @{phase='running';rtl=[bool]$request.state.rtl;since=$request.state.since;port=$request.state.port} } else { @{phase='idle'} }
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
            foreach ($name in @('node','winget','oh-my-posh')) {
                $cmd = Get-Command $name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
                @{id=$name;label=@{en=$name;fa=$name};status=$(if($cmd){'pass'}else{'fail'});detail=$(if($cmd){$cmd.Source}else{'Not found on PATH'})}
            }
            @{id='profile';label=@{en='PowerShell profile';fa='PowerShell profile'};status='unknown';detail=(ProfilePath)}
        }
        default { throw 'Unknown native operation' }
    }
    [Console]::Out.WriteLine('VIBEHUB_JSON:' + (ConvertTo-Json -InputObject $result -Depth 30 -Compress))
} catch {
    [Console]::Out.WriteLine('VIBEHUB_JSON:' + (ConvertTo-Json -InputObject @{error=$_.Exception.Message} -Compress))
    exit 1
}
