import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalAssetUrl, normalizeUpdater} from '../scripts/normalize-updater-release.mjs';

const context = {repository: 'owner/repo', tag: 'v0.1.0'};
const draft = name => `https://github.com/owner/repo/releases/download/untagged-deadbeef/${name}`;
const assets = ['app-setup.exe', 'app-setup.nsis.zip', 'app-setup.nsis.zip.sig'].map((name,index) => ({
  name,
  apiUrl: `https://api.github.com/repos/owner/repo/releases/assets/${index}`,
  url: draft(name),
}));

test('updater maps draft API and installer URLs to the signed canonical tagged archive', () => {
  for (const asset of assets.filter(candidate => !candidate.name.endsWith('.sig'))) for (const url of [asset.apiUrl, asset.url]) {
    const latest = normalizeUpdater({platforms:{'windows-x86_64':{url,signature:'old'}}}, assets, name => {
      assert.equal(name,'app-setup.nsis.zip.sig');
      return 'archive-signature\n';
    }, context);
    assert.equal(latest.platforms['windows-x86_64'].url, 'https://github.com/owner/repo/releases/download/v0.1.0/app-setup.nsis.zip');
    assert.equal(latest.platforms['windows-x86_64'].signature,'archive-signature');
    assert.doesNotMatch(JSON.stringify(latest), /untagged-/);
  }
});

test('updater normalization is idempotent for canonical tagged URLs', () => {
  const canonical = 'https://github.com/owner/repo/releases/download/v0.1.0/app-setup.nsis.zip';
  const latest = normalizeUpdater({platforms:{windows:{url:canonical}}}, assets, () => 'sig', context);
  assert.equal(latest.platforms.windows.url, canonical);
});

test('updater preserves prerelease tags and build metadata', () => {
  for (const tag of ['v0.2.0-beta.6','v0.2.2-beta.1','v1.0.0+build.7']) {
    const latest = normalizeUpdater({platforms:{windows:{url:assets[1].apiUrl}}}, assets, () => 'sig', {repository:'owner/repo',tag});
    assert.equal(latest.platforms.windows.url, `https://github.com/owner/repo/releases/download/${encodeURIComponent(tag)}/app-setup.nsis.zip`);
  }
});

test('updater rejects unknown URLs, missing context, archives and signatures', () => {
  const latest = url => ({platforms:{windows:{url}}});
  assert.throws(() => normalizeUpdater(latest('https://example.com/file'),assets,()=>'',context), /no matching/);
  assert.throws(() => normalizeUpdater(latest(assets[0].apiUrl),assets,()=>''), /Repository and release tag/);
  assert.throws(() => normalizeUpdater(latest(assets[0].apiUrl),assets.slice(0,1),()=>'',context), /archive is missing/);
  assert.throws(() => normalizeUpdater(latest(assets[1].apiUrl),assets.filter(asset => !asset.name.endsWith('.sig')),()=>'',context), /signature asset is missing/);
  assert.throws(() => normalizeUpdater(latest(assets[1].apiUrl),assets,()=>'',context), /signature is missing/);
});

test('canonical asset URLs reject untagged or malformed inputs', () => {
  assert.equal(canonicalAssetUrl('owner/repo','v0.2.1','app.nsis.zip'), 'https://github.com/owner/repo/releases/download/v0.2.1/app.nsis.zip');
  assert.throws(() => canonicalAssetUrl('owner/repo','untagged-deadbeef','app.nsis.zip'), /Invalid release tag/);
  assert.throws(() => canonicalAssetUrl('owner/repo','0.2.1','app.nsis.zip'), /Invalid release tag/);
  assert.throws(() => canonicalAssetUrl('owner','v0.2.1','app.nsis.zip'), /Invalid GitHub repository/);
  assert.throws(() => canonicalAssetUrl('owner/repo','v0.2.1','../app.nsis.zip'), /Invalid release asset name/);
});
