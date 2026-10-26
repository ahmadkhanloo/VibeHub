# Fixed local adapter. Request data arrives as JSON on stdin, never as PowerShell code.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
$root = $request.resourceRoot
$utf8 = [Text.UTF8Encoding]::new($true)
$begin = '# >>> VibeHub managed prompt >>>'
$end = '# <<< VibeHub managed prompt <<<'

function ProfilePath { $PROFILE.CurrentUserAllHosts }
function ProfileText { $p = ProfilePath; if (Test-Path -LiteralPath $p) { [IO.File]::ReadAllText($p) } else { '' } }
function ThemeBlockPattern { '(?ms)^' + [regex]::Escape($begin) + '\r?\n.*?^' + [regex]::Escape($end) + '(?:\r?\n)?' }

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
    $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
}

function Detect-Apps {
    @('zcode','qoder','deepseek-harness','opencode','mimocode','freebuff') | ForEach-Object {
        $path = Find-App $_
        $result = @{ id = $_; installed = [bool]$path; via = 'standard-path-or-PATH' }
        if ($path) { $result.path = $path; $version = (Get-Item -LiteralPath $path).VersionInfo.ProductVersion; if ($version) { $result.version = $version } }
        $result
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
            if (-not $exe) { throw 'App is not installed in a recognized location.' }
            $cwd = if ($request.req.cwd) { [string]$request.req.cwd } else { [Environment]::GetFolderPath('UserProfile') }
            if (-not (Test-Path -LiteralPath $cwd -PathType Container)) { throw 'Working directory does not exist.' }
            if ($request.proxyUrl) { $env:HTTP_PROXY=$request.proxyUrl; $env:HTTPS_PROXY=$request.proxyUrl; $env:ALL_PROXY=$request.proxyUrl; $env:NO_PROXY='localhost,127.0.0.1,::1' }
            elseif ($request.direct) { foreach ($name in @('HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY')) { [Environment]::SetEnvironmentVariable($name,$null,'Process') } }
            if ($request.req.rtl) {
                $folder = switch ($id) { 'zcode' {'ZCode'} 'qoder' {'Qoder'} 'deepseek-harness' {'DeepSeekHarness'} default {throw 'RTL is unavailable for this app'} }
                $port = switch ($id) { 'zcode' {9222} 'qoder' {9225} 'deepseek-harness' {9228} }
                $script = Join-Path $root "apps\$folder\start.ps1"
                & $script
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
                @{ok=$true;rtl=$false;pid=$proc.Id;since=[DateTime]::UtcNow.ToString('o');detail='Opened CLI in a terminal'}
            } else {
                $proc = Start-Process -FilePath $exe -WorkingDirectory $cwd -PassThru
                @{ok=$true;rtl=$false;pid=$proc.Id;since=[DateTime]::UtcNow.ToString('o');detail='Application process started'}
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
