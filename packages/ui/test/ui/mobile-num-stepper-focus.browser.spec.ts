import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';
import type {Locator, Page} from '@playwright/test';

/**
 * The ▲▼ buttons on the phone (John, 2026-10-15): a tap moves focus to the button and keeps it there,
 * so the keyboard goes away and stays away; the text box is never focused or selected by a step, and
 * the row does not move under the finger. The step is at the digit the caret last sat on, kept after
 * the box loses focus; a box that never had a caret steps 0.1. Real touch events at a phone viewport.
 */
test.use({hasTouch: true, viewport: {width: 412, height: 900}});

test.beforeEach(async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Signal'}).click();
});

const activeIs = (el: Locator) => el.evaluate(node => node === document.activeElement);

async function spinnerCenter(button: Locator): Promise<{x:number;y:number}> {
  const bounds=await button.boundingBox();
  if(bounds===null)throw new Error('Spinner is not visible');
  return {x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};
}


/** A finger held on `target` until `reached` is true, as the phone sends it. */
async function hold(page: Page, target: Locator, reached: () => Promise<boolean>): Promise<void> {
  const b = await target.boundingBox();
  if (b === null) throw new Error('button has no box');
  const point = {x: b.x + b.width / 2, y: b.y + b.height / 2, id: 1};
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [point]});
  await expect.poll(reached).toBe(true);
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
}

test('a tap focuses the button, steps the digit the caret last sat on, and the row does not move', async ({page}) => {
  const row = mobileFieldRow(page, 'Rs');
  const box = row.locator('input');
  const up = row.locator('.num-stepper-btn').first();
  await box.focus();
  await box.fill('1.00');
  await box.evaluate(el => { if (el instanceof HTMLInputElement) el.setSelectionRange(4, 4); });
  const where = await box.boundingBox();

  await up.tap();

  await expect(box).toHaveValue('1.01');
  expect(await activeIs(up)).toBe(true);
  expect(await activeIs(box)).toBe(false);
  expect(await box.boundingBox()).toEqual(where);

  await up.tap();
  await expect(box).toHaveValue('1.02');
  expect(await activeIs(up)).toBe(true);
});

test('a box that never had a caret steps 0.1 with a collapsed native caret and an inverse marker', async ({page}) => {
  const row = mobileFieldRow(page, 'Rs');
  const box = row.locator('input');
  const before = await box.inputValue();

  await row.locator('.num-stepper-btn').first().tap();

  const after = await box.inputValue();
  expect(Number(after) - Number(before)).toBeCloseTo(0.1, 9);
  expect(await activeIs(box)).toBe(false);
  expect(await box.evaluate(el => el instanceof HTMLInputElement && el.selectionStart === el.selectionEnd)).toBe(true);
  await expect(row.locator('.num-mark-underline')).toBeVisible();
});

test('pressing into the text box afterwards gives the keyboard\'s box back as normal', async ({page}) => {
  const row = mobileFieldRow(page, 'Rs');
  const box = row.locator('input');
  await row.locator('.num-stepper-btn').first().tap();
  await box.tap();
  expect(await activeIs(box)).toBe(true);
});

test('a hold keeps focus on the button and steps the same digit throughout', async ({page}) => {
  const row = mobileFieldRow(page, 'Rs');
  const box = row.locator('input');
  const up = row.locator('.num-stepper-btn').first();
  await box.focus();
  await box.fill('1.00');
  await box.evaluate(el => { if (el instanceof HTMLInputElement) el.setSelectionRange(4, 4); });
  await box.blur();

  await hold(page, up, async () => Number(await box.inputValue()) > 1.03);

  const value = Number(await box.inputValue());
  expect(value).toBeGreaterThan(1.03);
  expect(value).toBeLessThan(1.4);
  expect(await activeIs(up)).toBe(true);
  expect(await activeIs(box)).toBe(false);
});

for(const direction of [-1,1]){
  for(const spinner of ['Increase','Decrease']){
    test(`a vertical swipe ${direction} starting on ${spinner} does not step`,async({page})=>{
      const row=mobileFieldRow(page,'Rs');
      const box=row.locator('input');
      await box.fill('1.00');await box.blur();
      const before=await box.inputValue();
      const button=row.getByTitle(spinner,{exact:true});
      const {x,y}=await spinnerCenter(button);
      const session=await page.context().newCDPSession(page);
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
      for(const distance of [5,15,30,60]){
        await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+direction*distance,id:1}]});
      }
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await expect(box).toHaveValue(before);
      await session.detach();
    });
  }
}

