/**
 * The consistency-group DQ mark — workspace ledger QP18 and openisd ledger QO13's sibling
 * QO12, one mechanism for both rulings:
 *
 *   "show a dq next to any field in a group that has lost consistency"          (QP18)
 *   "if this causes dq error then please add dq note at side of affected fields" (QO12)
 *
 * What these tests pin: the mark lands on EVERY member of the group, it carries a tooltip
 * naming the group and the size of the disagreement, a consistent driver has none, and it
 * blocks nothing.
 */
import { test, expect } from '../fixtures.js';
import type { Page } from '@playwright/test';

// Mms typed as 30 g on the demo driver — the exact repro recorded in QO12. Fs stays entered
// at 37 Hz, Cms stays computed from Vas and Sd, and the three can no longer be reconciled:
// Fs implied by Mms and Cms is ~26.6 Hz.
const IMPOSSIBLE_MMS_G = '30';

async function openTune(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await page.locator('.skin-picker select').selectOption('original');
  await page.locator('.original-root').waitFor({ state: 'visible' });
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.edit-btn', { hasText: 'Tune' }).click();
  await expect(page.locator('.tune-panel')).toBeVisible();
}

const tuneField = (page: Page, label: string) =>
  page.locator('.tune-panel .tune-fld').filter({ has: page.locator('label', { hasText: new RegExp(`^${label}$`) }) });

async function openEditorParameters(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await page.locator('.skin-picker select').selectOption('original');
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.edit-btn', { hasText: 'Edit' }).click();
  await expect(page.locator('.de-modal')).toBeVisible();
  await page.getByRole('button', { name: 'Parameters', exact: true }).click();
}

const editorField = (page: Page, label: string) =>
  page.locator('.de-modal .de-fld', { has: page.locator('label', { hasText: new RegExp(`^${label}\\b`) }) });

// ── The driver editor ─────────────────────────────────────────────────────────────────────
test('driver editor: an inconsistent group marks every one of its members, with an actionable tooltip', async ({ page }) => {
  await openEditorParameters(page);

  // The demo driver reconciles, so nothing is marked to begin with — a mark on every driver
  // would be wallpaper, and the whole point is that it means something.
  for (const f of ['Fs', 'Mms', 'Cms']) {
    await expect(editorField(page, f).locator('.de-dq')).toHaveCount(0);
  }

  const mms = editorField(page, 'Mms').locator('input').first();
  await mms.click();
  await mms.press('Control+a');
  await mms.pressSequentially(IMPOSSIBLE_MMS_G);
  await mms.blur();

  // Fs, Mms AND Cms — the group is the unit, not the field that was typed.
  for (const f of ['Fs', 'Mms', 'Cms']) {
    await expect(editorField(page, f).locator('.de-dq')).toHaveCount(1);
  }

  // The tooltip names the group and how far out it is; "inconsistent" alone is not actionable.
  const note = await editorField(page, 'Fs').locator('.de-dq').getAttribute('title');
  expect(note).toContain('Fs');
  expect(note).toContain('Mms');
  expect(note).toContain('Cms');
  expect(note).toMatch(/disagree by \d/);
  expect(note).toContain('Fs = 1/(2π·√(Mms·Cms))');

  // A field outside the group is NOT marked.
  await expect(editorField(page, 'Re').locator('.de-dq')).toHaveCount(0);

  // Nothing is blocked — the ruling was a mark, not a gate.
  await expect(page.locator('.de-modal .de-footer button:has-text("OK")')).toBeEnabled();
  await expect(page.locator('.de-modal .de-footer button:has-text("Save")')).toBeEnabled();
});

