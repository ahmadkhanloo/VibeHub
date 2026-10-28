import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const baseline = await mkdtemp(join(tmpdir(), 'vibehub-discovery-benchmark-'));
const files = ['apps/desktop/src-tauri/src/windows.ps1', 'apps/rtl-paths.ps1',
  ...['Qoder', 'ZCode', 'DeepSeekHarness'].map(name => `apps/${name}/start.ps1`)];
const revision = execFileSync('git', ['rev-parse', 'HEAD'], {cwd:root, encoding:'utf8', windowsHide:true}).trim();

async function scan(resourceRoot, script, timeoutMs = 15000) {
  const start = performance.now();
  const output = await new Promise((resolveOutput, reject) => {
    const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script],
      {windowsHide:true, stdio:['pipe','pipe','pipe']});
    let text = '', errors = '';
    const timer = setTimeout(() => { child.kill(); reject(Error('Discovery benchmark timed out')); }, timeoutMs);
    child.stdout.setEncoding('utf8').on('data', chunk => { text += chunk; });
    child.stderr.on('data', chunk => { errors += chunk; });
    child.on('error', reject);
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolveOutput(text) : reject(Error(errors)); });
    child.stdin.end(JSON.stringify({operation:'detect', resourceRoot}));
  });
  const json = output.split(/\r?\n/).findLast(line => line.startsWith('VIBEHUB_JSON:'));
  return {ms:Math.round(performance.now()-start), apps:JSON.parse(json.slice(13))};
}

try {
  for (const file of files) {
    const path = join(baseline, file);
    await mkdir(resolve(path, '..'), {recursive:true});
    await writeFile(path, execFileSync('git', ['show', `${revision}:${file}`], {cwd:root, windowsHide:true}));
  }
  const before = [], after = [];
  for (let i=0;i<3;i++) {
    const old = await scan(baseline, join(baseline, files[0]), 60000);
    const current = await scan(root, join(root, files[0]));
    const identities = apps => apps.map(({id,installed,path,version}) => ({id,installed,path,version}));
    assert.deepEqual(identities(current.apps), identities(old.apps), 'Discovery must preserve installed apps, paths and versions');
    before.push(old.ms); after.push(current.ms);
    console.log(`Run ${i+1}: baseline ${old.ms} ms, current ${current.ms} ms`);
  }
  const median = numbers => [...numbers].sort((a,b)=>a-b)[1];
  const report = {baselineRevision:revision, beforeMs:before, afterMs:after,
    medianBeforeMs:median(before), medianAfterMs:median(after),
    reductionPercent:Math.round(100*(1-median(after)/median(before))), identitiesPreserved:true};
  await mkdir(join(root,'output/performance'), {recursive:true});
  await writeFile(join(root,'output/performance/discovery.json'), JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
} finally {
  // Remove only the temporary directory created by this benchmark.
  if (baseline.startsWith(join(tmpdir(),'vibehub-discovery-benchmark-')))
    await rm(baseline, {recursive:true, force:true});
}
