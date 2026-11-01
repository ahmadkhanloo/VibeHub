import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Educational schematics, deliberately not replicas of product interfaces.
const out = fileURLToPath(new URL('../apps/desktop/public/tutorials/', import.meta.url));
await mkdir(out, { recursive: true });
const esc = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const text = (x,y,s,cls='label',anchor='start') => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${esc(s)}</text>`;
const box = (x,y,w,h,title,sub='',accent=false) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" class="${accent?'focus':'box'}"/>${text(x+20,y+(h<60?29:40),title)}${sub?text(x+20,y+75,sub,'sub'):''}`;
const arrow = (x,y,x2,y2) => `<path d="M${x} ${y} H${x2}" class="arrow" marker-end="url(#head)"/>`;
const line = (d, dashed=false) => `<path d="${d}" class="arrow" ${dashed?'stroke-dasharray="7 6"':''} marker-end="url(#head)"/>`;
const note = s => `<rect x="36" y="340" width="888" height="48" rx="6" fill="#eaf2f8"/>${text(56,371,s,'sub')}`;
const wrap = (title,desc,body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 420" role="img" aria-labelledby="title desc"><title id="title">${esc(title)}</title><desc id="desc">${esc(desc)}</desc><defs><marker id="head" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8" fill="none" stroke="#64748b" stroke-width="1.5"/></marker></defs><style>text{font-family:Arial,Helvetica,sans-serif;fill:#18324b}.heading{font-size:30px;font-weight:700}.label{font-size:23px;font-weight:600}.sub{font-size:20px;fill:#50657a}.eyebrow{font-size:20px;fill:#237e84;font-weight:700}.box{fill:#fff;stroke:#b9cad8;stroke-width:2}.focus{fill:#e5f5f3;stroke:#23868a;stroke-width:2}.arrow{fill:none;stroke:#64748b;stroke-width:2}</style><rect width="960" height="420" rx="12" fill="#f6f9fc"/>${text(36,40,'WORKFLOW SCHEMATIC','eyebrow')}${text(36,83,title,'heading')}${body}</svg>\n`;
const flows = {
 'qoder': ['Qoder: from workspace to reviewed change', ['Workspace','Files + context'],['Model','Choose capacity'],['Ask / Agent','Explain or edit'],['Review diff','Accept changes'], 'Start with a question; inspect every proposed change.'],
 'zcode': ['ZCode: guide a scoped coding task', ['Open project','Project context'],['Set task','Goal + constraints'],['Edit code','Focused changes'],['Verify','Run + review'], 'A clear task connects project context to a verifiable result.'],
 'deepseek-harness': ['DeepSeek Harness: configure, then iterate', ['Project','Working folder'],['Connection','Endpoint + model'],['Coding task','Context + request'],['Validate','Diff + checks'], 'Confirm the connection before running a larger coding task.'],
 'opencode': ['OpenCode: a terminal coding session', ['Terminal','Open repository'],['Provider','Select model'],['Session','Ask + act'],['Changes','Inspect + test'], 'Keep the terminal session rooted in the intended repository.'],
 'mimocode': ['MiMo Code: model-assisted code changes', ['Repository','Select scope'],['MiMo model','Connection setup'],['Code request','One clear task'],['Local result','Review + run'], 'Model access and local verification are separate steps.'],
 'freebuff': ['Freebuff: connect a project and a task', ['Project folder','Select context'],['Assistant','Explain the goal'],['Proposed edit','Read the diff'],['Working app','Run checks'], 'Give the assistant a bounded task with an observable outcome.'],
 'chatgpt': ['ChatGPT: build understanding with context', ['Question','Goal + constraints'],['Context','Files + examples'],['Conversation','Clarify + refine'],['Useful result','Check accuracy'], 'Share relevant context and verify the result before using it.'],
 'antigravity': ['Antigravity: plan, execute, inspect', ['Workspace','Open the project'],['Plan','Agree on scope'],['Agent work','Track progress'],['Artifacts','Inspect + verify'], 'Review the plan and the resulting artifacts at each handoff.'],
 'claude-code': ['Claude Code: trace the request path', ['Terminal','Claude Code'],['Gateway','If configured'],['Provider','Selected model'],['Local tools','Files + commands'], 'Check the configured route, then review tool actions and changes.'],
 'code-review': ['Code review: use a fresh pair of eyes', ['Change','Diff + intent'],['Checks','Build + tests'],['Fresh review','Find concrete risks'],['Decide','Resolve + approve'], 'Passing checks and independent review provide different evidence.'],
 'testing': ['Testing: reproduce, change, verify', ['Reproduce','Observe failure'],['Small change','Address the cause'],['Run checks','Relevant tests'],['Confirm','Original scenario'], 'A passing test matters when it covers the behavior that failed.'],
 'models': ['Models: choose for the task and connection', ['Task needs','Context + depth'],['Model choice','Capabilities'],['Connection','Access + endpoint'],['Small trial','Check the output'], 'A model appearing in a list does not prove the connection works.'],
};
for (const [key,[title,...items]] of Object.entries(flows)) {
 const footer = items.pop();
 const body = items.map(([a,b],i)=>box(36+i*228,158,204,124,a,b,i===2)+(i<3?arrow(242+i*228,220,258+i*228):'')).join('')+note(footer);
 await writeFile(`${out}/${key}.svg`,wrap(title,items.map(x=>x.join(': ')).join(' → ')+'. '+footer,body));
}
const special = {
 documents: ['Documents: inspect before editing', 'PDF, Word, Excel and PowerPoint inputs feed an inspect, edit, render and verify workflow.',
 ['PDF','Word','Excel','PowerPoint'].map((s,i)=>box(36,110+i*52,176,44,s)).join('')+line('M224 135 H248 V216 H276')+line('M224 187 H248')+line('M224 239 H248')+line('M224 291 H248 V216')+box(286,164,190,112,'Read / inspect','Content + layout',true)+arrow(484,220,510)+box(520,164,154,112,'Edit','Keep intent')+arrow(682,220,708)+box(718,164,206,112,'Render + verify','Final appearance')+note('Inspect the rendered file as well as the underlying content.')],
 ui: ['UI work: connect intent to interaction', 'A user goal becomes a layout, interactive states and a verification on real sizes.',
 box(36,158,198,124,'User goal','Primary action')+arrow(242,220,264)+box(274,122,226,88,'Layout','Hierarchy + spacing',true)+box(274,226,226,88,'States','Loading + errors')+line('M508 166 H538 V220 H566')+line('M508 270 H538 V220')+box(576,158,170,124,'Build','Components')+arrow(754,220,776)+box(786,158,138,124,'Verify','Real sizes')+note('Check keyboard access, readable text, and narrow windows.')],
 extensions: ['Extensions: extend with a clear boundary', 'A specific need leads to an extension, a permission review and a small verification.',
 box(36,158,190,124,'Need','Missing capability')+arrow(234,220,258)+box(268,158,204,124,'Extension','Check provenance',true)+arrow(480,220,504)+box(514,158,190,124,'Permissions','Read the scope')+arrow(712,220,736)+box(746,158,178,124,'Small trial','Verify behavior')+note('Enable only the capabilities needed for the current task.')],
 'long-running': ['Long tasks: preserve progress at checkpoints', 'A scoped task advances through work blocks with durable checkpoints and a final verification.',
 box(36,158,180,124,'Scope','Done criteria')+arrow(224,220,246)+box(256,158,192,124,'Work block','Bounded progress')+arrow(456,220,478)+box(488,158,214,124,'Checkpoint','State + next step',true)+arrow(710,220,732)+box(742,158,182,124,'Finish','Verify outcome')+line('M594 290 V318 H352 V290',true)+note('Save decisions, completed work, and the next action between blocks.')],
 rtl: ['RTL: separate text direction from code direction', 'A right-to-left prose region and a left-to-right code region coexist. Verify selection, punctuation and scrolling.',
 `<rect x="36" y="122" width="422" height="182" rx="8" class="focus"/>${text(432,158,'RTL text region','label','end')}<path d="M404 192 H96 M404 218 H156 M404 244 H116" stroke="#23868a" stroke-width="8" stroke-linecap="round"/>${line('M408 278 H84')}<rect x="482" y="122" width="442" height="182" rx="8" class="box"/>${text(506,158,'LTR code region')}${text(506,202,'const label = "example";','sub')}${text(506,238,'render(label);','sub')}${line('M510 278 H890')}`+note('Verify mixed text, punctuation, selection, and horizontal scrolling.')],
};
for(const [key,[title,desc,body]] of Object.entries(special)) await writeFile(`${out}/${key}.svg`,wrap(title,desc,body));
console.log(`Generated ${Object.keys(flows).length+Object.keys(special).length} tutorial illustrations.`);
