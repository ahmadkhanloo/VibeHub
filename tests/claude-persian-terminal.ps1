$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$source=Get-Content -LiteralPath (Join-Path $repo 'apps/desktop/src-tauri/src/windows.ps1') -Raw
$tokens=$null; $errors=$null
$ast=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors)
foreach($name in @('Get-ClaudeCliCommand','Open-ClaudePersianTerminal')) {
  $function=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
  if(-not $function){throw "Missing function: $name"}
  . ([scriptblock]::Create($function.Extent.Text))
}
function Find-App($id){if($id -ne 'claude-code'){throw 'Wrong app'}; return "C:\Test folder's\claude.cmd"}
function Find-PersianTerminal {return $script:hostPath}
function Test-Path {return $true}
function Get-RtlNodePath {return "C:\Private node's\node.exe"}
function Get-Item {return [pscustomobject]@{VersionInfo=@{ProductVersion=$script:hostVersion}}}
function Start-Process {param($FilePath,$ArgumentList,$WorkingDirectory,[switch]$PassThru,$WindowStyle); $script:launch=@{file=$FilePath;args=$ArgumentList;cwd=$WorkingDirectory;proxy=$env:HTTPS_PROXY}; return @{Id=1234}}
$root='C:\VibeHub'
$script:hostPath=$null; $script:hostVersion='1.1.6'; $script:launch=$null
$result=Open-ClaudePersianTerminal @{cwd='C:\project';open=$false}
if($result.installed -or $result.opened -or $script:launch){throw 'Preparation must not launch or invent an installed host'}
if($result.command -notmatch "node''s" -or $result.command -match 'ANTHROPIC.*KEY'){throw 'Prepared command lost literal quoting or includes credentials'}
$script:hostPath='C:\RTL Terminal\RtlTerminal.exe'
$script:hostVersion='1.1.4'
$result=Open-ClaudePersianTerminal @{cwd='C:\project';open=$false}
if($result.quickInputAvailable){throw 'Old host must not claim Quick Input'}
$script:hostVersion='1.1.6'
$result=Open-ClaudePersianTerminal @{cwd='C:\project';open=$true;proxyUrl='http://127.0.0.1:7890'}
if(-not $result.opened -or -not $result.quickInputAvailable){throw 'Installed current host not opened'}
if($script:launch.cwd -ne 'C:\project' -or $script:launch.proxy -ne 'http://127.0.0.1:7890'){throw 'Project/proxy lost at host boundary'}
if($result.claudeStarted -or $result.proxyRoutingVerified){throw 'Host launch must not claim Claude/model/network acceptance'}
$rejected=$false; try{Open-ClaudePersianTerminal @{open=$true;proxyUrl='socks5://127.0.0.1:1'}}catch{$rejected=$true}
if(-not $rejected){throw 'SOCKS-only proxy must fail'}
'Claude Persian host preparation/launch checks passed'
