import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {COMPLETE_DRIVER_PROJECT_OWPR, expect, focusedBoxVolume, openAProject, setFocusedBoxVolume, test} from '../fixtures.js';
import {fillAndBlur} from '../fixtures/numField.js';

// The build (scripts/version-info.mjs → packages/ui/public/build-info.json) is the on-disk source
// of truth for the published version. In dev mode (vite serve), the app shows a dev version
// (git sha + dirty state) instead, since build-info.json is rewritten on every build and does
// not describe the running dev server code.
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

async function computeExpectedPublishedLabel(page: import('@playwright/test').Page, version: string): Promise<string> {
  return page.evaluate((ver) => {
    const match = /^v?(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(ver);
    if (!match) return ver;
    const d = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6]));
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mon = months[d.getMonth()];
    const day = String(d.getDate()).padStart(2, '0');
    const hr = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${mon} ${day} ${hr}:${min}`;
  }, version);
}

test.describe('Original toolbar', () => {
  test('toolbar shows the correct version for the running environment', async ({ page }) => {
    const onDisk = readBuildInfo();
    expect(onDisk.version).toMatch(/^v\d{8}T\d{6}Z$/);

    await page.goto('/');
    await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);

    const brand = page.locator('.app-brand');
    await expect(brand).toContainText('OpenISD');

    // In dev mode (vite serve), the version chip shows "dev <sha> + changes" format.
    // In production, it shows the published version from build-info.json in browser local time.
    const versionChip = brand.locator('.version-chip');
    const expectedPublished = await computeExpectedPublishedLabel(page, onDisk.version);
    const escaped = expectedPublished.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(versionChip).toHaveText(new RegExp(`^(?:\\(dev [a-f0-9]{7,8}(?: \\+ changes)?\\)|\\(${escaped}\\))$`));
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
