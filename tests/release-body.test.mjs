import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {renderReleaseBody} from '../scripts/render-release-body.mjs';

const template = await readFile(new URL('../.github/release-body.md', import.meta.url), 'utf8');

test('release body template renders a future tag without hardcoded release data', () => {
  const body = renderReleaseBody(template, {tag:'v0.3.0',version:'0.3.0',prerelease:false,generatedNotes:'## What\'s Changed\n* Example change'});
  assert.match(body, /VibeHub 0\.3\.0/);
  assert.match(body, /Settings → Updates/);
  assert.match(body, /VibeHub-\*-source\.zip/);
  assert.match(body, /What's Changed/);
  assert.doesNotMatch(body, /0\.2\.1/);
  assert.doesNotMatch(body, /\.msi/);
  assert.doesNotMatch(body, /\{\{[A-Z_]+\}\}/);
});

test('prerelease bodies carry a testing notice and stable bodies do not', () => {
  const notes = 'notes';
  assert.match(renderReleaseBody(template, {tag:'v0.3.0-beta.1',version:'0.3.0-beta.1',prerelease:true,generatedNotes:notes}), /پیش‌انتشار/);
  assert.doesNotMatch(renderReleaseBody(template, {tag:'v0.3.0',version:'0.3.0',prerelease:false,generatedNotes:notes}), /پیش‌انتشار/);
});

test('release body rendering rejects unresolved placeholders', () => {
  assert.throws(() => renderReleaseBody('{{UNKNOWN}}', {tag:'v0.3.0',version:'0.3.0',prerelease:false}), /unresolved placeholder/);
});
