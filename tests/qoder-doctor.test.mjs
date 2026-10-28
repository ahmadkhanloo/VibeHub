import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('Qoder doctor bounds silent DevTools requests and fails instead of hanging', async () => {
  const doctor = new URL('../apps/Qoder/doctor.mjs', import.meta.url).href;
  const code = `
    globalThis.fetch = async () => ({ok:true,json:async()=>({webSocketDebuggerUrl:'ws://127.0.0.1:9'})});
    globalThis.WebSocket = class extends EventTarget {
      constructor(){super();queueMicrotask(()=>this.dispatchEvent(new Event('open')))}
      send(){} close(){this.dispatchEvent(new Event('close'))}
    };
    await import(${JSON.stringify(doctor)});
  `;
  try {
    await promisify(execFile)(process.execPath, ['--input-type=module', '-e', code], { timeout: 10000 });
    assert.fail('A silent DevTools peer must not pass verification');
  } catch (error) {
    assert.equal(error.code, 1);
    assert.match(error.stdout, /request timed out: Target\.setDiscoverTargets/);
  }
});
