/**
 * Visual regression tests — SPL graph panel.
 *
 * These tests take a screenshot of the SPL response panel for each box type and
 * compare it against a committed baseline. They catch:
 *   - Canvas rendering regressions (blank graph, wrong scale, missing curves)
 *   - CSS layout breakage in the graph area
 *   - Gross numerical regressions (a curve that shifts 20 dB is visible)
 *
 * Fine numerical regressions (sub-dB) are caught by test/golden.test.mjs instead.
 *
 * ── Baseline management ────────────────────────────────────────────────────────
 * Baselines live in test/visual.browser.spec.js-snapshots/ and are committed.
 * When a visual change is intentional:
 *   npm run test:visual -- --update-snapshots
 * Review the diff (git diff), confirm the change is correct, then commit.
 *
 * ── Pixel tolerance ────────────────────────────────────────────────────────────
 * Canvas anti-aliasing can cause up to ~1% of pixels to differ slightly across
 * platform builds. SNAPSHOT_DIFF_RATIO allows for this without masking real regressions.
 *
 * ── Stability ─────────────────────────────────────────────────────────────────
 * Screenshots are taken AFTER the stat bar shows a known computed value, which
 * proves both the physics sweep and the Vue reactive chain have completed. The
 * canvas redraws on the same reactive tick (flush: 'post'), so by the time
 * the stat bar assertion passes, the canvas is already painted.
 */

import { test, expect } from './fixtures.js';
import type { Page } from '@playwright/test';

// Fixed viewport for all visual tests — pixel-exact comparison requires a stable size
test.use({ viewport: { width: 1440, height: 900 } });

// Pixel tolerance: up to 2% of pixels may differ (canvas anti-aliasing across builds)
const SNAPSHOT_DIFF_RATIO = 0.02;

// Reference driver — same as app.browser.spec.js reference driver
const DRV_FS_HZ = 37;
const DRV_QTS   = 0.38;
const DRV_VAS_L = 30;

// Helper: locate a NumInput's <input> by the text of its paired <label>
function numInputByLabel(page: Page, labelText: string) {
  return page.locator('label')
    .filter({ hasText: labelText })
    .locator('..')
    .locator('input[type="number"]');
}

// Helper: locate the SPL graph panel by its title text
function splPanel(page: Page) {
  return page.locator('.gpanel').filter({
    has: page.locator('.gtitle', { hasText: 'SPL response' }),
  });
}

// Helper: set the reference driver T/S params via the edit panel
async function setReferenceDriver(page: Page) {
  await page.locator('text=What-If? ✎').click();
  await numInputByLabel(page, 'Fs').fill(String(DRV_FS_HZ));
  await numInputByLabel(page, 'Fs').press('Tab');
  const qtsInput = numInputByLabel(page, 'Qts');
  await qtsInput.fill(String(DRV_QTS));
  await qtsInput.press('Tab');
  const vasInput = numInputByLabel(page, 'Vas');
  await vasInput.fill(String(DRV_VAS_L));
  await vasInput.press('Tab');
}

// ── Box-type visual tests ────────────────────────────────────────────────────

// Sealed 20L — Qtc shown in stat bar proves sweep ran before screenshot
const SEALED_VB_L = 20;
const SEALED_QTC  = '0.601'; // Qts × √(1 + Vas/Vb) = 0.38 × √2.5 = 0.601

test('SPL panel renders correctly for sealed 20L box', async ({ page }) => {
  await page.goto('/');
  await setReferenceDriver(page);
  await page.locator('#boxtype').selectOption('sealed');
  await numInputByLabel(page, 'Box volume Vb').fill(String(SEALED_VB_L));
  await numInputByLabel(page, 'Box volume Vb').press('Tab');

  // Wait for sweep to complete — stat bar showing Qtc proves the reactive chain ran
  await expect(page.locator('#stat')).toContainText(`Qtc: ${SEALED_QTC}`);
  await expect(splPanel(page)).toHaveScreenshot('sealed-spl.png', {
    maxDiffPixelRatio: SNAPSHOT_DIFF_RATIO,
  });
});

// Vented 30L, 5cm × 10cm port — Fb shown in stat bar proves sweep ran
const VENTED_VB_L    = 30;
const VENT_DIAM_CM   = 5;
const VENT_LENGTH_CM = 10;
const VENTED_FB_HZ   = '37.1';

