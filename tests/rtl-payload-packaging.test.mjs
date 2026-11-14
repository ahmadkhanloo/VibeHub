import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const adapters = new Map([
  ['zcode', 'ZCode'],
  ['qoder', 'Qoder'],
  ['deepseek-harness', 'DeepSeekHarness'],
  ['antigravity', 'Antigravity'],
  ['opencode', 'OpenCode'],
  ['claude-desktop', 'Claude'],
]);
const payloadFiles = ['start.ps1', 'launch.vbs', 'injector.mjs', 'style.mjs', 'cdp-targets.mjs', 'rtl.ico'];
const fontFiles = ['assets/OFL.txt', 'assets/Vazirmatn-Regular.woff2', 'assets/Vazirmatn-Bold.woff2'];

function parsePowerShellAdapterMap(source) {
  const body = source.match(/\$files\s*=\s*@\{([\s\S]*?)\n\s*\}/)?.[1];
  assert.ok(body, 'independent payload preparation must expose its adapter manifest');
  const result = new Map();
  for (const match of body.matchAll(/^\s*(\w+)\s*=\s*@\(([^)]*)\)/gm)) {
    result.set(match[1], [...match[2].matchAll(/'([^']+)'/g)].map(value => value[1]));
  }
  return result;
}

function fullPackageHas(resources, relative) {
  const wanted = `../../../apps/${relative}`.replaceAll('\\', '/');
  return Object.keys(resources).some(key => {
    const normalized = key.replaceAll('\\', '/');
    return normalized === wanted || (normalized.endsWith('/') && wanted.startsWith(normalized));
  });
}

test('every usable adapter carries its launcher, injector, style, target guard, logo badge icon and fonts in both payload modes', async () => {
  const prepare = await read('scripts/prepare-windows-rtl-payload.ps1');
  const independent = parsePowerShellAdapterMap(prepare);
  const tauri = JSON.parse(await read('apps/desktop/src-tauri/tauri.conf.json'));
  const resources = tauri.bundle.resources;

  for (const [id, folder] of adapters) {
    const files = independent.get(folder) ?? [];
    for (const file of [...payloadFiles, ...fontFiles]) {
      assert.ok(files.includes(file), `${folder} independent payload is missing ${file}`);
      assert.ok(fullPackageHas(resources, `${folder}/${file}`), `${folder} full Tauri package is missing ${file}`);
      await read(`apps/${folder}/${file}`);
    }
    assert.ok(files.includes('rtl-shortcut.ico'), `${folder} independent payload is missing its logo plus RTL shortcut icon`);
    await read(`apps/${folder}/rtl-shortcut.ico`);
    if (id === 'claude-desktop') {
      assert.ok(files.includes('compatibility.json'), 'Claude Desktop must ship its version-specific RTL compatibility gate');
      assert.ok(fullPackageHas(resources, `${folder}/compatibility.json`), 'Claude Desktop compatibility gate must ship in the full package');
      const compatibility = JSON.parse(await read(`apps/${folder}/compatibility.json`));
      assert.equal(compatibility.adapterVerified, false, 'unverified Claude Desktop RTL must remain disabled');
      assert.ok(compatibility.reason, 'unverified Claude Desktop RTL must explain the compatibility blocker');
    }
    assert.ok(folder && id, 'adapter map entries must remain named');
  }

  for (const [folder, files] of [['Qoder', ['doctor.mjs', 'LICENSE']]]) {
    for (const file of files) {
      assert.ok(independent.get(folder)?.includes(file), `${folder} independent payload is missing ${file}`);
      assert.ok(fullPackageHas(resources, `${folder}/${file}`), `${folder} full Tauri package is missing ${file}`);
    }
  }
  assert.ok(prepare.includes("Copy-Item -LiteralPath (Join-Path $root 'apps\\rtl-style.mjs')"), 'shared style helper must ship in the independent payload');
  assert.ok(fullPackageHas(resources, 'rtl-style.mjs'), 'shared style helper must ship in the full Tauri package');
  assert.ok(prepare.includes("Copy-Item -LiteralPath (Join-Path $root 'apps\\rtl-launch-lib.ps1')"), 'shared launcher library must ship in the independent payload');
  assert.ok(fullPackageHas(resources, 'rtl-launch-lib.ps1'), 'shared launcher library must ship in the full Tauri package');
  const rtlInstaller = await read('apps/desktop/src-tauri/windows/installer.nsi');
  assert.ok(rtlInstaller.includes('File "${VIBEHUB_PAYLOAD_DIR}\\rtl-style.mjs"'), 'standalone RTL installer must install the shared style helper');
  assert.ok(rtlInstaller.includes('Delete "$INSTDIR\\apps\\rtl-style.mjs"'), 'standalone RTL uninstaller must remove its shared style helper');
  assert.ok(rtlInstaller.includes('File "${VIBEHUB_PAYLOAD_DIR}\\rtl-launch-lib.ps1"'), 'standalone RTL installer must install the shared launcher library');
  assert.ok(rtlInstaller.includes('Delete "$INSTDIR\\apps\\rtl-launch-lib.ps1"'), 'standalone RTL uninstaller must remove its shared launcher library');
});

