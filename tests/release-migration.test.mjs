import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('release prepares bundled resources before Rust preflight needs them', async () => {
  const workflow = await read('../.github/workflows/release.yml');
  const prepare = workflow.indexOf('run: ./scripts/prepare-windows-rtl-payload.ps1');
  const preflight = workflow.indexOf('- name: Run release preflight');
  assert.ok(prepare >= 0 && prepare < preflight);
});

test('release SBOM attachment uses the filename required by artifact verification', async () => {
  const workflow = await read('../.github/workflows/release.yml');
  assert.match(workflow, /artifact-name: VibeHub-SBOM\.cdx\.json/);
  assert.match(workflow, /assets\.Name -contains 'VibeHub-SBOM\.cdx\.json'/);
});

test('the Persian plan and English agent directive require gates 16 through 19', async () => {
  const [plan, directive] = await Promise.all([
    read('../docs/product/VibeHub_Final_Master_Plan_v4_FA.md'),
    read('../docs/product/VibeHub_Final_Agent_Prompt_EN_v4.md'),
  ]);

  for (const gate of [
    'Gate 16 — Repository Migration',
    'Gate 17 — Production Release',
    'Gate 18 — Post-Release QA',
    'Gate 19 — Real Update Verification',
  ]) {
    assert.ok(directive.includes(gate), `English directive is missing ${gate}`);
  }
  assert.match(plan, /مرحله\s*۱۶|گیت\s*۱۶/);
  assert.match(plan, /مرحله\s*۱۷|گیت\s*۱۷/);
  assert.match(plan, /مرحله\s*۱۸|گیت\s*۱۸/);
  assert.match(plan, /مرحله\s*۱۹|گیت\s*۱۹/);
  assert.match(directive, /explicit authorization/i);
  assert.match(plan, /مجوز\s*صریح/);
});

