import {duplicateFocusedProject, expect, openAProject, test} from '../fixtures.js';

test.beforeEach(async ({page}) => {
  await page.goto('/');
  await openAProject(page);
});

for (const box of ['sealed','vented','box-passive-radiator','bandpass4','bandpass6','abc']) {
  test(`${box}: narrow desktop list keeps name, box type and volumes visible on separate lines`, async ({page}) => {
    await page.setViewportSize({width:1280,height:900});
    await page.locator('#og-box-type').selectOption(box);
    const row = page.locator('.project-row.selected');
    await expect(row.locator('.project-box-type')).toBeVisible();
    await expect(row.locator('.project-volumes')).toContainText('L');
    const geometry = await row.evaluate(el => {
      const parts = ['.project-name','.project-box-type','.project-volumes'].map(selector => {
        const node = el.querySelector<HTMLElement>(selector)!;
        const bounds = node.getBoundingClientRect();
        return {top:bounds.top,bottom:bounds.bottom,left:bounds.left,right:bounds.right,fits:node.scrollWidth<=node.clientWidth+1 && node.scrollHeight<=node.clientHeight+1};
      });
      const bounds=el.getBoundingClientRect(), swatch=el.querySelector('.project-swatch')!.getBoundingClientRect();
      return {parts,right:bounds.right,swatchWidth:swatch.width,swatchHeight:swatch.height};
    });
    expect(geometry.parts.every(part=>part.fits && part.right<=geometry.right)).toBe(true);
    expect(geometry.parts[1].top).toBeGreaterThanOrEqual(geometry.parts[0].bottom);
    expect(geometry.parts[2].top).toBeGreaterThanOrEqual(geometry.parts[1].bottom);
    expect(geometry.swatchWidth).toBeGreaterThanOrEqual(5);
    expect(geometry.swatchWidth).toBeLessThanOrEqual(6);
    expect(geometry.swatchHeight).toBeGreaterThanOrEqual(20);
  });
}

test('single click picks an unused colour without activating or recolouring another project', async ({page}) => {
  await duplicateFocusedProject(page, 'Other design');
  const active = page.locator('.project-row.selected');
  const other = page.locator('.project-row:not(.selected)').first();
  const activeColour = await active.locator('.project-swatch').evaluate(el=>getComputedStyle(el).getPropertyValue('--swatch-color'));
  const oldColour = await other.locator('.project-swatch').evaluate(el=>getComputedStyle(el).getPropertyValue('--swatch-color'));
  await other.locator('.project-swatch').click();
  await expect.poll(()=>other.locator('.project-swatch').evaluate(el=>getComputedStyle(el).getPropertyValue('--swatch-color'))).not.toBe(oldColour);
  const newColour = await other.locator('.project-swatch').evaluate(el=>getComputedStyle(el).getPropertyValue('--swatch-color'));
  expect(newColour).not.toBe(activeColour);
  await expect(active.locator('.project-name')).toHaveText('Other design');
  expect(await active.locator('.project-swatch').evaluate(el=>getComputedStyle(el).getPropertyValue('--swatch-color'))).toBe(activeColour);
});