test('a swipe starting on a spinner scrolls real content without changing any filter value',async({page})=>{
  await page.setViewportSize({width:374,height:500});
  await page.locator('.mob-tab').filter({hasText:/^Filters$/}).click();
  for(const card of [1,2,3]){
    await page.getByText('+ AP',{exact:true}).click();
    await expect(page.locator('.mob-fcard')).toHaveCount(card);
  }
  const content=page.locator('.mob-content');
  await content.evaluate(element=>{element.scrollTop=0;});
  const scroll=await content.evaluate(element=>({top:element.scrollTop,room:element.scrollHeight-element.clientHeight}));
  expect(scroll.room).toBeGreaterThan(100);
  const inputs=content.locator('.mob-fcard input[data-numinput]');
  const before=await inputs.evaluateAll(elements=>elements.map(element=>element instanceof HTMLInputElement?element.value:''));
  const button=page.locator('.mob-fcard').first().getByTitle('Increase',{exact:true}).first();
  const {x,y}=await spinnerCenter(button);
  const session=await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  for(const distance of [5,20,40,80,110]){
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-distance,id:1}]});
  }
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(()=>content.evaluate(element=>element.scrollTop)).toBeGreaterThan(scroll.top);
  expect(await inputs.evaluateAll(elements=>elements.map(element=>element instanceof HTMLInputElement?element.value:''))).toEqual(before);
  await session.detach();
});

test('a cancelled touch never changes the value or starts a delayed repeat',async({page})=>{
  const row=mobileFieldRow(page,'Rs'),box=row.locator('input');
  const before=await box.inputValue();
  const {x,y}=await spinnerCenter(row.getByTitle('Increase',{exact:true}));
  await page.clock.install();
  const session=await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await page.clock.runFor(1500);
  await expect(box).toHaveValue(before);
  await session.detach();
});

test('touch hold uses one activation delay and the existing repeat cadence',async({page})=>{
  const row=mobileFieldRow(page,'Rs'),box=row.locator('input');
  await box.focus();await box.fill('1.00');
  await box.evaluate(element=>{if(element instanceof HTMLInputElement)element.setSelectionRange(4,4);});
  await page.clock.install({time:new Date('2026-10-27T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-10-27T00:00:01Z'));
  const {x,y}=await spinnerCenter(row.getByTitle('Increase',{exact:true}));
  const session=await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  await page.clock.runFor(399);
  await expect(box).toHaveValue('1.00');
  await page.clock.runFor(1);
  await expect(box).toHaveValue('1.01');
  await page.clock.runFor(334);
  await expect(box).toHaveValue('1.02');
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.clock.runFor(1000);
  await expect(box).toHaveValue('1.02');
  await session.detach();
});

for(const direction of [-1,1]){
  test(`a vertical swipe ${direction} from a focused draft does not edit or reset it`,async({page})=>{
    const row=mobileFieldRow(page,'Rs'),box=row.locator('input');
    await box.focus();await box.fill('1.00');
    await box.evaluate(element=>{if(element instanceof HTMLInputElement)element.setSelectionRange(1,1);});
    const {x,y}=await spinnerCenter(row.getByTitle('Increase',{exact:true}));
    const session=await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    for(const distance of [5,15,30,60]){
      await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+direction*distance,id:1}]});
    }
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect(box).toHaveValue('1.00');
    await expect(box).toBeFocused();
    await session.detach();
  });
}

test('an activated hold tolerates small sideways drift inside the spinner',async({page})=>{
  const row=mobileFieldRow(page,'Rs'),box=row.locator('input');
  await page.clock.install({time:new Date('2026-10-27T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-10-27T00:00:01Z'));
  const {x,y}=await spinnerCenter(row.getByTitle('Increase',{exact:true}));
  const session=await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  await page.clock.runFor(850);
  const before=Number(await box.inputValue());
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+9,y,id:1}]});
  await page.clock.runFor(400);
  expect(Number(await box.inputValue())).toBeGreaterThan(before);
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await session.detach();
});