test('SPL panel renders correctly for vented 30L box with ø5cm×10cm port', async ({ page }) => {
  await page.goto('/');
  await setReferenceDriver(page);
  await page.locator('#boxtype').selectOption('vented');
  await numInputByLabel(page, 'Box volume Vb').fill(String(VENTED_VB_L));
  await numInputByLabel(page, 'Box volume Vb').press('Tab');
  await numInputByLabel(page, 'Vent diameter').fill(String(VENT_DIAM_CM));
  await numInputByLabel(page, 'Vent diameter').press('Tab');
  await numInputByLabel(page, 'Vent length').fill(String(VENT_LENGTH_CM));
  await numInputByLabel(page, 'Vent length').press('Tab');

  await expect(page.locator('#stat')).toContainText(`Fb: ${VENTED_FB_HZ} Hz`);
  await expect(splPanel(page)).toHaveScreenshot('vented-spl.png', {
    maxDiffPixelRatio: SNAPSHOT_DIFF_RATIO,
  });
});

// Bandpass4 15L rear + 20L front + ø5cm×10cm port — peak port proves sweep ran
const BP4_REAR_VB_L    = 15;
const BP4_FRONT_VF_L   = 20;
const BP4_VENT_DIAM_CM = 5;
const BP4_VENT_LEN_CM  = 10;

test('SPL panel renders correctly for bandpass4 15L+20L box', async ({ page }) => {
  await page.goto('/');
  await setReferenceDriver(page);
  await page.locator('#boxtype').selectOption('bandpass4');
  await numInputByLabel(page, 'Box volume Vb').fill(String(BP4_REAR_VB_L));
  await numInputByLabel(page, 'Box volume Vb').press('Tab');
  await numInputByLabel(page, 'Front chamber Vf').fill(String(BP4_FRONT_VF_L));
  await numInputByLabel(page, 'Front chamber Vf').press('Tab');
  await numInputByLabel(page, 'Vent diameter').fill(String(BP4_VENT_DIAM_CM));
  await numInputByLabel(page, 'Vent diameter').press('Tab');
  await numInputByLabel(page, 'Vent length').fill(String(BP4_VENT_LEN_CM));
  await numInputByLabel(page, 'Vent length').press('Tab');

  await expect(page.locator('#stat')).toContainText('peak port:');
  await expect(splPanel(page)).toHaveScreenshot('bandpass4-spl.png', {
    maxDiffPixelRatio: SNAPSHOT_DIFF_RATIO,
  });
});

// Passive radiator 30L, Fp=37.9Hz — Fp in stat bar proves sweep ran
const PR_VB_L     = 30;
const PR_SD_CM2   = 133;
const PR_MMS_G    = 50;
const PR_CMS_MMPN = 0.5;
const PR_RMS_KGS  = 1.0;
const PR_FP_HZ    = '37.9';

test('SPL panel renders correctly for passive radiator 30L box', async ({ page }) => {
  await page.goto('/');
  // No setReferenceDriver here — Fp depends only on box+PR params, not driver T/S.
  // Keeping the driver panel closed avoids a locator conflict: both driver and PR
  // panels expose an 'Sd' label, and numInputByLabel('Sd') would be ambiguous.
  await page.locator('#boxtype').selectOption('pr');
  await numInputByLabel(page, 'Box volume Vb').fill(String(PR_VB_L));
  await numInputByLabel(page, 'Box volume Vb').press('Tab');

  await page.locator('[title="Click to edit passive radiator parameters"]').click();
  const modeSelect = page.locator('label')
    .filter({ hasText: 'Input mode' })
    .locator('..')
    .locator('select');
  await modeSelect.selectOption('ts');
  await numInputByLabel(page, 'Sd').fill(String(PR_SD_CM2));
  await numInputByLabel(page, 'Sd').press('Tab');
  await numInputByLabel(page, 'Mms').fill(String(PR_MMS_G));
  await numInputByLabel(page, 'Mms').press('Tab');
  await numInputByLabel(page, 'Cms').fill(String(PR_CMS_MMPN));
  await numInputByLabel(page, 'Cms').press('Tab');
  await numInputByLabel(page, 'Rms').fill(String(PR_RMS_KGS));
  await numInputByLabel(page, 'Rms').press('Tab');
  await numInputByLabel(page, 'Added mass').fill('0');
  await numInputByLabel(page, 'Added mass').press('Tab');

  await expect(page.locator('#stat')).toContainText(`Fp: ${PR_FP_HZ} Hz`);
  await expect(splPanel(page)).toHaveScreenshot('pr-spl.png', {
    maxDiffPixelRatio: SNAPSHOT_DIFF_RATIO,
  });
});