for (const trigger of ['double click','menu'] as const) {
  test(`${trigger} opens the native colour picker without cycling and applies its chosen colour`, async ({page}) => {
    await page.evaluate(()=>{HTMLInputElement.prototype.showPicker=function(){this.setAttribute('data-picker-open','true');};});
    const row=page.locator('.project-row.selected'), swatch=row.locator('.project-swatch');
    const before=await swatch.evaluate(el=>getComputedStyle(el).getPropertyValue('--swatch-color'));
    const actions = {
      'double click':()=>swatch.dblclick(),
      menu:async()=>{await row.locator('.row-menu-btn').click();await page.locator('.row-menu-item').filter({hasText:/colour/i}).click();},
    };
    await actions[trigger]();
    const picker=page.locator('.project-colour-input');
    await expect(picker).toHaveAttribute('data-picker-open','true');
    await page.waitForTimeout(500); // eslint-disable-line playwright/no-wait-for-timeout -- verify delayed single-click never fires after double-click/menu
    expect(await swatch.evaluate(el=>getComputedStyle(el).getPropertyValue('--swatch-color'))).toBe(before);
    await picker.evaluate(el=>{if(!(el instanceof HTMLInputElement))throw new Error('Expected colour input');el.value='#123456';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await expect.poll(()=>swatch.evaluate(el=>getComputedStyle(el).getPropertyValue('--swatch-color'))).toBe('#123456');
  });
}


test('right-click copies active chart definitions into another project without changing focus', async ({page}) => {
  await duplicateFocusedProject(page, 'Source charts');
  await page.locator('.chart-select').click();
  await page.locator('.chart-item').filter({hasText:'Impedance'}).first().locator('input').check();
  await page.locator('.project-row.selected .project-name').click();
  const chartCount = await page.locator('.chart-close').count();
  expect(chartCount).toBeGreaterThan(1);
  const target = page.locator('.project-row:not(.selected)').first();
  await target.click({button:'right'});
  await page.getByRole('button',{name:'Copy charts from active project',exact:true}).click();
  await expect(page.locator('.project-row.selected .project-name')).toHaveText('Source charts');
  await target.locator('.project-name').click();
  await expect(page.locator('.chart-close')).toHaveCount(chartCount);
});

test('chart definitions can be copied into a closed project without opening it or moving focus', async ({page}) => {
  await duplicateFocusedProject(page, 'Source charts');
  const target = page.locator('.project-row:not(.selected)').first();
  await target.locator('.row-menu-btn').click();
  await page.locator('.menu-action-close').click();
  await expect(target).toHaveClass(/is-closed/);
  await page.locator('.chart-select').click();
  await page.locator('.chart-item').filter({hasText:'Impedance'}).first().locator('input').check();
  await page.locator('.project-row.selected .project-name').click();
  const count = await page.locator('.chart-close').count();
  await target.click({button:'right'});
  await page.getByRole('button',{name:'Copy charts from active project',exact:true}).click();
  await expect(target).toHaveClass(/is-closed/);
  await expect(page.locator('.project-row.selected .project-name')).toHaveText('Source charts');
  await target.locator('.project-name').click();
  await expect(page.locator('.chart-close')).toHaveCount(count);
});

test('the expanded project menu remains inside the viewport at its bottom right edge', async ({page}) => {
  await page.setViewportSize({width:1024,height:768});
  await duplicateFocusedProject(page, 'Source charts');
  await page.locator('.project-row:not(.selected)').first().dispatchEvent('contextmenu', {clientX:1020,clientY:764,bubbles:true});
  const menu = page.locator('.row-menu-popup');
  await expect(menu.getByRole('button',{name:'Copy charts from active project',exact:true})).toBeVisible();
  const bounds = await menu.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(768);
  expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(1024);
});

test('quick single clicks on different project colours both take effect', async ({page}) => {
  await duplicateFocusedProject(page,'Other design');
  await page.clock.install();
  const swatches=page.locator('.project-row .project-swatch');
  const before=await swatches.evaluateAll(els=>els.map(el=>getComputedStyle(el).getPropertyValue('--swatch-color')));
  await swatches.nth(0).click();
  await swatches.nth(1).click();
  await page.clock.runFor(600);
  const after=await swatches.evaluateAll(els=>els.map(el=>getComputedStyle(el).getPropertyValue('--swatch-color')));
  expect(after[0]).not.toBe(before[0]);
  expect(after[1]).not.toBe(before[1]);
  expect(after[0]).not.toBe(after[1]);
});

test('a slower native double-click restores the original colour before opening its picker', async ({page}) => {
  await page.clock.install();
  await page.evaluate(()=>{HTMLInputElement.prototype.showPicker=function(){this.setAttribute('data-picker-open','true');};});
  const swatch=page.locator('.project-row.selected .project-swatch');
  const before=await swatch.evaluate(el=>getComputedStyle(el).getPropertyValue('--swatch-color'));
  await swatch.click();
  await page.clock.runFor(450);
  // Send only the second native click; locator.click({clickCount:2}) sends a fresh pair.
  await swatch.hover();
  await page.mouse.down({clickCount:2});
  await page.mouse.up({clickCount:2});
  await expect(page.locator('.project-colour-input')).toHaveAttribute('data-picker-open','true');
  expect(await swatch.evaluate(el=>getComputedStyle(el).getPropertyValue('--swatch-color'))).toBe(before);
  await expect(page.locator('.project-colour-input')).toHaveValue(before);
});

test('project-list colour and copied charts survive closing and reopening the destination', async ({page}) => {
  await duplicateFocusedProject(page, 'Source charts');
  const targetName = await page.locator('.project-row:not(.selected) .project-name').first().innerText();
  const target = page.locator('.project-row').filter({has:page.getByText(targetName,{exact:true})});
  const swatch = target.locator('.project-swatch');
  const before = await swatch.evaluate(el=>getComputedStyle(el).getPropertyValue('--swatch-color'));
  await swatch.click();
  await expect.poll(()=>swatch.evaluate(el=>getComputedStyle(el).getPropertyValue('--swatch-color'))).not.toBe(before);
  const colour = await swatch.evaluate(el=>getComputedStyle(el).getPropertyValue('--swatch-color'));
  await page.locator('.chart-select').click();
  await page.locator('.chart-item').filter({hasText:'Impedance'}).first().locator('input').check();
  await page.locator('.project-row.selected .project-name').click();
  const chartCount = await page.locator('.chart-close').count();
  await target.click({button:'right'});
  await page.getByRole('button',{name:'Copy charts from active project',exact:true}).click();
  await target.locator('.row-menu-btn').click();
  await page.locator('.menu-action-close').click();
  await expect(target).toHaveClass(/is-closed/);
  await target.locator('.project-name').click();
  await expect(page.locator('.chart-close')).toHaveCount(chartCount);
  expect(await swatch.evaluate(el=>getComputedStyle(el).getPropertyValue('--swatch-color'))).toBe(colour);
});

test('project row checkbox and dirty Save action keep their alignment with multiline names', async ({page}) => {
  await duplicateFocusedProject(page, 'A long project name with multiple lines');
  const result = await page.locator('.project-row.selected').evaluate(row=>{
    const rect=(selector:string)=>row.querySelector(selector)!.getBoundingClientRect();
    const rowRect=row.getBoundingClientRect();
    const saveRect=rect('.row-save-btn');
    return {gap:rect('.project-show-cbx').top-rowRect.top,
      saveFits:saveRect.top>=rowRect.top&&saveRect.bottom<=rowRect.bottom};
  });
  await expect(page.locator('.project-row.selected .row-save-btn')).toBeVisible();
  expect(result.gap).toBeGreaterThanOrEqual(0);
  expect(result.gap).toBeLessThanOrEqual(8);
  expect(result.saveFits).toBe(true);
});

test('saving project-list chart views does not save unsaved box edits', async ({page}) => {
  await duplicateFocusedProject(page, 'Source charts');
  const name = await page.locator('.project-row:not(.selected) .project-name').first().innerText();
  const target = page.locator('.project-row').filter({has:page.getByText(name,{exact:true})});
  const source = page.locator('.project-row').filter({has:page.getByText('Source charts',{exact:true})});
  await target.locator('.project-name').click();
  await page.locator('#og-box-type').selectOption('sealed');
  const savedVolume = await page.locator('#og-box-volume').inputValue();
  await page.locator('#og-box-volume').fill('19');
  await page.locator('#og-box-volume').blur();
  await source.locator('.project-name').click();
  await page.locator('.chart-select').click();
  await page.locator('.chart-item').filter({hasText:'Impedance'}).first().locator('input').check();
  await source.locator('.project-name').click();
  const charts = await page.locator('.chart-close').count();
  const swatch = target.locator('.project-swatch');
  const before = await swatch.evaluate(el=>getComputedStyle(el).getPropertyValue('--swatch-color'));
  await swatch.click();
  await expect.poll(()=>swatch.evaluate(el=>getComputedStyle(el).getPropertyValue('--swatch-color'))).not.toBe(before);
  const colour = await swatch.evaluate(el=>getComputedStyle(el).getPropertyValue('--swatch-color'));
  await target.click({button:'right'});
  await page.getByRole('button',{name:'Copy charts from active project',exact:true}).click();
  await target.locator('.row-menu-btn').click();
  await page.locator('.menu-action-close').click();
  await page.locator('.close-actions').getByRole('button',{name:'Close without saving',exact:true}).click();
  await expect(target).toHaveClass(/is-closed/);
  await target.locator('.project-name').click();
  await page.locator('#og-box-type').selectOption('sealed');
  await expect(page.locator('#og-box-volume')).toHaveValue(savedVolume);
  await expect(page.locator('.chart-close')).toHaveCount(charts);
  expect(await swatch.evaluate(el=>getComputedStyle(el).getPropertyValue('--swatch-color'))).toBe(colour);
});
