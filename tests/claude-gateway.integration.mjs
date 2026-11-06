// Real CLI / synthetic gateway: no provider credentials or user configuration.
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
const directory=mkdtempSync(join(tmpdir(),'vibehub-claude-'));
const file=join(directory,'acceptance.txt'), marker='VIBEHUB_READ_7319';
writeFileSync(file,marker);
const bearer=process.env.CLAUDE_TEST_AUTH==='bearer', requests=[];
let serverError;
const server=createServer((req,res)=>{
 let body='';req.on('data',x=>body+=x);req.on('end',()=>{try {
  if(!req.url.split('?')[0].endsWith('/messages')) {res.writeHead(200,{'content-type':'application/json'});return res.end('{}');}
  const data=JSON.parse(body);requests.push({data,key:req.headers['x-api-key'],authorization:req.headers.authorization});
  const results=data.messages.flatMap(m=>Array.isArray(m.content)?m.content:[]).filter(b=>b.type==='tool_result');
  const done=results.some(b=>JSON.stringify(b.content).includes(marker));
  assert.ok(data.tools.some(t=>t.name==='Read'),'Read must remain enabled');
  const content=done ? [{type:'text',text:`سلام، می‌خواهم نسخهٔ API v2 را بررسی کنم؛ مقدار x = 12.5 است. ${marker}`}]
   : [{type:'tool_use',id:'tool_read_fixture',name:'Read',input:{file_path:file}}];
  const message={id:'msg_fixture',type:'message',role:'assistant',model:data.model,content,stop_reason:done?'end_turn':'tool_use',stop_sequence:null,usage:{input_tokens:5,output_tokens:8}};
  if(!data.stream){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify(message));}
  res.writeHead(200,{'content-type':'text/event-stream'});
  const event=(type,data)=>res.write(`event: ${type}\ndata: ${JSON.stringify({type,...data})}\n\n`);
  event('message_start',{message:{...message,content:[],stop_reason:null}});
  content.forEach((b,index)=>{
   event('content_block_start',{index,content_block:b.type==='text'?{type:'text',text:''}:{...b,input:{}}});
   event('content_block_delta',{index,delta:b.type==='text'?{type:'text_delta',text:b.text}:{type:'input_json_delta',partial_json:JSON.stringify(b.input)}});
   event('content_block_stop',{index});
  });
  event('message_delta',{delta:{stop_reason:message.stop_reason,stop_sequence:null},usage:{output_tokens:8}});
  event('message_stop',{});res.end();
 }catch(e){serverError=e;res.writeHead(500);res.end('Fixture assertion failed');}});
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const env={...process.env,CLAUDE_CONFIG_DIR:join(directory,'config'),ANTHROPIC_BASE_URL:`http://127.0.0.1:${server.address().port}`,ANTHROPIC_MODEL:'vibehub-fixture',CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1',HTTP_PROXY:'',HTTPS_PROXY:'',ALL_PROXY:'',NO_PROXY:'127.0.0.1,localhost'};
for(const n of ['ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','CLAUDE_CODE_OAUTH_TOKEN'])delete env[n];
env[bearer?'ANTHROPIC_AUTH_TOKEN':'ANTHROPIC_API_KEY']='synthetic-vibehub-test';
const child=spawn(process.env.CLAUDE_TEST_EXE||join(process.env.APPDATA,'npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe'),['--plugin-dir',resolve('apps/ClaudeRtlPlugin'),'-p',`Read ${file} and report its contents in Persian.`,'--model','vibehub-fixture','--allowedTools','Read','--no-session-persistence','--output-format','stream-json','--verbose'],{env,cwd:directory,stdio:['ignore','pipe','pipe']});
let output='',error='';child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>error+=x);
const timer=setTimeout(()=>child.kill(),90000);
try {
 const code=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject)});
 if(serverError)throw serverError;
 assert.equal(code,0,error+output.slice(-800));assert.ok(requests.length>=2,'Tool result must return to gateway');assert.ok(requests.some(r=>r.data.stream),'Streaming must be exercised');
 assert.ok(requests.every(r=>r.data.model==='vibehub-fixture'&&(bearer?r.authorization==='Bearer synthetic-vibehub-test'&&!r.key:r.key==='synthetic-vibehub-test'&&!r.authorization)));
 const events=output.trim().split('\n').map(line=>JSON.parse(line));
 const init=events.find(e=>e.type==='system'&&e.subtype==='init');
 const result=events.findLast(e=>e.type==='result');
 assert.ok(result?.result?.includes(marker)&&result.result.includes('می‌خواهم'));
 assert.ok(init?.plugins?.some(p=>p.name==='rtl-terminal'),'CLI must report the bundled plugin loaded');
 console.log(`PASS: real Claude / bundled plugin / ${bearer?'Bearer':'x-api-key'} / SSE / Read round trip / Persian logical output`);
 console.log('Request roles:',JSON.stringify(requests.map(r=>r.data.messages.map(m=>m.role))));
}finally{clearTimeout(timer);server.closeAllConnections();server.close();rmSync(directory,{recursive:true,force:true});}
