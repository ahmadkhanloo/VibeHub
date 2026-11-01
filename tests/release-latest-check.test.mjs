import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const releaseWorkflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');

test('release workflow checks the latest stable tag through the releases/latest API', () => {
  assert.match(releaseWorkflow, /gh api "repos\/\$repository\/releases\/latest" --jq \.tag_name/);
  assert.match(releaseWorkflow, /\$latestReleaseTag -ceq \$tag/);
  assert.doesNotMatch(releaseWorkflow, /--json[^\r\n]*\bisLatest\b/);
});
