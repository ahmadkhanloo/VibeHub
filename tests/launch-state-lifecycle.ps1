$ErrorActionPreference = 'Stop'
$adapter = Join-Path $PSScriptRoot '..\apps\desktop\src-tauri\src\windows.ps1'
$ast = [Management.Automation.Language.Parser]::ParseFile($adapter, [ref]$null, [ref]$null)
$definition = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-LaunchState' }, $true)
. ([scriptblock]::Create($definition.Extent.Text))
$script:appAlive = $false
$script:injectorAlive = $true
function Get-CimInstance {
    param($ClassName, $Filter, $ErrorAction)
    if ($Filter -like 'ProcessId=*' -and $script:injectorAlive) { return [pscustomobject]@{Name='node.exe';CommandLine='node C:\Fixture\injector.mjs'} }
    if ($Filter -match "Name='ZCode.exe'" -and $script:appAlive) { return [pscustomobject]@{Name='ZCode.exe';CommandLine='C:\Fixture\ZCode.exe'} }
}
$state = @{rtl=$true;injectorPid=123;injectorPath='C:\Fixture\injector.mjs';port=9224;since='fixture'}
if ((Get-LaunchState $state 'zcode').phase -ne 'idle') { throw 'A surviving injector must not keep a closed ZCode marked running.' }
$script:appAlive = $true
if ((Get-LaunchState $state 'zcode').phase -ne 'running') { throw 'An app with its owned injector must remain running.' }
$script:injectorAlive = $false
if ((Get-LaunchState $state 'zcode').phase -ne 'idle') { throw 'A dead injector must allow the RTL launcher to repair the session.' }
Write-Output 'Launch lifecycle: 3 assertions passed; no real application was started or stopped.'
