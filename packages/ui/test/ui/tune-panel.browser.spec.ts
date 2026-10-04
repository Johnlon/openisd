import {COMPLETE_DRIVER_PROJECT_OWPR, duplicateFocusedProject, expect, focusedBoxVolume, focusedDriverSpec, openAProject, setFocusedBoxType, test} from '../fixtures.js';
import type {Page} from '@playwright/test';

/**
 * The docked Tune panel (OriginalTune.vue): a what-if over the focused project's driver (T/S
 * parameters, Mms, Bl, Q trio) and its box volume. Its edits are live; Cancel, its titlebar ✕ and
 * Escape discard everything since the last save; it is independent of the box view and tab it was
 * opened from, and closes when focus moves to another project.
 */

/** Open the docked Tune panel on a project opened from `owpr`. */
async function openTune(page: Page, owpr?: string) {
  await page.goto('/');
  await openAProject(page, owpr);
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.edit-btn', { hasText: 'What-if' }).click();
  const tune = page.locator('.tune-panel');
  await expect(tune).toBeVisible();
  return tune;
}

const tuneField = (page: Page, label: string) =>
  page.locator('.tune-panel .tune-fld').filter({ has: page.locator('label', { hasText: new RegExp(`^${label}$`) }) });

test.describe('Tune panel', () => {
  test.describe('on the sample project', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await openAProject(page);
    });

    test('the Tune panel edits live and Cancel discards everything since the last save', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('.save-rail .tune-btn').click();
      const tune = page.locator('.tune-panel');
      await expect(tune).toBeVisible();
      await expect(tune.locator('button', { hasText: 'Keep' })).toHaveCount(0);
      await expect(tune.locator('button', { hasText: 'Cancel' })).toBeVisible();

      const readFs = () => focusedDriverSpec(page, 'Fs_hz');
      const before = await readFs();

      const fsInput = tune.locator('.tune-fld', { hasText: 'Fs' }).locator('input');
      await fsInput.fill(String(before + 6));
      await fsInput.dispatchEvent('input');
      expect(await readFs()).toBeCloseTo(before + 6, 1); // the edit lands immediately

      await tune.locator('button', { hasText: 'Cancel' }).click();
      await expect(tune).toBeHidden();
      expect(await readFs()).toBeCloseTo(before, 1); // Cancel discarded it
    });

    test('the Tune panel Reset discards edits and stays open', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('.save-rail .tune-btn').click();
      const tune = page.locator('.tune-panel');
      const readFs = () => focusedDriverSpec(page, 'Fs_hz');
      const before = await readFs();

      const fsInput = tune.locator('.tune-fld', { hasText: 'Fs' }).locator('input');
      const beforeText = await fsInput.inputValue();
      await fsInput.fill(String(before + 6));
      await fsInput.dispatchEvent('input');
      expect(await readFs()).toBeCloseTo(before + 6, 1);

      await tune.locator('button', { hasText: 'Reset' }).click();
      await expect(tune).toBeVisible();
      expect(await readFs()).toBeCloseTo(before, 1);
      await expect(fsInput).toHaveValue(beforeText);
    });

    test('closing Tune via the titlebar ✕ also discards the edit, same as Cancel', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();

      const readFs = () => focusedDriverSpec(page, 'Fs_hz');
      const before = await readFs();

      await page.locator('.save-rail .tune-btn').click();
      const tune = page.locator('.tune-panel');
      const fsInput = tune.locator('.tune-fld', { hasText: 'Fs' }).locator('input');
      await fsInput.fill(String(before + 6));
      await fsInput.dispatchEvent('input');
      expect(await readFs()).toBeCloseTo(before + 6, 1);

      // Closing via the titlebar ✕ (the only other close path besides Cancel) discards the edit
      // exactly like Cancel does.
      await tune.locator('.tune-titlebar .close-btn').click();
      await expect(tune).toBeHidden();
      expect(await readFs()).toBeCloseTo(before, 1);
    });

    test('closing Tune does not corrupt the saved Mms value', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('.save-rail .tune-btn').click();
      const tune = page.locator('.tune-panel');
      const readMms = () => focusedDriverSpec(page, 'Mms_kg');
      const before = await readMms();
      const mmsInput = tune.locator('.tune-fld', { hasText: 'Mms' }).locator('input');
      await mmsInput.fill(String((before * 1000) + 6));
      await mmsInput.dispatchEvent('input');
      expect(await readMms()).toBeCloseTo(before + 0.006, 6);

      await tune.locator('.tune-titlebar .close-btn').click();
      await expect(tune).toBeHidden();
      expect(await readMms()).toBeCloseTo(before, 9);
    });

    test('Escape cancels the active Tune what-if', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('.save-rail .tune-btn').click();
      await expect(page.locator('.tune-panel')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.tune-panel')).toBeHidden();
    });

    test('the Tune fields accept multi-character typing (no reformat-while-typing clobber)', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('.save-rail .tune-btn').click();
      const fsInput = page.locator('.tune-panel .tune-fld', { hasText: 'Fs' }).locator('input');
      await fsInput.click();
      await fsInput.press('Control+a');
      await fsInput.pressSequentially('42'); // type char-by-char, like a real user
      await expect(fsInput).toHaveValue('42');
      const fs = await focusedDriverSpec(page, 'Fs_hz');
      expect(fs).toBeCloseTo(42, 1);
    });

    test('an open Tune panel stays open across a reload', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('.save-rail .tune-btn').click();

      await page.waitForFunction(() => (localStorage.getItem('openisd_view') || '').includes('originalTuneOpen'),
        undefined, { timeout: 5000 }); // the open-panel flag is persisted
      await page.reload({ waitUntil: 'domcontentloaded' });

      await expect(page.locator('.tune-panel')).toBeVisible();          // Tune reopened
    });

    test('the Tune panel stays open when the box type changes underneath it', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('button.edit-btn', { hasText: 'What-if' }).click();
      await expect(page.locator('.tune-panel')).toBeVisible();

      await setFocusedBoxType(page, 'vented');
      await expect(page.locator('.tune-panel')).toBeVisible();

      await setFocusedBoxType(page, 'sealed');
      await expect(page.locator('.tune-panel')).toBeVisible();
    });

    test('the Tune panel stays open across project tab changes', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('button.edit-btn', { hasText: 'What-if' }).click();
      await expect(page.locator('.tune-panel')).toBeVisible();

      // The panel is not a child of any one tab section.
      await page.locator('.project-nav li', { hasText: 'Box' }).click();
      await expect(page.locator('.tune-panel')).toBeVisible();

      await page.locator('.project-nav li', { hasText: 'Signal' }).click();
      await expect(page.locator('.tune-panel')).toBeVisible();
    });

    test('Tune keeps the Vb typed into it when the field loses focus', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('button.edit-btn', { hasText: 'What-if' }).click();
      await expect(page.locator('.tune-panel')).toBeVisible();

      const vb = page.locator('.tune-panel .tune-fld', { hasText: 'Vb' }).locator('input');
      await vb.fill('33');

      // Blur by focusing a sibling field in the same panel.
      await page.locator('.tune-panel .tune-fld', { hasText: 'Fs' }).locator('input').first().focus();
      await expect(vb).toHaveValue(/^33(\.0+)?$/);
    });

    test('switching focus to a different open project closes an open Tune panel', async ({ page }) => {
      await duplicateFocusedProject(page, 'Copy');

      await page.locator('li', { hasText: 'Driver' }).click();
      await page.locator('button.edit-btn', { hasText: 'What-if' }).click();
      const tunePanel = page.locator('.tune-panel');
      await expect(tunePanel).toBeVisible();

      // Tune is a DOCKED panel, not a modal — the rows stay clickable, and switching focus closes it.
      const projectRows = page.locator('.project-row');
      await expect(projectRows).toHaveCount(2);
      await projectRows.nth(0).click();

      await expect(tunePanel).toBeHidden();
    });
  });

  test.describe('on the complete driver project', () => {
    // State transitions themselves (calculated → entered → calculated, and the g→kg-equivalent
    // numeric value landing in the model) are covered by OriginalTune-hooks.test.ts; this proves only
    // that the DOM reflects that state via its value-c/value-e class.
    test('Mms and Bl are editable and override the calculation; clearing returns them to Calculated', async ({ page }) => {
      await openTune(page, COMPLETE_DRIVER_PROJECT_OWPR);

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

    test('numeric fields are narrow and uniform, not stretched to fill the column', async ({ page }) => {
      await openTune(page, COMPLETE_DRIVER_PROJECT_OWPR);
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

    test('a blank Q autocalculates from the other two, with the editor E/C/N marks and red border', async ({ page }) => {
      const tune = await openTune(page, COMPLETE_DRIVER_PROJECT_OWPR);
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
      // OriginalTune-hooks.test.ts; here we only need the DOM to reflect it after blur.
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

    test('box volume is on the panel, drives the same state, and Cancel puts it back', async ({ page }) => {
      const tune = await openTune(page, COMPLETE_DRIVER_PROJECT_OWPR);
      const vb = tuneField(page, 'Vb').locator('input');
      await expect(vb).toBeVisible();

      const before = await focusedBoxVolume(page);
      await vb.click();
      await vb.press('Control+a');
      await vb.pressSequentially('42');
      expect(await focusedBoxVolume(page)).toBeCloseTo(0.042, 6);   // the SAME state.P.Vb the Box tab edits

      await tune.locator('button', { hasText: 'Cancel' }).click();
      await expect(tune).toBeHidden();
      expect(await focusedBoxVolume(page)).toBeCloseTo(before, 6);  // Cancel reverts the box change too
    });
  });
});
