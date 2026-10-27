import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

export function normalizeUpdater(latest, assets, signatureFor) {
  if (!latest.platforms || !Object.keys(latest.platforms).length) throw Error('Updater platforms are missing');
  for (const entry of Object.values(latest.platforms)) {
    const referenced = assets.find(asset => [asset.apiUrl, asset.url].includes(entry.url));
    if (!referenced) throw Error(`Updater URL has no matching release asset: ${entry.url}`);
    const archiveName = referenced.name.replace(/\.exe$/, '.nsis.zip');
    const archive = assets.find(asset => asset.name === archiveName);
    if (!archive || !archive.name.endsWith('.nsis.zip')) throw Error('Signed NSIS archive is missing');
    const signature = signatureFor(`${archive.name}.sig`).trim();
    if (!signature) throw Error('Updater archive signature is missing');
    const url = new URL(archive.url);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || !url.pathname.includes('/releases/download/')) throw Error('Public GitHub download URL is required');
    entry.url = url.href;
    entry.signature = signature;
  }
  return latest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [latestPath, releasePath, signatureDirectory] = process.argv.slice(2);
  const latest = JSON.parse(readFileSync(latestPath, 'utf8'));
  const release = JSON.parse(readFileSync(releasePath, 'utf8'));
  normalizeUpdater(latest, release.assets, name => readFileSync(join(signatureDirectory, name), 'utf8'));
  writeFileSync(latestPath, JSON.stringify(latest, null, 2) + '\n');
}
