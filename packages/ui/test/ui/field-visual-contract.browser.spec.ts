import {COMPLETE_DRIVER_PROJECT_OWPR, expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {measureFieldBorders, measureFieldContent} from '../fixtures/fieldVisualContract.js';
import {BOX_TYPES, SCREENS} from '../visual/screens.js';
import type {Locator, Page} from '@playwright/test';

/** Only the presented dialog is interactive; the page behind its backdrop is deliberately covered. */
async function fieldSurface(page: Page): Promise<Locator> {
  const dialog = page.locator('.de-modal:visible, .overlay.open .modal:visible, .mob-dlg:visible, .mob-np-overlay:visible').last();
  return await dialog.count() > 0 ? dialog : page.locator('body');
}

async function openClosedBox(page: Page, skin: 'mobile' | 'desktop'): Promise<void> {
  await page.setViewportSize(skin === 'mobile' ? {width: 374, height: 705} : {width: 1280, height: 900});
  if (skin === 'mobile') await forceMobileSkin(page);
  await page.goto('/');
  if (skin === 'mobile') await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  else await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator(skin === 'mobile' ? '#mob-box-type' : '#og-box-type').selectOption('sealed');
}

for (const skin of ['mobile', 'desktop'] as const) {
  test(`closed box ${skin}: displayed values clear every unit, stepper and cue`, async ({page}) => {
    await openClosedBox(page, skin);
    const root = page.locator(skin === 'mobile' ? '.mob-content' : '.tab-section.active');
    const report = await root.evaluate(measureFieldContent);
    expect(report.rows, 'closed box has all three numeric fields').toBe(3);
    expect(report.controls, 'every field is measured').toBe(report.rows);
    expect(report.issues).toEqual([]);
  });
}

for (const screen of SCREENS.filter(screen => screen.name !== 'empty' && screen.name !== 'menu')) {
  test(`shared overlap contract ${screen.skin.name} ${screen.name}`, async ({page}) => {
    await screen.open(page);
    const report = await (await fieldSurface(page)).evaluate(measureFieldContent);
    expect(report.controls, 'every mounted field is measured').toBe(report.rows);
    expect(report.issues).toEqual([]);
  });
}

test('Driver phone: every field border remains painted around its value', async ({page}) => {
  await openClosedBox(page, 'mobile');
  await page.locator('.mob-tab').filter({hasText: /^Driver$/}).click();
  const report = await page.locator('.mob-content').evaluate(measureFieldBorders);
  expect(report.rows).toBe(5);
  expect(report.controls).toBe(report.rows);
  expect(report.issues).toEqual([]);
});

test('Driver desktop: every unit fits its control without touching the steppers', async ({page}) => {
  await openClosedBox(page, 'desktop');
  await page.locator('.project-nav li').filter({hasText: /^Driver$/}).click();
  const report = await page.locator('.tab-section.active').evaluate(measureFieldContent);
  expect(report.rows).toBeGreaterThan(0);
  expect(report.controls).toBe(report.rows);
  expect(report.issues).toEqual([]);
});

for (const screen of SCREENS.filter(screen => screen.name !== 'empty' && screen.name !== 'menu')) {
  test(`shared border contract ${screen.skin.name} ${screen.name}`, async ({page}) => {
    await screen.open(page);
    const report = await (await fieldSurface(page)).evaluate(measureFieldBorders);
    expect(report.controls, 'every mounted field is measured').toBe(report.rows);
    expect(report.issues).toEqual([]);
  });
}

for (const skin of ['mobile', 'desktop'] as const) {
  for (const tab of ['General', 'Parameters', 'Advanced', 'Dimensions']) {
    test(`shared border contract Driver Editor ${skin} ${tab}`, async ({page}) => {
      await openClosedBox(page, skin);
      await page.locator(skin === 'mobile' ? '.mob-tab' : '.project-nav li').filter({hasText: /^Driver$/}).click();
      await page.getByRole('button', {name: /^(?:✎ )?Edit$/}).click();
      const modal = page.locator('.de-modal');
      await modal.getByRole('button', {name: tab, exact: true}).click();
      const report = await modal.evaluate(measureFieldBorders);
      const content = await modal.evaluate(measureFieldContent);
      expect(report.rows, 'the editor tab has fields').toBeGreaterThan(0);
      expect(report.controls).toBe(report.rows);
      expect(report.issues).toEqual([]);
      expect(content.issues).toEqual([]);
    });
  }
}

for (const box of BOX_TYPES) {
  test(`shared field contracts phone box ${box}`, async ({page}) => {
    await openClosedBox(page, 'mobile');
    await page.locator('#mob-box-type').selectOption(box);
    const root = page.locator('.mob-content');
    const content = await root.evaluate(measureFieldContent);
    const borders = await root.evaluate(measureFieldBorders);
    expect(content.rows).toBeGreaterThan(0);
    expect(content.controls).toBe(content.rows);
    expect(borders.controls).toBe(content.controls);
    expect(content.issues).toEqual([]);
    expect(borders.issues).toEqual([]);
  });
}

// The bundled driver has populated reference-air values absent from the imported comparison project.
test('shared content contract Driver Editor Advanced at narrow phone width', async ({page}) => {
  await page.setViewportSize({width: 360, height: 740});
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab').filter({hasText: /^Driver$/}).click();
  await page.getByRole('button', {name: 'Edit', exact: true}).click();
  const modal = page.locator('.de-modal');
  await modal.getByRole('button', {name: 'Advanced', exact: true}).click();
  const report = await modal.evaluate(measureFieldContent);
  expect(report.rows).toBeGreaterThan(0);
  expect(report.controls).toBe(report.rows);
  expect(report.issues).toEqual([]);
});

for (const width of [360, 374]) {
  test(`PR warning and model cues preserve displayed precision at ${width}px`, async ({page}) => {
    await openClosedBox(page, 'mobile');
    await page.setViewportSize({width, height: 740});
    await page.locator('#mob-box-type').selectOption('box-passive-radiator');
    const qms = page.locator('.mob-ui-field').filter({has: page.locator('label', {hasText: /^Qms$/})}).locator('input');
    await qms.fill('');
    await qms.blur();
    await expect(qms).toHaveValue('');
    for (const label of ['Mms', 'Cms']) {
      const row = page.locator('.mob-ui-field').filter({has: page.locator('label', {hasText: new RegExp(`^${label}$`)})});
      await expect(row.locator('.ui-field-dq-btn')).toHaveCount(1);
      await expect(row.locator('.winisd-deviation-cue')).toHaveCount(1);
      await expect(row.locator('input')).not.toBeEmpty();
    }
    const report = await page.locator('.mob-content').evaluate(measureFieldContent);
    expect(report.rows).toBeGreaterThan(0);
    expect(report.controls).toBe(report.rows);
    expect(report.issues).toEqual([]);
  });
}
