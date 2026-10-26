import test from 'node:test';
import assert from 'node:assert/strict';
import { preferredLaunchMode, launchBlocked, normalizeSearch } from '../packages/core/src/ux.ts';
test('RTL defaults only when both evidence and component are ready; explicit preference remains explicit',()=>{
 assert.equal(preferredLaunchMode(undefined,true,true),'rtl');
 assert.equal(preferredLaunchMode(undefined,true,false),'normal');
 assert.equal(preferredLaunchMode('normal',true,true),'normal');
 assert.equal(preferredLaunchMode('rtl',true,false),'rtl');
});
test('launches fail closed for unknown state, active process, missing selected RTL and in-flight requests',()=>{
 assert.equal(launchBlocked('normal',undefined,false,false),true);
 assert.equal(launchBlocked('rtl',{phase:'running',rtl:false},true,false),true);
 assert.equal(launchBlocked('rtl',{phase:'idle'},false,false),true);
 assert.equal(launchBlocked('normal',{phase:'idle'},false,true),true);
 assert.equal(launchBlocked('normal',{phase:'idle'},false,false),false);
});
test('catalog search normalizes Persian letter forms and English case without changing copied values',()=>{
 assert.equal(normalizeSearch(' NVIDIA '),'nvidia');
 assert.equal(normalizeSearch('ي ك'),'ی ک');
});
