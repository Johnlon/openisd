import {expect, test, openAMobileProject, openAProject, COMPLETE_DRIVER_PROJECT_OWPR} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {MOBILE_SURFACES} from '../fixtures/mobileSurfaceManifest.js';
import {openCaptureSurface} from '../../../../scripts/mobile-surface-capture-navigation.js';
import {measureFieldBorders, measureFieldContent} from '../fixtures/fieldVisualContract.js';

for (const skin of ['phone', 'desktop'] as const) {
  const hosts = {
    phone: {prepare: forceMobileSkin, open: openAMobileProject, nav: '.mob-tab', surface: '.mob-content', box: '#mob-box-type', viewport: {width:374,height:705}},
    desktop: {prepare: async () => {}, open: openAProject, nav: '.project-nav li', surface: '.tab-section.active', box: '#og-box-type', viewport: {width:1280,height:900}},
  };
  const host = hosts[skin];

  test.describe(skin, () => {

  test.beforeEach(async ({page}) => {
    await page.setViewportSize(host.viewport);
    await host.prepare(page);
    await page.goto('/');
    await host.open(page, COMPLETE_DRIVER_PROJECT_OWPR);
  });

  for (const tab of ['Box', 'Driver', 'Signal']) {
    test(`${skin} ${tab}: units occupy the attached right segment without covering numbers`, async ({page}) => {
      await page.locator(host.nav).filter({hasText: new RegExp('^'+tab+'$')}).click();
      const root = page.locator(host.surface);
      const report = await root.locator('.ui-field[data-field]:visible').evaluateAll(rows => {
        const issues: string[] = []; let units = 0;
        for (const row of rows) {
          const control = row.querySelector('input,select'), unit = row.querySelector('.ui-field-unit');
          if (!control || !unit || !unit.textContent?.trim()) continue;
          const c = control.getBoundingClientRect(), u = unit.getBoundingClientRect(); units++;
          if (u.right > c.right || u.left <= c.left || u.top !== c.top || u.bottom !== c.bottom) issues.push(row.getAttribute('data-field')+': unit is not joined inside the complete outline '+JSON.stringify({control:{left:c.left,right:c.right,top:c.top,bottom:c.bottom},unit:{left:u.left,right:u.right,top:u.top,bottom:u.bottom}}));
          if (parseFloat(getComputedStyle(control).paddingRight) < u.width) issues.push(row.getAttribute('data-field')+': no space reserved for unit');
        }
        return {issues, units};
      });
      expect(report.units).toBeGreaterThan(0);
      expect(report.issues).toEqual([]);
      expect((await root.evaluate(measureFieldContent)).issues).toEqual([]);
      expect((await root.evaluate(measureFieldBorders)).issues).toEqual([]);
    });
  }

  });
}

test('phone readonly Driver boxes retain the production width and grey surface', async ({page}) => {
  await page.setViewportSize({width:374,height:705});
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('.mob-tab').filter({hasText:/^Driver$/}).click();
  const values = page.locator('.mob-content .ui-field-readout input');
  await expect(values).toHaveCount(5);
  // John rejected the narrowed experiment; use the earlier production-style Driver reference.
  expect(await values.first().evaluate(element=>getComputedStyle(element).fontFamily)).toBe('Inter, system-ui, sans-serif');
  for (const input of await values.all()) {
    await expect(input).toHaveCSS('width','170px');
    await expect(input).toHaveCSS('background-color','rgb(244, 244, 244)');
    await expect(input).toHaveAttribute('readonly');
  }
});

test('warnings and model differences stay outside opposite ends of each control group', async ({page}) => {
  await page.setViewportSize({width:374,height:705});
  await page.goto('/?field-catalogue=1');
  const rows = page.locator('[data-specimen] .ui-field[data-field]:has(input,select):has(.ui-field-dq-btn):has(.ui-field-dev)');
  expect(await rows.count()).toBeGreaterThan(0);
  const issues = await rows.evaluateAll(rows => rows.flatMap(row => {
    const c = row.querySelector('input,select')!.getBoundingClientRect();
    const warning = row.querySelector('.ui-field-dq-btn')!.getBoundingClientRect();
    const model = row.querySelector('.ui-field-dev')!.getBoundingClientRect();
    const buttons = row.querySelector('.num-stepper')?.getBoundingClientRect();
    return [warning.right > c.left ? 'warning covers value' : '', model.left < (buttons?.right ?? c.right) ? 'model cue covers control' : ''].filter(Boolean);
  }));
  expect(issues).toEqual([]);
});

test('phone Closed Box reserves one model rail so boxes and spinners share their edges', async ({page}) => {
  await page.setViewportSize({width:374,height:705});
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('#mob-box-type').selectOption('sealed');
  const geometry = await page.locator('.mob-content .ui-field[data-field]').evaluateAll(rows => rows.map(row => {
    const input = row.querySelector('input')!, box = input.getBoundingClientRect();
    return {left:box.left, right:box.right, padding:getComputedStyle(input).paddingLeft, spinners:row.querySelector('.num-stepper')?.getBoundingClientRect().left};
  }));
  expect(geometry).toHaveLength(3);
  expect(new Set(geometry.map(value => value.right)).size).toBe(1);
  expect(new Set(geometry.map(value => value.spinners)).size).toBe(1);
  expect(geometry.map(value=>value.padding)).toEqual(['16px','16px','16px']);
});

