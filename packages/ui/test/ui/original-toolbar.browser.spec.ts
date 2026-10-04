import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {COMPLETE_DRIVER_PROJECT_OWPR, expect, openAProject, test} from '../fixtures.js';
import {fillAndBlur} from '../fixtures/numField.js';

// The build (scripts/version-info.mjs → packages/ui/public/build-info.json) is the on-disk source
// of truth for the toolbar version. The dev/preview server serves THAT file at /build-info.json,
// so this assertion proves the app shows exactly what the last build wrote.
const BUILD_INFO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'build-info.json');

/** Widths a browser window realistically reaches; the toolbar must never overlap at any. */
const WIDTHS = [1280, 1024, 900, 780];

function isBuildInfo(v: unknown): v is { version: string } {
  return typeof v === 'object' && v !== null && 'version' in v && typeof v.version === 'string';
}

function readBuildInfo(): { version: string } {
  const parsed: unknown = JSON.parse(readFileSync(BUILD_INFO, 'utf8'));
  if (!isBuildInfo(parsed)) throw new Error(`build-info.json has no string "version": ${JSON.stringify(parsed)}`);
  return parsed;
}

test.describe('Original toolbar', () => {
  test('toolbar shows the exact version stored in build-info.json', async ({ page }) => {
    const onDisk = readBuildInfo();
    expect(onDisk.version).toMatch(/^v\d{8}T\d{6}Z$/);

    await page.goto('/');
    await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);

    const brand = page.locator('.app-brand');
    await expect(brand).toContainText('OpenISD');
    await expect(brand.locator('.version-chip')).toHaveText(`(${onDisk.version})`);
    // The brand icon renders either from the public /icon.svg or inline as a data-URI SVG
    // (the shell embeds the loudspeaker mark directly) — assert the icon exists and is SVG.
    await expect(brand.locator('img')).toHaveAttribute('src', /^data:image\/svg\+xml|\/icon\.svg$/);

    // Layout contract: one row — window buttons and chart menu left, then the version, then
    // the frequency selector right, none painting over another. A version stranded on its own
    // row is a regression. (John 2026-09-29: the version need not be centred — the chart menu
    // is wider than half the bar at 1280 px, so centring it overlapped the icons.)
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
    page.on('dialog', (d) => d.accept().catch(() => {}));
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

    // 4. Name should revert back to original
    await expect(nameInput).toHaveValue(originalName);
    await expect(revertBtn).toHaveClass(/disabled/);
  });

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
