// Opt-in live acceptance. Uses only the existing Radeon credential in the selected
// Claude settings file; never persists or prints it. Relay observes, never rewrites.
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir,homedir} from 'node:os';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
if(!process.argv.includes('--live')) {console.log('SKIP: pass --live to use existing Radeon free allowance');process.exit(0);}
const settings=JSON.parse(readFileSync(process.env.CLAUDE_TEST_SETTINGS||join(homedir(),'.claude/settings.json'),'utf8'));
const base=settings.env?.ANTHROPIC_BASE_URL;
assert.equal(base,'https://developer.amd.com.cn/radeon/api','Live test is restricted to the existing Radeon endpoint');
const key=settings.env.ANTHROPIC_AUTH_TOKEN||settings.env.ANTHROPIC_API_KEY;
assert.ok(key,'Existing credential required');
const model=process.env.CLAUDE_TEST_MODEL||'Qwen3.8-Flash-Next';
const redact=s=>String(s).split(key).join('[REDACTED]');
if(process.argv.includes('--models')) {
 const r=await fetch(base+'/v1/models',{headers:{authorization:`Bearer ${key}`},redirect:'error',signal:AbortSignal.timeout(30000)});
 const data=await r.json();console.log(JSON.stringify({status:r.status,models:data.data?.map(m=>m.id)},null,2));process.exit(r.ok?0:1);
}
const directory=mkdtempSync(join(tmpdir(),'vibehub-live-'));
const marker='VIBEHUB_LIVE_8291',file=join(directory,'acceptance.txt');writeFileSync(file,marker);
const observations=[];
const server=createServer((req,res)=>{
 if(req.headers.authorization!==`Bearer ${key}`){res.writeHead(401);res.end();return;}
 let body='';req.on('data',x=>body+=x);req.on('end',async()=>{try{
 const data=body?JSON.parse(body):{};
 const observation={model:data.model,roles:data.messages?.map(m=>m.role),stream:data.stream,tools:data.tools?.map(t=>t.name)};
 const upstream=await fetch(base+req.url,{method:req.method,headers:{'content-type':'application/json','anthropic-version':'2023-06-01',authorization:`Bearer ${key}`,...(req.headers['anthropic-beta']?{'anthropic-beta':req.headers['anthropic-beta']}:{})},redirect:'error',body:body||undefined,signal:AbortSignal.timeout(60000)});
 observation.status=upstream.status;observations.push(observation);
 res.writeHead(upstream.status,{'content-type':upstream.headers.get('content-type')||'application/json'});
 if(!upstream.ok){const text=await upstream.text();observation.error=redact(text).slice(0,600);res.end(text);return;}
 for await(const chunk of upstream.body)res.write(chunk);res.end();
 }catch{
 observations.push({transportError:true});
 if(res.headersSent)res.destroy();
 else {res.writeHead(502);res.end('{"error":{"type":"api_error","message":"Live acceptance upstream unavailable"}}');}
 }});});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const env={...process.env,CLAUDE_CONFIG_DIR:join(directory,'config'),ANTHROPIC_BASE_URL:`http://127.0.0.1:${server.address().port}`,ANTHROPIC_AUTH_TOKEN:key,ANTHROPIC_MODEL:model,ANTHROPIC_DEFAULT_OPUS_MODEL:model,ANTHROPIC_DEFAULT_SONNET_MODEL:model,ANTHROPIC_DEFAULT_HAIKU_MODEL:model,MAX_THINKING_TOKENS:'0',CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1',HTTP_PROXY:'',HTTPS_PROXY:'',ALL_PROXY:'',NO_PROXY:'localhost,127.0.0.1'};
delete env.ANTHROPIC_API_KEY;delete env.CLAUDE_CODE_OAUTH_TOKEN;
async function run(prompt,resume=false){
 const args=['--plugin-dir',resolve('apps/ClaudeRtlPlugin'),'-p',prompt,'--model',model,'--allowedTools','Read','--max-turns','5','--output-format','stream-json','--verbose'];if(resume)args.push('--continue');
 const child=spawn(process.env.CLAUDE_TEST_EXE||join(process.env.APPDATA,'npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe'),args,{env,cwd:directory,stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.setEncoding('utf8');child.stdout.on('data',x=>output+=x);child.stderr.resume();const timer=setTimeout(()=>child.kill(),120000);
 try{const code=await new Promise((r,j)=>{child.on('exit',r);child.on('error',j)});
 const events=output.split('\n').flatMap(line=>{try{return [JSON.parse(line)]}catch{return []}});
 const read=events.some(e=>e.message?.content?.some(b=>b.type==='tool_use'&&b.name==='Read'));
 const result=events.findLast(e=>e.type==='result');
 const init=events.find(e=>e.type==='system'&&e.subtype==='init');
 const pluginLoaded=init?.plugins?.some(p=>p.name==='rtl-terminal')||false;
 const summary={code,read,pluginLoaded,resultType:result?.subtype,isError:result?.is_error,marker:result?.result?.includes(marker)||false,persian:/[\u0600-\u06ff]/.test(result?.result||'')};
 console.log(JSON.stringify({phase:resume?'continuation':'initial',...summary}));return summary;
 }finally{clearTimeout(timer);}
}
try{
 const initial=await run(`Use Read to read ${file}. Report the exact file token and say سلام in Persian.`);
 assert.ok(initial.code===0&&!initial.isError&&initial.pluginLoaded&&initial.read&&initial.marker&&initial.persian,'Initial real tool/Persian acceptance failed');
 const continued=await run('What exact token did you just read? Answer from this conversation, with سلام.',true);
 assert.ok(continued.code===0&&!continued.isError&&continued.marker&&continued.persian,'Continuation acceptance failed');
 console.log('PASS: live provider, bundled plugin, Read, Persian and continuation');
}finally{
 console.log('Protocol observations:',JSON.stringify(observations));server.closeAllConnections();server.close();rmSync(directory,{recursive:true,force:true});
}
