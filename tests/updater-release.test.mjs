import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeUpdater} from '../scripts/normalize-updater-release.mjs';

const assets = ['app-setup.exe', 'app-setup.nsis.zip'].map((name,index) => ({name,apiUrl:`https://api.github.com/repos/owner/repo/releases/assets/${index}`,url:`https://github.com/owner/repo/releases/download/v0.1.0/${name}`}));
test('updater maps draft API and installer URLs to the signed public NSIS archive', () => {
  for (const asset of assets) for (const url of [asset.apiUrl, asset.url]) {
    const latest = normalizeUpdater({platforms:{'windows-x86_64':{url,signature:'old'}}}, assets, name => {
      assert.equal(name,'app-setup.nsis.zip.sig');return 'archive-signature\n';
    });
    assert.equal(latest.platforms['windows-x86_64'].url, assets[1].url);
    assert.equal(latest.platforms['windows-x86_64'].signature,'archive-signature');
  }
});
test('updater rejects unknown URLs, missing archives and missing signatures', () => {
  const latest = url => ({platforms:{windows:{url}}});
  assert.throws(() => normalizeUpdater(latest('https://example.com/file'),assets,()=>''), /no matching/);
  assert.throws(() => normalizeUpdater(latest(assets[0].apiUrl),assets.slice(0,1),()=>''), /archive is missing/);
  assert.throws(() => normalizeUpdater(latest(assets[1].apiUrl),assets,()=>''), /signature is missing/);
});
