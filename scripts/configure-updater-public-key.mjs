import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG_URL = new URL('../apps/desktop/src-tauri/tauri.conf.json', import.meta.url);
const PLACEHOLDER = '__CONFIGURE_VIBEHUB_TAURI_UPDATER_PUBLIC_KEY__';

export function withUpdaterPublicKey(config, publicKey) {
  const key = typeof publicKey === 'string' ? publicKey.trim() : '';
  if (!key) throw new Error('TAURI_UPDATER_PUBLIC_KEY is required for production updater builds');
  if (/PRIVATE\s+KEY|BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY/i.test(key)) {
    throw new Error('private key material is forbidden in the updater public-key setting');
  }
  if (key.length < 40) throw new Error('TAURI_UPDATER_PUBLIC_KEY does not look like a Tauri public key');
  const decoded = Buffer.from(key, 'base64');
  const lines = decoded.toString('utf8').trim().split(/\r?\n/);
  const raw = Buffer.from(lines[1] ?? '', 'base64');
  if (decoded.toString('base64') !== key || !lines[0]?.startsWith('untrusted comment:') || raw.length !== 42 || raw.subarray(0, 2).toString() !== 'Ed') {
    throw new Error('TAURI_UPDATER_PUBLIC_KEY must be a base64-encoded Minisign public key');
  }

  const result = structuredClone(config);
  const current = result?.plugins?.updater?.pubkey;
  if (current !== PLACEHOLDER && current !== key) {
    throw new Error('refusing to overwrite an unexpected updater public key');
  }
  result.plugins.updater.pubkey = key;
  return result;
}

async function main() {
  const publicKey = process.env.TAURI_UPDATER_PUBLIC_KEY;
  const configPath = fileURLToPath(CONFIG_URL);
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const configured = withUpdaterPublicKey(config, publicKey);
  await writeFile(configPath, `${JSON.stringify(configured, null, 2)}\n`, 'utf8');
  process.stdout.write('Updater public key configured for this build; key value redacted.\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
