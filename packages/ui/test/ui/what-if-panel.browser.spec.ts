import {COMPLETE_DRIVER_PROJECT_OWPR, curvesSplSum, duplicateFocusedProject, expect, focusedBoxVolume, focusedDriverSpec, focusedIsModified, openAProject, setFocusedBoxType, setFocusedBoxVolume, setFocusedDriverSpecs, test} from '../fixtures.js';
import type {Page} from '@playwright/test';

/**
 * The docked What-if? panel (OriginalWhatIf.vue): a What-if over the focused project's driver
 * (T/S parameters, Mms, Bl, Q trio) and its box volume. Its values show on the charts at once but
 * never change the project: no unsaved marker. Close, its titlebar ✕ and Escape end the What-if;
 * it is independent of the box view and tab it was opened from, and closes when focus moves to
 * another project.
 */

/** Open the docked What-if? panel on a project opened from `owpr`. */
async function openWhatIf(page: Page, owpr?: string) {
  await page.goto('/');
  await openAProject(page, owpr);
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('.edit-btn', { hasText: 'What-if' }).click();
  const whatIf = page.locator('.what-if-panel');
  await expect(whatIf).toBeVisible();
  return whatIf;
}

const whatIfField = (page: Page, label: string) =>
  page.locator('.what-if-panel .what-if-fld').filter({ has: page.locator('label', { hasText: new RegExp(`^${label}$`) }) });

