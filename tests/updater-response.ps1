$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../scripts/release-http.ps1')
$text = '{"version":"0.2.2-beta.1","platforms":{"windows-x86_64":{"url":"https://example.com/archive.zip"}},"notes":"فارسی"}'
foreach ($content in @($text, [Text.Encoding]::UTF8.GetBytes($text))) {
    $decoded = ConvertFrom-ReleaseHttpContent -Content $content
    $manifest = $decoded | ConvertFrom-Json
    if ($manifest.version -ne '0.2.2-beta.1' -or -not $manifest.platforms -or $manifest.notes -ne 'فارسی') {
        throw 'Release JSON did not survive string/UTF-8 byte response decoding'
    }
}
$signature = "c2lnbmF0dXJl`n"
if ((ConvertFrom-ReleaseHttpContent -Content ([Text.Encoding]::UTF8.GetBytes($signature))).Trim() -ne 'c2lnbmF0dXJl') {
    throw 'Signature response could not be decoded and trimmed'
}
'Release HTTP string and UTF-8 byte responses pass'
