import {expect, openAProject, test} from '../fixtures.js';
import type {Page} from '@playwright/test';

import {COMPLETE_DRIVER_PROJECT_OWPR, ensureSampleProject} from '../fixtures/sampleProject.js';

ensureSampleProject();
const COMPLETE = COMPLETE_DRIVER_PROJECT_OWPR;

async function readVb(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const modPath = '/src/logic/appState.ts';
    const s = await import(/* @vite-ignore */ modPath);
    const project = s.focusedProject();
    if (!project) throw new Error('expected a focused project');
    // The sample fixture is VENTED, the complete-driver one is sealed, so read whichever box
    // type the project actually is. Every field answers through `.value`; vented's can be null
    // where sealed's cannot, so only that one needs the check.
    if (project.box.boxType.value === 'vented') {
      const v = project.box.vented.volume_m3.value;
      if (v === null) throw new Error('vented volume is not available');
      return v;
    }
    return project.box.sealed.volume_m3.value;
  });
}

/** Open the Original skin's docked Tune panel on a clean slate. */
async function openTune(page: Page) {
  await page.goto('/');
  await openAProject(page, COMPLETE);
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.edit-btn', { hasText: 'What-if' }).click();
  const tune = page.locator('.tune-panel');
  await expect(tune).toBeVisible();
  return tune;
}

const tuneField = (page: Page, label: string) =>
  page.locator('.tune-panel .tune-fld').filter({ has: page.locator('label', { hasText: new RegExp(`^${label}$`) }) });

// ── QO11.1 — a calculated field is editable, and clearing hands it back ────────────────────
// State transitions themselves (calculated → entered → calculated, and the g→kg-equivalent
// numeric value landing in the model) are covered by OgTune-hooks.test.ts; this proves only
// that the DOM reflects that state via its value-c/value-e class.
test('QO11.1 Tune: Mms and Bl are editable and override the calculation; clearing returns them to Calculated', async ({ page }) => {
  await openTune(page);

  const mms = tuneField(page, 'Mms').locator('input');
  await expect(mms).toBeVisible();
  await expect(mms).toBeEditable();

  // Untouched, Mms is derived from the T/S set → Calculated.
  await expect(mms).toHaveClass(/value-c/);

  // Typing one makes it Entered.
  await mms.click();
  await mms.press('Control+a');
  await mms.pressSequentially('12.5');
  await expect(mms).toHaveClass(/value-e/);

  // Clearing withdraws the override — the field goes back to being calculated.
  await mms.press('Control+a');
  await mms.press('Delete');
  await expect(mms).toHaveClass(/value-c/);

  // Bl behaves the same way — it is a driver field, not a read-only output.
  const bl = tuneField(page, 'Bl').locator('input');
  await expect(bl).toBeEditable();
  await bl.click();
  await bl.press('Control+a');
  await bl.pressSequentially('9.5');
  await expect(bl).toHaveClass(/value-e/);
});

// ── QO11.2 — fields are sized to their content, not stretched to the column ────────────────
test('QO11.2 Tune: numeric fields are narrow and uniform, not stretched to fill the column', async ({ page }) => {
  await openTune(page);
  const widths = await page.locator('.tune-panel .tune-unit input').evaluateAll(
    els => els.map(e => Math.round(e.getBoundingClientRect().width)));
  expect(widths.length).toBeGreaterThan(8);
  // One width for the whole panel — a field that sizes to its container instead of its content
  // would vary with the column it landed in.
  expect(new Set(widths).size).toBe(1);
  expect(widths[0]).toBeLessThanOrEqual(90);
  // ...and genuinely narrower than the cell holding it, i.e. leftover whitespace exists.
  const cellW = await page.locator('.tune-panel .tune-fld').first().evaluate(e => e.getBoundingClientRect().width);
  expect(widths[0]).toBeLessThan(cellW);
});

