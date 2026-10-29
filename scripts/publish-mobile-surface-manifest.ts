import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {discoverMobileSources} from './mobile-surface-discovery.js';
import {mobileSurfaceFlow} from '../packages/ui/test/fixtures/mobileSurfaceFlow.js';
import {MOBILE_SURFACES,MobileRoute} from '../packages/ui/test/fixtures/mobileSurfaceManifest.js';
import {PhoneHelp,PhoneHelpSection,PhoneDialogHelp,PhoneWizardHelp,ChartPageHelp,SheetMode,PHONE_FILTER_CHIPS,NumberField,EnumField,TextField,ToggleField,DateField,PhoneWizardText,WinisdDifference} from '../packages/design/fields/index.js';
import type {BoxType} from '../packages/design/engine/index.js';
const root=fileURLToPath(new URL('../',import.meta.url)),out=join(root,'build/ui-manifest/mobile');mkdirSync(out,{recursive:true});
const source=discoverMobileSources(root),help:{id:string;title:string;owner:string;content:unknown}[]=[];
function helpGroup(name:string,group:object,owner:string):void{
  for(const [key,value] of Object.entries(group)){
    if(value instanceof PhoneHelpSection)help.push({id:name+'.'+key,title:value.title||key,owner,content:value});
    else if(Array.isArray(value)){
      const sections=value.filter((item:unknown):item is PhoneHelpSection=>item instanceof PhoneHelpSection);
      if(sections.length)help.push({id:name+'.'+key,title:sections.map(section=>section.title).filter(Boolean).join(' / ')||key,owner,content:sections});
    }
  }
}
helpGroup('PhoneHelp',PhoneHelp,'packages/design/fields/phoneText.ts');
helpGroup('PhoneDialogHelp',PhoneDialogHelp,'packages/design/fields/phoneDialogText.ts');
helpGroup('PhoneWizardHelp',PhoneWizardHelp,'packages/design/fields/phoneWizardText.ts');
helpGroup('ChartPageHelp',ChartPageHelp,'packages/design/fields/chartPageText.ts');
for(const box of ['sealed','vented','box-passive-radiator','bandpass4','bandpass6','abc'] satisfies BoxType[]){
  help.push({id:'rear-help-'+box,title:'Rear chamber help — '+box,owner:'packages/design/fields/phoneText.ts',content:PhoneHelp.rearChamber(box)});
  help.push({id:'wizard-help-'+box,title:'Wizard box-details help — '+box,owner:'packages/design/fields/phoneWizardText.ts',content:PhoneWizardHelp.boxDetails(box)});
  for(const mode of SheetMode.ALL)help.push({id:'sheet-help-'+mode.label+'-'+box,title:mode.label+' help — '+box,owner:'packages/design/fields/chartPageText.ts',content:ChartPageHelp.forSheet(mode,box)});
}
for(const filter of PHONE_FILTER_CHIPS)help.push({id:'filter-help-'+filter.type,title:filter.short+' filter help',owner:'packages/design/fields/phoneText.ts',content:PhoneHelp.filter(filter.type)});
for(const difference of WinisdDifference.ALL)help.push({id:'difference-'+difference.anchor,title:difference.title,owner:'packages/design/fields/winisdDifference.ts',content:{winisd:difference.winisd,openisd:difference.openisd,seenIn:difference.seenIn,size:difference.size,control:difference.control}});
for(const fieldType of [NumberField,EnumField,TextField,ToggleField,DateField])for(const [key,value] of Object.entries(fieldType))if(value instanceof fieldType)help.push({id:'field-doc-'+key,title:value.label,owner:'packages/design/fields/field.ts',content:value.description});
for(const port of ['Vent','Front','Rear','Intra'] as const)help.push({id:'vent-help-'+port,title:port+' section help',owner:'packages/design/fields/phoneText.ts',content:PhoneHelp.ventSection(port)});
help.push({id:'sync-activity-help',title:'Cloud activity help',owner:'packages/design/fields/phoneDialogText.ts',content:PhoneDialogHelp.syncActivity('Activity')});
help.push({id:'sync-conflicts-help',title:'Cloud conflicts help',owner:'packages/design/fields/phoneDialogText.ts',content:PhoneDialogHelp.syncConflicts('Conflicts')});
for(const tone of ['bug','option','fixed'] as const)help.push({id:'difference-help-'+tone,title:'WinISD '+tone+' section help',owner:'packages/design/fields/phoneDialogText.ts',content:PhoneDialogHelp.differenceSection(tone,tone)});
help.push({id:'wizard-placement-info',title:'Wizard placement information',owner:'packages/design/fields/phoneWizardText.ts',content:PhoneWizardText.PLACEMENT_INFO});
help.push({id:'wizard-ebp-info',title:'Wizard EBP information (dynamic driver value)',owner:'packages/design/fields/phoneWizardText.ts',content:PhoneWizardText.ebpInfo('[current driver Fs/Qes]')});
const visitsPath=join(root,'build/ui-manifest/mobile-visits.json');
interface VisitEvidence {status:string;testDurationMs:number}
const visits:Record<string,VisitEvidence>=existsSync(visitsPath)?JSON.parse(readFileSync(visitsPath,'utf8')):{};
const flow=mobileSurfaceFlow(MOBILE_SURFACES);
const manifest={flow:flow.map(chapter=>({...chapter,groups:chapter.groups.map(group=>({...group,surfaces:group.surfaces.map(surface=>surface.id)}))})),generatedAt:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceHash:source.sourceHash,definitionHash:createHash('sha256').update(readFileSync(join(root,'packages/ui/test/fixtures/mobileSurfaceManifest.ts'))).digest('hex'),scope:'Mobile. All discovered conditional branches, popup roots, native UI, documentation files and links are included. Source enumeration is not runtime/conformance coverage. Shared-source desktop branches are retained and flagged for applicability reconciliation.',declared:MOBILE_SURFACES,help,source,visits};
writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2));
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]??char));
const sourceLink=(path:string,line?:number)=>'http://lap:8000/winisd/openisd-t607/'+encodeURI(path)+(path.endsWith('.md')?'?html':'')+(line?'#L'+line:'');
const rows:{group:string;id:string;title:string;status:string;details:string;link:string}[]=[];
for(const surface of MOBILE_SURFACES)rows.push({group:'Declared pages and popups',id:surface.id,title:surface.title,status:surface.id in visits?'Runtime '+visits[surface.id].status+' · '+Math.round(visits[surface.id].testDurationMs)+'ms · visible root only':surface.route===MobileRoute.Manual?'NAVIGATION GAP — not automated':'Navigation defined — not yet verified',details:surface.instructions+' '+(surface.notes??'')+' Owner: '+surface.owner,link:sourceLink(surface.owner)});
for(const entry of help)rows.push({group:'In-app help and field documentation',id:entry.id,title:entry.title,status:'Content enumerated — popup visit not proven',details:JSON.stringify(entry.content),link:sourceLink(entry.owner)});
for(const entry of source.documents)rows.push({group:'Documentation files and assets',id:entry.id,title:entry.title,status:entry.kind,details:entry.path,link:sourceLink(entry.path)});
for(const entry of source.surfaces)rows.push({group:'Source roots and conditional branches',id:entry.id,title:entry.title,status:entry.mobile,details:entry.path+':'+entry.line+' · '+entry.kind+' · '+entry.condition,link:sourceLink(entry.path,entry.line)});
for(const entry of source.links)rows.push({group:'Documentation/resource links',id:entry.id,title:entry.title,status:entry.kind,details:entry.href??'',link:entry.href?.startsWith('https://')||entry.href?.startsWith('http://')?entry.href:sourceLink(entry.path,entry.line)});
const byId=new Map(rows.map(row=>[row.id,row]));
function rowHtml(row:typeof rows[number]):string{
 return `<tr data-group="${esc(row.group)}" data-row="${esc(row.id)}"><td><a href="${esc(row.link)}">${esc(row.title)}</a><br><code>${esc(row.id)}</code></td><td>${esc(row.status)}</td><td><details><summary>Instructions and details</summary>${esc(row.details)}</details></td></tr>`;
}
function groupHtml(id:string,title:string,entries:typeof rows):string{
 const passed=entries.filter(row=>row.status.startsWith('Runtime passed')).length,gaps=entries.filter(row=>row.status.startsWith('NAVIGATION GAP')).length;
 return `<details class="inventory-group" id="group-${esc(id.replace(/[^a-zA-Z0-9_-]/g,'-'))}"><summary>${esc(title)} <span class="group-count">(${entries.length}${passed?' · '+passed+' visits passed':''}${gaps?' · '+gaps+' navigation gaps':''})</span></summary><table><thead><tr><th>Screen, popup or document</th><th>Evidence / gap</th><th>Details</th></tr></thead><tbody>${entries.map(rowHtml).join('')}</tbody></table></details>`;
}
function groupsBy(entries:typeof rows,key:(row:typeof rows[number])=>string):string{
 const groups=new Map<string,typeof rows>();
 for(const row of entries){const title=key(row);const group=groups.get(title)??[];group.push(row);groups.set(title,group);}
 return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([title,items],index)=>groupHtml(items[0].group+'-'+index,title,items.sort((a,b)=>a.title.localeCompare(b.title)))).join('');
}
const journey=flow.map((chapter,index)=>`<section class="inventory-section" id="${esc(chapter.id)}"><h2>${index+1}. ${esc(chapter.title)}</h2><p>${esc(chapter.description)}</p>${chapter.groups.map(group=>groupHtml(group.id,group.title,group.surfaces.map(surface=>{
 const row=byId.get(surface.id);if(!row)throw new Error('Missing publication row: '+surface.id);return row;
}))).join('')}</section>`).join('');
const referenceGroups=[
 {id:'help-reference',title:'In-app help and field reference',category:'In-app help and field documentation',description:'Full help text and field descriptions. Popup visits are separate evidence.',key:(row:typeof rows[number])=>row.id.startsWith('field-doc-')?'Field descriptions':row.id.startsWith('difference-')?'WinISD differences':row.id.startsWith('wizard-')||row.id.startsWith('PhoneWizardHelp.')?'New-project help':row.id.startsWith('sheet-')||row.id.startsWith('ChartPageHelp.')?'Chart, Tune and What-if help':row.id.startsWith('sync-')?'Cloud help':'Page and dialog help'},
 {id:'documentation',title:'Documentation and recorded findings',category:'Documentation files and assets',description:'All repository documentation remains listed, grouped by folder. Bug records and engineering notes are included.',key:(row:typeof rows[number])=>row.details.includes('/')?row.details.slice(0,row.details.lastIndexOf('/')):'Project overview and guides'},
 {id:'source-reference',title:'Source inventory and conditional branches',category:'Source roots and conditional branches',description:'Grouped by source file. These are implementation branches, not independent pages; shared-source mobile applicability still needs reconciliation.',key:(row:typeof rows[number])=>row.details.split(':')[0]},
 {id:'link-reference',title:'Resource and documentation links',category:'Documentation/resource links',description:'Static and dynamic link declarations retained for inspection.',key:()=> 'All link declarations'},
];
const references=referenceGroups.map((reference,index)=>`<details class="reference-section inventory-section" id="${reference.id}"><summary>${flow.length+index+1}. ${reference.title}</summary><p>${reference.description}</p>${groupsBy(rows.filter(row=>row.group===reference.category),reference.key)}</details>`).join('');
const nav=flow.map((chapter,index)=>`<a href="#${chapter.id}">${index+1}. ${esc(chapter.title)}</a>`).join('')+referenceGroups.map((reference,index)=>`<a href="#${reference.id}">${flow.length+index+1}. ${reference.title}</a>`).join('');
const passed=MOBILE_SURFACES.filter(surface=>visits[surface.id]?.status==='passed').length;
writeFileSync(join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mobile surface manifest — app journey</title><style>
*{box-sizing:border-box}body{font:15px/1.5 Arial,sans-serif;margin:16px auto;padding:0 12px;max-width:1100px;color:#222;overflow-wrap:anywhere}h1{font-size:25px}h2{font-size:21px;margin:24px 0 4px}a{color:#175ca8}nav{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:5px 20px;padding:14px;border:1px solid #ccd3da;background:#f5f8fb}nav a{padding:5px}.toolbar{padding:12px 0;display:flex;flex-wrap:wrap;align-items:end;gap:10px}.toolbar label{display:flex;flex-direction:column;gap:3px}input,select,button{font:inherit;max-width:100%;padding:8px}button{cursor:pointer}.inventory-group{border:1px solid #ccd3da;margin:7px 0;border-radius:4px}.inventory-group>summary{padding:10px;font-weight:600;background:#f8f9fa}.group-count{font-weight:400;color:#505b65;font-size:13px}.reference-section{border-top:2px solid #ccd3da;margin-top:24px;padding-top:12px}.reference-section>summary{font-size:21px;font-weight:bold}summary{cursor:pointer}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border-top:1px solid #ddd;padding:9px;vertical-align:top;text-align:left}code{font-size:11px}td details{white-space:pre-wrap}tr[hidden],details[hidden],section[hidden]{display:none!important}.evidence{padding:10px;border-left:4px solid #6384a8;background:#f5f8fb}#comments{margin-top:30px}#comments textarea{width:100%;max-width:100%}@media(max-width:650px){table,tbody,tr,td{display:block}thead{display:none}tr{border-top:1px solid #bbb}td{border:0}nav{grid-template-columns:1fr}}
</style><p><b>What to do:</b> follow the app journey below; report missing screens or misplaced items in the comment box.</p><h1>Mobile screens, popups and documentation</h1><p class="evidence"><b>${MOBILE_SURFACES.length} declared screens and variants · ${passed} navigation visits passed · ${MOBILE_SURFACES.filter(surface=>surface.route===MobileRoute.Manual).length} navigation gaps.</b><br>Visits check visible roots and mobile skin. They do not certify appearance or function. This organisation does not approve use cases.</p><nav aria-label="App journey">${nav}</nav><div class="toolbar"><label>Search everything<input id="query" type="search" placeholder="Screen, popup, help or document"></label><label>Type<select id="group"><option value="">All categories</option>${[...new Set(rows.map(row=>row.group))].map(group=>`<option>${esc(group)}</option>`).join('')}</select></label><button id="expand" type="button">Expand groups</button><button id="collapse" type="button">Collapse groups</button><output id="count" aria-live="polite">${rows.length} entries</output></div><p>Open a group to see its screens, instructions and recorded checks. Search opens matching groups, including the reference sections.</p><main>${journey}${references}</main><section id="comments"><h2>Comments on this inventory</h2></section><footer><p>${help.length} help/field descriptions · ${source.documents.length} documentation files/assets · ${source.surfaces.length} source roots/branches · ${source.links.length} link declarations. All retained in the reference sections.</p><p>Published ${esc(manifest.generatedAt)} · source HEAD ${esc(manifest.head)}. <a href="manifest.json?raw">Machine-readable manifest and journey order</a> · <a href="${sourceLink('packages/ui/test/fixtures/mobileSurfaceManifest.ts')}">Definitions used by navigation tests</a>.</p></footer><script src="/board/thread.js"></script><script>if(window.BoardThread){const store=BoardThread.store('QO305'),topic={kind:'page',name:'T607/mobile-surface-manifest'};document.querySelector('#comments').append(store.compose({topic,label:'Report a missing surface or coverage gap'}),store.list({topic,order:'newest',replies:true}));}</script><script>
const q=document.querySelector('#query'),g=document.querySelector('#group'),rows=[...document.querySelectorAll('tbody tr')],groups=[...document.querySelectorAll('.inventory-group')],sections=[...document.querySelectorAll('.inventory-section')],panels=[...document.querySelectorAll('.inventory-group,.reference-section')];
let beforeSearch=null;
function filter(){
 const active=!!(q.value.trim()||g.value);if(active&&!beforeSearch)beforeSearch=new Map(panels.map(panel=>[panel,panel.open]));
 let count=0;for(const row of rows){row.hidden=!!((g.value&&row.dataset.group!==g.value)||!row.textContent.toLowerCase().includes(q.value.trim().toLowerCase()));if(!row.hidden)count++;}
 for(const group of groups){group.hidden=![...group.querySelectorAll('tbody tr')].some(row=>!row.hidden);if(active&&!group.hidden)group.open=true;}
 for(const section of sections){section.hidden=![...section.querySelectorAll('.inventory-group')].some(group=>!group.hidden);if(active&&!section.hidden&&section instanceof HTMLDetailsElement)section.open=true;}
 if(!active&&beforeSearch){for(const [panel,open] of beforeSearch)panel.open=open;beforeSearch=null;}
 document.querySelector('#count').textContent=count+' entries';
}
q.addEventListener('input',filter);g.addEventListener('change',filter);
document.querySelector('#expand').addEventListener('click',()=>panels.forEach(panel=>{if(!panel.hidden)panel.open=true;}));
document.querySelector('#collapse').addEventListener('click',()=>panels.forEach(panel=>{panel.open=false;}));
for(const link of document.querySelectorAll('nav a'))link.addEventListener('click',()=>{const section=document.querySelector(link.getAttribute('href'));if(section instanceof HTMLDetailsElement)section.open=true;});
</script></html>`);
console.log(JSON.stringify({url:'http://lap:8000/winisd/openisd-t607/build/ui-manifest/mobile/',declared:MOBILE_SURFACES.length,help:help.length,documents:source.documents.length,sourceRoots:source.surfaces.length,links:source.links.length,total:rows.length,navigationReady:MOBILE_SURFACES.filter(surface=>surface.route!==MobileRoute.Manual).length}));
