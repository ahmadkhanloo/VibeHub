$ErrorActionPreference = 'Stop'
$adapter = Join-Path (Split-Path -Parent $PSScriptRoot) 'apps\desktop\src-tauri\src\windows.ps1'
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($adapter, [ref]$null, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
$function = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Install-PersianTerminal' }, $true)
. ([scriptblock]::Create($function.Extent.Text))
$script:installed = $false
$script:runCount = 0
$script:validHash = $false
$script:installerExit = 0
$script:downloadPath = $null
function Find-PersianTerminal { if ($script:installed) { 'fixture.exe' } }
function Invoke-WebRequest {
    param([switch]$UseBasicParsing, $Uri, $OutFile, $TimeoutSec)
    if ($Uri -ne 'https://github.com/mirbehnam/RtlTerminal/releases/download/v1.1.4/RtlTerminal-Setup-1.1.4-x64.exe') { throw 'Unexpected source' }
    $script:downloadPath = $OutFile
    [IO.File]::WriteAllText($OutFile, 'fixture installer; never executed')
}
function Get-FileHash { param($LiteralPath, $Algorithm)
    @{Hash=$(if ($script:validHash) { 'B9F60B9761FB7410994FCB33293111E012C1D79256E5BCFAB0B4D62D16B4A096' } else { 'invalid' })}
}
function Start-Process { param($FilePath, $ArgumentList, $Verb, $WindowStyle, [switch]$Wait, [switch]$PassThru)
    if ($Verb -ne 'RunAs' -or $WindowStyle -ne 'Hidden' -or '/NOCLOSEAPPLICATIONS' -notin $ArgumentList) { throw 'Unexpected installer options' }
    $script:runCount++
    if ($script:installerExit -eq 0) { $script:installed = $true }
    @{ExitCode=$script:installerExit}
}
function Assert($condition, $message) { if (-not $condition) { throw $message } }
function Expect-Failure($pattern) {
    $caught = $null
    try { Install-PersianTerminal | Out-Null } catch { $caught = $_.Exception.Message }
    Assert ($caught -like $pattern) "Expected failure $pattern, got $caught"
    Assert (-not (Test-Path -LiteralPath $script:downloadPath)) 'Temporary installer must be removed'
}
Expect-Failure '*SHA-256 mismatch*'
Assert ($script:runCount -eq 0) 'Corrupt installer must not run'
$script:validHash = $true
$script:installerExit = 5
Expect-Failure '*exit 5*'
$script:installerExit = 0
$result = Install-PersianTerminal
Assert $result.ok 'Verified installer should succeed after detection'
Assert (-not (Test-Path -LiteralPath $script:downloadPath)) 'Successful download must be cleaned up'
$count = $script:runCount
$result = Install-PersianTerminal
Assert ($result.ok -and $script:runCount -eq $count) 'Existing installation must be preserved'
Write-Output 'Persian terminal adapter checks passed (checksum rejection, installer failure, success, cleanup, existing installation).'
