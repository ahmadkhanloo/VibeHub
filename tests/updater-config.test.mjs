import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { withUpdaterPublicKey } from '../scripts/configure-updater-public-key.mjs';

const config = JSON.parse(await readFile(new URL('../apps/desktop/src-tauri/tauri.conf.json', import.meta.url), 'utf8'));

test('production updater configuration requires a public key and never accepts private key material', () => {
  assert.throws(() => withUpdaterPublicKey(config, ''), /TAURI_UPDATER_PUBLIC_KEY is required/);
  assert.throws(() => withUpdaterPublicKey(config, '-----BEGIN PRIVATE KEY-----\nsecret'), /private key material is forbidden/);
});

test('production updater configuration replaces only the public key placeholder', () => {
  const publicKey = config.plugins.updater.pubkey;
  const fixture = structuredClone(config);
  fixture.plugins.updater.pubkey = '__CONFIGURE_VIBEHUB_TAURI_UPDATER_PUBLIC_KEY__';
  const configured = withUpdaterPublicKey(fixture, publicKey);

  assert.equal(configured.plugins.updater.pubkey, publicKey);
  assert.equal(configured.plugins.updater.endpoints[0], 'https://github.com/ahmadkhanloo/VibeHub/releases/latest/download/latest.json');
  assert.match(JSON.stringify(configured), /VibeHub/);
  assert.doesNotMatch(JSON.stringify(configured), /PRIVATE KEY/);
  assert.deepEqual(withUpdaterPublicKey(config, publicKey), config);
  assert.throws(() => withUpdaterPublicKey(fixture, 'invalid-public-key'.repeat(5)), /public key/);
});
