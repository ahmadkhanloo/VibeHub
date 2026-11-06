import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const windowsPath = new URL('../apps/desktop/src-tauri/src/windows.ps1', import.meta.url);
const windows = await readFile(windowsPath, 'utf8');
const manifest = JSON.parse(await readFile(new URL('../content/apps/chatgpt.json', import.meta.url), 'utf8'));

test('Codex package identity gates RTL independently of the ChatGPT.exe basename', () => {
  const componentsFunction = windows.match(/function\s+Get-RtlComponents\([\s\S]*?(?=\nfunction\s)/)?.[0] ?? '';
  for (const expression of [
    /function\s+Resolve-OpenAIProduct\s*\(/,
    /function\s+Get-CodexRtlAvailability\s*\(/,
    /Resolve-OpenAIProduct\s+\$packageName\s+\$executablePath/,
    /cdpLaunchVerified/,
    /Get-CodexRtlAvailability/,
    /\$available\s*=\s*\$resolvedProduct\s+-eq\s+'codex'\s+-and\s+\$cdpLaunchVerified/s,
  ]) assert.ok(expression.test(windows), `missing Codex RTL contract: ${expression}`);
  assert.ok(/CodexRtlStatus\s+\$resourceRoot/.test(componentsFunction), 'Get-RtlComponents must expose Codex only through the guarded availability result');
});

test('ordinary ChatGPT stays out of RTL setup and RTL launch fails closed', () => {
  assert.equal(manifest.id, 'chatgpt');
  assert.equal(manifest.capabilities.rtl, 'unsupported');
  for (const expression of [
    /ordinary ChatGPT/i,
    /Codex Desktop RTL is unavailable/i,
    /'rtl-setup'[\s\S]*?if \(\$id -notin @\('zcode','qoder','deepseek-harness','antigravity','opencode','claude-desktop'\)\)/,
    /if \(\$id -eq 'claude-desktop'\)[\s\S]*?Get-RtlComponents \$root[\s\S]*?setupSupported/,
    /if \(\$id -eq 'chatgpt' -and \$request\.req\.rtl\)[\s\S]*?CodexRtlStatus/,
  ]) assert.ok(expression.test(windows), `missing ChatGPT fail-closed contract: ${expression}`);
});

test('Codex account-management operation IDs and discovery remain intact', () => {
  for (const operation of ['codex-desktop', 'codex-desktop-close', 'codex-desktop-open']) {
    assert.ok(new RegExp(`'${operation}'`).test(windows), `lost account operation ${operation}`);
  }
  assert.ok(/function\s+Codex-DesktopState\b/.test(windows));
  const desktopState = windows.match(/function\s+Codex-DesktopState\b[\s\S]*?(?=\nfunction\s)/)?.[0] ?? '';
  assert.ok(/Get-AppxPackage\s+-Name\s+'OpenAI\.Codex'/.test(desktopState));
  assert.ok(/Resolve-OpenAIProduct\b[^\r\n]+-eq\s+'codex'/.test(desktopState));
});
