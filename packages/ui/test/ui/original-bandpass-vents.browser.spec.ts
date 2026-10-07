import {expect, focusedPortVents, openAProject, setFocusedBoxType, test} from '../fixtures.js';
import {fillAndBlur} from '../fixtures/numField.js';

/**
 * The Original shell's Vents pane for the 6th-order bandpass and ABC: one column per port,
 * each editing its own vent (bugs/BUG_20261007_bp6-abc-front-tuning-edits-the-vented-box.md,
 * plan PLAN_20261007_bp6_abc_complete.md step 5).
 */

test.beforeEach(async ({page}) => {
  await page.goto('/');
  await openAProject(page);
});

async function openVents(page: import('@playwright/test').Page, type: 'bandpass6' | 'abc'): Promise<void> {
  await setFocusedBoxType(page, type);
  await page.locator('.project-nav li', {hasText: type === 'abc' ? 'ABC' : '6th Order'}).click();
}

test('bandpass6: a Rear and a Front port, no pending note, diameter edits reach only that vent', async ({page}) => {
  await openVents(page, 'bandpass6');
  await expect(page.locator('.vent-port-tab')).toHaveText(['Rear', 'Front']);
  await expect(page.locator('section.tab-section.active')).not.toContainText('Response model pending');
  const before = await focusedPortVents(page);
  await fillAndBlur(page.locator('#og-vent-diameter-rear'), '6.5');
  const after = await focusedPortVents(page);
  expect(after.rear.diameter).toBeCloseTo(0.065, 6);
  expect(after.front.diameter).toBe(before.front.diameter);
});

test('abc: Rear, Front and Intra ports; the Intra length is editable and reaches the intra vent', async ({page}) => {
  await openVents(page, 'abc');
  await expect(page.locator('.vent-port-tab')).toHaveText(['Rear', 'Front', 'Intra']);
  await page.locator('#og-vent-port-intra').click();
  await fillAndBlur(page.locator('#og-vent-length-intra'), '7');
  const after = await focusedPortVents(page);
  expect(after.intra?.length).toBeCloseTo(0.07, 6);
});

test('bandpass6: the rear vent length follows the rear tuning set on the Box tab', async ({page}) => {
  await openVents(page, 'bandpass6');
  await expect(page.locator('#og-vent-length-rear')).toHaveValue(/\d/);
  await page.locator('#og-vent-port-front').click();
  await expect(page.locator('#og-vent-length-front')).toHaveValue(/\d/);
  const before = await focusedPortVents(page);
  expect(before.rear.length).toBeGreaterThan(0);
});
