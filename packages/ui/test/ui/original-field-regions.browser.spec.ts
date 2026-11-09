import {test,expect,openAProject,COMPLETE_DRIVER_PROJECT_OWPR,setFocusedBoxType} from '../fixtures.js';
import {setPortShapes} from '../fixtures/portShape.js';
import {measureFieldGroupContent,measureFieldLayoutRegions} from '../fixtures/fieldControlContainment.js';

const BOXES=['sealed','vented','box-passive-radiator','bandpass4','bandpass6','abc'] as const;
for (const width of [1280,1024,780]) for (const box of BOXES) {
 test(`${box} painted fields stay in their regions at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.addInitScript(()=>localStorage.setItem('openisd_view',JSON.stringify({ui:{splashSeen:true,skinOverride:'original'}})));
  await page.goto('/');await openAProject(page,COMPLETE_DRIVER_PROJECT_OWPR);await setFocusedBoxType(page,box);
  for (const name of ['Box',...((await page.locator('.project-nav li').allTextContents()).map(text=>text.trim()).filter(text=>!['Box','Driver','Signal','Filters','Advanced','Project'].includes(text)))]) {
   await page.locator('.project-nav li').filter({hasText:new RegExp('^'+name+'$')}).click();
   const report=await page.locator('.tab-section.active').evaluate(measureFieldLayoutRegions);
   expect(report.fields).toBeGreaterThan(0);expect(report.issues,name).toEqual([]);
   expect(await page.locator('.tab-section.active').evaluate(measureFieldGroupContent),name+' heading bounds').toEqual([]);
  }
 });
}

test('passive radiator boxes share one width across parameters and user options',async({page})=>{
 await page.goto('/');await openAProject(page,COMPLETE_DRIVER_PROJECT_OWPR);await setFocusedBoxType(page,'box-passive-radiator');
 await page.locator('.project-nav li').filter({hasText:/^Passive Radiator$/i}).click();
 const widths=await page.locator('.tab-section.active .ui-field input,.tab-section.active .ui-field select').evaluateAll(nodes=>nodes.map(node=>Math.round(node.getBoundingClientRect().width)));
 expect(widths.length).toBeGreaterThan(8);expect(new Set(widths).size).toBe(1);
});

test('vent chamber headings have visible matching banners',async({page})=>{
 await page.goto('/');await openAProject(page,COMPLETE_DRIVER_PROJECT_OWPR);await setFocusedBoxType(page,'abc');
 await page.locator('.project-nav li').filter({hasText:/^ABC$/}).click();
 const paint=await page.locator('.vent-col-title').evaluateAll(nodes=>nodes.map(node=>{const style=getComputedStyle(node);return {background:style.backgroundColor,border:parseFloat(style.borderTopWidth)};}));
 expect(paint.length).toBeGreaterThan(1);
 for(const heading of paint){expect(heading.background).not.toBe('rgba(0, 0, 0, 0)');expect(heading.border).toBeGreaterThanOrEqual(1);}
});

for(const {box,tab} of [{box:'bandpass6',tab:'6th Order Bandpass'},{box:'abc',tab:'ABC'}] as const) test(`${box} vent fields fit the standard desktop viewport without clipping`,async({page})=>{
 await page.setViewportSize({width:1600,height:900});await page.goto('/');await openAProject(page,COMPLETE_DRIVER_PROJECT_OWPR);await setFocusedBoxType(page,box);
 await page.locator('.project-nav li').filter({hasText:new RegExp('^'+tab+'$')}).click();
 const region=await page.locator('.tab-section.active').evaluate(node=>({width:node.clientWidth,content:node.scrollWidth}));
 expect(region.content).toBeLessThanOrEqual(region.width+1);
 for(const label of await page.locator('.vent-pane-tight .field > label').all())await expect(label).toHaveCSS('font-size','12px');
});


test('compact vent choices display every end correction fully beside the native arrow',async({page})=>{
 await page.setViewportSize({width:1600,height:900});await page.goto('/');await openAProject(page,COMPLETE_DRIVER_PROJECT_OWPR);await setFocusedBoxType(page,'abc');await page.locator('.project-nav li').filter({hasText:/^ABC$/}).click();
 const choices=page.locator('.vent-pane-tight .field').filter({has:page.locator('label',{hasText:/^End Correction$/})}).locator('select');
 const failures=await choices.evaluateAll(nodes=>{
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d')!;const failures:string[]=[];
  for(const node of nodes){if(!(node instanceof HTMLSelectElement))throw new Error('Expected selector');const css=getComputedStyle(node);ctx.font=css.font;const available=node.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)-18;
   for(const option of node.options)if(ctx.measureText(option.label).width>available)failures.push(option.label+' exceeds visible text space');
  }return failures;
 });
 await expect(choices).toHaveCount(3);expect(failures).toEqual([]);
});


for (const {box,tab} of [{box:'bandpass6',tab:'6th Order Bandpass'},{box:'abc',tab:'ABC'}] as const) test(`${box} vent labels stay to the left of their controls`, async ({page}) => {
 await page.goto('/');await openAProject(page,COMPLETE_DRIVER_PROJECT_OWPR);await setFocusedBoxType(page,box);
 await page.locator('.project-nav li').filter({hasText:new RegExp('^'+tab+'$')}).click();
 const positions=await page.locator('.vent-pane-tight .field').evaluateAll(rows=>rows.map(row=>{
  const label=row.querySelector('label')!.getBoundingClientRect();
  const control=row.querySelector('input,select')!.getBoundingClientRect();
  return {text:row.querySelector('label')!.textContent,left:label.right,right:control.left,dy:Math.abs((label.top+label.bottom-control.top-control.bottom)/2)};
 }));
 expect(positions.length).toBeGreaterThan(5);
 for(const position of positions){expect(position.left,position.text??'label').toBeLessThanOrEqual(position.right);expect(position.dy).toBeLessThan(2);}
});

for (const shape of ['round','slotted'] as const) test(`ABC ${shape} ports keep every field inside the visible panel`,async({page})=>{
 await page.setViewportSize({width:1600,height:900});await page.goto('/');await openAProject(page,COMPLETE_DRIVER_PROJECT_OWPR);await setFocusedBoxType(page,'abc');
 await page.locator('.project-nav li').filter({hasText:/^ABC$/}).click();
 await setPortShapes(page,shape);
 const panel=(await page.locator('.content-panel').boundingBox())!;
 const fields=await page.locator('.vent-col .field').evaluateAll(rows=>rows.map(row=>{
  const label=row.querySelector('label')!,control=row.querySelector('input,select')!,r=control.getBoundingClientRect(),l=label.getBoundingClientRect();
  return {label:label.textContent,left:l.right,controlLeft:r.left,right:r.right,bottom:r.bottom,labelWidth:label.clientWidth,labelContent:label.scrollWidth};
 }));
 expect(fields).toHaveLength(shape==='round'?20:23);
 for(const field of fields){expect(field.left,field.label??'').toBeLessThanOrEqual(field.controlLeft);expect(field.right).toBeLessThanOrEqual(panel.x+panel.width);expect(field.bottom).toBeLessThanOrEqual(panel.y+panel.height);expect(field.labelContent).toBeLessThanOrEqual(field.labelWidth);}
 const scroll=await page.locator('.tab-section.active').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));expect(scroll.scroll).toBeLessThanOrEqual(scroll.width);
});

test('ABC vent count choices fit beside their dropdown arrow',async({page})=>{
 await page.goto('/');await openAProject(page,COMPLETE_DRIVER_PROJECT_OWPR);await setFocusedBoxType(page,'abc');await page.locator('.project-nav li').filter({hasText:/^ABC$/}).click();
 const failures=await page.locator('.vent-col select[id^="og-vent-count-"]').evaluateAll(nodes=>{
  const ctx=document.createElement('canvas').getContext('2d')!,failures:string[]=[];
  for(const node of nodes){if(!(node instanceof HTMLSelectElement))throw new Error('Expected select');const css=getComputedStyle(node);ctx.font=css.font;const available=node.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)-18;for(const option of node.options)if(ctx.measureText(option.label).width>available)failures.push(option.label);}
  return failures;
 });expect(failures).toEqual([]);
});

for(const {box,tab} of [{box:'vented',tab:'Vented'},{box:'bandpass4',tab:'4th Order Bandpass'},{box:'bandpass6',tab:'6th Order Bandpass'},{box:'abc',tab:'ABC'}] as const) test(`${box} slotted port dimensions preserve the visible layout`,async({page})=>{
 await page.setViewportSize({width:1600,height:900});await page.goto('/');await openAProject(page,COMPLETE_DRIVER_PROJECT_OWPR);await setFocusedBoxType(page,box);await page.locator('.project-nav li').filter({hasText:new RegExp('^'+tab+'$')}).click();
 const shapes=page.locator('.tab-section.active button.port-shape-toggle');
 await setPortShapes(page,'slotted');
 await expect(shapes).not.toHaveCount(0);
 const region=page.locator('.tab-section.active');
 expect((await region.evaluate(measureFieldLayoutRegions)).issues).toEqual([]);
 expect(await region.evaluate(measureFieldGroupContent)).toEqual([]);
 const size=await region.evaluate(node=>({width:node.clientWidth,scroll:node.scrollWidth}));expect(size.scroll).toBeLessThanOrEqual(size.width);
});

test('every ported panel uses the same ABC field columns for round and slotted ports',async({page})=>{
 await page.setViewportSize({width:1600,height:900});await page.goto('/');await openAProject(page,COMPLETE_DRIVER_PROJECT_OWPR);
 const measurements=[];
 for(const {box,tab} of [{box:'abc',tab:'ABC'},{box:'bandpass6',tab:'6th Order Bandpass'},{box:'vented',tab:'Vented'},{box:'bandpass4',tab:'4th Order Bandpass'}] as const){
  await setFocusedBoxType(page,box);await page.locator('.project-nav li').filter({hasText:new RegExp('^'+tab+'$')}).click();
  for(const shape of ['round','slotted'] as const){
   await setPortShapes(page,shape);
   for(const field of await page.locator('.vent-col [data-field="vent_W_cm"] input').all()){await field.fill('10');await field.press('Enter');}
   for(const field of await page.locator('.vent-col [data-field="vent_H_cm"] input').all()){await field.fill('5');await field.press('Enter');}
   const fields=page.locator('.vent-col .ui-field').filter({has:page.locator('input')});await expect(fields.first()).toBeVisible();
   measurements.push(...await fields.evaluateAll(rows=>rows.map(row=>{const input=row.querySelector('input')!.getBoundingClientRect(),label=row.querySelector('label')!.getBoundingClientRect(),group=row.closest('.vent-col')!.getBoundingClientRect();return {offset:input.left-group.left,width:input.width,labelLeft:label.left-group.left};})));
  }
 }
 for(const measurement of measurements)expect(measurement).toEqual(measurements[0]);
});

for(const {box,tab} of [{box:'bandpass6',tab:'6th Order Bandpass'},{box:'abc',tab:'ABC'}] as const)test(`${box} port tuning controls edit the same targets shown on Box`,async({page})=>{
 await page.goto('/');await openAProject(page,COMPLETE_DRIVER_PROJECT_OWPR);await setFocusedBoxType(page,box);await page.locator('.project-nav li').filter({hasText:new RegExp('^'+tab+'$')}).click();
 const rear=page.locator('#og-vent-tuning-rear'),front=page.locator('#og-vent-tuning-front');
 await rear.fill('33');await rear.press('Enter');await front.fill('66');await front.press('Enter');
 await expect(page.locator('#og-vent-tuning-intra')).toHaveCount(0);
 await page.locator('.project-nav li').filter({hasText:/^Box$/}).click();
 await expect(page.locator('.tab-section.active [data-field="box_Frc_hz"] input')).toHaveValue('33.00');await expect(page.locator('#og-ffc-target')).toHaveValue('66.00');
 const boxRear=page.locator('.tab-section.active [data-field="box_Frc_hz"] input'),boxFront=page.locator('#og-ffc-target');
 await boxRear.fill('44');await boxRear.press('Enter');await boxFront.fill('77');await boxFront.press('Enter');
 await page.locator('.project-nav li').filter({hasText:new RegExp('^'+tab+'$')}).click();
 await expect(rear).toBeEditable();await expect(front).toBeEditable();await expect(rear).toHaveValue('44.00');await expect(front).toHaveValue('77.00');
 await page.locator('#og-vent-length-front').fill('20');await page.locator('#og-vent-length-front').press('Enter');
 await expect(front).not.toHaveValue('77.00');const calculated=await front.inputValue();expect(Number(calculated)).toBeGreaterThan(0);
 await page.locator('.project-nav li').filter({hasText:/^Box$/}).click();await expect(boxFront).toHaveValue(calculated);

});

test('ABC slotted columns share horizontal rows and End Correction aligns with numeric values',async({page})=>{
 await page.goto('/');await openAProject(page,COMPLETE_DRIVER_PROJECT_OWPR);await setFocusedBoxType(page,'abc');await page.locator('.project-nav li').filter({hasText:/^ABC$/}).click();
 await setPortShapes(page,'slotted');
 const positions=await page.locator('.vent-col').evaluateAll(groups=>groups.map(group=>{
  const width=group.querySelector('[data-field="vent_W_cm"] input')!.getBoundingClientRect();
  const correction=[...group.querySelectorAll('.field')].find(row=>row.querySelector('label')?.textContent?.trim()==='End Correction')!.querySelector('select')!.getBoundingClientRect();
  return {widthTop:width.top,valueLeft:width.left,correctionLeft:correction.left};
 }));
 expect(positions).toHaveLength(3);
 for(const position of positions){expect(position.widthTop).toBe(positions[0]!.widthTop);expect(position.correctionLeft).toBe(position.valueLeft);}
});


test('port shape button sits on the right of the count on row 2, the panel stays at its ceiling',async({page})=>{
 await page.setViewportSize({width:1600,height:900});await page.goto('/');await openAProject(page,COMPLETE_DRIVER_PROJECT_OWPR);await setFocusedBoxType(page,'abc');await page.locator('.project-nav li').filter({hasText:/^ABC$/}).click();
 for(const shape of ['round','slotted'] as const) {
  await setPortShapes(page,shape);
  for(const group of await page.locator('.vent-col').all()) {
   const toggle=group.locator('button.port-shape-toggle'),count=group.locator('select[id*="vent-count"]'),tuning=group.locator('.port-tuning-row input, .port-tuning-placeholder').first();
   await expect(toggle).toHaveText(shape==='round'?'Round':'Slotted');
   const dimension=(await group.locator('.port-dimensions-row input').first().boundingBox())!;
   const toggleBox=(await toggle.boundingBox())!,countBox=(await count.boundingBox())!,tuningBox=(await tuning.boundingBox())!;
   expect(Math.abs((toggleBox.y+toggleBox.height/2)-(countBox.y+countBox.height/2))).toBeLessThanOrEqual(1);
   expect(toggleBox.x).toBeGreaterThanOrEqual(countBox.x+countBox.width);
   expect(countBox.y).toBeGreaterThanOrEqual(tuningBox.y+tuningBox.height);
   expect(dimension.y).toBeGreaterThanOrEqual(countBox.y+countBox.height);
  }
 }
 expect((await page.locator('.content-panel').boundingBox())!.height).toBeLessThanOrEqual(283);
});


test('ABC labels use readable text without wrapping or clipping',async({page})=>{
 await page.setViewportSize({width:1600,height:900});await page.goto('/');await openAProject(page,COMPLETE_DRIVER_PROJECT_OWPR);await setFocusedBoxType(page,'abc');
 await page.locator('.project-nav li').filter({hasText:/^ABC$/}).click();
 const failures=await page.locator('.vent-col .field > label').evaluateAll(labels=>labels.flatMap(label=>{
  const css=getComputedStyle(label),range=document.createRange();range.selectNodeContents(label);
  return parseFloat(css.fontSize)<12 || new Set([...range.getClientRects()].map(rect=>Math.round(rect.top))).size>1 ? [label.textContent] : [];
 }));
 expect(failures).toEqual([]);
 expect(await page.locator('.tab-section.active').evaluate(measureFieldLayoutRegions)).toMatchObject({issues:[]});
});

test('Passive Radiator tab shows every control inside its section at 1280x720',async({page})=>{
 await page.setViewportSize({width:1280,height:720});await page.goto('/');await openAProject(page,COMPLETE_DRIVER_PROJECT_OWPR);await setFocusedBoxType(page,'box-passive-radiator');await page.locator('.project-nav li').filter({hasText:'Passive Radiator'}).click();
 const section=page.locator('.tab-section.active');
 const sectionRight=(await section.boundingBox())!.x+(await section.boundingBox())!.width;
 expect(await section.evaluate(el=>el.scrollWidth-el.clientWidth),'the section scrolls sideways').toBeLessThanOrEqual(0);
 const rights=await section.locator('input,select,button,label').evaluateAll(els=>els.filter(el=>el.getBoundingClientRect().width>0).map(el=>el.getBoundingClientRect().right));
 expect(Math.max(...rights),'a control reaches past the section edge').toBeLessThanOrEqual(sectionRight+0.5);
 for(const label of await section.locator('.pr-controls label').all()) expect(await label.evaluate(el=>el.scrollWidth-el.clientWidth),'a label is cut').toBeLessThanOrEqual(0);
});
