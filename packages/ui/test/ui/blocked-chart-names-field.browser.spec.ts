/**
 * A chart that cannot be drawn names the field that causes it under its reason, instead of "Fix the listed
 * inputs" with nothing listed (John, 19 Nov 2026, QO955.c3/c4: "if a chart cannot be drawn then the chart should
 * show the reason message, and the related fields also, this is particularly important on the mobile where we
 * can't see the chart and fields at the same time"; he chose "chart shows the reason AND each field causing it
 * shows it too (desktop and phone)"). Desktop says "Fix: Vent length"; the phone adds the tab, "(Box tab)".
 *
 * Set SHOT_DIR to save a screenshot of each panel.
 */
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';
import {fillAndCommit, PageOps, setNumField} from '../fixtures/numField.js';
import type {Locator, Page} from '@playwright/test';
import {PIXEL_9} from '../fixtures/phoneSizes.js';
import {SHARED_STEPS} from '../fixtures/viewOpenShared.js';
import {driverEditor} from '../fixtures/viewOpenNavigation.js';
import type {OpenStep} from '../fixtures/viewOpenTypes.js';
import {WalkSkin, WALK_VIEWPORT} from '../fixtures/viewOpenTypes.js';

const shotDir = process.env['SHOT_DIR'];

/** The blocked chart's panel. */
function panel(page: Page): Locator {
  return page.locator('.gmsg', {has: page.getByText(/Can.t plot/)}).first();
}

async function capture(page: Page, name: string): Promise<void> {
  if (shotDir === undefined) return;
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({path: `${shotDir}/${name}.png`, animations: 'disabled'});
}

/** The panel's fix line, once the panel is shown and carries no "listed"; saves a picture when asked. */
async function fixLine(page: Page, shot: string): Promise<Locator> {
  const p = panel(page);
  await expect(p).toBeVisible();
  await expect(p).not.toContainText(/listed/);
  await capture(page, shot);
  return p.locator('.gmsg-foot');
}

test.describe('Original skin', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/');
    await openAProject(page);
    await expect(page.getByText(/Project imported/)).toBeHidden();
  });

  test('a vented tuning the port cannot reach names Vent length', async ({page}) => {
    await new PageOps(page).setNum('#og-fb-target', '200');
    await expect(await fixLine(page, 'desktop-vented')).toHaveText('Fix: Vent length');
  });

  test('an ABC rear tuning the port cannot reach names Vent length', async ({page}) => {
    await page.locator('#og-box-type').selectOption('abc');
    await page.locator('.project-nav li', {hasText: 'Box'}).first().click();
    await setNumField(page, 'Tuning freq (Frc)', '2000', page.locator('.tab-section.active'));
    await expect(await fixLine(page, 'desktop-abc-rear')).toHaveText('Fix: Vent length');
  });

  test('an ABC front tuning the port cannot reach names Vent length', async ({page}) => {
    await page.locator('#og-box-type').selectOption('abc');
    await page.locator('.project-nav li', {hasText: 'Box'}).first().click();
    await setNumField(page, 'Tuning freq (Ffc)', '900', page.locator('.tab-section.active'));
    await expect(await fixLine(page, 'desktop-abc-front')).toHaveText('Fix: Vent length');
  });
});

test.describe('Mobile skin', () => {
  test.use({viewport: PIXEL_9});

  test.beforeEach(async ({page}) => {
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await expect(page.getByText(/Project imported/)).toBeHidden();
  });

  test('a vented tuning the port cannot reach names Vent length and the Box tab', async ({page}) => {
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    await page.locator('#mob-box-type').selectOption('vented');
    await fillAndCommit(mobileFieldRow(page, 'Fb').locator('input'), '200');
    await page.locator('.mob-tab', {hasText: 'Graph'}).click();
    await expect(await fixLine(page, 'phone-vented')).toHaveText('Fix: Vent length (Box tab)');
  });

  test('an ABC rear tuning the port cannot reach names Vent length and the Box tab', async ({page}) => {
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    await page.locator('#mob-box-type').selectOption('abc');
    await fillAndCommit(page.locator('.ui-field', {hasText: 'Frc'}).locator('input'), '2000');
    await page.locator('.mob-tab', {hasText: 'Graph'}).click();
    await expect(await fixLine(page, 'phone-abc-rear')).toHaveText('Fix: Vent length (Box tab)');
  });

  test('an ABC front tuning the port cannot reach names Vent length and the Box tab', async ({page}) => {
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    await page.locator('#mob-box-type').selectOption('abc');
    await fillAndCommit(page.locator('.ui-field', {hasText: 'Ffc'}).locator('input'), '900');
    await page.locator('.mob-tab', {hasText: 'Graph'}).click();
    await expect(await fixLine(page, 'phone-abc-front')).toHaveText('Fix: Vent length (Box tab)');
  });
});