test.describe('What-if? panel', () => {
  test.describe('on the sample project', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await openAProject(page);
    });

    test('the What-if? changes the charts but never the project, and Close puts the curve back', async ({ page }) => {
      expect(await focusedIsModified(page)).toBe(false);
      const volume = await focusedBoxVolume(page);
      // The charts draw after the project opens; under load the first read is 0, and Close would then be compared to it.
      await expect.poll(() => curvesSplSum(page)).toBeGreaterThan(0);
      const spl = await curvesSplSum(page);

      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('.save-rail .what-if-btn').click();
      const whatIf = page.locator('.what-if-panel');
      await expect(whatIf).toBeVisible();
      await expect(whatIf.locator('button', { hasText: 'Cancel' })).toHaveCount(0);
      await expect(whatIf.locator('button', { hasText: 'Done' })).toHaveCount(0);

      const vb = whatIfField(page, 'Vb').locator('input');
      await vb.click();
      await vb.press('Control+a');
      await vb.pressSequentially(String(Math.round(volume * 1000 * 2)));
      await expect.poll(() => curvesSplSum(page)).not.toBe(spl);

      expect(await focusedIsModified(page)).toBe(false);
      await expect(page.locator('.project-row.is-unsaved')).toHaveCount(0);
      await expect(page.locator('.unsaved-label')).toHaveCount(0);

      await whatIf.locator('button', { hasText: 'Close' }).click();
      await expect(whatIf).toBeHidden();
      await expect.poll(() => curvesSplSum(page)).toBe(spl);
      expect(await focusedBoxVolume(page)).toBe(volume);
      expect(await focusedIsModified(page)).toBe(false);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect.poll(() => focusedBoxVolume(page)).toBe(volume);
      expect(await focusedIsModified(page)).toBe(false);
    });

    test('the What-if? Reset puts the project values back and stays open', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('.save-rail .what-if-btn').click();
      const whatIf = page.locator('.what-if-panel');
      const readFs = () => focusedDriverSpec(page, 'Fs_hz');
      const before = await readFs();

      const fsInput = whatIf.locator('.what-if-fld', { hasText: 'Fs' }).locator('input');
      const beforeText = await fsInput.inputValue();
      await fsInput.fill(String(before + 6));
      await fsInput.dispatchEvent('input');
      expect(await readFs()).toBeCloseTo(before + 6, 1);

      await whatIf.locator('button', { hasText: 'Reset' }).click();
      await expect(whatIf).toBeVisible();
      expect(await readFs()).toBeCloseTo(before, 1);
      await expect(fsInput).toHaveValue(beforeText);
    });

    test('closing the What-if? via the titlebar ✕ discards the What-if, same as Close', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();

      const readFs = () => focusedDriverSpec(page, 'Fs_hz');
      const before = await readFs();

      await page.locator('.save-rail .what-if-btn').click();
      const whatIf = page.locator('.what-if-panel');
      const fsInput = whatIf.locator('.what-if-fld', { hasText: 'Fs' }).locator('input');
      await fsInput.fill(String(before + 6));
      await fsInput.dispatchEvent('input');
      expect(await readFs()).toBeCloseTo(before + 6, 1);

      // Closing via the titlebar ✕ discards the What-if exactly like Close does.
      await whatIf.locator('.what-if-titlebar .close-btn').click();
      await expect(whatIf).toBeHidden();
      expect(await readFs()).toBeCloseTo(before, 1);
      expect(await focusedIsModified(page)).toBe(false);
    });

    test('closing the What-if? does not corrupt the saved Mms value', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('.save-rail .what-if-btn').click();
      const whatIf = page.locator('.what-if-panel');
      const readMms = () => focusedDriverSpec(page, 'Mms_kg');
      const before = await readMms();
      const mmsInput = whatIf.locator('.what-if-fld', { hasText: 'Mms' }).locator('input');
      await mmsInput.fill(String((before * 1000) + 6));
      await mmsInput.dispatchEvent('input');
      expect(await readMms()).toBeCloseTo(before + 0.006, 6);

      await whatIf.locator('.what-if-titlebar .close-btn').click();
      await expect(whatIf).toBeHidden();
      expect(await readMms()).toBeCloseTo(before, 9);
    });

    test('Escape closes the What-if?', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('.save-rail .what-if-btn').click();
      await expect(page.locator('.what-if-panel')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.what-if-panel')).toBeHidden();
    });

    test('the What-if? fields accept multi-character typing (no reformat-while-typing clobber)', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('.save-rail .what-if-btn').click();
      const fsInput = page.locator('.what-if-panel .what-if-fld', { hasText: 'Fs' }).locator('input');
      await fsInput.click();
      await fsInput.press('Control+a');
      await fsInput.pressSequentially('42'); // type char-by-char, like a real user
      await expect(fsInput).toHaveValue('42');
      const fs = await focusedDriverSpec(page, 'Fs_hz');
      expect(fs).toBeCloseTo(42, 1);
    });

    test('an open What-if? panel stays open across a reload', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('.save-rail .what-if-btn').click();

      await page.waitForFunction(() => (localStorage.getItem('openisd_view') || '').includes('originalWhatIfOpen'),
        undefined, { timeout: 5000 }); // the open-panel flag is persisted
      await page.reload({ waitUntil: 'domcontentloaded' });

      await expect(page.locator('.what-if-panel')).toBeVisible();          // What-if? reopened
    });

    test('the What-if? panel stays open when the box type changes underneath it', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('button.edit-btn', { hasText: 'What-if' }).click();
      await expect(page.locator('.what-if-panel')).toBeVisible();

      await setFocusedBoxType(page, 'vented');
      await expect(page.locator('.what-if-panel')).toBeVisible();

      await setFocusedBoxType(page, 'sealed');
      await expect(page.locator('.what-if-panel')).toBeVisible();
    });

    test('the What-if? panel stays open across project tab changes', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('button.edit-btn', { hasText: 'What-if' }).click();
      await expect(page.locator('.what-if-panel')).toBeVisible();

      // The panel is not a child of any one tab section.
      await page.locator('.project-nav li', { hasText: 'Box' }).click();
      await expect(page.locator('.what-if-panel')).toBeVisible();

      await page.locator('.project-nav li', { hasText: 'Signal' }).click();
      await expect(page.locator('.what-if-panel')).toBeVisible();
    });

    test('What-if? keeps the Vb typed into it when the field loses focus', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('button.edit-btn', { hasText: 'What-if' }).click();
      await expect(page.locator('.what-if-panel')).toBeVisible();

      const vb = page.locator('.what-if-panel .what-if-fld', { hasText: 'Vb' }).locator('input');
      await vb.fill('33');

      // Blur by focusing a sibling field in the same panel.
      await page.locator('.what-if-panel .what-if-fld', { hasText: 'Fs' }).locator('input').first().focus();
      await expect(vb).toHaveValue(/^33(\.0+)?$/);
    });

    test('switching focus to a different open project closes an open What-if? panel', async ({ page }) => {
      await duplicateFocusedProject(page, 'Copy');

      await page.locator('li', { hasText: 'Driver' }).click();
      await page.locator('button.edit-btn', { hasText: 'What-if' }).click();
      const whatIfPanel = page.locator('.what-if-panel');
      await expect(whatIfPanel).toBeVisible();

      // What-if? is a DOCKED panel, not a modal — the rows stay clickable, and switching focus closes it.
      const projectRows = page.locator('.project-row');
      await expect(projectRows).toHaveCount(2);
      const volume = await focusedBoxVolume(page);
      const vb = whatIfField(page, 'Vb').locator('input');
      await vb.click();
      await vb.press('Control+a');
      await vb.pressSequentially('42');
      await expect.poll(() => focusedBoxVolume(page)).toBeCloseTo(0.042, 6);

      await projectRows.nth(0).click();
      await expect(whatIfPanel).toBeHidden();

      // The project left behind is as it was: its What-if ended with the panel.
      await projectRows.nth(1).click();
      expect(await focusedBoxVolume(page)).toBe(volume);
      expect(await focusedIsModified(page)).toBe(false);
    });
  });

  test.describe('on the complete driver project', () => {
    // State transitions themselves (calculated → entered → calculated, and the g→kg-equivalent
    // numeric value landing in the model) are covered by OriginalWhatIf-hooks.test.ts; this proves only
    // that the DOM reflects that state via its value-c/value-e class.
    test('Mms and Bl are editable and override the calculation; clearing returns them to Calculated', async ({ page }) => {
      await openWhatIf(page, COMPLETE_DRIVER_PROJECT_OWPR);

      const mms = whatIfField(page, 'Mms').locator('input');
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
      const bl = whatIfField(page, 'Bl').locator('input');
      await expect(bl).toBeEditable();
      await bl.click();
      await bl.press('Control+a');
      await bl.pressSequentially('9.5');
      await expect(bl).toHaveClass(/value-e/);
    });

    test('numeric fields are narrow and uniform, not stretched to fill the column', async ({ page }) => {
      await openWhatIf(page, COMPLETE_DRIVER_PROJECT_OWPR);
      const widths = await page.locator('.what-if-panel .what-if-unit input').evaluateAll(
        els => els.map(e => Math.round(e.getBoundingClientRect().width)));
      expect(widths.length).toBeGreaterThan(8);
      // One width for the whole panel — a field that sizes to its container instead of its content
      // would vary with the column it landed in.
      expect(new Set(widths).size).toBe(1);
      expect(widths[0]).toBeLessThanOrEqual(90);
      // ...and genuinely narrower than the cell holding it, i.e. leftover whitespace exists.
      const cellW = await page.locator('.what-if-panel .what-if-fld').first().evaluate(e => e.getBoundingClientRect().width);
      expect(widths[0]).toBeLessThan(cellW);
    });

    test('a blank Q autocalculates from the other two, with the editor E/C/N marks and red border', async ({ page }) => {
      const whatIf = await openWhatIf(page, COMPLETE_DRIVER_PROJECT_OWPR);
      const qts = whatIfField(page, 'Qts').locator('input');
      const qes = whatIfField(page, 'Qes').locator('input');
      const qms = whatIfField(page, 'Qms').locator('input');

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
      // OriginalWhatIf-hooks.test.ts; here we only need the DOM to reflect it after blur.
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
      await expect(whatIf).toBeVisible();
    });

    test('box volume is on the panel, shows on the charts, and Close puts it back', async ({ page }) => {
      const whatIf = await openWhatIf(page, COMPLETE_DRIVER_PROJECT_OWPR);
      const vb = whatIfField(page, 'Vb').locator('input');
      await expect(vb).toBeVisible();

      const before = await focusedBoxVolume(page);
      await vb.click();
      await vb.press('Control+a');
      await vb.pressSequentially('42');
      expect(await focusedBoxVolume(page)).toBeCloseTo(0.042, 6);   // the What-if's volume, read by the charts
      expect(await focusedIsModified(page)).toBe(false);

      await whatIf.locator('button', { hasText: 'Close' }).click();
      await expect(whatIf).toBeHidden();
      expect(await focusedBoxVolume(page)).toBeCloseTo(before, 6);  // Close puts the project's volume back
    });

    test('a box volume changed outside the open What-if? panel shows in the panel', async ({ page }) => {
      await openWhatIf(page, COMPLETE_DRIVER_PROJECT_OWPR);
      const vb = whatIfField(page, 'Vb').locator('input');
      await setFocusedBoxVolume(page, 0.0777);
      await expect(vb).toHaveValue(/77\.7/);
    });

    test('a driver spec changed outside the open What-if? panel shows in the panel', async ({ page }) => {
      await openWhatIf(page, COMPLETE_DRIVER_PROJECT_OWPR);
      const fs = whatIfField(page, 'Fs').locator('input');
      await setFocusedDriverSpecs(page, { Fs_hz: 61.5 });
      await expect(fs).toHaveValue(/61\.5/);
    });

    test('a box volume typed on the Box tab shows in the open What-if? panel', async ({ page }) => {
      await openWhatIf(page, COMPLETE_DRIVER_PROJECT_OWPR);
      await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
      const boxVol = page.locator('.field', { has: page.locator('label', { hasText: /^Volume$/ }) }).locator('input').first();
      await boxVol.click();
      await boxVol.press('Control+a');
      await boxVol.pressSequentially('55');
      await expect(whatIfField(page, 'Vb').locator('input')).toHaveValue(/55/);
    });

    test('after editing in the What-if? panel, a later Box tab edit still shows in the panel', async ({ page }) => {
      await openWhatIf(page, COMPLETE_DRIVER_PROJECT_OWPR);
      const whatIfVb = whatIfField(page, 'Vb').locator('input');
      await whatIfVb.click();
      await whatIfVb.press('Control+a');
      await whatIfVb.pressSequentially('42');
      await whatIfVb.blur();
      await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
      const boxVol = page.locator('.field', { has: page.locator('label', { hasText: /^Volume$/ }) }).locator('input').first();
      await boxVol.click();
      await boxVol.press('Control+a');
      await boxVol.pressSequentially('55');
      await expect(whatIfVb).toHaveValue(/55/);
    });
  });
});
