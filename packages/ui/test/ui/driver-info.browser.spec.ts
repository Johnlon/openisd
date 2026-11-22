import {expect,test,openAMobileProject,openAProject,COMPLETE_DRIVER_PROJECT_OWPR} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {measureSummaryContent} from '../fixtures/fieldVisualContract.js';

const hosts=[
  {skin:'phone',width:320,height:740,prepare:forceMobileSkin,open:openAMobileProject,nav:'.mob-tab',actions:'.mob-cbtns',minCloseHeight:44},
  {skin:'phone',width:374,height:705,prepare:forceMobileSkin,open:openAMobileProject,nav:'.mob-tab',actions:'.mob-cbtns',minCloseHeight:44},
  {skin:'desktop',width:1024,height:900,prepare:async()=>{},open:openAProject,nav:'.project-nav li',actions:'.driver-id-row',minCloseHeight:20},
  {skin:'desktop',width:1280,height:900,prepare:async()=>{},open:openAProject,nav:'.project-nav li',actions:'.driver-id-row',minCloseHeight:20},
];
for(const host of hosts){
  test(`${host.skin} ${host.width}: Info opens current driver details between Select and Edit`,async({page})=>{
    await page.setViewportSize({width:host.width,height:host.height});
    await host.prepare(page);await page.goto('/');await host.open(page,COMPLETE_DRIVER_PROJECT_OWPR);
    await page.locator(host.nav).filter({hasText:/^Driver$/}).click();
    const actions=page.locator(host.actions),info=actions.getByRole('button',{name:'Info',exact:true});
    const names=await actions.getByRole('button').allTextContents();
    expect(names.map(name=>name.replace('✎','').trim().toLowerCase())).toEqual(['select driver','info','edit']);
    const boxes=await actions.getByRole('button').evaluateAll(elements=>elements.map(element=>{const rect=element.getBoundingClientRect();return {left:rect.left,right:rect.right,top:rect.top,height:rect.height};}));
    expect(boxes.every(box=>box.left>=0&&box.right<=host.width)).toBe(true);
    expect(boxes.map(box=>box.top)).toEqual([boxes[0].top,boxes[0].top,boxes[0].top]);
    expect(boxes.map(box=>box.height)).toEqual([boxes[0].height,boxes[0].height,boxes[0].height]);
    expect(boxes[0].right).toBeLessThanOrEqual(boxes[1].left);
    expect(boxes[1].right).toBeLessThanOrEqual(boxes[2].left);
    expect(boxes[1].height).toBeGreaterThanOrEqual(host.minCloseHeight);
    await info.click();
    const panel=page.locator('.wb-modal');
    await expect(panel).toBeVisible();
    await expect(panel.locator('h2')).toContainText('Fixture Test Driver');
    await expect(panel.locator('.preview')).toBeVisible();
    await expect(panel.locator('.spec-row').filter({has:page.locator('.spec-lbl',{hasText:/^Fs$/})}).locator('.spec-val')).toContainText('37');
    expect((await panel.evaluate(measureSummaryContent)).issues).toEqual([]);
    await expect(panel.getByRole('button',{name:/^(Use|Clone driver|Edit)$/})).toHaveCount(0);
    await expect(page.locator('.de-modal')).toHaveCount(0);
    const close=panel.getByRole('button',{name:'Close',exact:true});
    expect((await close.boundingBox())!.height).toBeGreaterThanOrEqual(host.minCloseHeight);
    await close.click();
    await expect(panel).toHaveCount(0);
    await info.click();
    await expect(panel).toBeVisible();
    await panel.locator('h2 .x').click();
    await expect(panel).toHaveCount(0);
    await info.click();
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await actions.getByRole('button',{name:/^Select driver$/i}).click();
    await expect(page.locator('.wb-modal')).toBeVisible();
    await expect(page.locator('.wb-modal .preview')).toHaveCount(0);
    await expect(page.locator('.wb-modal .dlist .ditem').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await actions.getByRole('button',{name:/^(?:✎ )?Edit$/}).click();
    await expect(page.locator('.de-modal')).toBeVisible();
  });
}
