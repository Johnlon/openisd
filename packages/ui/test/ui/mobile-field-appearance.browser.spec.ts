import {expect,test,openAMobileProject,COMPLETE_DRIVER_PROJECT_OWPR} from '../fixtures.js';
import {PhoneBoxText} from '@openisd/design/fields';
import {forceMobileSkin,tapMobileMenuItem} from '../fixtures/mobileSkin.js';
import {measureFieldContent,measureFieldBorders} from '../fixtures/fieldVisualContract.js';

for(const width of [360,374,430]){
  test(`Driver Signal and Filters retain the common control appearance at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:740});
    await forceMobileSkin(page);await page.goto('/');await openAMobileProject(page,COMPLETE_DRIVER_PROJECT_OWPR);

    const prepare:Record<string,()=>Promise<void>>={Driver:async()=>{},Signal:async()=>{},Filters:()=>page.getByText('+ AP',{exact:true}).click()};
    for(const tab of ['Driver','Signal','Filters']){
      await page.locator('.mob-tab').filter({hasText:new RegExp('^'+tab+'$')}).click();
      // Open the same allpass specimen by its public UI.
      await prepare[tab]();
      const surface=page.locator('.mob-content');
      const fields=await surface.locator('.ui-field[data-field] input,.ui-field[data-field] select,.mob-cselect:not(.mob-cselect-wide)').evaluateAll(elements=>elements.map(element=>{
        const css=getComputedStyle(element);
        return {field:element.closest('.ui-field')?.getAttribute('data-field')??element.id,height:element.getBoundingClientRect().height,inset:css.paddingLeft,border:css.borderTopStyle,radius:css.borderTopLeftRadius,fontSize:css.fontSize};
      }));
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.filter(field=>field.height!==34||field.inset!=='16px'||field.border!=='solid'||field.radius!=='4px'||field.fontSize!=='15px'),'single-row control shape and inner spacing').toEqual([]);
      expect((await surface.evaluate(measureFieldContent)).issues).toEqual([]);
      expect((await surface.evaluate(measureFieldBorders)).issues).toEqual([]);
    }
  });
}


const popups=[
  ...['Parameters','Advanced','Dimensions'].map(tab=>({name:'Driver Editor '+tab,root:'.de-modal',open:async(page:import('@playwright/test').Page)=>{
    await page.locator('.mob-tab').filter({hasText:/^Driver$/}).click();
    await page.getByRole('button',{name:'Edit',exact:true}).click();
    await page.locator('.de-tabs').getByRole('button',{name:tab,exact:true}).click();
  }})),
  ...['Tune','What-if'].map(mode=>({name:mode,root:'.mob-sheet',open:async(page:import('@playwright/test').Page)=>{
    await page.locator('.mob-tab').filter({hasText:/^Graph$/}).click();
    await page.getByRole('button',{name:'Open '+mode,exact:true}).click();
  }})),
  {name:'Box losses',root:'.mob-align-sheet',open:async(page:import('@playwright/test').Page)=>{
    await page.locator('#mob-box-type').selectOption('sealed');
    await page.getByRole('button',{name:PhoneBoxText.BOX_LOSSES_LINK,exact:true}).first().click();
  }},
  {name:'Options General',root:'.mob-dlg',open:async(page:import('@playwright/test').Page)=>{await tapMobileMenuItem(page,/^Options/);}},
];
for(const popup of popups){
  test(popup.name+': numeric controls retain the shared mobile appearance',async({page})=>{
    await page.setViewportSize({width:374,height:705});
    await forceMobileSkin(page);await page.goto('/');await openAMobileProject(page,COMPLETE_DRIVER_PROJECT_OWPR);
    await popup.open(page);
    const controls=page.locator(popup.root).locator('input[data-numinput]');
    expect(await controls.count()).toBeGreaterThan(0);
    for(const control of await controls.all()){
      await expect(control).toHaveCSS('font-family','Arial, sans-serif');
      await expect(control).toHaveCSS('font-size','15px');
      await expect(control).toHaveCSS('height','34px');
      await expect(control).toHaveCSS('padding-left','16px');
      await expect(control).toHaveCSS('border-top-left-radius','4px');
    }
  });
}
