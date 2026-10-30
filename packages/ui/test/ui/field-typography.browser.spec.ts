import {expect,test,openAMobileProject,COMPLETE_DRIVER_PROJECT_OWPR} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {measureFieldContent} from '../fixtures/fieldVisualContract.js';

async function openDriver(page: import('@playwright/test').Page): Promise<void> {
  await page.setViewportSize({width:374,height:705});
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page,COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('.mob-tab').filter({hasText:/^Driver$/}).click();
  await expect(page.locator('.mob-content .ui-field-readout input')).toHaveCount(5);
  await page.evaluate(()=>document.fonts.ready.then(()=>{}));
}

const regressions=[
  {name:'family',property:'font-family',value:'monospace'},
  {name:'size',property:'font-size',value:'17px'},
  {name:'weight',property:'font-weight',value:'700'},
  {name:'style',property:'font-style',value:'italic'},
  {name:'spacing',property:'letter-spacing',value:'2px'},
  {name:'line height',property:'line-height',value:'30px'},
];
for(const regression of regressions){
  test(`shared DOM contract detects a readout ${regression.name} change beyond the first field`,async({page})=>{
    await openDriver(page);
    const surface=page.locator('.mob-content');
    expect((await surface.evaluate(measureFieldContent)).issues).toEqual([]);
    await surface.locator('.ui-field-readout input').last().evaluate((element,change)=>element.style.setProperty(change.property,change.value,'important'),regression);
    const report=await surface.evaluate(measureFieldContent);
    expect(report.issues.filter(issue=>issue.problem.includes('typography'))).toEqual([
      expect.objectContaining({field:'Xmax',problem:expect.stringContaining('typography')})
    ]);
  });
}

test('shared DOM contract detects missing Inter faces despite unchanged CSS font family',async({page})=>{
  await openDriver(page);
  expect((await page.locator('.mob-content').evaluate(measureFieldContent)).issues).toEqual([]);
  // Simulate losing the font imports. No CSS family declaration changes and no
  // network error is needed: the browser silently substitutes its system font.
  const removed=await page.evaluate(()=>{
    let removed=0;
    for(const sheet of document.styleSheets){
      for(let index=sheet.cssRules.length-1;index>=0;index--){
        const rule=sheet.cssRules[index];
        if(rule instanceof CSSFontFaceRule && rule.style.fontFamily.replace(/["']/g,'')==='Inter'){
          sheet.deleteRule(index);removed++;
        }
      }
    }
    return removed;
  });
  expect(removed).toBeGreaterThan(0);
  await expect(page.locator('.mob-content .ui-field-readout input').first()).toHaveCSS('font-family','Inter, system-ui, sans-serif');
  const report=await page.locator('.mob-content').evaluate(measureFieldContent);
  expect(report.issues.filter(issue=>issue.problem.includes('font unavailable'))).toHaveLength(5);
});
