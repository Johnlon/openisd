import {TABS,CHART_LABELS} from '@openisd/design/chart';
import {chromium,type Page} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {DESKTOP_SURFACES,DesktopRoute,type DesktopSurface} from '../packages/ui/test/fixtures/desktopSurfaceManifest.js';
const root=fileURLToPath(new URL('../',import.meta.url)),side=process.argv[2],url=process.argv[3];
if(!['preview','production'].includes(side)||!url)throw new Error('Usage: capture-desktop-surface-manifest.ts <preview|production> <base-url>');
const out=process.env.OPENISD_VISUAL_OUT??join(root,'build/ui-manifest/mobile-visual-draft'),records=join(out,'captures/desktop',side);mkdirSync(records,{recursive:true});
const project=readFileSync(join(root,'build/ui-contract/same-complete-project.owpr')),projectSha256=createHash('sha256').update(project).digest('hex');
async function tab(page:Page,label:string):Promise<void>{await page.locator('.project-nav li').filter({hasText:new RegExp('^'+label+'$')}).click();}
async function box(page:Page,type:string):Promise<void>{await tab(page,'Box');await page.locator('#og-box-type').selectOption(type);}
async function editor(page:Page):Promise<void>{await tab(page,'Driver');await page.locator('.driver-id-row').getByRole('button',{name:/^(✎ )?Edit$/}).click();}
async function open(page:Page,surface:DesktopSurface):Promise<void>{
 switch(surface.route){
  case DesktopRoute.Bin:await page.locator('.original-project-list .bin-toggle').click();return;
  case DesktopRoute.ProjectActions:await page.locator('.original-project-list .project-row').first().click({button:'right'});return;
  case DesktopRoute.InfoMenu:await page.getByRole('button',{name:'Info',exact:true}).click();return;
  case DesktopRoute.Cloud:if(await page.locator('.cloud-sync-badge').count()===0)throw new Error('VIEW UNAVAILABLE: cloud entry is not enabled in this build');await page.locator('.cloud-sync-badge').click();return;

  case DesktopRoute.Chart:{const key=surface.parameter??'SPL';await box(page,key.startsWith('PR')?'box-passive-radiator':key.startsWith('Intra')?'abc':key.startsWith('Front')?'bandpass6':key.startsWith('Rear')?'vented':'sealed');await page.locator('.chart-select').click();const chart=TABS.find(chart=>chart.id===key);if(!chart)throw new Error('Unknown chart '+key);await page.locator('.chart-item').getByText(CHART_LABELS[chart.id],{exact:true}).click();return;}
  case DesktopRoute.ChartPicker:await page.locator('.chart-select').click();return;
  case DesktopRoute.ChartData:await page.locator('.gdata').first().click();return;

  case DesktopRoute.Box:await box(page,surface.box??'sealed');return;
  case DesktopRoute.Enclosure:{await box(page,surface.box??'vented');const labels=await page.locator('.project-nav li').allTextContents(),label=labels.map(label=>label.trim()).find(label=>!['Box','Driver','Filters','Signal','Advanced','Project'].includes(label));if(!label)throw new Error('No enclosure tab');await tab(page,label);return;}
  case DesktopRoute.Losses:await box(page,surface.box??'sealed');await page.locator('.tab-section.active .link-btn').filter({hasText:'Advanced->'}).nth(surface.chamber==='Front'?1:0).click();return;
  case DesktopRoute.Tab:await tab(page,surface.parameter??'Box');return;
  case DesktopRoute.PRPicker:await box(page,'box-passive-radiator');await tab(page,'Passive Radiator');await page.getByRole('button',{name:'Select passive radiator',exact:true}).click();return;
  case DesktopRoute.PRSave:await box(page,'box-passive-radiator');await tab(page,'Passive Radiator');await page.getByRole('button',{name:'Save to library',exact:true}).click();return;
  case DesktopRoute.DataQuality:await box(page,'box-passive-radiator');await tab(page,'Passive Radiator');await page.locator('#og-pr-vas').fill('');await page.locator('#og-pr-vas').blur();await page.locator('.pr-controls .ui-field-dq-btn').first().click();return;
  case DesktopRoute.DriverInfo:{await tab(page,'Driver');const button=page.locator('.driver-id-row').getByRole('button',{name:'Info',exact:true});if(await button.count()===0)throw new Error((side==='production'?'VIEW UNAVAILABLE: ':'')+'Current-driver Info is absent');await button.click();return;}
  case DesktopRoute.EditorHelp:{await editor(page);const [editorTab,title]=(surface.parameter??'').split('|');await page.locator('.de-tabs').getByRole('button',{name:editorTab,exact:true}).click();const button=page.getByRole('button',{name:'Help: '+title,exact:true});if(await button.count()===0)throw new Error((side==='production'?'VIEW UNAVAILABLE: ':'')+'Editor help is absent');await button.click();return;}
  case DesktopRoute.Editor:await editor(page);await page.locator('.de-tabs').getByRole('button',{name:surface.parameter,exact:true}).click();return;
  case DesktopRoute.Options:await page.getByRole('button',{name:'Options',exact:true}).click();await page.locator('.opt-tabs').getByRole('button',{name:surface.parameter,exact:true}).click();return;
  case DesktopRoute.Info:await page.getByRole('button',{name:'Info',exact:true}).click();if(await page.locator('.tb-menu .dropdown-menu.open').getByText(surface.parameter??'',{exact:true}).count()===0)throw new Error('VIEW UNAVAILABLE: '+surface.parameter+' is absent in this build');await page.getByText(surface.parameter??'',{exact:true}).last().click();return;
  case DesktopRoute.Library:await page.getByRole('button',{name:'Manage Drivers',exact:true}).click();return;
  case DesktopRoute.Picker:await tab(page,'Driver');await page.locator('.driver-id-row').getByRole('button',{name:/Select Driver/i}).click();return;
  case DesktopRoute.WhatIf:await box(page,surface.box??'sealed');await page.getByRole('button',{name:/What-if/}).click();return;
  case DesktopRoute.Filter:await tab(page,'Filters');await page.locator('.filters-quickadd').getByRole('button',{name:surface.parameter,exact:true}).click();return;
  case DesktopRoute.Projects:case DesktopRoute.ProjectImport:return;
  case DesktopRoute.ProjectExport:await page.locator('#btnExportMenu').click();return;
  case DesktopRoute.DriverImport:await editor(page);return;
  case DesktopRoute.DriverExport:await editor(page);await page.locator('.de-modal').getByRole('button',{name:'Export',exact:true}).click();return;
  case DesktopRoute.DriverSave:await editor(page);await page.locator('.de-modal').getByRole('button',{name:/Copy to My Drivers/}).click();return;
  case DesktopRoute.Wizard:{
   await page.getByRole('button',{name:'New project',exact:true}).first().click();const step=Number(surface.parameter??1);if(step===1)return;
   await page.locator('.overlay.open input.filter').fill('Tang Band W5-1138SMF');await page.getByText('Tang Band W5-1138SMF',{exact:true}).first().click();const next=page.locator('.modal-footer').getByRole('button',{name:'Next',exact:true});await next.click();if(step===2)return;await next.click();await page.locator('#np-box-type').selectOption(surface.box??'sealed');if(step===3)return;await next.click();if(step===4)return;if(surface.box==='box-passive-radiator'&&await next.isDisabled()){await page.locator('#np-pr-select').click();await page.locator('.pr-lib-name').first().click();}await next.click();return;
  }
 }
}
const browser=await chromium.launch();let index=0,failed=0;
try{await Promise.all([0,1].map(async()=>{while(index<DESKTOP_SURFACES.length){const surface=DESKTOP_SURFACES[index++],name=surface.id.replaceAll('/','__'),recordPath=join(records,name+'.json');if(existsSync(recordPath)){const prior=JSON.parse(readFileSync(recordPath,'utf8'));if(prior.status==='captured'||prior.status==='unavailable')continue;writeFileSync(recordPath.replace('.json','.attempt-'+Date.now()+'.json'),JSON.stringify(prior,null,2));}const width=surface.route===DesktopRoute.Enclosure || (surface.route===DesktopRoute.Tab&&surface.parameter==='Advanced')?1600:1280;const context=await browser.newContext({viewport:{width,height:900}}),errors:string[]=[];let build:unknown;
 try{const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',error=>errors.push(error.message));await page.addLocatorHandler(page.getByRole('alertdialog',{name:'Your projects may not be kept'}),async notice=>{await notice.getByRole('button',{name:'Close',exact:true}).click();});await page.addInitScript(()=>localStorage.setItem('openisd_view',JSON.stringify({ui:{splashSeen:true,skinOverride:'original'}})));
 const response=await context.request.get(url+'/build-info.json');if(response.ok())build=await response.json();await page.goto(url,{timeout:60000});await page.locator('#loading-overlay').waitFor({state:'hidden'});if(side==='production')await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,undefined,{timeout:20000});
   await page.locator('.original-root input[type=file]').setInputFiles({name:'same-complete-project.owpr',mimeType:'application/json',buffer:project});await page.locator('.project-nav').waitFor();await open(page,surface);await page.locator(surface.root).first().waitFor({state:'visible'});await page.locator('.flash:visible,.mob-flash-banner:visible').first().waitFor({state:'hidden'});await page.evaluate(()=>document.fonts.ready.then(()=>{}));if(errors.length)throw new Error(errors.join('; '));
 const image='images/desktop/'+side+'/'+name+'.png';mkdirSync(join(out,'images/desktop',side),{recursive:true});await page.screenshot({path:join(out,image)});await page.locator(surface.root).first().waitFor({state:'visible'});writeFileSync(recordPath,JSON.stringify({id:surface.id,platform:'desktop',side,status:'captured',images:[image],url,build,projectSha256,viewport:page.viewportSize(),serviceWorkers:'allowed; production capture waits for controller before import',capturedAt:new Date().toISOString(),scrollCoverage:'initial viewport',errors},null,2));console.log('CAPTURED desktop '+side+' '+surface.id);
 }catch(error){failed++;writeFileSync(recordPath,JSON.stringify({id:surface.id,platform:'desktop',side,status:String(error).includes('VIEW UNAVAILABLE:')?'unavailable':'failed',url,build,projectSha256,error:String(error),errors},null,2));console.log('MISSING desktop '+side+' '+surface.id+' '+String(error).split('\n')[0]);}finally{await context.close();}
 }}));}finally{await browser.close();}
console.log(JSON.stringify({platform:'desktop',side,selected:DESKTOP_SURFACES.length,failed}));
