import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const desktopUrl = new URL('../content/apps/freebuff-desktop.json', import.meta.url);
const cliUrl = new URL('../content/apps/freebuff.json', import.meta.url);

test('Freebuff Desktop has a distinct catalog ID from the Freebuff CLI', async () => {
  const [desktop, cli] = await Promise.all([
    readFile(desktopUrl, 'utf8').then(JSON.parse),
    readFile(cliUrl, 'utf8').then(JSON.parse),
  ]);
  assert.equal(desktop.id, 'freebuff-desktop');
  assert.equal(desktop.name, 'Freebuff Desktop');
  assert.equal(desktop.kind, 'desktop_agent');
  assert.deepEqual(desktop.platforms, ['windows', 'linux', 'macos']);
  assert.equal(cli.id, 'freebuff');
  assert.equal(cli.kind, 'cli_agent');
});

test('without renderer evidence, Desktop stays RTL-unavailable and gets no guessed adapter', async () => {
  const desktop = JSON.parse(await readFile(desktopUrl, 'utf8'));
  const cli = JSON.parse(await readFile(cliUrl, 'utf8'));
  assert.equal(desktop.capabilities.rtl, 'unsupported');
  assert.equal(cli.id, 'freebuff');
  assert.equal(cli.kind, 'cli_agent');
  await assert.rejects(access(new URL('../apps/FreebuffDesktop', import.meta.url)));
});
