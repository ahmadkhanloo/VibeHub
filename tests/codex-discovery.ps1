$ErrorActionPreference = 'Stop'
$windowsPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'apps\desktop\src-tauri\src\windows.ps1'
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($windowsPath, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
$resolver = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Resolve-OpenAIProduct' }, $true)
if (-not $resolver) { throw 'Resolve-OpenAIProduct is missing.' }
$invoke = [scriptblock]::Create($resolver.Extent.Text + "`nResolve-OpenAIProduct -packageName ([string]`$args[0]) -executablePath ([string]`$args[1])")

function Assert-Product([string]$Name, [string]$PackageName, [string]$Path, [string]$Expected) {
  $actual = & $invoke $PackageName $Path
  if ($actual -ne $Expected) { throw "$Name expected '$Expected', got '$actual'" }
}

$codexPath = 'C:\Program Files\WindowsApps\OpenAI.Codex_26.1027.3384.0_x64__2p2nqsd0c76g0\app\ChatGPT.exe'
$chatGptPath = 'C:\Program Files\WindowsApps\OpenAI.ChatGPT_1.2.3.4_x64__2p2nqsd0c76g0\app\ChatGPT.exe'
Assert-Product 'Codex package' 'OpenAI.Codex' $codexPath 'codex'
Assert-Product 'ordinary ChatGPT package' 'OpenAI.ChatGPT' $chatGptPath 'chatgpt'
Assert-Product 'same basename in an unrelated location' 'OpenAI.Codex' 'C:\Temp\ChatGPT.exe' 'unknown'
Assert-Product 'Codex package paired with ChatGPT package location' 'OpenAI.Codex' $chatGptPath 'unknown'
Assert-Product 'Codex alias is not the verified renderer executable' 'OpenAI.Codex' ($codexPath -replace 'ChatGPT\.exe$', 'Codex.exe') 'unknown'

$availabilityFunction = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-CodexRtlAvailability' }, $true)
if (-not $availabilityFunction) { throw 'Get-CodexRtlAvailability is missing.' }
$definitions = $resolver.Extent.Text + "`n" + $availabilityFunction.Extent.Text
$availability = [scriptblock]::Create($definitions + "`nGet-CodexRtlAvailability -resourceRoot ([string]`$args[0]) -packageName ([string]`$args[1]) -executablePath ([string]`$args[2]) -cdpLaunchVerified ([bool]`$args[3])")
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ('vibehub-codex-rtl-' + [guid]::NewGuid().ToString('N'))
try {
  $codex = & $availability $tempRoot 'OpenAI.Codex' $codexPath $false
  if ($codex.product -ne 'codex' -or $codex.available -or $codex.reason -notmatch 'CDP startup path has not been verified') {
    throw "Unverified Codex RTL must stay unavailable with a direct reason: $($codex | ConvertTo-Json -Compress)"
  }
  $chatgpt = & $availability $tempRoot 'OpenAI.ChatGPT' $chatGptPath $true
  if ($chatgpt.product -ne 'chatgpt' -or $chatgpt.available -or $chatgpt.reason -notmatch 'ordinary ChatGPT') {
    throw "Ordinary ChatGPT must remain non-RTL even when the caller supplies a verified-port fixture: $($chatgpt | ConvertTo-Json -Compress)"
  }
  $codexWithMissingAdapter = & $availability $tempRoot 'OpenAI.Codex' $codexPath $true
  if ($codexWithMissingAdapter.available) { throw 'Codex RTL must also require adapter files and the runtime.' }
} finally {
  $resolvedTemp = [IO.Path]::GetFullPath($tempRoot)
  $tempRootPath = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if ($resolvedTemp.StartsWith($tempRootPath, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolvedTemp) -like 'vibehub-codex-rtl-*') {
    Remove-Item -LiteralPath $resolvedTemp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

$installed = Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($installed) {
  $installedExecutable = Join-Path $installed.InstallLocation 'app\ChatGPT.exe'
  Assert-Product 'installed Codex package' $installed.Name $installedExecutable 'codex'
}
$desktopState = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Codex-DesktopState' }, $true)
$stubs = @'
function Get-AppxPackage {
  param([string]$Name)
  if ($Name -eq 'OpenAI.Codex') {
    [pscustomobject]@{ Name=$Name; InstallLocation=(Split-Path (Split-Path $argsFixture[0])); PackageFamilyName='OpenAI.Codex_2p2nqsd0c76g0' }
  }
}
function Get-Process {
  param($Name)
  [pscustomobject]@{Path=$argsFixture[1]; MainWindowHandle=0}
  if ($argsFixture[2]) { [pscustomobject]@{Path=$argsFixture[0]; MainWindowHandle=0} }
}
Codex-DesktopState
'@
$desktopFixture = [scriptblock]::Create(($resolver.Extent.Text, $desktopState.Extent.Text, $stubs -join [Environment]::NewLine))
foreach ($running in @($false,$true)) {
  $argsFixture = @($codexPath,$chatGptPath,$running)
  $state = & $desktopFixture
  if ($state.running -ne $running -or $state.launchPath -ne $codexPath -or $state.ambiguous) {
    throw 'Only the verified Codex package should count, including processes without a window.'
  }
}
Write-Host 'OpenAI product identity fixtures passed'