test('the independent RTL installer offers every available adapter and keeps translations in sync', async () => {
  const installer = await read('apps/desktop/src-tauri/windows/installer.nsi');
  for (const token of [
    'OpenCode RTL', 'SEC_OPENCODE', 'ModeOpenCode', 'VibeHubOpenCode',
    'Claude Desktop RTL', 'SEC_CLAUDE', 'ModeClaude', 'VibeHubClaude',
    'Choose 1–6 tools', 'Choose RTL tools (6 available)', 'All 6 RTL tools',
  ]) assert.ok(installer.includes(token), `NSIS independent RTL mode is missing ${token}`);
  assert.match(installer, /File \/r "\$\{VIBEHUB_PAYLOAD_DIR\}\\OpenCode\\\*"/);
  assert.match(installer, /StrCpy \$SelectedComponents "[^"]*opencode[^"]*"/);

  const sourceInstaller = await read('install.ps1');
  assert.match(sourceInstaller, /function Assert-ClaudeRtlCompatible/);
  assert.match(sourceInstaller, /adapterVerified -ne \$true[\s\S]*?Get-AuthenticodeSignature[\s\S]*?ProductVersion/,
    'the source-checkout helper must keep Claude shortcut creation version- and signature-gated');
  for (const id of ['antigravity', 'opencode', 'claude-desktop']) {
    const key = id === 'claude-desktop' ? `['"]${id}['"]` : id;
    assert.match(sourceInstaller, new RegExp(`^\\s*${key}\\s*=`, 'm'), `source-checkout shortcut helper must support ${id}`);
  }
});

test('upgrades preserve foreign shortcuts and uninstall removes only exact VibeHub launcher targets', async () => {
  const installer = await read('apps/desktop/src-tauri/windows/installer.nsi');
  const ownedMacro = installer.match(/!macro CreateOwnedRtlShortcut[\s\S]*?!macroend/)?.[0] ?? '';
  assert.match(ownedMacro, /IsShortcutTarget/);
  assert.match(ownedMacro, /DetailPrint "Keeping unrelated shortcut/);
  assert.doesNotMatch(ownedMacro, /SetShortcutTarget/);

  const uninstaller = installer.match(/; Remove the standalone launcher shortcuts only when they still point to our files\.[\s\S]*?RMDir "\$R4"/)?.[0] ?? '';
  assert.ok(uninstaller, 'uninstaller must have an explicit standalone-shortcut cleanup block');
  const labels = new Map([
    ['ZCode', 'ZCode'], ['Qoder', 'Qoder'], ['DeepSeekHarness', 'DeepSeek Harness'],
    ['Antigravity', 'Antigravity'], ['OpenCode', 'OpenCode'],
    ['Claude', 'Claude Desktop'],
  ]);
  for (const [, folder] of adapters) {
    const label = labels.get(folder);
    for (const [area, root] of [['start menu', '$R4'], ['desktop', '$DESKTOP']]) {
      const shortcut = `${root}\\${label} RTL.lnk`;
      const target = `$R0\\${folder}\\launch.vbs`;
      const quoted = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const block = new RegExp(`!insertmacro IsShortcutTarget "${quoted(shortcut)}" "${quoted(target)}"\\r?\\n\\s*Pop \\$0\\r?\\n\\s*\\$\\{If\\} \\$0 = 1\\r?\\n\\s*Delete "${quoted(shortcut)}"\\r?\\n\\s*\\$\\{EndIf\\}`);
      assert.match(uninstaller, block, `${folder} ${area} shortcut must be deleted only when it still targets its VibeHub launcher`);
    }
  }
});

test('injector shutdown covers every packaged adapter while unverified apps stay out of payloads', async () => {
  const cleanup = await read('cleanup.ps1');
  const prepare = await read('scripts/prepare-windows-rtl-payload.ps1');
  const tauri = JSON.parse(await read('apps/desktop/src-tauri/tauri.conf.json'));
  for (const folder of adapters.values()) {
    assert.ok(cleanup.includes(`apps\\${folder}\\injector.mjs`), `cleanup must stop the ${folder} injector`);
  }
  for (const unavailable of ['Codex', 'FreebuffDesktop']) {
    assert.doesNotMatch(prepare, new RegExp(`^\\s*${unavailable}\\s*=`, 'm'));
    assert.equal(fullPackageHas(tauri.bundle.resources, `${unavailable}/injector.mjs`), false);
  }
});
