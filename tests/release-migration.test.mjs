import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

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
  assert.match(workflow, /Updater signature is missing for \$\(\$installer\.Name\)/);
  assert.match(workflow, /minisign-\$version-win64\.zip/);
  assert.match(workflow, /37B600344E20C19314B2E82813DB2BFDCC408B77B876F7727889DBD46D539479/);
  assert.match(workflow, /minisignPublisherKey = 'RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3'/);
  assert.match(workflow, /FromBase64String\(\$env:TAURI_UPDATER_PUBLIC_KEY\.Trim\(\)\)/);
  assert.match(workflow, /FromBase64String\(\(Get-Content -LiteralPath \$signature\.FullName -Raw\)\.Trim\(\)\)/);
  assert.match(workflow, /& \$minisign -Vm \$payloadPath -x \$decodedSignaturePath -p \$publicKeyPath/);
  assert.match(workflow, /latest\.json version does not match release tag/);
  assert.match(workflow, /Updater URL has no matching Release asset/);
  assert.match(workflow, /Updater JSON signature does not match the signed Release asset/);
  assert.doesNotMatch(workflow, /choco install minisign|\.nsis\.zip|\.msi\.zip/);
  assert.doesNotMatch(workflow, /\.nsis\.zip|\.msi\.zip/);
  assert.doesNotMatch(workflow, /pull_request:/);
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
  for (const status of ['PASS', 'FAIL', 'SKIPPED', 'UNVERIFIED']) {
    assert.ok(matrix.includes(status), `matrix is missing ${status}`);
  }
  for (const field of ['CI link', 'GitHub Release URL', 'checksum', 'screenshot', 'log']) {
    assert.ok(matrix.toLowerCase().includes(field.toLowerCase()), `matrix is missing ${field}`);
  }
  assert.match(matrix, /critical[\s\S]*failures[\s\S]*block/i);
  assert.doesNotMatch(matrix, /^\| Gate (?:18|19)[^|]*\| PASS \|/mi);
});
