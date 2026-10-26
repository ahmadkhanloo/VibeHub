import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildCss, INJECT_JS } from '../apps/Qoder/style.mjs';
import { buildAutoHeadingDirectionScript } from '../apps/rtl-direction.mjs';

const zcode = await readFile(new URL('../apps/ZCode/injector.mjs', import.meta.url), 'utf8');
const harness = await readFile(new URL('../apps/DeepSeekHarness/injector.mjs', import.meta.url), 'utf8');
const directionHelper = await readFile(new URL('../apps/rtl-direction.mjs', import.meta.url), 'utf8');
const home = await readFile(new URL('../apps/desktop/src/features/home/Home.tsx', import.meta.url), 'utf8');

test('RTL styles align headings by their text direction and center table content', () => {
  const css = buildCss({ font: false });
  assert.match(css, /:is\(h1,h2,h3,h4,h5,h6\):dir\(rtl\)[^{]*\{[^}]*text-align:\s*right/i);
  assert.match(css, /:is\(td,th\)[^{]*\{[^}]*text-align:\s*center/i);
  assert.match(css, /:is\(td,th\) :is\(h1,h2,h3,h4,h5,h6\):dir\(rtl\)[^{]*\{[^}]*text-align:\s*center/i);
  assert.match(zcode, /DIRECTION_ALIGNMENT_CSS/);
  assert.match(harness, /DIRECTION_ALIGNMENT_CSS/);
});

test('each injector sets automatic direction on new headings', () => {
  assert.match(INJECT_JS, /setAttribute\(['"]dir['"],\s*['"]auto['"]\)/);
  assert.doesNotThrow(() => new Function(INJECT_JS));
  assert.doesNotThrow(() => new Function(buildAutoHeadingDirectionScript('rtl-heading-test')));
  assert.match(zcode, /buildAutoHeadingDirectionScript/);
  assert.match(harness, /buildAutoHeadingDirectionScript/);
  assert.match(INJECT_JS, /new MutationObserver/);
  assert.match(directionHelper, /new MutationObserver/);
});

test('launch controls and shared context apply the shared fail-closed policy', async () => {
  const controls = await readFile(new URL('../apps/desktop/src/components/LaunchControls.tsx', import.meta.url), 'utf8');
  const context = await readFile(new URL('../apps/desktop/src/app/tool-context.tsx', import.meta.url), 'utf8');
  assert.match(home, /LaunchControls/);
  assert.match(controls, /launchBlocked/);
  assert.match(controls, /disabled=\{blocked\}/);
  assert.match(context, /ipc\.launchState/);
  assert.match(context, /launchBlocked/);
});
