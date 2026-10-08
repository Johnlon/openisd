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

test('bandpass6: a Rear and a Front column, no pending note, diameter edits reach only that vent', async ({page}) => {
  await openVents(page, 'bandpass6');
  await expect(page.locator('.vent-col-title')).toHaveText(['Rear', 'Front']);
  await expect(page.locator('section.tab-section.active')).not.toContainText('Response model pending');
  const before = await focusedPortVents(page);
  await fillAndBlur(page.locator('#og-vent-diameter-rear'), '6.5');
  const after = await focusedPortVents(page);
  expect(after.rear.diameter).toBeCloseTo(0.065, 6);
  expect(after.front.diameter).toBe(before.front.diameter);
});

test('abc: Rear, Front and Intra columns; the Intra length is editable and reaches the intra vent', async ({page}) => {
  await openVents(page, 'abc');
  await expect(page.locator('.vent-col-title')).toHaveText(['Rear', 'Front', 'Intra']);
  await fillAndBlur(page.locator('#og-vent-length-intra'), '7');
  const after = await focusedPortVents(page);
  expect(after.intra?.length).toBeCloseTo(0.07, 6);
});

test('bandpass6: the rear vent length follows the rear tuning set on the Box tab', async ({page}) => {
  await openVents(page, 'bandpass6');
  await expect(page.locator('#og-vent-length-rear')).toHaveValue(/\d/);
  await expect(page.locator('#og-vent-length-front')).toHaveValue(/\d/);
  const before = await focusedPortVents(page);
  expect(before.rear.length).toBeGreaterThan(0);
});

/** WinISD's Vents tab per port (capture bp6_abc_wizard_defaults): Number, Shape, Vent diameter,
 *  Vent length, End Correction, Cross area, 1st port resonance. Each must sit fully inside the
 *  bottom panel, not clipped or scrolled away. */
const PORT_CASES: readonly {readonly type: 'bandpass6' | 'abc'; readonly ports: readonly string[]}[] = [
  {type: 'bandpass6', ports: ['rear', 'front']},
  {type: 'abc', ports: ['rear', 'front', 'intra']},
];
for (const {type, ports} of PORT_CASES) {
  test(`${type}: every port column shows all seven fields inside the bottom panel`, async ({page}) => {
    await openVents(page, type);
    const panel = await page.locator('section.tab-section.active').boundingBox();
    expect(panel).not.toBeNull();
    for (const port of ports) {
      const ids = [`#og-vent-count-${port}`, `#og-vent-shape-${port}`, `#og-vent-diameter-${port}`, `#og-vent-length-${port}`];
      const labelled = ['End Correction', 'Cross area', '1st port resonance'];
      const col = page.locator('.vent-col', {has: page.locator(`#og-vent-count-${port}`)});
      const boxes = [];
      for (const id of ids) boxes.push({what: id, box: await page.locator(id).boundingBox()});
      for (const label of labelled) boxes.push({what: `${port} ${label}`, box: await col.locator('.field', {hasText: label}).boundingBox()});
      for (const {what, box} of boxes) {
        expect(box, `${what} is rendered`).not.toBeNull();
        expect(box!.x, `${what} inside panel on the left`).toBeGreaterThanOrEqual(panel!.x);
        expect(box!.x + box!.width, `${what} inside panel on the right`).toBeLessThanOrEqual(panel!.x + panel!.width + 1);
        expect(box!.y + box!.height, `${what} inside panel at the bottom`).toBeLessThanOrEqual(panel!.y + panel!.height + 1);
      }
    }
  });
}