// ── The Original skin's docked What-If panel ──────────────────────────────────────────────
test('Tune what-if: the same mark appears on every member of the group as the driver is scrubbed', async ({ page }) => {
  await openTune(page);

  await expect(page.locator('.tune-panel .de-dq')).toHaveCount(0);

  const mms = tuneField(page, 'Mms').locator('input');
  await mms.click();
  await mms.press('Control+a');
  await mms.pressSequentially(IMPOSSIBLE_MMS_G);
  await mms.blur();

  // Fs and Mms are both on this panel and both carry it. (Cms is a member too, but the Tune
  // panel does not show Cms — a mark can only appear beside a field that is on screen.)
  await expect(tuneField(page, 'Fs').locator('.de-dq')).toHaveCount(1);
  await expect(tuneField(page, 'Mms').locator('.de-dq')).toHaveCount(1);
  await expect(tuneField(page, 'Re').locator('.de-dq')).toHaveCount(0);

  const dqIcon = tuneField(page, 'Mms').locator('.de-dq');
  const tooltip = page.locator('body > .dq-tooltip-box-Mms');
  await dqIcon.hover();
  await expect(tooltip).toBeVisible();
  const note = await tooltip.textContent();
  expect(note).toMatch(/disagree by \d/);

  // Withdrawing the override hands Mms back to the calculation, and the group reconciles again.
  await mms.click();
  await mms.press('Control+a');
  await mms.press('Delete');
  await mms.blur();
  await expect(page.locator('.tune-panel .de-dq')).toHaveCount(0);
});

// ── The Classic skin's inline What-If panel ───────────────────────────────────────────────
test('Classic what-if: the mark is the same one, from the same model', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await page.locator('.skin-picker select').selectOption('classic');
  await page.locator('.cl-whatif').click();
  const dep = page.locator('.dep');
  await expect(dep).toBeVisible();
  await expect(dep.locator('.de-dq')).toHaveCount(0);

  const row = (label: string) => dep.locator('.row').filter({ has: page.locator('label', { hasText: new RegExp(`^${label}`) }) });
  const mms = row('Mms').locator('input');
  await mms.click();
  await mms.press('Control+a');
  await mms.pressSequentially(IMPOSSIBLE_MMS_G);
  await mms.blur();

  await expect(row('Fs').locator('.de-dq')).toHaveCount(1);
  await expect(row('Mms').locator('.de-dq')).toHaveCount(1);
});

test('Tune what-if: hovering or clicking the alert icon displays the custom formatted tooltip', async ({ page }) => {
  await openTune(page);

  const mms = tuneField(page, 'Mms').locator('input');
  await mms.click();
  await mms.press('Control+a');
  await mms.pressSequentially(IMPOSSIBLE_MMS_G);
  await mms.blur();

  const dqIcon = tuneField(page, 'Mms').locator('.de-dq');
  await expect(dqIcon).toBeVisible();

  // Tooltip box should not be visible initially
  const tooltip = page.locator('body > .dq-tooltip-box-Mms');
  await expect(tooltip).toBeHidden();

  // Hovering should show the tooltip
  await dqIcon.hover();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('disagree by');

  // Verify bounding box is fully visible within viewport boundaries
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  const box = await tooltip.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);

  // Mouse leave should hide it
  await page.locator('.tune-panel .tune-titlebar').hover(); // Hover elsewhere
  await expect(tooltip).toBeHidden();

  // Clicking should toggle the tooltip
  await dqIcon.click();
  await expect(tooltip).toBeVisible();

  // Clicking outside should close it
  await page.locator('.tune-panel .tune-titlebar').click();
  await expect(tooltip).toBeHidden();
});

test('Classic what-if: hovering or clicking the alert icon displays the custom formatted tooltip', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await page.locator('.skin-picker select').selectOption('classic');
  await page.locator('.cl-whatif').click();
  
  const dep = page.locator('.dep');
  await expect(dep).toBeVisible();

  const row = (label: string) => dep.locator('.row').filter({ has: page.locator('label', { hasText: new RegExp(`^${label}`) }) });
  const mms = row('Mms').locator('input');
  await mms.click();
  await mms.press('Control+a');
  await mms.pressSequentially(IMPOSSIBLE_MMS_G);
  await mms.blur();

  const dqIcon = row('Mms').locator('.de-dq');
  await expect(dqIcon).toBeVisible();

  const tooltip = page.locator('body > .dq-tooltip-box-Mms');
  await expect(tooltip).toBeHidden();

  // Hover
  await dqIcon.hover();
  await expect(tooltip).toBeVisible();

  // Verify bounding box is fully visible within viewport boundaries
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  const box = await tooltip.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);

  // Mouse leave
  await dep.locator('.subsect', { hasText: 'Box' }).hover();
  await expect(tooltip).toBeHidden();

  // Click
  await dqIcon.click();
  await expect(tooltip).toBeVisible();

  // Click outside
  await dep.locator('.subsect', { hasText: 'Box' }).click();
  await expect(tooltip).toBeHidden();
});
