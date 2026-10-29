import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const {chromium}=createRequire(root+'/package.json')('@playwright/test');
const projectPath=process.argv[2];
if(!projectPath)throw new Error('Usage: node scripts/capture-driver-info-review.mjs <project.owpr> [before|after]');
const project=readFileSync(projectPath);
const out=root+'/build/ui-contract/driver-info-v1';mkdirSync(out,{recursive:true});
const stage=process.argv[3]??'before';
if(!['before','after'].includes(stage))throw new Error('Stage must be before or after');
const sites=stage==='after'?[['after-final','http://127.0.0.1:4607']]:[['prod','https://openisd.app'],['before','http://127.0.0.1:4607']];
const browser=await chromium.launch();
try{for(const [name,url] of sites)for(const skin of ['phone','desktop']){
 const id=name+'-'+skin+'-stable';if(existsSync(out+'/'+id+'.json'))throw new Error('Capture already exists '+id);
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
  await page.locator(skin==='phone'?'.mob-tab':'.project-nav li').filter({hasText:/^Driver$/}).click();
  const save=skin==='phone'?page.getByTestId('mob-save'):page.getByRole('button',{name:'Save',exact:true});
  if(await save.isEnabled())await save.click();
  await page.waitForTimeout(3500);
  await page.locator(skin==='phone'?'.mob-tab':'.project-nav li').filter({hasText:/^Driver$/}).click();
  const surface=page.locator(skin==='phone'?'.mob-content':'.tab-section.active');
  const geometry=await surface.locator(skin==='phone'?'.mob-cbtns button':'.driver-id-row button').evaluateAll(elements=>elements.map(element=>({text:element.textContent,box:element.getBoundingClientRect().toJSON()})));
  if(geometry.length!==(name==='after-final'?3:2))throw new Error('Wrong Driver action row: '+id);
  await page.screenshot({path:out+'/'+id+'.png'});
  const record={name,skin,url,build,viewport:page.viewportSize(),projectSha256:createHash('sha256').update(project).digest('hex'),recorderHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),recorderUiPatchSha256:createHash('sha256').update(execFileSync('git',['diff','HEAD','--','packages/ui/src'],{cwd:root})).digest('hex'),geometry,errors};
  writeFileSync(out+'/'+id+'.json',JSON.stringify(record,null,2));console.log(JSON.stringify({id,build,geometry,errors}));
  if(name==='after-final'){
   await surface.getByRole('button',{name:'Info',exact:true}).click();
   const panel=page.locator('.wb-modal');await panel.locator('.preview').waitFor();
   await page.screenshot({path:out+'/info-'+skin+'-final.png'});
   const state=await panel.evaluate(element=>({title:element.querySelector('h2')?.textContent,rows:element.querySelectorAll('.spec-row').length,text:element.textContent}));
   writeFileSync(out+'/info-'+skin+'-final.json',JSON.stringify({...record,state},null,2));
  }
 }finally{await context.close();}
}}finally{await browser.close();}
