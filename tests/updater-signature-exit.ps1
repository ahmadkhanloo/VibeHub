$ErrorActionPreference = 'Stop'
$names = @('TAURI_SIGNING_PRIVATE_KEY','TAURI_SIGNING_PRIVATE_KEY_PASSWORD','TAURI_UPDATER_PUBLIC_KEY')
$saved = @{}
foreach ($name in $names) { $saved[$name] = [Environment]::GetEnvironmentVariable($name) }
try {
    $env:TAURI_SIGNING_PRIVATE_KEY = 'test-fixture'
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = 'test-fixture'
    $env:TAURI_UPDATER_PUBLIC_KEY = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('fixture public key'))
    function global:corepack {
        $payload = $args[-1]
        [IO.File]::WriteAllText("$payload.sig", [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('fixture signature')))
        $global:LASTEXITCODE = 0
    }
    function global:TestSignatureVerifier {
        $payload = $args[1]
        $global:LASTEXITCODE = if ([IO.File]::ReadAllText($payload).Contains('tampered')) { 1 } else { 0 }
    }
    & "$PSScriptRoot/updater-signature.ps1" -Minisign TestSignatureVerifier
    if ($LASTEXITCODE -ne 0) { throw 'Expected rejection leaked a failing exit code to the caller' }
    'Signature harness exit status: PASS (fixture verifier; cryptography tested separately)'
} finally {
    Remove-Item Function:\corepack,Function:\TestSignatureVerifier -ErrorAction SilentlyContinue
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $saved[$name]) }
}
