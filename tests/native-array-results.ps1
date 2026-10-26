$ErrorActionPreference = 'Stop'
$source = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '../apps/desktop/src-tauri/src/windows.ps1'))
$match = [regex]::Match($source, "(?m)^\s*'detect-editors'\s*\{\s*(.*?)\s*\}")
if (-not $match.Success) { throw 'Editor detection switch arm was not found' }
$arm = [scriptblock]::Create($match.Groups[1].Value)
function Detect-Editors { $script:fixtureEditors }
foreach ($count in 0, 1, 2) {
    $script:fixtureEditors = @(for ($index = 0; $index -lt $count; $index++) { @{ id="editor-$index"; installed=$true } })
    $result = & $arm
    $json = ConvertTo-Json -InputObject $result -Depth 10 -Compress
    if (-not $json.StartsWith('[')) { throw "Editor count $count did not serialize as an array: $json" }
    $parsed = ConvertFrom-Json -InputObject $json -NoEnumerate
    if ($parsed.Count -ne $count) { throw "Editor count $count changed across JSON serialization" }
}
'Native editor JSON arrays: PASS (empty, one and multiple results)'
