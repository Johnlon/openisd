import {expect,test,openAMobileProject,openAProject,COMPLETE_DRIVER_PROJECT_OWPR} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {measureFieldContent,measureFieldBorders} from '../fixtures/fieldVisualContract.js';
import {measureFieldControlContainment} from '../fixtures/fieldControlContainment.js';

const boxes=[
  {type:'sealed',chambers:['whole']}, {type:'vented',chambers:['whole']}, {type:'box-passive-radiator',chambers:['whole']},
  {type:'bandpass4',chambers:['Rear','Front']}, {type:'bandpass6',chambers:['Rear','Front']}, {type:'abc',chambers:['Rear','Front']},
];
const hosts=[
  {skin:'phone',width:360,height:740,prepare:forceMobileSkin,open:openAMobileProject,box:'#mob-box-type',nav:'.mob-tab',group:'.mob-csection',heading:'.mob-band-title',link:'.mob-clink',linkName:'Box losses',surface:'.mob-align-sheet'},
  {skin:'phone',width:374,height:705,prepare:forceMobileSkin,open:openAMobileProject,box:'#mob-box-type',nav:'.mob-tab',group:'.mob-csection',heading:'.mob-band-title',link:'.mob-clink',linkName:'Box losses',surface:'.mob-align-sheet'},
  {skin:'desktop',width:1024,height:900,prepare:async()=>{},open:openAProject,box:'#og-box-type',nav:'.project-nav li',group:'.box-fields-col',heading:'.section-header',link:'.link-btn',linkName:'Advanced',surface:'.overlay.open .modal'},
  {skin:'desktop',width:1280,height:900,prepare:async()=>{},open:openAProject,box:'#og-box-type',nav:'.project-nav li',group:'.box-fields-col',heading:'.section-header',link:'.link-btn',linkName:'Advanced',surface:'.overlay.open .modal'},
];
for(const host of hosts) for(const box of boxes) for(const chamber of box.chambers){
  test(`${host.skin} ${host.width} ${box.type} ${chamber}: losses labels and complete controls remain visible`,async({page})=>{
    await page.setViewportSize({width:host.width,height:host.height});
    await host.prepare(page);await page.goto('/');await host.open(page,COMPLETE_DRIVER_PROJECT_OWPR);
    await page.locator(host.nav).filter({hasText:/^Box$/}).click();
    await page.locator(host.box).selectOption(box.type);
    const group=page.locator(host.group).filter({has:page.locator(host.heading,{hasText:chamber==='whole'?'Rear chamber':chamber+' chamber'})});
    await group.locator(host.link,{hasText:host.linkName}).click();
    const surface=page.locator(host.surface);
    await expect(surface).toBeVisible();
    const labels=await surface.locator('.ui-field > label').evaluateAll(elements=>elements.map(element=>{
      const range=document.createRange();range.selectNodeContents(element);
      return {label:element.textContent,lines:range.getClientRects().length};
    }));
    expect(labels.length).toBeGreaterThanOrEqual(2);
    expect(labels.filter(label=>label.lines!==1),'losses labels fit on one line beside narrower value boxes').toEqual([]);
    expect((await surface.evaluate(measureFieldContent)).issues).toEqual([]);
    expect((await surface.evaluate(measureFieldBorders)).issues).toEqual([]);
    expect((await surface.evaluate(measureFieldControlContainment)).issues).toEqual([]);
  });
}
