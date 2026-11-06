import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('Persian terminal download opens latest official release without native installation',async()=>{
 const source=await readFile(new URL('../apps/desktop/src/features/terminal/Terminal.tsx',import.meta.url),'utf8');
 assert.match(source,/https:\/\/github.com\/mirbehnam\/RtlTerminal\/releases\/latest/);
 assert.doesNotMatch(source,/ipc\.terminalInstallPersian\(/);
 assert.doesNotMatch(source,/setConfirmation\('persian'\)/);
});
