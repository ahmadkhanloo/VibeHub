$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$sandbox = Join-Path ([IO.Path]::GetTempPath()) ('vibehub-rtl-setup-' + [guid]::NewGuid().ToString('N'))
$root = Join-Path $sandbox 'نصب آزمایشی'
$programs = Join-Path $sandbox 'میانبرها'
$passed = 0
function Assert($condition, [string]$message) { if (-not $condition) { throw $message }; $script:passed++ }
try {
    $ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $repo 'apps/desktop/src-tauri/src/windows.ps1'), [ref]$null, [ref]$null)
    $helper = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Install-HubRtlShortcut' }, $true)
    Assert ($null -ne $helper) 'Native RTL setup helper must exist'
    . ([scriptblock]::Create($helper.Extent.Text))
    $files = @('apps/rtl-paths.ps1','apps/rtl-direction.mjs','runtime/node.exe')
    foreach ($folder in @('ZCode','Qoder','DeepSeekHarness','Antigravity')) {
        $files += @('start.ps1','launch.vbs','injector.mjs','rtl.ico','style.mjs','assets/Vazirmatn-Regular.woff2','assets/Vazirmatn-Bold.woff2') | ForEach-Object { "apps/$folder/$_" }
    }
    foreach ($file in $files) { $path = Join-Path $root $file; $null = [IO.Directory]::CreateDirectory((Split-Path $path)); [IO.File]::WriteAllText($path, 'fixture') }
    $shell = New-Object -ComObject WScript.Shell
    foreach ($id in @('qoder','zcode','deepseek-harness','antigravity')) {
        $result = Install-HubRtlShortcut $root $id $programs
        Assert ($result.ok -and (Test-Path -LiteralPath $result.shortcut)) "$id setup must create a real shortcut"
        $shortcut = $shell.CreateShortcut($result.shortcut)
        $savedTarget = [VibeHub.RtlShortcuts]::Target($result.shortcut)
        Assert ($savedTarget.StartsWith($root) -and $savedTarget.EndsWith('launch.vbs')) "$id shortcut must target the bundled launcher"
        Assert ($shortcut.Arguments -eq '') "$id shortcut must have no executable arguments"
        $again = Install-HubRtlShortcut $root $id $programs
        Assert ($again.shortcut -eq $result.shortcut) "$id setup must be idempotent"
    }
    $failed = $false
    try { Install-HubRtlShortcut $root '../outside' $programs } catch { $failed = $true }
    Assert $failed 'Unknown apps and traversal must be rejected'
    $shortcutPath = Join-Path $programs 'VibeHub/Qoder RTL.lnk'
    [VibeHub.RtlShortcuts]::Save($shortcutPath, (Join-Path $sandbox 'other.exe'), $sandbox, (Join-Path $root 'apps/Qoder/rtl.ico'))
    $failed = $false
    try { Install-HubRtlShortcut $root 'qoder' $programs } catch { $failed = $true }
    Assert $failed 'Unrelated shortcuts must not be overwritten'
    Assert ([VibeHub.RtlShortcuts]::Target($shortcutPath) -eq (Join-Path $sandbox 'other.exe')) 'Unrelated shortcut target must survive setup'
    Remove-Item -LiteralPath (Join-Path $root 'apps/Antigravity/injector.mjs')
    $failed = $false
    try { Install-HubRtlShortcut $root 'antigravity' $programs } catch { $failed = $true }
    Assert $failed 'Incomplete payload must not claim successful setup'
    Write-Output "PASS: $passed isolated RTL setup assertions; no real app was launched or changed."
} finally {
    $resolved = [IO.Path]::GetFullPath($sandbox)
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if ($resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolved -Leaf).StartsWith('vibehub-rtl-setup-') -and (Test-Path -LiteralPath $resolved)) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
