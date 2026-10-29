import {chromium} from '@playwright/test';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {MOBILE_SURFACES} from '../packages/ui/test/fixtures/mobileSurfaceManifest.js';
import {hasCaptureNavigation,openCaptureSurface} from './mobile-surface-capture-navigation.js';
import {forceMobileSkin} from '../packages/ui/test/fixtures/mobileSkin.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const side=process.argv[2],url=process.argv[3];
if(!['preview','production'].includes(side)||!url)throw new Error('Usage: capture-mobile-surface-manifest.ts <preview|production> <base-url> [id,...]');
const selection=process.argv[4]?.split(','),out=process.env.OPENISD_VISUAL_OUT??join(root,'build/ui-manifest/mobile-visual-draft');
const surfaces=MOBILE_SURFACES.filter(surface=>hasCaptureNavigation(surface)&&(!selection||selection.includes(surface.id)));
if(!surfaces.length)throw new Error('No registered views selected');
const project=readFileSync(join(root,'build/ui-contract/same-complete-project.owpr'));
const projectSha256=createHash('sha256').update(project).digest('hex'),head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const records=join(out,'captures',side);mkdirSync(records,{recursive:true});
const browser=await chromium.launch();let cursor=0,failed=0;
try{await Promise.all([0,1].map(async()=>{
 while(cursor<surfaces.length){
  const surface=surfaces[cursor++],recordPath=join(records,surface.id+'.json');
  if(existsSync(recordPath)){const prior=JSON.parse(readFileSync(recordPath,'utf8'));if(prior.status==='captured'||prior.status==='unavailable'){console.log('EXISTS '+side+' '+surface.id);continue;}writeFileSync(recordPath.replace('.json','.attempt-'+Date.now()+'.json'),JSON.stringify(prior,null,2));}
  const context=await browser.newContext({viewport:{width:374,height:705},hasTouch:true,isMobile:true,deviceScaleFactor:1});
  const start=Date.now(),errors:string[]=[];let build:unknown=null;
  try{
   const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',error=>errors.push(error.message));
   await page.addLocatorHandler(page.getByRole('alertdialog',{name:'Your projects may not be kept'}),async notice=>{await notice.getByRole('button',{name:'Close',exact:true}).click();});
   await forceMobileSkin(page);
   const response=await context.request.get(url+'/build-info.json');if(response.ok())build=await response.json();
   await page.goto(url,{waitUntil:'load',timeout:60000});await page.locator('#loading-overlay').waitFor({state:'hidden'});
   
   if(side==='production')await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,undefined,{timeout:20000});
   await page.locator('.mobile-root input[type=file]').setInputFiles({name:'same-complete-project.owpr',mimeType:'application/json',buffer:project});
   await page.locator('.mob-tabbar').waitFor();
   const announcements=page.locator('.ann-backdrop');
   if(await announcements.isVisible())await announcements.getByRole('button',{name:'Dismiss',exact:true}).click();
   const surfaceRoot=await openCaptureSurface(page,surface);await page.locator(surfaceRoot).first().waitFor({state:'visible'});
   await page.locator('.flash:visible,.mob-flash-banner:visible').first().waitFor({state:'hidden'});await page.evaluate(()=>document.fonts.ready.then(()=>{}));
   await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
   if(errors.length)throw new Error(errors.join('; '));
   const images:string[]=[],imageDir=join(out,'images',side,surface.id);mkdirSync(imageDir,{recursive:true});
   const file='images/'+side+'/'+surface.id+'/01.png';await page.screenshot({path:join(out,file)});images.push(file);
   if(surface.id==='editor-dimensions'){await page.locator('.de-diagram svg').scrollIntoViewIfNeeded();const detail='images/'+side+'/'+surface.id+'/02.png';await page.screenshot({path:join(out,detail)});images.push(detail);}
   const state=await page.locator(surfaceRoot).first().evaluate(element=>({text:element.textContent?.slice(0,5000),rect:element.getBoundingClientRect().toJSON()}));
   writeFileSync(recordPath,JSON.stringify({id:surface.id,side,status:'captured',url,build,projectSha256,recorderHead:head,viewport:page.viewportSize(),serviceWorkers:'allowed; production capture waits for controller before import',capturedAt:new Date().toISOString(),images,scrollCoverage:surface.id==='editor-dimensions'?'initial viewport and full diagram after scrolling':'initial viewport',state,errors,elapsedMs:Date.now()-start},null,2));
   console.log('CAPTURED '+side+' '+surface.id);
  }catch(error){failed++;writeFileSync(recordPath,JSON.stringify({id:surface.id,side,status:String(error).includes('VIEW UNAVAILABLE:')?'unavailable':'failed',url,build,projectSha256,recorderHead:head,capturedAt:new Date().toISOString(),error:String(error),errors,elapsedMs:Date.now()-start},null,2));console.log('MISSING '+side+' '+surface.id+' '+String(error).split('\n')[0]);}
  finally{await context.close();}
 }
}));}finally{await browser.close();}
console.log(JSON.stringify({side,selected:surfaces.length,failed,projectSha256}));
