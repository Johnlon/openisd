import {chromium} from '@playwright/test';
import {writeFileSync,mkdirSync} from 'node:fs';
import {SCREENS} from '../packages/ui/test/visual/screens.js';
import {measureUnitPaint} from '../packages/ui/test/fixtures/referenceUnitPaint.js';
const url='http://127.0.0.1:4607';
const out='build/ui-contract/approved-607-paint.json';mkdirSync('build/ui-contract',{recursive:true});
const browser=await chromium.launch();
const screens:Record<string,unknown>={},catalogue:Record<string,unknown>={};
try{
 const context=await browser.newContext({baseURL:url,viewport:{width:374,height:705}}),page=await context.newPage();
 await page.addLocatorHandler(page.getByRole('alertdialog',{name:'Your projects may not be kept'}),async notice=>notice.getByRole('button',{name:'Close',exact:true}).click());
 await page.goto('/');await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,undefined,{timeout:20000});await page.locator('#loading-overlay').waitFor({state:'hidden'});await page.goto('/?field-catalogue=1');await page.evaluate(()=>document.fonts.ready.then(()=>{}));
 const build=await(await context.request.get('/build-info.json')).json();
 if(build.version!=='v20261027T1419Z')throw new Error('The approved preview build changed: '+JSON.stringify(build));
 for(const specimen of await page.locator('[data-specimen]').all()){
  const id=await specimen.getAttribute('data-specimen');if(!id)throw new Error('Missing specimen identity');
  const entry=await specimen.evaluate(root=>{
   const paint={capture(element:Element){const css=getComputedStyle(element),box=element.getBoundingClientRect();const properties=['fontFamily','fontSize','fontWeight','textAlign','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','borderTopStyle','borderRightStyle','borderBottomStyle','borderLeftStyle','borderTopColor','borderRightColor','borderBottomColor','borderLeftColor','borderTopLeftRadius','borderTopRightRadius','borderBottomLeftRadius','borderBottomRightRadius','backgroundColor','backgroundImage','color'] as const;return{width:box.width,height:box.height,...Object.fromEntries(properties.map(key=>[key,css[key]]))};}};
   const value=root.querySelector('input,select');if(!value)return null;const unit=root.querySelector('.ui-field-unit');const spinner=root.querySelector('.num-stepper-btn');const model=root.querySelector('.winisd-deviation-cue'),label=root.querySelector('label');
   return {control:paint.capture(value),unit:unit?paint.capture(unit):null,spinner:spinner?paint.capture(spinner):null,model:model?paint.capture(model):null,label:label?{family:getComputedStyle(label).fontFamily,size:getComputedStyle(label).fontSize,weight:getComputedStyle(label).fontWeight,lineHeight:getComputedStyle(label).lineHeight,colour:getComputedStyle(label).color,align:getComputedStyle(label).textAlign}:null};
  });
  if(entry)catalogue[id]=entry;
 }
 await context.close();
 let index=0;const selected=SCREENS.filter(screen=>screen.name!=='empty');
 await Promise.all([0,1].map(async()=>{while(index<selected.length){const screen=selected[index++],context=await browser.newContext({baseURL:url}),page=await context.newPage();page.setDefaultTimeout(15000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));try{await page.addLocatorHandler(page.getByRole('alertdialog',{name:'Your projects may not be kept'}),async notice=>notice.getByRole('button',{name:'Close',exact:true}).click());await page.goto('/');await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,undefined,{timeout:20000});await page.locator('#loading-overlay').waitFor({state:'hidden'});await screen.open(page);await page.evaluate(()=>document.fonts.ready.then(()=>{}));const rows=[];for(const unit of await page.locator('.unit-label:visible').all()){const owner=await unit.evaluate(element=>({field:element.closest('[data-field]')?.getAttribute('data-field'),symbol:element.textContent,toggle:element.classList.contains('unit-toggle')}));rows.push({...owner,paint:await unit.evaluate(measureUnitPaint)});}if(errors.length)throw new Error(errors.join('; '));screens[screen.skin.name+'/'+screen.name]=rows;console.log('REFERENCE '+screen.skin.name+'/'+screen.name+' '+rows.length);}finally{await context.close();}}}));
 writeFileSync(out,JSON.stringify({provenance:{url,build,capturedAt:new Date().toISOString(),selection:'John accepted the mobile607appearance for test deployment. Desktop paint is observed candidate evidence awaiting desktop review. This freezes paint, not approval of additional use cases.'},catalogue,screens},null,2));console.log(JSON.stringify({out,catalogue:Object.keys(catalogue).length,screens:Object.keys(screens).length}));
}finally{await browser.close();}
