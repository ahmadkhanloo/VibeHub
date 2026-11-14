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

function Install-HubRtlShortcut([string]$resourceRoot, [string]$appId, [string]$programsRoot) {
    # IShellLinkW preserves Unicode targets; WScript.Shell rejects some Persian paths.
    if (-not ('VibeHub.RtlShortcuts' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
namespace VibeHub {
    [ComImport, Guid("000214F9-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IShellLinkW {
        void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int count, IntPtr data, uint flags);
        void GetIDList(out IntPtr id);
        void SetIDList(IntPtr id);
        void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder text, int count);
        void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string text);
        void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int count);
        void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string path);
        void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder text, int count);
        void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string text);
        void GetHotkey(out short key);
        void SetHotkey(short key);
        void GetShowCmd(out int command);
        void SetShowCmd(int command);
        void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int count, out int index);
        void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string path, int index);
        void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string path, uint reserved);
        void Resolve(IntPtr window, uint flags);
        void SetPath([MarshalAs(UnmanagedType.LPWStr)] string path);
    }
    public static class RtlShortcuts {
        static object Create() { return Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("00021401-0000-0000-C000-000000000046"))); }
        public static string Target(string path) {
            object value = Create();
            try {
                ((IPersistFile)value).Load(path, 0);
                var buffer = new StringBuilder(32768);
                ((IShellLinkW)value).GetPath(buffer, buffer.Capacity, IntPtr.Zero, 4);
                return buffer.ToString();
            } finally { Marshal.FinalReleaseComObject(value); }
        }
        public static void Save(string path, string target, string directory, string icon) {
            object value = Create();
            try {
                var link = (IShellLinkW)value;
                link.SetPath(target);
                link.SetArguments("");
                link.SetWorkingDirectory(directory);
                link.SetIconLocation(icon, 0);
                link.SetDescription("VibeHub managed RTL launcher");
                ((IPersistFile)value).Save(path, true);
            } finally { Marshal.FinalReleaseComObject(value); }
        }
    }
}
'@
    }
    $folders = @{zcode='ZCode'; qoder='Qoder'; 'deepseek-harness'='DeepSeekHarness'; antigravity='Antigravity'; opencode='OpenCode'; 'claude-desktop'='Claude'}
    $names = @{zcode='ZCode'; qoder='Qoder'; 'deepseek-harness'='DeepSeek Harness'; antigravity='Antigravity'; opencode='OpenCode'; 'claude-desktop'='Claude Desktop'}
    if (-not $folders.ContainsKey($appId)) { throw 'RTL is unavailable for this app.' }
    $adapter = Join-Path $resourceRoot ('apps\' + $folders[$appId])
    $required = @((Join-Path $resourceRoot 'apps\rtl-paths.ps1'), (Join-Path $resourceRoot 'apps\rtl-direction.mjs'))
    $required += @('start.ps1','launch.vbs','injector.mjs','rtl.ico','rtl-shortcut.ico') | ForEach-Object { Join-Path $adapter $_ }
    if ($appId -in @('qoder','antigravity','opencode','claude-desktop')) { $required += Join-Path $adapter 'style.mjs' }
    if ($appId -eq 'claude-desktop') { $required += Join-Path $adapter 'compatibility.json' }
    if ($appId -in @('qoder','zcode','deepseek-harness','antigravity','opencode','claude-desktop')) {
        $required += @('Vazirmatn-Regular.woff2','Vazirmatn-Bold.woff2') | ForEach-Object { Join-Path $adapter ('assets\' + $_) }
    }
    foreach ($file in $required) { if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw 'RTL files are missing. Install the full VibeHub package first.' } }
    if (-not ((Test-Path -LiteralPath (Join-Path $resourceRoot 'runtime\node.exe') -PathType Leaf) -or (Test-Path -LiteralPath (Join-Path $resourceRoot 'apps\desktop\src-tauri\windows\payload\node.exe') -PathType Leaf))) { throw 'The bundled RTL runtime is missing. Install the full VibeHub package first.' }
    $directory = Join-Path $programsRoot 'VibeHub'
    $null = [IO.Directory]::CreateDirectory($directory)
    $destination = Join-Path $directory ($names[$appId] + ' RTL.lnk')
    $target = Join-Path $adapter 'launch.vbs'
    if ((Test-Path -LiteralPath $destination) -and [VibeHub.RtlShortcuts]::Target($destination) -ine $target) { throw 'An unrelated shortcut already uses this name. Keep it or rename it before retrying.' }
    [VibeHub.RtlShortcuts]::Save($destination, $target, $adapter, (Join-Path $adapter 'rtl-shortcut.ico'))
    $desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) ($names[$appId] + ' RTL.lnk')
    if ((Test-Path -LiteralPath $desktopShortcut -PathType Leaf) -and [VibeHub.RtlShortcuts]::Target($desktopShortcut) -ieq $target) {
        [VibeHub.RtlShortcuts]::Save($desktopShortcut, $target, $adapter, (Join-Path $adapter 'rtl-shortcut.ico'))
    }
    @{ok=$true;shortcut=$destination}
}

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
        'opencode' { '^OpenCode(?:\s+.*)?$' }
        'freebuff-desktop' { '^Freebuff(?: Desktop)?(?:\s+.*)?$' }
        'antigravity-ide' { '^Antigravity IDE(?:\s+.*)?$' }
        'claude-desktop' { '^Claude(?: Desktop)?(?:\s+.*)?$' }
        default { return $null }
    }
    $exeNames = switch ($id) {
        'zcode' { @('ZCode.exe') }
        'qoder' { @('Qoder IDE.exe', 'Qoder.exe') }
        'deepseek-harness' { @('DeepSeek Harness.exe') }
        'opencode' { @('OpenCode.exe') }
        'freebuff-desktop' { @('Freebuff.exe') }
        'antigravity-ide' { @('Antigravity IDE.exe') }
        'claude-desktop' { @('Claude.exe') }
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

function Resolve-OpenAIProduct([string]$packageName, [string]$executablePath) {
    if ([string]::IsNullOrWhiteSpace($packageName) -or [string]::IsNullOrWhiteSpace($executablePath)) { return 'unknown' }
    try { $path = [IO.Path]::GetFullPath($executablePath) } catch { return 'unknown' }
    $codexPath = '(?i)\\WindowsApps\\OpenAI\.Codex_\d+(?:\.\d+){2,3}_x64__2p2nqsd0c76g0\\app\\ChatGPT\.exe$'
    $chatGptPath = '(?i)\\WindowsApps\\OpenAI\.ChatGPT_\d+(?:\.\d+){2,3}_x64__2p2nqsd0c76g0\\app\\ChatGPT\.exe$'
    if ($packageName -ieq 'OpenAI.Codex' -and $path -match $codexPath) { return 'codex' }
    if ($packageName -ieq 'OpenAI.ChatGPT' -and $path -match $chatGptPath) { return 'chatgpt' }
    return 'unknown'
}

function Get-OpenAIProductForPath([string]$executablePath) {
    if ([string]::IsNullOrWhiteSpace($executablePath)) { return 'unknown' }
    foreach ($packageName in @('OpenAI.Codex','OpenAI.ChatGPT')) {
        foreach ($package in @(Get-AppxPackage -Name $packageName -ErrorAction SilentlyContinue)) {
            $candidate = Join-Path $package.InstallLocation 'app\ChatGPT.exe'
            if ($executablePath -ieq $candidate) {
                return Resolve-OpenAIProduct $package.Name $candidate
            }
        }
    }
    return 'unknown'
}

function Get-CodexRtlAvailability([string]$resourceRoot, [string]$packageName, [string]$executablePath, [bool]$cdpLaunchVerified = $false) {
    $resolvedProduct = Resolve-OpenAIProduct $packageName $executablePath
    # No CodexDesktop adapter ships today; the six shipped adapters live under apps\ in the payload.
    $runtime = (Test-Path -LiteralPath (Join-Path $resourceRoot 'runtime\node.exe') -PathType Leaf) -or
        (Test-Path -LiteralPath (Join-Path $resourceRoot 'apps\desktop\src-tauri\windows\payload\node.exe') -PathType Leaf)
    $available = $resolvedProduct -eq 'codex' -and $cdpLaunchVerified -and
        (Test-Path -LiteralPath $executablePath -PathType Leaf) -and $runtime
    $reason = if ($resolvedProduct -eq 'chatgpt') {
        'RTL is unavailable for ordinary ChatGPT; only Codex Desktop is eligible.'
    } elseif ($resolvedProduct -ne 'codex') {
        'The OpenAI executable is not tied to a verified OpenAI desktop package.'
    } elseif (-not $cdpLaunchVerified) {
        'Codex Desktop RTL is unavailable because a supported CDP startup path has not been verified for the installed package.'
    } elseif (-not $runtime) {
        'The bundled RTL runtime is missing.'
    } else { '' }
    @{id='chatgpt';available=[bool]$available;configured=$false;setupSupported=($resolvedProduct -eq 'codex' -and $cdpLaunchVerified);product=$resolvedProduct;reason=$reason}
}

function CodexRtlStatus([string]$resourceRoot, [string]$executablePath = (Find-App 'chatgpt')) {
    $package = @(Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction SilentlyContinue |
        Where-Object { $executablePath -ieq (Join-Path $_.InstallLocation 'app\ChatGPT.exe') } |
        Select-Object -First 1)
    $packageName = if ($package.Count) { [string]$package[0].Name } else { '' }
    # Keep this false until the AppX launch route and account-preserving CDP profile are verified on the installed app.
    Get-CodexRtlAvailability $resourceRoot $packageName $executablePath $false
}

function Codex-DesktopState {
    $packages = @(Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction Stop | Where-Object {
        (Resolve-OpenAIProduct $_.Name (Join-Path $_.InstallLocation 'app\ChatGPT.exe')) -eq 'codex'
    })
    $package = $packages | Select-Object -First 1
    $exe = if ($package) { Join-Path $package.InstallLocation 'app\ChatGPT.exe' }
    $processes = @(Get-Process -Name ChatGPT,Codex -ErrorAction SilentlyContinue)
    $known = @($processes | Where-Object { $exe -and $_.Path -ieq $exe })
    $unknown = @($processes | Where-Object {
        (-not $_.Path -and $_.MainWindowHandle -ne 0) -or
        ($_.Path -ine $exe -and $_.Path -match '\\WindowsApps\\OpenAI\.Codex_')
    })
    @{
        installed=($packages.Count -gt 0)
        running=($known.Count -gt 0 -or $unknown.Count -gt 0)
        ambiguous=($packages.Count -gt 1 -or $unknown.Count -gt 0)
        launchPath=$exe
        packageFamily=$package.PackageFamilyName
    }
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

function Test-AntigravityIdePath([string]$path) {
    if (-not $path -or [IO.Path]::GetFileName($path) -ine 'Antigravity IDE.exe' -or -not (Test-Path -LiteralPath $path -PathType Leaf)) { return $false }
    # Some releases accidentally shipped the standalone App under the IDE filename.
    $productFile = Join-Path (Split-Path -Parent $path) 'resources\app\product.json'
    try {
        $product = [IO.File]::ReadAllText($productFile) | ConvertFrom-Json
        return $product.applicationName -eq 'antigravity-ide' -and $product.nameShort -eq 'Antigravity IDE'
    } catch { return $false }
}

function Test-ClaudeCliPath([string]$path) {
    if (-not $path -or [IO.Path]::GetFileName($path) -notin @('claude.exe','claude.cmd','claude.bat') -or -not (Test-Path -LiteralPath $path -PathType Leaf)) { return $false }
    # Claude Desktop also uses Claude.exe (Windows filenames are case insensitive).
    return (Get-Item -LiteralPath $path).VersionInfo.ProductName -notmatch '^Claude(?: Desktop)?$'
}

function Find-ClaudeDesktopPackage {
    foreach ($package in @(Get-AppxPackage -Name 'Claude' -ErrorAction SilentlyContinue)) {
        if (-not $package.InstallLocation) { continue }
        try {
            $manifest = Get-AppxPackageManifest -Package $package -ErrorAction Stop
            foreach ($application in @($manifest.Package.Applications.Application)) {
                if ([IO.Path]::GetFileName([string]$application.Executable) -ieq 'Claude.exe') {
                    return @{
                        path = Join-Path $package.InstallLocation ([string]$application.Executable)
                        appUserModelId = "$($package.PackageFamilyName)!$($application.Id)"
                    }
                }
            }
        } catch {}
    }
}

function Find-App([string]$id) {
    if ($id -eq 'freebuff-desktop') {
        $saved = if (Get-Command Get-RtlSavedPath -ErrorAction SilentlyContinue) { Get-RtlSavedPath $id }
        foreach ($candidate in @($saved, "$env:LOCALAPPDATA\Programs\@codebufffreebuff-desktop\Freebuff.exe", (Find-RegisteredAppPath $id))) {
            if ($candidate -and [IO.Path]::GetFileName($candidate) -ieq 'Freebuff.exe' -and
                (Test-Path -LiteralPath $candidate -PathType Leaf) -and
                (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $candidate) 'resources\app.asar') -PathType Leaf)) { return $candidate }
        }
        return $null
    }
    if ($id -eq 'claude-desktop') {
        # Prefer the registered MSIX over legacy installs left on disk. Cowork requires MSIX.
        $package = Find-ClaudeDesktopPackage
        if ($package) { return $package.path }
        if (Get-Command Get-RtlExecutable -ErrorAction SilentlyContinue) {
            $resolved = Get-RtlExecutable $id (Join-Path $root 'apps\Claude')
            if ($resolved -and -not (Test-ClaudeCliPath $resolved)) { return $resolved }
        }
        $registered = Find-RegisteredAppPath $id
        if ($registered -and -not (Test-ClaudeCliPath $registered)) { return $registered }
        return $null
    }
    if (Get-Command Get-RtlSavedPath -ErrorAction SilentlyContinue) {
        $saved = Get-RtlSavedPath $id
        if ($saved -and ($id -ne 'antigravity-ide' -or (Test-AntigravityIdePath $saved)) -and ($id -ne 'claude-code' -or (Test-ClaudeCliPath $saved))) { return $saved }
    }
    if ($id -eq 'antigravity-ide') {
        $candidates = @("$env:LOCALAPPDATA\Programs\Antigravity IDE\Antigravity IDE.exe", "$env:ProgramFiles\Antigravity IDE\Antigravity IDE.exe", (Find-RegisteredAppPath $id))
        return $candidates | Where-Object { Test-AntigravityIdePath $_ } | Select-Object -First 1
    }
    if ($id -eq 'claude-code') {
        $candidates = @("$env:USERPROFILE\.local\bin\claude.exe", "$env:APPDATA\npm\claude.cmd", (Find-App 'claude'))
        return $candidates | Where-Object { Test-ClaudeCliPath $_ } | Select-Object -First 1
    }
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
        'copilot-cli' { return Find-App 'copilot' }
        'opencode' { $candidates = @("$env:LOCALAPPDATA\Programs\ai.opencode.desktop\OpenCode.exe") }
        default {
            # Native file checks avoid module discovery for missing CLI commands.
            $paths = @($env:PATH, [Environment]::GetEnvironmentVariable('Path','User'), [Environment]::GetEnvironmentVariable('Path','Machine')) -join ';'
            foreach ($directory in ($paths -split ';' | Select-Object -Unique)) {
                if (-not $directory) { continue }
                foreach ($extension in ($env:PATHEXT -split ';')) {
                    if (-not $extension) { continue }
                    $commandName = $id
                    try { $candidate = [IO.Path]::Combine([Environment]::ExpandEnvironmentVariables($directory.Trim('"')), "$commandName$extension") } catch { continue }
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
    @('zcode','qoder','deepseek-harness','opencode','mimocode','freebuff','freebuff-desktop','copilot-cli','antigravity-ide','chatgpt','claude-code','claude-desktop') | ForEach-Object {
        $path = Find-App $_
        $via = 'standard-path-or-PATH'
        $result = @{ id = $_; installed = [bool]$path; via = $via }
        if ($path) { $result.path = $path; $version = (Get-Item -LiteralPath $path -ErrorAction SilentlyContinue).VersionInfo.ProductVersion; if ($version) { $result.version = $version } }
        $result
    }
}

function Detect-Editors { @() }

function Get-RtlComponents([string]$resourceRoot) {
    $names = @{zcode='ZCode';qoder='Qoder';'deepseek-harness'='DeepSeekHarness';antigravity='Antigravity';opencode='OpenCode';'claude-desktop'='Claude'}
    $labels = @{zcode='ZCode';qoder='Qoder';'deepseek-harness'='DeepSeek Harness';antigravity='Antigravity';opencode='OpenCode';'claude-desktop'='Claude Desktop'}
    $runtime = (Test-Path -LiteralPath (Join-Path $resourceRoot 'runtime\node.exe') -PathType Leaf) -or
        (Test-Path -LiteralPath (Join-Path $resourceRoot 'apps\desktop\src-tauri\windows\payload\node.exe') -PathType Leaf)
    foreach ($id in @('zcode','qoder','deepseek-harness','antigravity','opencode')) {
        $adapter = Join-Path $resourceRoot ('apps\' + $names[$id])
        $required = @((Join-Path $resourceRoot 'apps\rtl-paths.ps1'), (Join-Path $resourceRoot 'apps\rtl-launch-lib.ps1'), (Join-Path $resourceRoot 'apps\rtl-direction.mjs'))
        $required += @('start.ps1','launch.vbs','injector.mjs','rtl.ico','rtl-shortcut.ico') | ForEach-Object { Join-Path $adapter $_ }
        if ($id -in @('qoder','antigravity','opencode')) { $required += Join-Path $adapter 'style.mjs' }
        if ($id -in @('qoder','zcode','deepseek-harness','antigravity','opencode')) { $required += @('Vazirmatn-Regular.woff2','Vazirmatn-Bold.woff2') | ForEach-Object { Join-Path $adapter ('assets\' + $_) } }
        $available = $runtime -and ($required | ForEach-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Where-Object { -not $_ } | Measure-Object).Count -eq 0 -and [bool](Find-App $id)
        $shortcut = Join-Path ([Environment]::GetFolderPath('Programs')) ('VibeHub\' + $labels[$id] + ' RTL.lnk')
        $configured = $false
        if ($available -and (Test-Path -LiteralPath $shortcut -PathType Leaf)) {
            try {
                $shell = New-Object -ComObject WScript.Shell
                $target = $shell.CreateShortcut($shortcut).TargetPath
                $expected = Join-Path $adapter 'launch.vbs'
                $configured = $target -ieq $expected -and (Test-Path -LiteralPath $target -PathType Leaf)
            } catch { $configured = $false }
        }
        @{id=$id;available=$available;configured=$configured;setupSupported=$true}
    }
    $claudeExe = Find-App 'claude-desktop'
    $claudeVersion = if ($claudeExe) { [string](Get-Item -LiteralPath $claudeExe).VersionInfo.ProductVersion } else { '' }
    $claudeSignature = if ($claudeExe) { Get-AuthenticodeSignature -FilePath $claudeExe } else { $null }
    $claudePublisherVerified = $claudeSignature -and $claudeSignature.Status -eq 'Valid' -and $claudeSignature.SignerCertificate.Subject -match 'Anthropic'
    $claudeAdapter = Join-Path $resourceRoot 'apps\Claude'
    $compatibilityPath = Join-Path $claudeAdapter 'compatibility.json'
    $compatibility = $null
    if (Test-Path -LiteralPath $compatibilityPath -PathType Leaf) {
        try { $compatibility = Get-Content -LiteralPath $compatibilityPath -Raw | ConvertFrom-Json } catch {}
    }
    $claudeRequired = @('start.ps1','launch.vbs','injector.mjs','style.mjs','cdp-targets.mjs','compatibility.json','rtl.ico','rtl-shortcut.ico','assets\OFL.txt','assets\Vazirmatn-Regular.woff2','assets\Vazirmatn-Bold.woff2') |
        ForEach-Object { Join-Path $claudeAdapter $_ }
    $claudeRuntimeFiles = @((Join-Path $resourceRoot 'apps\rtl-paths.ps1'),(Join-Path $resourceRoot 'apps\rtl-direction.mjs'))
    $claudeRuntime = $runtime -and @($claudeRuntimeFiles | Where-Object { -not (Test-Path -LiteralPath $_ -PathType Leaf) }).Count -eq 0
    $claudeFilesPresent = @($claudeRequired | Where-Object { -not (Test-Path -LiteralPath $_ -PathType Leaf) }).Count -eq 0
    $testedVersion = if ($compatibility) { [string]$compatibility.testedVersion } else { '' }
    $versionMatches = $testedVersion -and $claudeVersion -and $claudeVersion -eq $testedVersion
    $claudeVerified = $compatibility -and $compatibility.adapterVerified -eq $true
    $claudeAvailable = [bool]($claudeExe -and $claudePublisherVerified -and $claudeRuntime -and $claudeFilesPresent -and $versionMatches -and $claudeVerified)
    $claudeReason = if (-not $claudeExe) {
        'Install Claude Desktop from claude.com/download before checking RTL compatibility.'
    } elseif (-not $claudeRuntime -or -not $claudeFilesPresent) {
        'Claude Desktop RTL files or the bundled runtime are missing. Repair the VibeHub installation.'
    } elseif (-not $claudePublisherVerified) {
        'Claude Desktop RTL requires a valid Anthropic-signed Claude.exe.'
    } elseif (-not $testedVersion) {
        if ($compatibility.reason) { [string]$compatibility.reason } else { 'Claude Desktop RTL has not been verified against a live chat renderer.' }
    } elseif (-not $versionMatches) {
        "Claude Desktop RTL is verified for version '$testedVersion'; installed version is '$claudeVersion'."
    } elseif (-not $claudeVerified) {
        [string]$compatibility.reason
    } else { '' }
    $claudeShortcut = Join-Path ([Environment]::GetFolderPath('Programs')) 'VibeHub\Claude Desktop RTL.lnk'
    $claudeConfigured = $false
    if ($claudeAvailable -and (Test-Path -LiteralPath $claudeShortcut -PathType Leaf)) {
        try {
            $shell = New-Object -ComObject WScript.Shell
            $target = $shell.CreateShortcut($claudeShortcut).TargetPath
            $expected = Join-Path $claudeAdapter 'launch.vbs'
            $claudeConfigured = $target -ieq $expected -and (Test-Path -LiteralPath $target -PathType Leaf)
        } catch { $claudeConfigured = $false }
    }
    @{id='claude-desktop';available=$claudeAvailable;configured=$claudeConfigured;setupSupported=$claudeAvailable;testedVersion=$testedVersion;installedVersion=$claudeVersion;reason=$claudeReason}
    @{id='freebuff-desktop';available=$false;configured=$false;setupSupported=$false;reason='Freebuff Desktop removes remote debugging switches; its chat RTL is unavailable in VibeHub.'}
    CodexRtlStatus $resourceRoot
}

function Get-RtlSessionBinding([string]$appId) {
    $binding = switch ($appId) {
        'zcode' { @{folder='ZCode';defaultPort=9222;portVariable='ZCODE_RTL_PORT';processNames=@('ZCode.exe')} }
        'qoder' { @{folder='Qoder';defaultPort=9225;portVariable='QODER_RTL_PORT';processNames=@('Qoder.exe','Qoder IDE.exe')} }
        'deepseek-harness' { @{folder='DeepSeekHarness';defaultPort=9228;portVariable='DEEPSEEK_HARNESS_RTL_PORT';processNames=@('DeepSeek Harness.exe','DeepSeek.exe')} }
        'antigravity' { @{folder='Antigravity';defaultPort=9231;portVariable='ANTIGRAVITY_RTL_PORT';processNames=@('Antigravity.exe')} }
        'opencode' { @{folder='OpenCode';defaultPort=9234;portVariable='OPENCODE_RTL_PORT';processNames=@('OpenCode.exe')} }
        'claude-desktop' { @{folder='Claude';defaultPort=9237;portVariable='CLAUDE_RTL_PORT';processNames=@('Claude.exe')} }
        default { return $null }
    }
    $port = [int]$binding.defaultPort
    $override = [Environment]::GetEnvironmentVariable([string]$binding.portVariable)
    if ($override) {
        $parsed = 0
        if (-not [int]::TryParse($override, [ref]$parsed) -or $parsed -lt 1024 -or $parsed -gt 65534) { throw "Invalid $($binding.portVariable) RTL port." }
        $port = $parsed
    }
    $adapter = Join-Path $root ('apps\' + $binding.folder)
    @{id=$appId;folder=$binding.folder;port=$port;lockPort=($port + 1);processNames=$binding.processNames;injectorPath=[IO.Path]::GetFullPath((Join-Path $adapter 'injector.mjs'))}
}

function Stop-ManagedRtlInjector([string]$appId, $state) {
    if (-not $state -or $state.rtl -ne $true) { return $false }
    $binding = Get-RtlSessionBinding $appId
    if (-not $binding) { throw 'Cannot stop an injector for an unsupported app.' }
    if ($state.id -and [string]$state.id -cne $appId) { throw 'RTL state belongs to another app. Refusing stop.' }
    $statePort = 0
    if (-not [int]::TryParse([string]$state.port, [ref]$statePort) -or $statePort -ne $binding.port) { throw 'RTL state port does not match this app. Refusing stop.' }
    $expectedPath = [IO.Path]::GetFullPath([string]$binding.injectorPath)
    try { $statePath = [IO.Path]::GetFullPath([string]$state.injectorPath) } catch { throw 'RTL injector path is invalid. Refusing stop.' }
    if ($statePath -ine $expectedPath) { throw 'RTL state path does not match this app injector. Refusing stop.' }
    $injectorPid = 0
    if (-not [int]::TryParse([string]$state.injectorPid, [ref]$injectorPid) -or $injectorPid -le 0) { throw 'RTL injector PID is invalid. Refusing stop.' }
    # No -State Listen filter: on recent Windows builds a loopback-only listener
    # (the node injector lock) reports a Bound state, so filtering by state would never match it.
    $connections = @(Get-NetTCPConnection -LocalPort $binding.lockPort -ErrorAction SilentlyContinue)
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$injectorPid" -ErrorAction SilentlyContinue
    if (-not $proc) {
        if ($connections.Count) { throw 'The injector lock port is owned by another process. Refusing stop.' }
        return $false
    }
    if ($proc.Name -ine 'node.exe' -or $proc.ProcessId -and [int]$proc.ProcessId -ne $injectorPid -or $proc.CommandLine -notmatch [regex]::Escape($expectedPath)) {
        throw 'PID no longer belongs to this app injector. Refusing stop.'
    }
    if (-not $connections.Count -or @($connections | Where-Object { [int]$_.OwningProcess -ne $injectorPid }).Count) {
        throw 'The injector no longer owns its lock port. Refusing stop.'
    }
    Stop-Process -Id $injectorPid -Force -ErrorAction Stop
    $true
}

function Get-LaunchState($state, [string]$appId = '') {
    if ($state.phase -eq 'failed') { return $state }
    if ($state.rtl) {
        if (-not $appId) { $appId = [string]$state.id }
        try {
            $binding = Get-RtlSessionBinding $appId
            if (-not $binding -or ($state.id -and [string]$state.id -cne $appId)) { throw 'RTL state identity mismatch.' }
            $statePort = 0
            if (-not [int]::TryParse([string]$state.port, [ref]$statePort) -or $statePort -ne $binding.port) { throw 'RTL state port mismatch.' }
            if ([IO.Path]::GetFullPath([string]$state.injectorPath) -ine $binding.injectorPath) { throw 'RTL state injector path mismatch.' }
            $injectorPid = [int]$state.injectorPid
            $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$injectorPid" -ErrorAction SilentlyContinue
            # No -State Listen filter: on recent Windows builds a loopback-only listener
            # (the node injector lock) reports a Bound state, so filtering by state would never match it.
            $connections = @(Get-NetTCPConnection -LocalPort $binding.lockPort -ErrorAction SilentlyContinue)
            $ownsLock = $connections.Count -gt 0 -and @($connections | Where-Object { [int]$_.OwningProcess -eq $injectorPid }).Count -eq $connections.Count
            $alive = $proc -and $proc.Name -ieq 'node.exe' -and $proc.CommandLine -match [regex]::Escape($binding.injectorPath) -and $ownsLock
            if ($alive) {
                $names = @($binding.processNames)
                $nameFilter = ($names | ForEach-Object { "Name='$_'" }) -join ' OR '
                $sessionId = [Diagnostics.Process]::GetCurrentProcess().SessionId
                # The injector reconnects across app window lifetimes; it alone does not mean the app is open.
                $application = Get-CimInstance Win32_Process -Filter "($nameFilter) AND SessionId=$sessionId" -ErrorAction Stop |
                    Where-Object { $_.CommandLine -notmatch '--type=' } | Select-Object -First 1
                $alive = [bool]$application
            }
        } catch { $alive = $false }
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

function Find-PersianTerminal {
    $candidate = Join-Path $env:ProgramFiles 'behnamapps\Rtl Terminal\RtlTerminal.exe'
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    $candidate = Join-Path $env:LOCALAPPDATA 'Programs\behnamapps\Rtl Terminal\RtlTerminal.exe'
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    return $null
}

function Set-ClaudeConnectionEnvironment($options) {
                    if ($options.claudeBaseUrl) {
                        foreach ($name in @('ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','CLAUDE_CODE_OAUTH_TOKEN','ANTHROPIC_BASE_URL','ANTHROPIC_MODEL','ANTHROPIC_DEFAULT_OPUS_MODEL','ANTHROPIC_DEFAULT_SONNET_MODEL','ANTHROPIC_DEFAULT_HAIKU_MODEL','CLAUDE_CODE_SUBAGENT_MODEL')) { [Environment]::SetEnvironmentVariable($name,$null,'Process') }
                        $env:ANTHROPIC_BASE_URL = [string]$options.claudeBaseUrl
                        [Environment]::SetEnvironmentVariable([string]$options.claudeAuth,[string]$options.claudeKey,'Process')
                        $env:ANTHROPIC_MODEL = [string]$options.claudeModel
                        $env:ANTHROPIC_DEFAULT_OPUS_MODEL = $env:ANTHROPIC_MODEL
                        $env:ANTHROPIC_DEFAULT_SONNET_MODEL = $env:ANTHROPIC_MODEL
                        $env:ANTHROPIC_DEFAULT_HAIKU_MODEL = $env:ANTHROPIC_MODEL
                        $env:CLAUDE_CODE_SUBAGENT_MODEL = $env:ANTHROPIC_MODEL
                        # Radeon rejects budget-based thinking; scope this to the selected child connection.
                        if (([uri]$options.claudeBaseUrl).Host -eq 'developer.amd.com.cn' -and ([uri]$options.claudeBaseUrl).AbsolutePath.TrimEnd('/') -eq '/radeon/api') {
                            $env:MAX_THINKING_TOKENS = '0'
                        }
                    }
}

function Get-ClaudeCliCommand([string]$exe, [string]$resourceRoot, [string]$model = '') {
    $command = "& '" + $exe.Replace("'", "''") + "'"
    if ([IO.Path]::GetExtension($exe) -in @('.cmd','.bat')) {
        $cliScript = Join-Path (Split-Path -Parent $exe) 'node_modules\@anthropic-ai\claude-code\cli.js'
        if (Test-Path -LiteralPath $cliScript -PathType Leaf) {
            $node = Get-RtlNodePath (Join-Path $resourceRoot 'apps\Claude')
            $command = "function global:claude { & '" + $node.Replace("'", "''") + "' '" + $cliScript.Replace("'", "''") + "' @args }; claude"
        }
    }
    if ($model) { $command += " --model '" + $model.Replace("'", "''") + "'" }
    return $command
}

function Open-ClaudePersianTerminal($options) {
    $exe = Find-App 'claude-code'
    if (-not $exe) { throw 'Install Claude Code CLI first, then refresh VibeHub.' }
    $cwd = if ($options.cwd) { [string]$options.cwd } else { [Environment]::GetFolderPath('UserProfile') }
    if (-not [IO.Path]::IsPathRooted($cwd) -or -not (Test-Path -LiteralPath $cwd -PathType Container) -or $cwd.IndexOfAny([char[]]@('"',"`n","`r",[char]0)) -ge 0) { throw 'Select an existing project directory.' }
    $terminal = Find-PersianTerminal
    $version = if ($terminal) { [string](Get-Item -LiteralPath $terminal).VersionInfo.ProductVersion } else { '' }
    $quickInput = $version -match '^\d+\.\d+\.\d+(?:\.\d+)?' -and [version]$Matches[0] -ge [version]'1.1.6'
    $result = @{ok=$true;installed=[bool]$terminal;opened=$false;claudeStarted=$false;proxyRoutingVerified=$false;quickInputAvailable=[bool]$quickInput;version=$version;command=(Get-ClaudeCliCommand $exe $root);cwd=$cwd}
    if (-not $options.open) { return $result }
    if (-not $terminal) { throw 'Install RtlTerminal 1.1.6 or newer from the Terminal page first.' }
    if ($options.proxyUrl) {
        if ([string]$options.proxyUrl -notmatch '^https?://') { throw 'Claude Code requires an HTTP or HTTPS proxy; SOCKS is not supported.' }
        foreach ($name in @('HTTP_PROXY','HTTPS_PROXY','ALL_PROXY')) { [Environment]::SetEnvironmentVariable($name,[string]$options.proxyUrl,'Process') }
        $env:NO_PROXY='localhost,127.0.0.1,::1'
    } elseif ($options.direct) {
        foreach ($name in @('HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY')) { [Environment]::SetEnvironmentVariable($name,$null,'Process') }
    }
    # Upstream accepts only a directory, not an arbitrary startup command.
    $process = Start-Process -FilePath $terminal -ArgumentList ('"' + $cwd.TrimEnd('\') + '\."') -WorkingDirectory $cwd -WindowStyle Normal -PassThru
    $result.opened=$true
    $result.pid=$process.Id
    return $result
}

function Install-PersianTerminal {
    if (Find-PersianTerminal) { return @{ok=$true;detail='RtlTerminal is already installed.'} }
    if (-not [Environment]::Is64BitOperatingSystem -or [Environment]::OSVersion.Version.Build -lt 19041) { throw 'RtlTerminal requires 64-bit Windows 10 build 19041 or newer.' }
    # Pinned upstream release asset digest; do not execute a mutable latest download.
    $url = 'https://github.com/mirbehnam/RtlTerminal/releases/download/v1.1.6/RtlTerminal-Setup-1.1.6-x64.exe'
    $expected = 'BF5B21D82CD4F74B60760472E41BED69257AE1C708D804E6FB254A2655104661'
    $download = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString('N') + '.exe')
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $download -TimeoutSec 120
        if ((Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash -ne $expected) { throw 'RtlTerminal SHA-256 mismatch. Installer was not executed.' }
        $installer = Start-Process -FilePath $download -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/NOCLOSEAPPLICATIONS') -Verb RunAs -WindowStyle Hidden -Wait -PassThru
        if ($installer.ExitCode -ne 0) { throw "RtlTerminal installer failed (exit $($installer.ExitCode))." }
        if (-not (Find-PersianTerminal)) { throw 'Installer finished but RtlTerminal was not found. Check the installation directory.' }
        @{ok=$true;detail='RtlTerminal installed. Open it from Start, select PowerShell, and check the Persian sample. Remove it using Windows Installed apps.'}
    } finally { if (Test-Path -LiteralPath $download) { Remove-Item -LiteralPath $download } }
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
    $persianTerminal = Find-PersianTerminal
    $result.hasPersianTerminal = [bool]$persianTerminal
    if ($persianTerminal) { $result.persianTerminalPath = $persianTerminal }
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
            if ($state.ambiguous -or -not $request.path -or $state.launchPath -ine $request.path) { throw 'Codex desktop installation changed.' }
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
            $state = Codex-DesktopState
            if ($state.ambiguous -or -not $request.path -or $state.launchPath -ine $request.path) {
                throw 'Codex desktop installation changed.'
            }
            $appIds = @(Get-StartApps | Where-Object { $_.AppID -like "$($state.packageFamily)!*" })
            if ($appIds.Count -ne 1) { throw 'Codex desktop activation entry could not be identified.' }
            Start-Process -FilePath explorer.exe -ArgumentList "shell:AppsFolder\$($appIds[0].AppID)"
            $deadline = [DateTime]::UtcNow.AddSeconds(10)
            do {
                $running = @(Get-Process -Name ChatGPT,Codex -ErrorAction SilentlyContinue |
                    Where-Object { $_.Path -ieq $state.launchPath })
                if ($running.Count -gt 0) { break }
                Start-Sleep -Milliseconds 100
            } while ([DateTime]::UtcNow -lt $deadline)
            if ($running.Count -eq 0) { throw 'Codex desktop did not start.' }
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
        'claude-persian-terminal' { Open-ClaudePersianTerminal $request }
        'detect-editors' { ,@(Detect-Editors) }
        'rtl-components' {
            $components = @(Get-RtlComponents $root | Where-Object { $_.id -notin @('antigravity','claude-desktop') })
            $programs = [Environment]::GetFolderPath('Programs')
            foreach ($component in $components) {
                if (-not $component.available) { continue }
                $folder = switch ($component.id) {
                    'zcode' {'ZCode'} 'qoder' {'Qoder'} 'deepseek-harness' {'DeepSeekHarness'}
                    'antigravity' {'Antigravity'} 'opencode' {'OpenCode'} 'claude-desktop' {'Claude'}
                    default { $null }
                }
                if (-not $folder) { continue }
                $shortcutName = switch ($component.id) {
                    'deepseek-harness' {'DeepSeek Harness RTL.lnk'} 'claude-desktop' {'Claude Desktop RTL.lnk'}
                    default { "$($component.id) RTL.lnk" }
                }
                if ($component.id -eq 'zcode') { $shortcutName = 'ZCode RTL.lnk' }
                if ($component.id -eq 'opencode') { $shortcutName = 'OpenCode RTL.lnk' }
                if ($component.id -eq 'antigravity') { $shortcutName = 'Antigravity RTL.lnk' }
                $shortcut = Join-Path (Join-Path $programs 'VibeHub') $shortcutName
                if (Test-Path -LiteralPath $shortcut -PathType Leaf) {
                    try { Install-HubRtlShortcut $root $component.id $programs | Out-Null } catch {}
                }
            }
            $components
        }
        'launch-editor' {
            $id = [string]$request.editorId
            if ($id -notin @('vscode','vscode-insiders','cursor','windsurf','zed','trae','kiro','vscodium')) { throw 'Unknown detected editor.' }
            $editor = Detect-Editors | Where-Object { $_.id -eq $id } | Select-Object -First 1
            if (-not $editor) { throw 'This editor is no longer installed at a recognized path. Refresh the app list.' }
            $expectedExe = switch ($id) {
                'vscode' { 'Code.exe' }
                'vscode-insiders' { 'Code - Insiders.exe' }
                'cursor' { 'Cursor.exe' }
                'windsurf' { 'Windsurf.exe' }
                'zed' { 'Zed.exe' }
                'trae' { 'Trae.exe' }
                'kiro' { 'Kiro.exe' }
                'vscodium' { 'VSCodium.exe' }
            }
            if ([IO.Path]::GetFileName([string]$editor.path) -ine $expectedExe) { throw 'Detected editor executable did not match its product.' }
            if ($request.rtl) { throw 'RTL is unavailable for this editor.' }
            $cwd = [Environment]::GetFolderPath('UserProfile')
            $startInfo = [Diagnostics.ProcessStartInfo]::new()
            $startInfo.FileName = [string]$editor.path
            $startInfo.WorkingDirectory = $cwd
            $startInfo.UseShellExecute = $false
            if ($request.proxyUrl -and $id -in @('vscode','vscode-insiders','cursor','windsurf','trae','kiro','vscodium')) {
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
        'terminal-install-persian' { Install-PersianTerminal }
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
            $names = @{qoder=@('Qoder.exe','Qoder IDE.exe','QoderAI.exe');zcode=@('ZCode.exe');'deepseek-harness'=@('DeepSeek Harness.exe','DeepSeek.exe');'antigravity-ide'=@('Antigravity IDE.exe');opencode=@('OpenCode.exe');chatgpt=@('ChatGPT.exe','Codex.exe');'claude-code'=@('claude.exe','claude.cmd','claude.bat');mimocode=@('mimocode.exe','mimocode.cmd','mimocode.bat');freebuff=@('freebuff.exe','freebuff.cmd','freebuff.bat');'freebuff-desktop'=@('Freebuff.exe')}
            $id = [string]$request.appId
            $path = [string]$request.path
            if (-not $names.ContainsKey($id) -or -not [IO.Path]::IsPathRooted($path) -or -not (Test-Path -LiteralPath $path -PathType Leaf) -or [IO.Path]::GetFileName($path) -notin $names[$id]) { throw 'Select the executable belonging to this application.' }
            if ($id -eq 'antigravity-ide' -and -not (Test-AntigravityIdePath $path)) { throw 'Choose the Antigravity IDE installation, with its resources/app/product.json; the standalone App is not this product.' }
            if ($id -eq 'freebuff-desktop' -and -not (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $path) 'resources\app.asar') -PathType Leaf)) { throw 'Choose the installed Freebuff Desktop executable.' }
            if ($id -eq 'claude-code' -and -not (Test-ClaudeCliPath $path)) { throw 'Choose Claude Code CLI, not Claude Desktop.' }
            Save-RtlPath $id $path
            @{ok=$true}
        }
        'focus-app' {
            $id = [string]$request.appId
            if ($id -notin @('zcode','qoder','deepseek-harness','opencode','mimocode','freebuff','freebuff-desktop','copilot-cli','antigravity-ide','chatgpt','claude-code','claude-desktop')) { throw 'Unknown app' }
            $exe = Find-App $id
            $target = Get-Process -ErrorAction SilentlyContinue | Where-Object { try { $_.Path -ieq $exe -and $_.MainWindowHandle -ne 0 } catch { $false } } | Select-Object -First 1
            if (-not $exe -or -not $target) { throw 'No application window was found.' }
            Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class HubWindow { [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h,int n); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); }'
            [HubWindow]::ShowWindowAsync($target.MainWindowHandle,9) | Out-Null
            if (-not [HubWindow]::SetForegroundWindow($target.MainWindowHandle)) { throw 'Windows did not activate the application window.' }
            @{ok=$true;rtl=$false;detail='Application window activated'}
        }
        'rtl-setup' {
            $id = [string]$request.appId
            if ($id -eq 'freebuff-desktop') { throw 'RTL is unavailable because the official executable and renderer have not been verified.' }
            if ($id -eq 'chatgpt') {
                $exe = Find-App 'chatgpt'
                $product = Get-OpenAIProductForPath $exe
                if ($product -eq 'codex') { throw [string](CodexRtlStatus $root $exe).reason }
                if ($product -eq 'chatgpt') { throw 'RTL is unavailable for ordinary ChatGPT; only Codex Desktop is eligible.' }
                throw 'RTL is unavailable because the OpenAI executable could not be verified as Codex Desktop; ordinary ChatGPT is unsupported.'
            }
            if ($id -notin @('zcode','qoder','deepseek-harness','antigravity','opencode')) { throw 'RTL is unavailable for this app.' }
            if (-not (Find-App $id)) { throw 'Install the application first, then check again in VibeHub.' }
            Install-HubRtlShortcut $root $id ([Environment]::GetFolderPath('Programs'))
        }
        'launch' {
            $id = [string]$request.req.appId
            if ($id -notin @('zcode','qoder','deepseek-harness','opencode','mimocode','freebuff','freebuff-desktop','copilot-cli','antigravity-ide','chatgpt','claude-code','claude-desktop')) { throw 'Unknown app' }
            if ($id -in @('antigravity-ide','claude-desktop') -and $request.req.rtl) { throw 'RTL is not verified for this tool.' }
            if ($id -eq 'claude-code' -and $request.req.rtl) {
                $claudePlugin = Join-Path $root 'apps\ClaudeRtlPlugin'
                if (-not (Test-Path -LiteralPath (Join-Path $claudePlugin 'hooks\register.tsx'))) { throw 'Claude Persian plugin is missing. Repair VibeHub.' }
                $cliVersion = & (Find-App 'claude-code') --version 2>$null
                if ([string]$cliVersion -notmatch '(\d+\.\d+\.\d+)' -or [version]$Matches[1] -lt [version]'2.1.294') { throw 'Persian rendering requires Claude Code 2.1.294 or newer. Update Claude Code first.' }
            }
            if ($id -eq 'claude-code' -and $request.proxyUrl -and [string]$request.proxyUrl -notmatch '^https?://') { throw 'Claude Code requires an HTTP or HTTPS proxy. Select the HTTP/Mixed port; SOCKS is not supported.' }
            if ($id -eq 'freebuff-desktop' -and $request.req.rtl) { throw 'RTL is unavailable for Freebuff Desktop.' }
            if ($id -eq 'chatgpt' -and $request.req.rtl) {
                $exe = Find-App 'chatgpt'
                $product = Get-OpenAIProductForPath $exe
                if ($product -eq 'codex') { throw [string](CodexRtlStatus $root $exe).reason }
                if ($product -eq 'chatgpt') { throw 'RTL is unavailable for ordinary ChatGPT; only Codex Desktop is eligible.' }
                throw 'RTL is unavailable because the OpenAI executable could not be verified as Codex Desktop; ordinary ChatGPT is unsupported.'
            }
            $package = if ($id -eq 'claude-desktop') { Find-ClaudeDesktopPackage }
            $exe = if ($package) { $package.path } else { Find-App $id }
            if (-not $exe -and -not $request.req.rtl) { throw 'App is not installed in a recognized location.' }
            $cwd = if ($request.req.cwd) { [string]$request.req.cwd } else { [Environment]::GetFolderPath('UserProfile') }
            if (-not (Test-Path -LiteralPath $cwd -PathType Container)) { throw 'Working directory does not exist.' }
            if (-not $request.req.rtl -and $request.previousState -and $request.previousState.rtl) {
                $null = Stop-ManagedRtlInjector -appId $id -state $request.previousState
            }
            if ($id -in @('mimocode','freebuff','claude-code','copilot-cli')) {
                $env:PATH = (@($env:PATH, [Environment]::GetEnvironmentVariable('Path','User'), [Environment]::GetEnvironmentVariable('Path','Machine')) -join ';')
            }
            $env:VIBEHUB_PROJECT = if ($request.req.cwd) { $cwd } else { '' }
            if ($request.proxyUrl) { $env:HTTP_PROXY=$request.proxyUrl; $env:HTTPS_PROXY=$request.proxyUrl; $env:ALL_PROXY=$request.proxyUrl; $env:NO_PROXY='localhost,127.0.0.1,::1' }
            elseif ($request.direct) { foreach ($name in @('HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY')) { [Environment]::SetEnvironmentVariable($name,$null,'Process') } }
            if ($request.req.rtl -and $id -ne 'claude-code') {
                $binding = Get-RtlSessionBinding $id
                if (-not $binding) { throw 'RTL is unavailable for this app.' }
                $folder = $binding.folder
                $port = $binding.port
                $script = Join-Path $root "apps\$folder\start.ps1"
                if ($id -eq 'antigravity') { $env:ANTIGRAVITY_RTL_EXE = $exe }
                if ($id -eq 'opencode') { $env:OPENCODE_RTL_EXE = $exe }
                $alreadyRtl = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
                Invoke-HubRtlLauncher $script
                if ($alreadyRtl -and $request.req.cwd) { Start-Process -FilePath $exe -ArgumentList ('"' + ($cwd.TrimEnd('\') + '\.') + '"') -WorkingDirectory $cwd | Out-Null }
                $injector = Join-Path $root "apps\$folder\injector.mjs"
                # No -State Listen filter: on recent Windows builds a loopback-only listener
                # (the node injector lock) reports a Bound state, so filtering by state would never match it.
                $owner = Get-NetTCPConnection -LocalPort $binding.lockPort -ErrorAction Stop | Select-Object -First 1
                $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($owner.OwningProcess)"
                if ($proc.Name -ine 'node.exe' -or $proc.CommandLine -notmatch [regex]::Escape($binding.injectorPath)) { throw 'RTL injector ownership verification failed' }
                @{ok=$true;id=$id;rtl=$true;port=$port;injectorPid=$proc.ProcessId;injectorPath=$binding.injectorPath;since=[DateTime]::UtcNow.ToString('o');detail='RTL launcher and owned injector are running'}
            } elseif ($package) {
                Start-Process -FilePath explorer.exe -ArgumentList ('shell:AppsFolder\' + $package.appUserModelId) | Out-Null
                @{ok=$true;rtl=$false;detail='Requested Claude Desktop activation; its process status is not verified.'}
            } elseif ($id -in @('mimocode','freebuff','claude-code','copilot-cli')) {
                # Visible shell is the requested product UI. No user text is parsed as code.
                $quotedExe = $exe.Replace("'", "''")
                $code = "& '$quotedExe'"
                if ($id -eq 'claude-code') { $code = Get-ClaudeCliCommand $exe $root ([string]$request.claudeModel) }
                if ($id -eq 'claude-code') {
                    Set-ClaudeConnectionEnvironment $request
                    if ($request.req.rtl) { $code += " --plugin-dir '" + $claudePlugin.Replace("'", "''") + "'" }
                }
                $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($code))
                $shellArgs = @('-NoLogo','-NoExit','-EncodedCommand',$encoded)
                if ($id -eq 'claude-code') { $shellArgs = @('-NoProfile') + $shellArgs }
                $shellExe = if ($id -eq 'copilot-cli') { (Get-Command pwsh.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1).Source } else { 'powershell.exe' }
                if (-not $shellExe) { throw 'PowerShell 7 (pwsh.exe) is required for GitHub Copilot CLI.' }
                $proc = Start-Process -FilePath $shellExe -ArgumentList $shellArgs -WorkingDirectory $cwd -WindowStyle Normal -PassThru
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
        'launch-state' { Get-LaunchState $request.state ([string]$request.appId) }
        'launch-states' {
            $states = @{}
            foreach ($entry in $request.states.PSObject.Properties) {
                $states[$entry.Name] = Get-LaunchState $entry.Value $entry.Name
            }
            $states
        }
        'stop-rtl' {
            $state = $request.state
            $id = if ($request.appId) { [string]$request.appId } else { [string]$state.id }
            Stop-ManagedRtlInjector -appId $id -state $state
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