test('public product metadata points at the VibeHub repository', async () => {
  const [readme, readmeFa, tauriConfig, settings] = await Promise.all([
    read('../README.md'),
    read('../README.fa.md'),
    read('../apps/desktop/src-tauri/tauri.conf.json'),
    read('../apps/desktop/src/app/settings.tsx'),
  ]);

  for (const text of [readme, readmeFa]) {
    assert.match(text, /^# VibeHub/m);
    assert.match(text, /github\.com\/ahmadkhanloo\/VibeHub/);
    assert.doesNotMatch(text, /github\.com\/ahmadkhanloo\/AgentRTL/);
  }
  assert.match(tauriConfig, /"productName"\s*:\s*"VibeHub"/);
  assert.match(tauriConfig, /"identifier"\s*:\s*"com\.ahmadkhanloo\.vibehub"/);
  assert.match(tauriConfig, /github\.com\/ahmadkhanloo\/VibeHub/);
  assert.match(settings, /ahmadkhanloo\.github\.io\/VibeHub\/feed/);
});

test('legacy adapter references are labeled and their active source links target VibeHub', async () => {
  const files = [
    '../apps/ZCode/README.md',
    '../apps/ZCode/README.fa.md',
    '../apps/Qoder/README.md',
    '../apps/Qoder/README.fa.md',
    '../apps/DeepSeekHarness/README.md',
    '../apps/DeepSeekHarness/README.fa.md',
  ];
  const docs = await Promise.all(files.map(read));
  for (const text of docs) {
    assert.match(text, /Legacy adapter notice|یادداشت آداپتر قدیمی/);
    assert.doesNotMatch(text, /github\.com\/ahmadkhanloo\/AgentRTL|raw\.githubusercontent\.com\/ahmadkhanloo\/AgentRTL|git clone[^\n]*AgentRTL/);
  }

  const [legacyInstaller, sourceInstaller] = await Promise.all([
    read('../installer.iss'),
    read('../install.sh'),
  ]);
  assert.match(legacyInstaller, /Historical AgentRTL RTL-adapter installer/);
  assert.match(legacyInstaller, /MyAppURL "https:\/\/github\.com\/ahmadkhanloo\/VibeHub"/);
  assert.match(sourceInstaller, /REPO="https:\/\/github\.com\/ahmadkhanloo\/VibeHub"/);
});

test('Windows Setup has full and component-selected RTL modes without MSI output', async () => {
  const [config, releaseConfig, template, payloadBuilder] = await Promise.all([
    read('../apps/desktop/src-tauri/tauri.conf.json').then(JSON.parse),
    read('../apps/desktop/src-tauri/tauri.release.conf.json').then(JSON.parse),
    read('../apps/desktop/src-tauri/windows/installer.nsi'),
    read('../scripts/prepare-windows-rtl-payload.ps1'),
  ]);
  assert.deepEqual(config.bundle.targets, ['nsis']);
  assert.equal(config.bundle.createUpdaterArtifacts, false);
  assert.equal(releaseConfig.bundle.createUpdaterArtifacts, 'v1Compatible');
  assert.equal(config.bundle.windows.nsis.installMode, 'currentUser');
  assert.equal(config.bundle.windows.nsis.template, 'windows/installer.nsi');
  assert.deepEqual(config.bundle.windows.nsis.languages, ['English', 'Farsi']);
  assert.match(template, /Section \/o "VibeHub desktop" SEC_INSTALL/);
  for (const section of ['ZCode RTL" SEC_ZCODE', 'Qoder RTL" SEC_QODER', 'DeepSeek Harness RTL" SEC_DEEPSEEK']) {
    assert.ok(template.includes(section), `Setup is missing ${section}`);
  }
  for (const resource of [
    '../../../apps/ZCode/launch.vbs',
    '../../../apps/rtl-direction.mjs',
    '../../../apps/Qoder/launch.vbs',
    '../../../apps/DeepSeekHarness/launch.vbs',
    '../../../apps/Qoder/doctor.mjs',
    '../../../apps/migrate-agentrtl-paths.ps1',
    'windows/payload/NODE-LICENSE.md',
  ]) {
    assert.ok(Object.hasOwn(config.bundle.resources, resource), `Full setup is missing ${resource}`);
  }
  assert.match(template, /\$InstallMode == "full"[\s\S]*?SectionSetFlags \$\{SEC_INSTALL\} \$\{SF_SELECTED\}/);
  assert.match(template, /\$InstallMode == "rtl"[\s\S]*?SectionSetFlags \$\{SEC_RUNTIME\} \$\{SF_SELECTED\}/);
  assert.match(template, /\$UpdateMode = 1[\s\S]*?Abort/);
  assert.match(template, /\$InstallMode == "rtl"[\s\S]*?Call CreateRtlShortcuts[\s\S]*?\$\{Else\}[\s\S]*?Call RemoveBrokenFullRtlShortcuts/);
  assert.match(template, /Function CreateRtlShortcuts[\s\S]*?StrCpy \$R0 "\$INSTDIR\\apps"/);
  assert.match(template, /RemoveBrokenFullRtlShortcut[\s\S]*?IsShortcutTarget/);
  const stateSection = template.match(/Section "-VibeHub installation state"[\s\S]*?SectionEnd/)?.[0] ?? '';
  const fullBranch = stateSection.split('${Else}')[1]?.split('${EndIf}')[0] ?? '';
  assert.ok(fullBranch.includes('Call RemoveBrokenFullRtlShortcuts'));
  assert.ok(!fullBranch.includes('Call CreateRtlShortcuts'), 'Full installation must not create RTL shortcuts');

  for (const folder of ['ZCode', 'Qoder', 'DeepSeekHarness', 'Antigravity']) {
    assert.match(template, new RegExp(`\\$R0\\\\${folder}\\\\rtl-shortcut\\.ico`));
  }
  assert.match(template, /Inno Setup: Selected Components/);
  assert.match(template, /Function SeedLegacySelection/);
  assert.match(template, /Function PageSetupChoice[\s\S]*?nsDialogs::SetRTL/);
  assert.match(template, /VibeHubRtlSectionTitle[\s\S]*?VibeHubFullCount/);
  assert.match(template, /Function UpdateModeCount[\s\S]*?\$\{NSD_SetText\} \$ModeCountLabel/);
  for (const id of ['ModeZCode', 'ModeQoder', 'ModeDeepSeek']) {
    assert.ok(template.includes(`NSD_OnClick} $${id} UpdateModeCount`), `${id} is missing a live selection counter`);
  }
  assert.match(template, /Function PageReinstall[\s\S]*?\$UpdateMode = 1[\s\S]*?Abort/);
  assert.match(template, /Function DetectModeReplacement[\s\S]*?PreviousComponents/);
  assert.match(template, /VibeHubReplaceBody/);
  assert.match(template, /Function PageLeaveReinstall[\s\S]*?ModeReplacement = 1[\s\S]*?NSD_GetState/);
  assert.match(template, /UpdateModeControls[\s\S]*?PreviousInstallMode == ""[\s\S]*?SeedLegacySelection/);
  assert.match(template, /migrate-agentrtl-paths\.ps1/);
  assert.match(payloadBuilder, /24\.22\.1/);
  assert.match(payloadBuilder, /D2046D28C2C3DCD211AC5145C0BF30E2047EF9DFB306693C8C6E2ECCD8B95FA5/);
  assert.match(payloadBuilder, /D702DAA815EABBFF763C7D3808E235CF031CF2CA70211B56847BC72F51E240E5/);
  assert.match(payloadBuilder, /'NODE-LICENSE\.md'/);
  assert.match(payloadBuilder, /rtl-direction\.mjs/);
  assert.match(template, /rtl-direction\.mjs/);
  assert.match(payloadBuilder, /migrate-agentrtl-paths\.ps1/);
});

test('release publishing is tag-only, least-privilege, and signs updater artifacts', async () => {
  const workflow = await read('../.github/workflows/release.yml');
  assert.match(workflow, /tags:\s*\["v\*"\]/);
  assert.match(workflow, /permissions:\s*\n(?:\s+\w+:\s+\w+\s*\n)*\s*contents:\s*write/);
  assert.match(workflow, /TAURI_SIGNING_PRIVATE_KEY/);
  assert.match(workflow, /TAURI_SIGNING_PRIVATE_KEY_PASSWORD/);
  assert.match(workflow, /uses: dtolnay\/rust-toolchain@b725eda525362e7cf34af9a7243cac1e3f01a7ec/);
  assert.match(workflow, /cargo check --locked --manifest-path apps\/desktop\/src-tauri\/Cargo\.toml/);
  assert.match(workflow, /latest\.json/);
  assert.match(workflow, /configure-updater-public-key\.mjs/);
  assert.match(workflow, /TAURI_UPDATER_PUBLIC_KEY/);
  assert.match(workflow, /pnpm release:guard/);
  assert.match(workflow, /Prepare checksum-pinned Node\.js and RTL installer payload/);
  assert.match(workflow, /\.\/tests\/qoder-discovery\.ps1/);
  assert.match(workflow, /\.\/tests\/rtl-paths\.ps1/);
  assert.match(workflow, /Add-Member -MemberType NoteProperty -Name version -Value \$tagVersion/);
  assert.match(workflow, /prerelease: \$\{\{ contains\(github\.ref_name, '-'\) \}\}/);
  assert.match(workflow, /RELEASE_IS_PRERELEASE/);
  assert.match(workflow, /--prerelease/);
  assert.match(workflow, /Stable release blocked until Gate 18 is PASS for every scenario/);
  assert.match(workflow, /Publish Setup as VibeHub-Setup\.exe/);
  assert.match(workflow, /The user-facing Windows Setup must be named VibeHub-Setup\.exe/);
  assert.match(workflow, /Updater URL must point to the signed NSIS updater bundle/);
  assert.doesNotMatch(workflow, /Updater signature is missing for \$\(\$installer\.Name\)/);
  assert.match(workflow, /minisign-\$version-win64\.zip/);
  assert.match(workflow, /37B600344E20C19314B2E82813DB2BFDCC408B77B876F7727889DBD46D539479/);
  assert.match(workflow, /minisignPublisherKey = 'RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3'/);
  assert.match(workflow, /FromBase64String\(\$env:TAURI_UPDATER_PUBLIC_KEY\.Trim\(\)\)/);
  assert.match(workflow, /FromBase64String\(\(Get-Content -LiteralPath \$signature\.FullName -Raw\)\.Trim\(\)\)/);
  assert.match(workflow, /& \$minisign -Vm \$payloadPath -x \$decodedSignaturePath -p \$publicKeyPath/);
  assert.match(workflow, /latest\.json version does not match release tag/);
  assert.match(workflow, /Updater URL has no matching Release asset/);
  assert.match(workflow, /Updater JSON signature does not match the signed Release asset/);
  assert.match(workflow, /exactly one Windows Setup executable/);
  assert.ok(workflow.includes(String.raw`\.nsis\.zip`));
  assert.doesNotMatch(workflow, /choco install minisign|\.msi\.zip/);
  assert.doesNotMatch(workflow, /\.msi\.zip/);
  assert.doesNotMatch(workflow, /pull_request:/);
});

test('release normalizes updater URLs against the tagged download path instead of draft asset URLs', async () => {
  const workflow = await read('../.github/workflows/release.yml');

  assert.match(
    workflow,
    /node scripts\/normalize-updater-release\.mjs \(Join-Path \$verifyDir 'latest\.json'\) \$releasePath \$verifyDir "\$env:GITHUB_REPOSITORY" "\$tag"/,
    'the normalizer must receive the repository and tag so URLs never use draft upload paths',
  );
  assert.match(workflow, /if \(\$updaterUrl -match 'untagged-'\) \{ throw "Updater URL must never reference a draft upload/);
  assert.match(
    workflow,
    /\$canonicalBase = "https:\/\/github\.com\/\$\(\$env:GITHUB_REPOSITORY\)\/releases\/download\/\$\(\[Uri\]::EscapeDataString\(\$tag\)\)\/"/,
  );
  assert.match(workflow, /Updater URL must use the canonical tagged release path/);
  assert.match(workflow, /if \(\$updaterUrl -match 'untagged-'\) \{ throw "Refusing to publish a manifest with a draft upload URL/);
  assert.match(workflow, /Refusing to publish a non-canonical updater URL/);

  const aliasUpload = workflow.indexOf('gh release upload $tag $stableSetup $stableSignature');
  const versionedDeletion = workflow.indexOf('gh release delete-asset $tag $setups[0].name --yes');
  assert.ok(aliasUpload >= 0, 'the stable Setup alias must be uploaded');
  assert.ok(versionedDeletion > aliasUpload, 'the versioned Setup must be deleted only after the alias is uploaded');
  assert.match(workflow, /Stable Setup copy does not match the Tauri-generated executable/);
});

test('release refuses to overwrite published assets and verifies public updater URLs after publishing', async () => {
  const workflow = await read('../.github/workflows/release.yml');

  assert.match(workflow, /Refuse to overwrite a published Release and reset any stale draft/);
  assert.match(workflow, /if \(-not \$release\.isDraft\) \{/);
  assert.match(workflow, /Cut a new patch tag instead of republishing/);
  assert.ok(
    workflow.indexOf('gh release delete $tag --yes --repo $env:GITHUB_REPOSITORY') < workflow.indexOf('- name: Build signed Windows installers'),
    'a stale draft must be reset before a new draft is uploaded',
  );

  assert.match(workflow, /node scripts\/render-release-body\.mjs \.github\/release-body\.md \$bodyPath \$tag \$version \$prerelease \$notesPath/);
  assert.match(workflow, /gh release edit \$tag --notes-file \$bodyPath/);
  assert.doesNotMatch(workflow, /releaseBody:/, 'the version-specific body must come from the template and generated notes');

  assert.match(workflow, /manifestUrl = "\$base\/latest\.json"/);
  assert.match(workflow, /Tagged updater manifest is not publicly reachable/);
  assert.match(workflow, /Public updater URL is not the canonical tagged download/);
  assert.match(workflow, /Signed updater archive is not publicly reachable/);
  assert.match(workflow, /Updater signature is not publicly reachable/);
  assert.match(workflow, /Public updater signature differs from latest\.json/);
  assert.match(workflow, /releases\/latest\/download\/latest\.json/);
  assert.match(workflow, /does not serve \$version after publication/);
});

test('content publishing has only the Pages deployment permissions it needs', async () => {
  const workflow = await read('../.github/workflows/publish-content.yml');
  assert.match(workflow, /actions\/deploy-pages@/);
  assert.match(workflow, /pages:\s*write/);
  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /pnpm content:validate/);
  assert.match(await read('../.github/workflows/ci.yml'), /pnpm release:guard/);
  assert.match(workflow, /content\//);
  assert.doesNotMatch(workflow, /contents:\s*write/);
});

test('acceptance matrix records real evidence fields and keeps unrun checks non-passing', async () => {
  const matrix = await read('../docs/validation/VibeHub_Release_Acceptance_Matrix.md');
  for (const status of ['PASS', 'FAIL', 'UNVERIFIED', 'BLOCKED']) {
    assert.ok(matrix.includes(status), `matrix is missing ${status}`);
  }
  assert.doesNotMatch(matrix, /\bSKIPPED\b/, 'matrix status vocabulary must stay limited to the four current states');
  for (const field of ['CI link', 'GitHub Release URL', 'SHA-256', 'screenshot', 'log', 'build / commit', 'OS / install', 'result / time', 'evidence']) {
    assert.ok(matrix.toLowerCase().includes(field.toLowerCase()), `matrix is missing ${field}`);
  }
  assert.match(matrix, /critical[\s\S]*failures[\s\S]*block/i);
  assert.doesNotMatch(
    matrix,
    /^\| Gate 18[^|]*\| PASS\b/mi,
    'Gate 18 must stay non-PASS until clean-machine evidence exists',
  );
  const gate19PassRows = matrix
    .split(/\r?\n/)
    .filter((line) => /^\| Gate 19[^|]*\| PASS\b/i.test(line));
  for (const row of gate19PassRows) {
    assert.match(row, /\[[^\]]+\]\([^)]+\)/, 'a Gate 19 PASS row must link its evidence');
  }
});
