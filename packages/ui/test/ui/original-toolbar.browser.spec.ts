import {COMPLETE_DRIVER_PROJECT_OWPR, expect, focusedBoxVolume, openAProject, setFocusedBoxVolume, test} from '../fixtures.js';
import {fillAndBlur} from '../fixtures/numField.js';
import {enableCloudSync, stubGoogleApis} from './fixtures/cloudSyncStubs.js';

const WIDTHS = [1280, 1024, 900, 780];

test.describe('Original toolbar', () => {
  test('the toolbar carries the brand, no version, and its groups sit in one row', async ({ page }) => {
    await page.goto('/');
    await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);

    const brand = page.locator('.app-brand');
    await expect(brand).toContainText('OpenISD');

    // The version lives in About, not the toolbar.
    await expect(page.locator('.version-chip')).toHaveCount(0);
    // The brand icon renders either from the public /icon.svg or inline as a data-URI SVG
    // (the shell embeds the loudspeaker mark directly) — assert the icon exists and is SVG.
    await expect(brand.locator('img')).toHaveAttribute('src', /^data:image\/svg\+xml|\/icon\.svg$/);

    // Layout contract: one row — window buttons and chart menu left, then the brand, then the
    // frequency selector right, none painting over another.
    const barBox = await page.locator('.toolbar').boundingBox();
    expect(barBox!.height).toBeLessThan(60);
    const brandBox = await brand.boundingBox();
    const icons = await page.locator('.tb-icons').boundingBox();
    const readout = await page.locator('.cursor-readout').boundingBox();
    const menu = await page.locator('.chart-select').boundingBox();
    expect(menu!.x + menu!.width).toBeLessThanOrEqual(icons!.x + icons!.width + 1);
    expect(icons!.x + icons!.width).toBeLessThanOrEqual(brandBox!.x);
    expect(brandBox!.x + brandBox!.width).toBeLessThanOrEqual(readout!.x);
  });

  test('the toolbar carries WinISD\'s icon buttons + chart-select', async ({ page }) => {
    await page.goto('/');
    await openAProject(page);
    // Toolbar: 9 icon controls (.tb-btn) — Open, New, Save, Save all, Revert, Save-As/Export,
    // Manage Drivers, Options, Info — plus the .chart-select control.
    await expect(page.locator('.toolbar .tb-btn')).toHaveCount(9);
    await expect(page.locator('.toolbar .chart-select .chart-name')).toBeVisible();
  });

  test('Revert is disabled until the project is modified, then restores the saved state', async ({ page }) => {
    await page.goto('/');
    await openAProject(page);
    // 1. Click Revert button when not modified (should be disabled)
    const revertBtn = page.locator('.tb-btn[title^="Revert"]');
    await expect(revertBtn).toHaveClass(/disabled/);

    // 2. Modify project name
    await page.locator('.project-nav li', { hasText: 'Project' }).click();
    const nameInput = page.locator('.tab-section.active .field', { hasText: 'Name' }).locator('input');
    const originalName = await nameInput.inputValue();
    await fillAndBlur(nameInput, 'Temp Modified Name');

    // 3. Revert button should be enabled, click it!
    await expect(revertBtn).not.toHaveClass(/disabled/);
    await revertBtn.click();

    // 4. In-app dialog should appear, click Discard
    await expect(page.locator('.confirm-overlay')).toBeVisible();
    await page.locator('.confirm-dialog-confirm').click();
    await expect(page.locator('.confirm-overlay')).toHaveCount(0);

    // 5. Name should revert back to original
    await expect(nameInput).toHaveValue(originalName);
    await expect(revertBtn).toHaveClass(/disabled/);
  });

  test('a reload keeps unsaved edits unsaved, and Revert still restores the saved value', async ({ page }) => {
    await page.goto('/');
    await openAProject(page);
    const saved = await focusedBoxVolume(page);
    await setFocusedBoxVolume(page, 0.0333333);
    const revertBtn = page.locator('.tb-btn[title^="Revert"]');
    await expect(revertBtn).not.toHaveClass(/disabled/);
    // The open-session record is written on a change; wait for it before reloading.
    await expect.poll(() => page.evaluate(() => localStorage.getItem('openisd_open_sessions') ?? '')).toContain('0.0333333');

    await page.reload();

    await expect(page.locator('.unsaved-label')).toBeVisible();
    await expect(revertBtn).not.toHaveClass(/disabled/);
    expect(await focusedBoxVolume(page)).toBeCloseTo(0.0333333, 9);
    await revertBtn.click();

    // In-app dialog should appear, click Discard
    await expect(page.locator('.confirm-overlay')).toBeVisible();
    await page.locator('.confirm-dialog-confirm').click();
    await expect(page.locator('.confirm-overlay')).toHaveCount(0);

    await expect.poll(() => focusedBoxVolume(page)).toBeCloseTo(saved, 9);
    await expect(revertBtn).toHaveClass(/disabled/);
  });

  for (const [width, menuWidth] of [[1280, 180], [1439, 180], [1440, 270], [1880, 270]] as const) {
    test(`the toolbar never overflows at ${width}px wide, with every chart open and cloud sync on, and the chart menu is ${menuWidth}px`, async ({ page }) => {
      await enableCloudSync(page);
      await stubGoogleApis(page);
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await openAProject(page);
      // The widest chart name: every chart ticked, so the label is as long as it gets.
      await page.locator('.chart-select').click();
      const ticks = page.locator('.chart-select .chart-item input[type=checkbox]');
      for (let i = 0, n = await ticks.count(); i < n; i++) {
        await ticks.nth(i).check();
      }
      await page.locator('.original-root').click({ position: { x: 5, y: 300 } });

      const bar = await page.locator('.toolbar').evaluate(e => ({ scroll: e.scrollWidth, client: e.clientWidth }));
      expect(bar.scroll).toBe(bar.client);
      const lastButton = await page.locator('.toolbar button').last().boundingBox();
      expect(lastButton!.x + lastButton!.width).toBeLessThanOrEqual(width);
      expect(lastButton!.x).toBeGreaterThanOrEqual(0);
      expect((await page.locator('.chart-select').boundingBox())!.width).toBe(menuWidth);
    });
  }

  test.describe('window widths', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await openAProject(page);
    });

    for (const width of [1400, ...WIDTHS]) {
      test(`the toolbar's icons, brand and cursor readout never overlap at ${width}px wide`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const boxes = await page.evaluate(() =>
          ['.tb-icons', '.app-brand', '.cursor-readout'].map(s => {
            const r = document.querySelector(s)!.getBoundingClientRect();
            return { s, l: r.left, r: r.right, t: r.top, b: r.bottom };
          }));
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i], b = boxes[j];
            const w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
            expect(w > 1 && h > 1, `${a.s} overlaps ${b.s}`).toBe(false);
          }
        }
        // The chart menu sits inside its own group, not spilling over the brand.
        const [menu, icons] = await Promise.all(['.chart-select', '.tb-icons'].map(s =>
          page.locator(s).evaluate(e => e.getBoundingClientRect().right)));
        expect(menu).toBeLessThanOrEqual(icons + 1);
      });
    }
  });
});
