import {readFileSync} from 'node:fs';
import type {Page} from '@playwright/test';
import {editorTab, expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

/**
 * QO941 (John, 2026-11-15): the Driver tab shows no measured wiring, so the data-quality mark for a
 * multi-coil driver whose wiring is not stated is the user's only sign. It is the ⚠ on the
 * "Coil wiring" field in the Driver editor, with the data-quality sentence as its tooltip.
 * BlieSMa W137A-854-4 has three coils and states no wiring; Dayton MX6-22 states series.
 */
const W137A = readFileSync('packages/ui/public/drivers/bliesma/w137a-854-4.json');
const MX6_22 = readFileSync('packages/ui/public/drivers/dayton-audio/mx6-22.json');

async function selectDriver(page: Page, file: Buffer): Promise<void> {
  await page.locator('.driver-library input[type="file"]').setInputFiles({name: 'driver.owdr', mimeType: 'application/json', buffer: file});
  await expect(page.locator('.driver-library .preview')).toBeVisible();
  await page.locator('.driver-library .use-btn').click();
  await expect(page.locator('.wb-modal')).toHaveCount(0);
}

const DESKTOP = {open: async (page: Page) => { await page.goto('/'); await openAProject(page); await page.locator('.project-nav li', {hasText: 'Driver'}).click(); await page.getByRole('button', {name: 'Select Driver'}).click(); }, edit: async (page: Page) => { await page.locator('.edit-btn', {hasText: 'Edit'}).click(); }};
const PHONE = {open: async (page: Page) => { await forceMobileSkin(page); await page.goto('/'); await openAMobileProject(page); await page.locator('.mob-tab', {hasText: 'Driver'}).click(); await page.getByText('Select driver').click(); }, edit: async (page: Page) => { await page.getByRole('button', {name: 'Edit', exact: true}).click(); }};

for (const [skin, skinName] of [[DESKTOP, 'desktop'], [PHONE, 'phone']] as const) {
  test(`${skinName}: unstated wiring on a multi-coil driver is flagged on the editor's Coil wiring field`, async ({page}) => {
    await skin.open(page);
    await selectDriver(page, W137A);
    await skin.edit(page);
    await editorTab(page, 'Parameters');
    const row = page.locator('.de-body [data-field-key="VCCon"]');
    await expect(row.locator('.ui-field-dq-btn')).toHaveAttribute('title', /Measured wiring not stated/);
  });

  test(`${skinName}: a stated wiring has no flag on the Coil wiring field`, async ({page}) => {
    await skin.open(page);
    await selectDriver(page, MX6_22);
    await skin.edit(page);
    await editorTab(page, 'Parameters');
    await expect(page.locator('.de-body [data-field-key="VCCon"]')).toBeVisible();
    await expect(page.locator('.de-body [data-field-key="VCCon"] .ui-field-dq-btn')).toHaveCount(0);
  });
}