// ── QO11.3 — the Q trio solves itself, and says which of the three it is short of ──────────
test('QO11.3 Tune: a blank Q autocalculates from the other two, with the editor E/C/N marks and red border', async ({ page }) => {
  const tune = await openTune(page);
  const qts = tuneField(page, 'Qts').locator('input');
  const qes = tuneField(page, 'Qes').locator('input');
  const qms = tuneField(page, 'Qms').locator('input');

  // All three entered to begin with.
  await expect(qms).toHaveClass(/value-e/);

  // Clear Qms: the other two still solve it, so it fills itself in — marked Calculated, and
  // NOT flagged, because the group is complete. (While the caret is still in the field the
  // raw keystrokes are echoed back deliberately, so the solved value appears once focus
  // leaves — the same caret-safe buffer every field on this panel uses.)
  await qms.click();
  await qms.press('Control+a');
  await qms.press('Delete');
  // Qms's calculated/not-available transitions themselves are covered by
  // OgTune-hooks.test.ts; here we only need the DOM to reflect it after blur.
  await qms.blur();
  await expect(qms).toHaveClass(/value-c/);
  await expect(qms).not.toHaveClass(/de-input-empty/);
  await expect(qms).not.toHaveValue('');

  // It keeps tracking the other two: change Qes and the solved Qms follows.
  const before = await qms.inputValue();
  await qes.click();
  await qes.press('Control+a');
  await qes.pressSequentially('0.55');
  await expect(qms).not.toHaveValue(before);

  // Clear Qes again: the solver does not use a calculated Qms as a new stated input, so both
  // dependent fields become unavailable while the entered Qts remains visible.
  await qes.press('Control+a');
  await qes.press('Delete');
  await qes.blur();
  await expect(qes).toHaveClass(/value-n/);
  await expect(qes).toHaveValue('');
  await expect(qts).toHaveClass(/value-e/);
  await expect(qms).toHaveClass(/value-n/);
  await expect(qms).toHaveValue('');
  await expect(tune).toBeVisible();
});

// ── QO11.4 — the box volume is on the panel ───────────────────────────────────────────────
test('QO11.4 Tune: box volume is on the panel, drives the same state, and Cancel puts it back', async ({ page }) => {
  const tune = await openTune(page);
  const vb = tuneField(page, 'Vb').locator('input');
  await expect(vb).toBeVisible();

  const before = await readVb(page);
  await vb.click();
  await vb.press('Control+a');
  await vb.pressSequentially('42');
  expect(await readVb(page)).toBeCloseTo(0.042, 6);   // the SAME state.P.Vb the Box tab edits

  await tune.locator('button', { hasText: 'Cancel' }).click();
  await expect(tune).toBeHidden();
  expect(await readVb(page)).toBeCloseTo(before, 6);  // Cancel reverts the box change too
});

// ── QO11.5 — an invalid entry is red while typing, before blur ────────────────────────────
test('QO11.5 NumInput: an out-of-range value typed character-by-character goes red before blur', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', { hasText: 'Box' }).click();

  const vb = page.locator('.tab-section.active .field', { hasText: 'Volume' }).locator('input').first();
  const before = await vb.inputValue();
  const goodVb = await readVb(page);
  await vb.click();
  await vb.press('Control+a');

  // ONE keystroke. `<input type="number">` reports value === '' for a lone '-', which is the
  // exact moment the field became un-numeric — it must say so, and it must NOT be mistaken for
  // the field having been emptied (which would clear the model out from under the charts).
  await vb.pressSequentially('-');
  await expect(vb).toHaveClass(/inp-bad/);
  await expect(vb).toBeFocused();
  expect(await readVb(page)).toBeCloseTo(goodVb, 9);

  // Typed, not filled: pressSequentially fires the keydowns that put NumInput on its raw-echo
  // path, which is the path `fill()` never exercises.
  await vb.pressSequentially('5');
  await expect(vb).toHaveValue('-5');                 // the keystrokes are echoed, caret intact
  await expect(vb).toHaveClass(/inp-bad/);            // red WHILE the caret is still in the field
  await expect(vb).toBeFocused();
  expect(await readVb(page)).toBeCloseTo(goodVb, 9);  // ...and the bad value never reached the model

  await vb.blur();
  await expect(vb).toHaveValue(before);               // blur reverts to the last good value
  await expect(vb).not.toHaveClass(/inp-bad/);
});

test('QO11.5 NumInput: a full-precision value survives typing and blur — dp is presentation only', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', { hasText: 'Box' }).click();

  const vb = page.locator('.tab-section.active .field', { hasText: 'Volume' }).locator('input').first();
  await vb.click();
  await vb.press('Control+a');
  // 6 significant decimals in a field whose display precision is far coarser: the model must
  // keep every one of them, before AND after blur.
  await vb.pressSequentially('12.345678');
  expect(await readVb(page)).toBeCloseTo(0.012345678, 12);
  await vb.blur();
  expect(await readVb(page)).toBeCloseTo(0.012345678, 12);
});