const hosts = {
  [WalkSkin.Phone]: {viewport: {width: 390, height: 844}, prepare: forceMobileSkin, open: openAMobileProject, place: 'Driver tab'},
  [WalkSkin.Desktop]: {viewport: WALK_VIEWPORT.desktop, prepare: async () => {}, open: openAProject, place: 'Driver'},
};

const blockedSteps = SHARED_STEPS.filter(([, id]) => id === 'shared/graph-blocked-message');

async function importBlankDriver(page: Page, skin: WalkSkin, step: OpenStep): Promise<void> {
  const {viewport, prepare, open} = hosts[skin];
  await page.setViewportSize(viewport);
  await prepare(page);
  await page.goto('/');
  await open(page);
  await step.open(page);
}

for (const [skin, , step] of blockedSteps) {
  test(`importing a driver with no figures shows how to restore SPL on ${skin}`, async ({page}) => {
    await importBlankDriver(page, skin, step);
    const message = panel(page);
    const fix = message.locator('.gmsg-title + .gmsg-foot');
    const details = message.locator('.gmsg-line');
    await expect(message.locator('.gmsg-title')).toHaveText('Can’t plot SPL response');
    await expect(fix).toHaveText(`Enter Fs, Qes, Qms, Vas, Re and Sd (or Dd) in ${hosts[skin].place} > Edit > Parameters.`);
    await expect(fix).toHaveCSS('font-weight', '700');
    await expect(fix).toHaveCSS('font-size', '15px');
    await expect(details).toHaveCount(6);
    await expect(details.first()).toHaveCSS('font-size', '11px');
    await expect.poll(() => message.evaluate(el => el.scrollHeight - el.clientHeight)).toBe(0);
    await expect(message).toContainText('Missing driver figures are cone area (Sd), coil resistance (Re), force factor (BL), compliance (Cms), moving mass (Mms) and mechanical resistance (Rms).');
    const rows = message.locator('.gmsg-title, .gmsg-foot, .gmsg-edit, .gmsg-summary, .gmsg-line');
    await expect.poll(() => rows.evaluateAll(elements => new Set(elements.map(el => el.getBoundingClientRect().left)).size)).toBe(1);
    await expect(fix).toHaveCSS('text-align', 'left');
    await expect(details.first()).toHaveText('Type Sd (cone area) if you know it, otherwise enter Dd (cone diameter).');
    await expect(details.nth(1)).toHaveText('Type Re (coil resistance) if you know it, otherwise enter USPL (voltage sensitivity) and SPL (1 W sensitivity).');
    await expect(message).not.toContainText(/needs|directly entered or derived|cannot be calculated yet/);
    const fields = ['Sd_m2', 'Re_ohm', 'BL_Tm', 'Cms_m_per_N', 'Mms_kg', 'Rms_kg_per_s'];
    for (const [i, label] of ['Sd', 'Re', 'BL', 'Cms', 'Mms', 'Rms'].entries()) {
      await expect(details.nth(i)).toHaveText(new RegExp('^Type ' + label + ' .* if you know it, otherwise enter '));
    }
    await capture(page, `blocktext-${skin}.after`);

    const reasons = await details.allTextContents();
    await driverEditor(page, skin);
    await page.locator('.de-modal').getByText('Parameters', {exact: true}).click();
    for (const [i, field] of fields.entries()) {
      await expect(page.locator(`[data-field-key="${field}"] .ui-field-dq-btn`)).toHaveAttribute('title', reasons[i]);
    }
    const sd = page.locator('[data-field-key="Sd_m2"]');
    await sd.locator('.ui-field-dq-btn').click();
    await expect(sd.getByRole('note')).toHaveText(reasons[0]);
  });
}

const desktopStep = blockedSteps.find(([skin]) => skin === WalkSkin.Desktop)?.[2];
if (desktopStep === undefined) throw new Error('Missing desktop driver import step');

test('entering the suggested datasheet figures with Dd instead of Sd restores SPL', async ({page}) => {
  const skin = WalkSkin.Desktop;
  await importBlankDriver(page, skin, desktopStep);
  await expect(panel(page).locator('.gmsg-foot')).toContainText('Re and Sd (or Dd)');
  await driverEditor(page, skin);
  const editor = page.locator('.de-modal');
  await editor.getByText('Parameters', {exact: true}).click();
  await setNumField(page, 'Fs', '37', editor);
  await setNumField(page, 'Qes', '0.4', editor);
  await setNumField(page, 'Qms', '7', editor);
  await setNumField(page, 'Vas', '30', editor);
  await setNumField(page, 'Re', '5.6', editor);
  await setNumField(page, 'Dd', '130', editor);
  await editor.getByRole('button', {name: 'OK', exact: true}).click();
  await expect(panel(page)).toBeHidden();
  await expect(page.locator('.graph-wrap canvas').first()).toBeVisible();
});
