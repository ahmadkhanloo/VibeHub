import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const SEMVER_TAG = /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function canonicalAssetUrl(repository, tag, assetName) {
  if (typeof repository !== 'string' || !REPOSITORY.test(repository)) throw Error(`Invalid GitHub repository: ${repository ?? ''}`);
  if (typeof tag !== 'string' || tag.includes('untagged-') || !SEMVER_TAG.test(tag)) throw Error(`Invalid release tag: ${tag ?? ''}`);
  if (typeof assetName !== 'string' || !assetName || assetName.includes('/') || assetName.includes('\\')) throw Error(`Invalid release asset name: ${assetName ?? ''}`);
  return `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(assetName)}`;
}

export function normalizeUpdater(latest, assets, signatureFor, {repository, tag} = {}) {
  if (!repository || !tag) throw Error('Repository and release tag are required');
  if (!latest.platforms || !Object.keys(latest.platforms).length) throw Error('Updater platforms are missing');
  for (const entry of Object.values(latest.platforms)) {
    const referenced = assets.find(asset => [asset.apiUrl, asset.url, canonicalAssetUrl(repository, tag, asset.name)].includes(entry.url));
    if (!referenced) throw Error(`Updater URL has no matching release asset: ${entry.url}`);
    const archiveName = referenced.name.replace(/\.exe$/, '.nsis.zip');
    const archive = assets.find(asset => asset.name === archiveName);
    if (!archive || !archive.name.endsWith('.nsis.zip')) throw Error('Signed NSIS archive is missing');
    if (!assets.some(asset => asset.name === `${archive.name}.sig`)) throw Error(`Updater signature asset is missing: ${archive.name}.sig`);
    const signature = signatureFor(`${archive.name}.sig`).trim();
    if (!signature) throw Error('Updater archive signature is missing');
    entry.url = canonicalAssetUrl(repository, tag, archive.name);
    entry.signature = signature;
  }
  return latest;
}

function cliContext(repositoryArgument, tagArgument) {
  const repository = repositoryArgument || process.env.GITHUB_REPOSITORY;
  const tag = tagArgument || process.env.GITHUB_REF_NAME;
  if (repositoryArgument && process.env.GITHUB_REPOSITORY && repositoryArgument !== process.env.GITHUB_REPOSITORY) {
    throw Error('Repository argument does not match GITHUB_REPOSITORY');
  }
  if (tagArgument && process.env.GITHUB_REF_NAME && tagArgument !== process.env.GITHUB_REF_NAME) {
    throw Error('Release tag argument does not match GITHUB_REF_NAME');
  }
  return {repository, tag};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [latestPath, releasePath, signatureDirectory, repositoryArgument, tagArgument] = process.argv.slice(2);
  if (!latestPath || !releasePath || !signatureDirectory) {
    throw Error('Usage: normalize-updater-release.mjs <latest.json> <release.json> <signature-dir> [repository] [tag]');
  }
  const latest = JSON.parse(readFileSync(latestPath, 'utf8'));
  const release = JSON.parse(readFileSync(releasePath, 'utf8'));
  normalizeUpdater(latest, release.assets, name => readFileSync(join(signatureDirectory, name), 'utf8'), cliContext(repositoryArgument, tagArgument));
  writeFileSync(latestPath, JSON.stringify(latest, null, 2) + '\n');
}
