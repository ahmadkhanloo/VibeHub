$ErrorActionPreference='Stop'
$source=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../apps/desktop/src-tauri/src/windows.ps1') -Raw
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Native adapter syntax error'}
foreach($name in @('Set-ClaudeConnectionEnvironment','Get-ClaudeCliCommand')) {
 $fn=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true)
 . ([scriptblock]::Create($fn.Extent.Text))
}
$env:ANTHROPIC_AUTH_TOKEN='stale-test-token'
$env:CLAUDE_CODE_OAUTH_TOKEN='stale-oauth-token'
$env:CLAUDE_CODE_SUBAGENT_MODEL='stale-model'
Set-ClaudeConnectionEnvironment @{claudeBaseUrl='https://example.invalid';claudeModel='test-model';claudeAuth='ANTHROPIC_API_KEY';claudeKey='synthetic-test-key'}
if($env:ANTHROPIC_AUTH_TOKEN -or $env:ANTHROPIC_API_KEY -ne 'synthetic-test-key' -or $env:ANTHROPIC_DEFAULT_HAIKU_MODEL -ne 'test-model'){throw 'Connection environment not isolated'}
if($env:CLAUDE_CODE_OAUTH_TOKEN -or $env:CLAUDE_CODE_SUBAGENT_MODEL -ne 'test-model'){throw 'Stale OAuth or subagent model leaked'}
Set-ClaudeConnectionEnvironment @{claudeBaseUrl='https://example.invalid';claudeModel='another-model';claudeAuth='ANTHROPIC_AUTH_TOKEN';claudeKey='synthetic-bearer'}
if($env:ANTHROPIC_API_KEY -or $env:ANTHROPIC_AUTH_TOKEN -ne 'synthetic-bearer'){throw 'Authentication modes mixed'}
$env:MAX_THINKING_TOKENS='1234'
Set-ClaudeConnectionEnvironment @{claudeBaseUrl='https://developer.amd.com.cn/radeon/api';claudeModel='test-model';claudeAuth='ANTHROPIC_AUTH_TOKEN';claudeKey='synthetic-bearer'}
if($env:MAX_THINKING_TOKENS -ne '0'){throw 'Radeon budget thinking was not disabled'}
$env:MAX_THINKING_TOKENS='1234'
Set-ClaudeConnectionEnvironment @{claudeBaseUrl='https://example.invalid';claudeModel='test-model';claudeAuth='ANTHROPIC_AUTH_TOKEN';claudeKey='synthetic-bearer'}
if($env:MAX_THINKING_TOKENS -ne '1234'){throw 'Unrelated provider thinking was changed'}
$code=Get-ClaudeCliCommand "C:\پروژه آزمایشی's\claude.exe" 'C:\VibeHub'
if($code -ne "& 'C:\پروژه آزمایشی''s\claude.exe'"){throw 'Native literal path changed'}
if($code -match 'synthetic|ANTHROPIC'){throw 'Credential leaked into command'}
$selected=Get-ClaudeCliCommand 'C:\Claude\claude.exe' 'C:\VibeHub' "model's name"
if($selected -ne "& 'C:\Claude\claude.exe' --model 'model''s name'"){throw 'Selected model must explicitly override saved Claude model with literal quoting'}
'Claude connection environment and literal launch checks passed'
