import {COMPLETE_DRIVER_PROJECT_OWPR, expect, openAProject, setFocusedBoxType, test} from '../fixtures.js';
import {setPortShapes} from '../fixtures/portShape.js';
import {measureFieldLayoutRules} from '../fixtures/fieldLayoutAudit.js';

/** QO429.c4: each desktop port column has "Number of ports" on the left of row 2 and one toggle button on its right: a drawn picture and the word Round or Slotted. */
for (const {box, tab, columns} of [{box: 'abc', tab: 'ABC', columns: 3}, {box: 'bandpass6', tab: '6th Order Bandpass', columns: 2}, {box: 'vented', tab: 'Vented', columns: 1}] as const) {
  test(`${box}: clicking the picture then the word toggles the port shape in every column`, async ({page}) => {
    await page.setViewportSize({width: 1280, height: 720});
    await page.goto('/');
    await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
    await setFocusedBoxType(page, box);
    await page.locator('.project-nav li').filter({hasText: new RegExp(`^${tab}$`)}).click();
    const cols = page.locator('.tab-section.active .vent-col');
    await expect(cols).toHaveCount(columns);
    await expect(page.locator('.tab-section.active select[id*="vent-shape"]')).toHaveCount(0);
    for (let i = 0; i < columns; i++) {
      const col = cols.nth(i);
      const toggle = col.locator('button.port-shape-toggle');
      await expect(toggle).toHaveText('Round');
      await expect(toggle).toHaveAttribute('aria-label', /Round/);
      await expect(toggle.locator('svg circle')).toHaveCount(1);
      await expect(col.locator('[data-field="vent_D_cm"]')).toHaveCount(1);
      await toggle.locator('svg').click();
      await expect(toggle).toHaveText('Slotted');
      await expect(toggle.locator('svg rect')).toHaveCount(1);
      await expect(col.locator('[data-field="vent_W_cm"]')).toHaveCount(1);
      await expect(col.locator('[data-field="vent_H_cm"]')).toHaveCount(1);
      await expect(col.locator('[data-field="vent_D_cm"]')).toHaveCount(0);
      await toggle.getByText('Slotted').click();
      await expect(toggle).toHaveText('Round');
      await expect(col.locator('[data-field="vent_D_cm"]')).toHaveCount(1);
      await expect(col.locator('[data-field="vent_W_cm"]')).toHaveCount(0);
    }
  });

  for (const shape of ['round', 'slotted'] as const) test(`${box} ${shape}: the count and the toggle share row 2, inside the column, nothing clipped`, async ({page}) => {
    await page.setViewportSize({width: 1280, height: 720});
    await page.goto('/');
    await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
    await setFocusedBoxType(page, box);
    await page.locator('.project-nav li').filter({hasText: new RegExp(`^${tab}$`)}).click();
    const cols = page.locator('.tab-section.active .vent-col');
    await setPortShapes(page, shape);
    for (let i = 0; i < columns; i++) {
      const col = cols.nth(i);
      const colBox = (await col.boundingBox())!, countBox = (await col.locator('select[id*="vent-count"]').boundingBox())!;
      const toggle = (await col.locator('button.port-shape-toggle').boundingBox())!;
      expect(Math.abs((toggle.y + toggle.height / 2) - (countBox.y + countBox.height / 2))).toBeLessThanOrEqual(1);
      expect(toggle.x).toBeGreaterThanOrEqual(countBox.x + countBox.width);
      expect(toggle.x + toggle.width).toBeLessThanOrEqual(colBox.x + colBox.width - 1);
      expect(toggle.height).toBe(countBox.height);
      const endCorrection = (await col.locator('.field > select:not([id])').boundingBox())!;
      expect(endCorrection.height).toBe(countBox.height);
    }
    expect(await page.locator('.content-panel').evaluate(measureFieldLayoutRules, 0)).toEqual([]);
    const size = await page.locator('.tab-section.active').evaluate(node => ({width: node.clientWidth, scroll: node.scrollWidth}));
    expect(size.scroll).toBeLessThanOrEqual(size.width);
  });
}

test('the port shape toggle works from the keyboard', async ({page}) => {
  await page.setViewportSize({width: 1280, height: 720});
  await page.goto('/');
  await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await setFocusedBoxType(page, 'vented');
  await page.locator('.project-nav li').filter({hasText: /^Vented$/}).click();
  const toggle = page.locator('.tab-section.active button.port-shape-toggle');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveText('Slotted');
  await page.keyboard.press('Space');
  await expect(toggle).toHaveText('Round');
});
