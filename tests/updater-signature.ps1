param([Parameter(Mandatory=$true)][string]$Minisign)
$ErrorActionPreference = 'Stop'
foreach ($name in @('TAURI_SIGNING_PRIVATE_KEY','TAURI_SIGNING_PRIVATE_KEY_PASSWORD','TAURI_UPDATER_PUBLIC_KEY')) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) { throw "Missing $name" }
}
$sandbox = Join-Path ([IO.Path]::GetTempPath()) ('vibehub-signature-test-' + [guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($sandbox) | Out-Null
try {
    $payload = Join-Path $sandbox 'payload.txt'
    $keyPath = Join-Path $sandbox 'public.key'
    $signaturePath = Join-Path $sandbox 'signature.minisig'
    [IO.File]::WriteAllText($payload, 'VibeHub updater signature test', [Text.UTF8Encoding]::new($false))
    & corepack pnpm --filter '@vibehub/desktop' tauri signer sign $payload 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Tauri signer failed; output suppressed' }
    $key = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:TAURI_UPDATER_PUBLIC_KEY.Trim()))
    $signature = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(([IO.File]::ReadAllText("$payload.sig")).Trim()))
    [IO.File]::WriteAllText($keyPath, $key, [Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllText($signaturePath, $signature, [Text.UTF8Encoding]::new($false))
    & $Minisign -Vm $payload -x $signaturePath -p $keyPath 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Valid updater signature was rejected' }
    [IO.File]::AppendAllText($payload, ' tampered')
    & $Minisign -Vm $payload -x $signaturePath -p $keyPath 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { throw 'Tampered updater payload was accepted' }
    # The rejected tampered payload is expected; do not fail the caller's shell.
    $global:LASTEXITCODE = 0
    'Updater signing roundtrip passed; tampered payload rejected. Private material not printed.'
} finally {
    $resolved = [IO.Path]::GetFullPath($sandbox)
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if ($resolved.StartsWith($tempRoot,[StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolved) -like 'vibehub-signature-test-*') { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
