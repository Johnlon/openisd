/**
 * The phone Save button (T349): a floppy disk at the right end of the top row of every project
 * page. Grey when saved, lit when there are unsaved changes; a tap saves and says "Saved <name>".
 */
import {expect, openAMobileProject, setFocusedBoxVolume, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';

const SIZES = [{ width: 360, height: 740 }, PIXEL_9];

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

test('the Save button is grey when saved, lit after an edit, and a tap saves with a popup', async ({ page }) => {
  const save = page.getByTestId('mob-save');
  await expect(save).toBeVisible();
  await expect(save).not.toHaveClass(/lit/);
  await setFocusedBoxVolume(page, 0.05);
  await expect(save).toHaveClass(/lit/);
  const name = (await page.locator('.mob-topbar .mob-project-title').innerText()).trim();
  await save.click();
  await expect(page.locator('.mob-save-note')).toHaveText(`Saved ${name}`);
  await expect(save).not.toHaveClass(/lit/);
});

test('the Saved popup covers no control', async ({ page }) => {
  await setFocusedBoxVolume(page, 0.05);
  const tabs = page.locator('.mob-tab');
  for (let index = 0; index < await tabs.count(); index++) {
    await tabs.nth(index).click();
    await page.getByTestId('mob-save').click();
    const toast = (await page.locator('.mob-save-note').boundingBox())!;
    for (const control of await page.locator('.mobile-root button:visible, .mobile-root select:visible, .mobile-root input:visible').all()) {
      const c = (await control.boundingBox())!;
      const apart = c.x + c.width <= toast.x || toast.x + toast.width <= c.x || c.y + c.height <= toast.y || toast.y + toast.height <= c.y;
      expect(apart, `a control sits under the popup at ${c.x},${c.y}`).toBe(true);
    }
    await setFocusedBoxVolume(page, 0.05 + index / 100);
  }
});

test('the Save button is not in the menu header or in dialog headers', async ({ page }) => {
  await page.locator('.mob-hamburger').click();
  await expect(page.locator('.mob-menu [data-testid=mob-save]')).toHaveCount(0);
  await page.locator('.mob-menu-item', { hasText: 'Project details' }).click();
  await expect(page.locator('.mob-dlg [data-testid=mob-save]')).toHaveCount(0);
});

for (const size of SIZES) {
  test(`the Save button is fully on screen on every tab at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    const tabs = page.locator('.mob-tab');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < count; i++) {
      await tabs.nth(i).click();
      const save = page.getByTestId('mob-save');
      await expect(save).toBeVisible();
      const box = (await save.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      expect(box.y).toBeGreaterThanOrEqual(0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
    }
  });
}
