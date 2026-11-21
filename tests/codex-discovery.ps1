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

$codexInstall = 'C:\Program Files\WindowsApps\OpenAI.Codex_26.1027.3384.0_x64__2p2nqsd0c76g0'
$codexApp = Join-Path $codexInstall 'app'
$codexPath = Join-Path $codexApp 'ChatGPT.exe'
$codexGuiPath = Join-Path $codexApp 'Codex.exe'
$codexHelperPath = Join-Path $codexApp 'resources\codex.exe'
$chatGptPath = 'C:\Program Files\WindowsApps\OpenAI.ChatGPT_1.2.3.4_x64__2p2nqsd0c76g0\app\ChatGPT.exe'
Assert-Product 'Codex package' 'OpenAI.Codex' $codexPath 'codex'
Assert-Product 'ordinary ChatGPT package' 'OpenAI.ChatGPT' $chatGptPath 'chatgpt'
Assert-Product 'same basename in an unrelated location' 'OpenAI.Codex' 'C:\Temp\ChatGPT.exe' 'unknown'
Assert-Product 'Codex package paired with ChatGPT package location' 'OpenAI.Codex' $chatGptPath 'unknown'
Assert-Product 'Codex alias is not the verified RTL renderer executable' 'OpenAI.Codex' $codexGuiPath 'unknown'

$availabilityFunction = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-CodexRtlAvailability' }, $true)
if (-not $availabilityFunction) { throw 'Get-CodexRtlAvailability is missing.' }
$definitions = $resolver.Extent.Text + "`n" + $availabilityFunction.Extent.Text
$availability = [scriptblock]::Create($definitions + "`nGet-CodexRtlAvailability -resourceRoot ([string]`$args[0]) -packageName ([string]`$args[1]) -executablePath ([string]`$args[2]) -cdpLaunchVerified ([bool]`$args[3])")
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ('vibehub-codex-rtl-' + [guid]::NewGuid().ToString('N'))
$codex = & $availability $tempRoot 'OpenAI.Codex' $codexPath $false
if ($codex.product -ne 'codex' -or $codex.available -or $codex.reason -notmatch 'CDP startup path has not been verified') {
  throw "Unverified Codex RTL must stay unavailable with a direct reason: $($codex | ConvertTo-Json -Compress)"
}
$chatgpt = & $availability $tempRoot 'OpenAI.ChatGPT' $chatGptPath $true
if ($chatgpt.product -ne 'chatgpt' -or $chatgpt.available -or $chatgpt.reason -notmatch 'ordinary ChatGPT') {
  throw "Ordinary ChatGPT must remain non-RTL even when the caller supplies a verified-port fixture: $($chatgpt | ConvertTo-Json -Compress)"
}
$codexWithMissingRuntime = & $availability $tempRoot 'OpenAI.Codex' $codexPath $true
if ($codexWithMissingRuntime.available) { throw 'Codex RTL must require the runtime.' }

$desktopState = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Codex-DesktopState' }, $true)
if (-not $desktopState) { throw 'Codex-DesktopState is missing.' }
$stubs = @'
function Get-AppxPackage {
  param([string]$Name, $ErrorAction)
  if ($Name -eq 'OpenAI.Codex') {
    [pscustomobject]@{ Name=$Name; InstallLocation=$codexInstall; PackageFamilyName='OpenAI.Codex_2p2nqsd0c76g0' }
  }
}
function Test-Path {
  param([string]$LiteralPath, $PathType)
  $PathType -eq 'Leaf' -and $LiteralPath -in @($codexPath, $codexGuiPath)
}
function Get-Process {
  param($Name, $ErrorAction)
  foreach ($path in $case.processes) { [pscustomobject]@{Path=$path; MainWindowHandle=0} }
}
Codex-DesktopState
'@
$desktopFixture = [scriptblock]::Create(($resolver.Extent.Text, $desktopState.Extent.Text, $stubs -join [Environment]::NewLine))
$otherCodexPath = $codexPath -replace '26\.1027\.3384\.0', '26.1026.3384.0'
$cases = @(
  @{ name='Ordinary ChatGPT only'; processes=@($chatGptPath); running=$false; ambiguous=$false }
  @{ name='Codex CLI helper only'; processes=@($codexHelperPath); running=$false; ambiguous=$false }
  @{ name='Codex GUI plus CLI helper'; processes=@($codexGuiPath, $codexHelperPath); running=$true; ambiguous=$false }
  @{ name='Legacy Codex GUI'; processes=@($codexPath); running=$true; ambiguous=$false }
  @{ name='Different Codex installation'; processes=@($otherCodexPath); running=$true; ambiguous=$true }
)
foreach ($case in $cases) {
  $state = & $desktopFixture
  if ($state.running -ne $case.running -or $state.ambiguous -ne $case.ambiguous) {
    throw "$($case.name) returned unexpected desktop state: $($state | ConvertTo-Json -Compress)"
  }
  if (-not $state.installed -or $state.launchPath -ne ($codexApp + '\')) {
    throw "$($case.name) must use the installed Codex app folder: $($state | ConvertTo-Json -Compress)"
  }
}
Write-Host 'OpenAI product identity and Codex desktop state fixtures passed'
