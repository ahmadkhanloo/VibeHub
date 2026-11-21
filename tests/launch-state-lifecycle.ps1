$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$adapter = Join-Path $root 'apps\desktop\src-tauri\src\windows.ps1'
$parseErrors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($adapter, [ref]$null, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
foreach ($name in @('Get-RtlSessionBinding', 'Get-LaunchState')) {
    $definition = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true)
    if (-not $definition) { throw "$name is missing." }
    . ([scriptblock]::Create($definition.Extent.Text))
}
function Find-App { return $null }
$binding = Get-RtlSessionBinding 'zcode'
$injectorPid = 123
$script:appAlive = $false
$script:injectorAlive = $true
$script:lockOwner = $injectorPid
function Get-NetTCPConnection {
    param($LocalPort, $State, $ErrorAction)
    if ($LocalPort -eq $binding.lockPort -and (-not $State -or $State -eq 'Bound')) {
        return [pscustomobject]@{OwningProcess=$script:lockOwner; State='Bound'}
    }
}
function Get-CimInstance {
    param($ClassName, $Filter, $ErrorAction)
    if ($Filter -eq "ProcessId=$injectorPid" -and $script:injectorAlive) { return [pscustomobject]@{Name='node.exe';CommandLine="node `"$($binding.injectorPath)`""} }
    if ($Filter -match "Name='ZCode.exe'" -and $script:appAlive) { return [pscustomobject]@{Name='ZCode.exe';CommandLine='C:\Fixture\ZCode.exe'} }
}
$state = @{id='zcode';rtl=$true;injectorPid=$injectorPid;injectorPath=$binding.injectorPath;port=$binding.port;since='fixture'}
if ((Get-LaunchState $state 'zcode').phase -ne 'idle') { throw 'A surviving injector must not keep a closed ZCode marked running.' }
$script:appAlive = $true
if ((Get-LaunchState $state 'zcode').phase -ne 'running') { throw 'An app with its owned injector must remain running.' }
$script:lockOwner = $injectorPid + 1
if ((Get-LaunchState $state 'zcode').phase -ne 'idle') { throw 'A lock owned by another process must invalidate the RTL session.' }
$script:lockOwner = $injectorPid
$script:injectorAlive = $false
if ((Get-LaunchState $state 'zcode').phase -ne 'idle') { throw 'A dead injector must allow the RTL launcher to repair the session.' }
Write-Output 'Launch lifecycle: 4 assertions passed; no real application was started or stopped.'
