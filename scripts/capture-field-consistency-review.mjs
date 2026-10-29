import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url).pathname.replace(/\/$/,'');
const {chromium}=createRequire(root+'/package.json')('@playwright/test');
const projectPath=process.argv[2];if(!projectPath)throw new Error('Usage: node scripts/capture-field-consistency-review.mjs <project.owpr> [before|after|final|restored|production]');
const project=readFileSync(projectPath);
const out=root+'/build/ui-contract/field-consistency-v1';mkdirSync(out,{recursive:true});
const stage=process.argv[3]??'before';
if(!['before','after','final','restored','production'].includes(stage))throw new Error('Unknown capture stage');
const sites=stage==='restored'?[['restored','http://127.0.0.1:4607']]:stage==='final'?[['after-final','http://127.0.0.1:4607']]:stage==='after'?[['after','http://127.0.0.1:4607']]:stage==='production'?[['prod-measured','https://openisd.app']]:[['prod-measured','https://openisd.app'],['before','http://127.0.0.1:4607']];
const browser=await chromium.launch();
try{for(const [name,url] of sites)for(const skin of ['phone']){
 if(existsSync(out+'/'+name+'-driver.json'))throw new Error('Capture exists '+name);
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
  for(const tab of ['Driver','Signal','Filters']){
    await page.locator('.mob-tab').filter({hasText:new RegExp('^'+tab+'$')}).click();
    if(tab==='Filters')await page.getByText('+ AP',{exact:true}).click();
    const surface=page.locator('.mob-content');
    await page.evaluate(()=>document.fonts.ready.then(()=>{}));
    const fields=await surface.locator('input:not([type=checkbox]),select,.mob-readonly,.calculated').evaluateAll(controls=>controls.filter(control=>control.checkVisibility()).map(control=>({field:control.closest('[data-field]')?.getAttribute('data-field')??control.id,value:control instanceof HTMLInputElement?control.value:control.textContent,control:control.getBoundingClientRect().toJSON(),font:getComputedStyle(control).font})));
    if(fields.length<(tab==='Driver'?2:3))throw new Error('Wrong or empty '+tab+' page');
    const file=name+'-'+tab.toLowerCase();
    await page.screenshot({path:out+'/'+file+'.png'});
    writeFileSync(out+'/'+file+'.json',JSON.stringify({name,tab,url,build,viewport:page.viewportSize(),projectSha256:createHash('sha256').update(project).digest('hex'),recorderHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),recorderUiPatchSha256:createHash('sha256').update(execFileSync('git',['diff','HEAD','--','packages/ui/src'],{cwd:root})).digest('hex'),fields,errors},null,2));
    console.log(JSON.stringify({name,tab,fields,errors}));
  }
 }finally{await context.close();}
}}finally{await browser.close();}
