import assert from 'node:assert/strict';
import test from 'node:test';
import {repairUpdaterManifest, sha256, verifyUpdaterManifest} from '../scripts/repair-updater-release.mjs';

const untagged = 'https://github.com/owner/repo/releases/download/untagged-deadbeef/app-setup.nsis.zip';
const latest = {version:'0.2.1',pub_date:'2026-10-31T00:00:00Z',platforms:{
  'windows-x86_64':{signature:'sig',url:untagged},
  'windows-x86_64-nsis':{signature:'sig',url:untagged},
}};
const rawLatest = JSON.stringify(latest,null,2) + '\n';
const checksums = `${sha256(rawLatest)}  latest.json\n${'a'.repeat(64)}  LICENSE\n`;

test('repair rewrites only updater URLs and patches the latest.json checksum line', () => {
  const result = repairUpdaterManifest(rawLatest, checksums, {repository:'owner/repo',tag:'v0.2.1'});
  const repaired = JSON.parse(result.latest);
  const canonical = 'https://github.com/owner/repo/releases/download/v0.2.1/app-setup.nsis.zip';
  for (const entry of Object.values(repaired.platforms)) {
    assert.equal(entry.url, canonical);
    assert.equal(entry.signature, 'sig');
  }
  assert.equal(repaired.version, '0.2.1');
  assert.equal(repaired.pub_date, '2026-10-31T00:00:00Z');
  assert.equal(result.changes.length, 2);
  assert.match(result.checksums, new RegExp(`^${sha256(result.latest)}  latest\\.json$`, 'm'));
  assert.match(result.checksums, /^a{64}  LICENSE$/m);
  assert.doesNotMatch(result.latest, /untagged-/);
});

test('verification accepts a canonical repaired manifest and rejects a stale one', () => {
  const result = repairUpdaterManifest(rawLatest, checksums, {repository:'owner/repo',tag:'v0.2.1'});
  assert.doesNotThrow(() => verifyUpdaterManifest(result.latest, result.checksums, {repository:'owner/repo',tag:'v0.2.1'}));
  assert.throws(() => verifyUpdaterManifest(rawLatest, checksums, {repository:'owner/repo',tag:'v0.2.1'}), /not canonical/);
});

test('repair rejects checksum mismatches, duplicate lines and non-NSIS URLs', () => {
  assert.throws(() => repairUpdaterManifest(rawLatest, `${'b'.repeat(64)}  latest.json\n`, {repository:'owner/repo',tag:'v0.2.1'}), /does not match/);
  const duplicate = `${sha256(rawLatest)}  latest.json\n${sha256(rawLatest)}  latest.json\n`;
  assert.throws(() => repairUpdaterManifest(rawLatest, duplicate, {repository:'owner/repo',tag:'v0.2.1'}), /exactly one/);
  const setup = JSON.stringify({platforms:{windows:{url:'https://github.com/owner/repo/releases/download/untagged-x/setup.exe'}}},null,2) + '\n';
  assert.throws(() => repairUpdaterManifest(setup, `${sha256(setup)}  latest.json\n`, {repository:'owner/repo',tag:'v0.2.1'}), /NSIS/);
});