test('Tab follows the warning, number, unit, spinners and model cue in visual order', async ({page}) => {
  await page.goto('/?field-catalogue=1');
  const row = page.locator('[data-specimen="number-writable-switchable-both"]');
  const warning = row.getByRole('button',{name:'Why this value is flagged'});
  await warning.focus();
  await warning.press('Tab');
  await expect(row.locator('input')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(row.locator('.unit-toggle')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(row.getByTitle('Increase',{exact:true})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(row.getByTitle('Decrease',{exact:true})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(row.locator('.winisd-deviation-cue')).toBeFocused();
});


test('a long single-word field label remains readable beside an outside warning', async ({page}) => {
  await page.setViewportSize({width:374,height:705});
  await page.goto('/?field-catalogue=1');
  const row = page.locator('[data-specimen="number-writable-switchable-both"] .ui-field');
  // Temperature is an existing field label: the catalogue must support that intrinsic shape.
  await row.locator('label').evaluate(element=>element.textContent='Temperature');
  const report = await row.locator('..').evaluate(measureFieldContent);
  expect(report.issues).toEqual([]);
});

test('a stepperless model cue hugs the control with one two-pixel gap', async ({page}) => {
  await page.setViewportSize({width:374,height:705});
  await page.goto('/?field-catalogue=1');
  const row = page.locator('[data-specimen="count-writable-none-model"]');
  const input = await row.locator('select').boundingBox();
  const model = await row.locator('.winisd-deviation-cue').boundingBox();
  expect(input).not.toBeNull(); expect(model).not.toBeNull();
  expect(model!.x - (input!.x+input!.width)).toBe(2);
});

for (const skin of ['phone','desktop'] as const) {
  test(`${skin}: a missing mandatory parameter retains its whole warning outline`,async ({page})=>{
    const hosts={phone:{prepare:forceMobileSkin,open:openAMobileProject,nav:'.mob-tab',viewport:{width:374,height:705}},desktop:{prepare:async()=>{},open:openAProject,nav:'.project-nav li',viewport:{width:1280,height:900}}};
    await page.setViewportSize(hosts[skin].viewport);
    await hosts[skin].prepare(page);await page.goto('/');await hosts[skin].open(page,COMPLETE_DRIVER_PROJECT_OWPR);
    await page.locator(hosts[skin].nav).filter({hasText:/^Driver$/}).click();
    await page.getByRole('button',{name:/^(?:✎ )?Edit$/}).click();
    const modal=page.locator('.de-modal');
    await modal.getByRole('button',{name:'Parameters',exact:true}).click();
    const input=modal.locator('.ui-field[data-field="Fs_hz"] input');
    await input.fill('');await input.blur();
    await expect(input).toHaveClass(/de-input-empty/);
    expect((await modal.evaluate(measureFieldBorders)).issues).toEqual([]);
  });
}


function closedWizardSurface(){
  const surface=MOBILE_SURFACES.find(surface=>surface.id==='wizard-sealed-4');
  if(!surface)throw new Error('Missing wizard view');
  return surface;
}

test('the real wizard readout keeps the model cue outside the input',async({page})=>{
  await page.setViewportSize({width:374,height:705});await forceMobileSkin(page);await page.goto('/');await openAMobileProject(page,COMPLETE_DRIVER_PROJECT_OWPR);
  await openCaptureSurface(page,closedWizardSurface());
  const report=await page.locator('.mob-np-overlay').evaluate(measureFieldContent);
  expect(report.controls).toBeGreaterThan(0);expect(report.issues).toEqual([]);
});

test('the shared DOM check rejects an inside model cue even when it clears the digits',async({page})=>{
  await page.setViewportSize({width:374,height:705});await forceMobileSkin(page);await page.goto('/');await openAMobileProject(page,COMPLETE_DRIVER_PROJECT_OWPR);
  await openCaptureSurface(page,closedWizardSurface());
  await page.locator('.mob-np-overlay .ui-field-dev').evaluate(cue=>{if(!(cue instanceof HTMLElement))throw new Error('Missing model cue');cue.style.gridColumn='2';cue.style.justifySelf='center';cue.style.paddingLeft='0';});
  const report=await page.locator('.mob-np-overlay').evaluate(measureFieldContent);
  expect(report.issues.some(issue=>issue.problem==='model cue is inside the value/unit/spinner control group')).toBe(true);
});

test('the shared field contract rejects an input extending beneath its spinner even when its digits fit', async ({page}) => {
  await page.goto('/');
  await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('#og-box-type').selectOption('sealed');
  const root = page.locator('.tab-section.active');
  const input = root.locator('.ui-field:has(.num-stepper) input').first();
  expect((await root.evaluate(measureFieldContent)).issues).toEqual([]);
  const before = await input.evaluate(element => element.getBoundingClientRect().width);
  await input.evaluate((element, width) => {
    element.style.setProperty('flex', 'none', 'important');
    element.style.setProperty('width', `${width + 12}px`, 'important');
  }, before);
  expect(await input.evaluate(element => element.getBoundingClientRect().width)).toBeCloseTo(before + 12, 1);
  const report = await root.evaluate(measureFieldContent);
  expect(report.issues.some(issue => issue.problem === 'spinner overlaps the complete input outline')).toBe(true);
  expect(report.issues.some(issue => issue.problem === 'unit does not end at the complete input outline')).toBe(true);
});
