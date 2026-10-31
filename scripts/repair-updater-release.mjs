import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {canonicalAssetUrl} from './normalize-updater-release.mjs';

export const sha256 = text => createHash('sha256').update(text).digest('hex');

function canonicalPlatformUrl(entry, {repository, tag}) {
  let parsed;
  try {
    parsed = new URL(entry.url);
  } catch {
    throw Error(`Updater URL is not valid: ${entry.url}`);
  }
  let assetName;
  try {
    assetName = decodeURIComponent(parsed.pathname.split('/').pop() || '');
  } catch {
    throw Error(`Updater URL has an invalid asset name: ${entry.url}`);
  }
  if (!assetName.endsWith('.nsis.zip')) throw Error(`Updater URL does not target a signed NSIS archive: ${entry.url}`);
  return {assetName, url: canonicalAssetUrl(repository, tag, assetName)};
}

export function repairUpdaterManifest(rawLatest, rawChecksums, {repository, tag}) {
  const latest = JSON.parse(rawLatest);
  if (!latest.platforms || !Object.keys(latest.platforms).length) throw Error('Updater platforms are missing');
  const changes = [];
  for (const [platform, entry] of Object.entries(latest.platforms)) {
    const {url} = canonicalPlatformUrl(entry, {repository, tag});
    if (entry.url !== url) changes.push({platform, from: entry.url, to: url});
    entry.url = url;
  }
  const repairedLatest = JSON.stringify(latest, null, 2) + '\n';
  const lines = rawChecksums.split(/\r?\n/);
  const matches = lines.map((line,index) => ({line,index})).filter(({line}) => /^[0-9a-fA-F]{64}  latest\.json$/.test(line));
  if (matches.length !== 1) throw Error(`Expected exactly one latest.json checksum line, found ${matches.length}`);
  const [{line,index}] = matches;
  const oldHash = sha256(rawLatest);
  if (line.slice(0,64).toLowerCase() !== oldHash) throw Error('Published checksum for latest.json does not match the downloaded manifest');
  const newHash = sha256(repairedLatest);
  lines[index] = `${newHash}  latest.json`;
  return {latest: repairedLatest, checksums: lines.join('\n'), changes, oldHash, newHash};
}

export function verifyUpdaterManifest(rawLatest, rawChecksums, context) {
  const result = repairUpdaterManifest(rawLatest, rawChecksums, context);
  if (result.changes.length) {
    throw Error(`Updater manifest is not canonical:\n${result.changes.map(change => `${change.platform}: ${change.from}`).join('\n')}`);
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argumentsList = process.argv.slice(2);
  const checkOnly = argumentsList.includes('--check');
  const [latestPath, checksumsPath, repository, tag] = argumentsList.filter(argument => argument !== '--check');
  if (!latestPath || !checksumsPath || !repository || !tag) {
    throw Error('Usage: repair-updater-release.mjs <latest.json> <checksums-sha256.txt> <repository> <tag> [--check]');
  }
  const rawLatest = readFileSync(latestPath, 'utf8');
  const rawChecksums = readFileSync(checksumsPath, 'utf8');
  const result = checkOnly
    ? verifyUpdaterManifest(rawLatest, rawChecksums, {repository, tag})
    : repairUpdaterManifest(rawLatest, rawChecksums, {repository, tag});
  if (!checkOnly) {
    writeFileSync(latestPath, result.latest);
    writeFileSync(checksumsPath, result.checksums);
  }
  process.stdout.write(`${JSON.stringify({checkOnly, changed: result.changes.length, oldHash: result.oldHash, newHash: result.newHash})}\n`);
}
