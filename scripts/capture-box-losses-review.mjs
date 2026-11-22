import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const {chromium}=createRequire(root+'/package.json')('@playwright/test');
const projectPath=process.argv[2];
if(!projectPath)throw new Error('Usage: node scripts/capture-box-losses-review.mjs <project.owpr> [before|after]');
const project=readFileSync(projectPath);
const out=root+'/build/ui-contract/surface-audit-v1/qicl';mkdirSync(out,{recursive:true});
const stage=process.argv[3]??'before';
if(!['before','after'].includes(stage))throw new Error('Stage must be before or after');
const sites=stage==='after'?[['after','http://127.0.0.1:4607']]:[['prod','https://openisd.app'],['before','http://127.0.0.1:4607']];
const browser=await chromium.launch();
try{for(const [name,url] of sites)for(const skin of ['phone','desktop']){
 const id=name+'-'+skin;if(existsSync(out+'/'+id+'.json'))throw new Error('Capture already exists '+id);
 const context=await browser.newContext({viewport:skin==='phone'?{width:374,height:705}:{width:1280,height:900}});
 try{
  await context.addInitScript(skin=>localStorage.setItem('openisd_view',JSON.stringify({ui:{splashSeen:true,skinOverride:skin==='phone'?'mobile':'original'}})),skin);
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const build=await(await context.request.get(url+'/build-info.json')).json();
  await page.goto(url);await page.locator('#loading-overlay').waitFor({state:'hidden'});
  const notice=page.getByRole('alertdialog',{name:'Your projects may not be kept'});if(await notice.isVisible())await notice.getByRole('button',{name:'Close',exact:true}).click();
  const input=page.locator(skin==='phone'?'.mobile-root input[type=file]':'.original-root input[type=file]');
  await input.setInputFiles({name:'same-complete-project.owpr',mimeType:'application/json',buffer:project});
  await page.locator(skin==='phone'?'.mob-tabbar':'.project-nav').waitFor();
  if(await page.locator('.ann-backdrop').isVisible())await page.locator('.ann-backdrop').getByRole('button',{name:'Dismiss',exact:true}).click();
  await page.locator(skin==='phone'?'.mob-tab':'.project-nav li').filter({hasText:/^Box$/}).click();
  await page.locator(skin==='phone'?'#mob-box-type':'#og-box-type').selectOption('bandpass6');
  const group=page.locator(skin==='phone'?'.mob-csection':'.box-fields-col').filter({has:page.locator(skin==='phone'?'.mob-band-title':'.section-header',{hasText:'Rear chamber'})});
  await group.locator(skin==='phone'?'.mob-clink':'.link-btn',{hasText:skin==='phone'?'Box losses':'Advanced'}).click();
  const surface=page.locator(skin==='phone'?'.mob-align-sheet':'.overlay.open .modal');await surface.waitFor();
  const geometry=await surface.locator('.ui-field').evaluateAll(rows=>rows.map(row=>{
   const label=row.querySelector('label'),input=row.querySelector('input'),range=document.createRange();range.selectNodeContents(label);
   return{label:label.textContent,value:input.value,labelBox:label.getBoundingClientRect().toJSON(),glyphs:[...range.getClientRects()].map(r=>r.toJSON()),input:input.getBoundingClientRect().toJSON()};
  }));
  await page.screenshot({path:out+'/'+id+'.png'});
  const record={name,skin,url,build,viewport:page.viewportSize(),projectSha256:createHash('sha256').update(project).digest('hex'),recorderHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),recorderUiPatchSha256:createHash('sha256').update(execFileSync('git',['diff','HEAD','--','packages/ui/src'],{cwd:root})).digest('hex'),geometry,errors};
  writeFileSync(out+'/'+id+'.json',JSON.stringify(record,null,2));console.log(JSON.stringify({id,build,geometry,errors}));
 }finally{await context.close();}
}}finally{await browser.close();}
