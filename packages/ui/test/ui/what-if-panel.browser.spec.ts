import {chartPicture, chartPng, settledChartPicture, COMPLETE_DRIVER_PROJECT_OWPR, duplicateFocusedProject, expect, shownBoxVolume, shownDriverSpec, focusedIsModified, openAProject, setFocusedBoxType, setFocusedBoxVolume, setFocusedDriverSpecs, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {measureCursorOrdinaryInk} from '../fixtures/fieldCursorContract.js';
import {chartFontReport, watchChartFonts} from '../fixtures/chartFonts.js';

/**
 * The docked What-if? panel (OriginalWhatIf.vue): a What-if over the focused project's driver
 * (T/S parameters, Mms, Bl, Q trio) and its box volume. Its values show on the charts at once but
 * never change the project: no unsaved marker. Close, its titlebar ✕ and Escape end the What-if;
 * it is independent of the box view and tab it was opened from, and closes when focus moves to
 * another project.
 */

/** Open the docked What-if panel on a project opened from `owpr`. */
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

test.describe('What-if panel', () => {
  test.describe('on the sample project', () => {
    test.beforeEach(async ({ page }) => {
      await watchChartFonts(page);
      await page.goto('/');
      await openAProject(page);
    });

    test('What-if changes the charts but never the project, and Close puts the curve back', async ({ page }) => {
      expect(await focusedIsModified(page)).toBe(false);
      const volume = await shownBoxVolume(page);
      // The charts draw after the project opens and redraw as the font loads; Close is compared to the settled picture.
      // The "Project imported" message floats over the chart for a few seconds and is part of its picture.
      await expect(page.getByText(/Project imported/)).toBeHidden();
      const spl = await settledChartPicture(page);
      const before = await chartPng(page);

      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('.save-rail .what-if-btn').click();
      const whatIf = page.locator('.what-if-panel');
      await expect(whatIf).toBeVisible();
      await expect(whatIf.locator('button', { hasText: 'Cancel' })).toHaveCount(0);
      await expect(whatIf.locator('button', { hasText: 'Done' })).toHaveCount(0);

      const vb = whatIfField(page, 'Vb').locator('input');
      await vb.click();
      await vb.press('Control+a');
      await vb.pressSequentially(String(Math.round(volume * 2)));
      await expect.poll(() => chartPicture(page)).not.toBe(spl);

      expect(await focusedIsModified(page)).toBe(false);
      await expect(page.locator('.project-row.is-unsaved')).toHaveCount(0);
      await expect(page.locator('.unsaved-label')).toHaveCount(0);

      await whatIf.locator('button', { hasText: 'Close' }).click();
      await expect(whatIf).toBeHidden();
      // Both pictures and the font record go with the report, so a failure shows what differs (bug what-if-close-curve-not-restored).
      await test.info().attach('chart before What-if', { body: before, contentType: 'image/png' });
      await expect.poll(() => chartPicture(page)).toBe(spl).finally(async () => {
        await test.info().attach('chart after Close', { body: await chartPng(page), contentType: 'image/png' });
        await test.info().attach('chart fonts', { body: await chartFontReport(page), contentType: 'text/plain' });
      });
      expect(await shownBoxVolume(page)).toBe(volume);
      expect(await focusedIsModified(page)).toBe(false);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect.poll(() => shownBoxVolume(page)).toBe(volume);
      expect(await focusedIsModified(page)).toBe(false);
    });

    test('What-if Reset puts the project values back and stays open', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('.save-rail .what-if-btn').click();
      const whatIf = page.locator('.what-if-panel');
      const fsInput = whatIf.locator('.what-if-fld', { hasText: 'Fs' }).locator('input');
      const beforeText = await fsInput.inputValue();
      await fsInput.fill(String(Number(beforeText) + 6));
      await fsInput.dispatchEvent('input');
      await expect(fsInput).toHaveValue(String(Number(beforeText) + 6));

      await whatIf.locator('button', { hasText: 'Reset' }).click();
      await expect(whatIf).toBeVisible();
      await expect(fsInput).toHaveValue(beforeText);
    });

    test('closing What-if via the titlebar ✕ discards the What-if, same as Close', async ({ page }) => {
      const before = await shownDriverSpec(page, 'Fs');

      await page.locator('.save-rail .what-if-btn').click();
      const whatIf = page.locator('.what-if-panel');
      const fsInput = whatIf.locator('.what-if-fld', { hasText: 'Fs' }).locator('input');
      await fsInput.fill(String(Number(before) + 6));
      await fsInput.dispatchEvent('input');
      await expect(fsInput).toHaveValue(String(Number(before) + 6));

      // Closing via the titlebar ✕ discards the What-if exactly like Close does.
      await whatIf.locator('.what-if-titlebar .close-btn').click();
      await expect(whatIf).toBeHidden();
      expect(await shownDriverSpec(page, 'Fs')).toBe(before);
      expect(await focusedIsModified(page)).toBe(false);
    });

    test('closing What-if does not corrupt the saved Mms value', async ({ page }) => {
      const readMms = () => shownDriverSpec(page, 'Mms');
      const before = await readMms();
      await page.locator('.save-rail .what-if-btn').click();
      const whatIf = page.locator('.what-if-panel');
      const mmsInput = whatIf.locator('.what-if-fld', { hasText: 'Mms' }).locator('input');
      await mmsInput.fill(String(Number(before) + 6));
      await mmsInput.dispatchEvent('input');
      await expect(mmsInput).toHaveValue(String(Number(before) + 6));

      await whatIf.locator('.what-if-titlebar .close-btn').click();
      await expect(whatIf).toBeHidden();
      expect(await readMms()).toBe(before);
    });

    test('Escape closes What-if', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('.save-rail .what-if-btn').click();
      await expect(page.locator('.what-if-panel')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.what-if-panel')).toBeHidden();
    });

    test('the What-if fields accept multi-character typing (no reformat-while-typing clobber)', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('.save-rail .what-if-btn').click();
      const fsInput = page.locator('.what-if-panel .what-if-fld', { hasText: 'Fs' }).locator('input');
      await fsInput.click();
      await fsInput.press('Control+a');
      await fsInput.pressSequentially('42'); // type char-by-char, like a real user
      await expect(fsInput).toHaveValue('42');
    });

    // T829: a What-if's values are never stored, so a reload does not reopen the panel showing old values as if
    // nothing was lost. (It used to; this test pinned that.)
    test('an open What-if panel is not reopened by a reload: its values were not kept', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('.save-rail .what-if-btn').click();
      await expect(page.locator('.what-if-panel')).toBeVisible();
      await page.reload({ waitUntil: 'domcontentloaded' });

      await page.locator('.project-row').first().waitFor({ state: 'visible' });
      await expect(page.locator('.what-if-panel')).toHaveCount(0);
    });

    test('the What-if panel stays open when the box type changes underneath it', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('button.edit-btn', { hasText: 'What-if' }).click();
      await expect(page.locator('.what-if-panel')).toBeVisible();

      await setFocusedBoxType(page, 'vented');
      await expect(page.locator('.what-if-panel')).toBeVisible();

      await setFocusedBoxType(page, 'sealed');
      await expect(page.locator('.what-if-panel')).toBeVisible();
    });

    test('the What-if panel stays open across project tab changes', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('button.edit-btn', { hasText: 'What-if' }).click();
      await expect(page.locator('.what-if-panel')).toBeVisible();

      // The panel is not a child of any one tab section.
      await page.locator('.project-nav li', { hasText: 'Box' }).click();
      await expect(page.locator('.what-if-panel')).toBeVisible();

      await page.locator('.project-nav li', { hasText: 'Signal' }).click();
      await expect(page.locator('.what-if-panel')).toBeVisible();
    });

    test('What-if keeps the Vb typed into it when the field loses focus', async ({ page }) => {
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.locator('button.edit-btn', { hasText: 'What-if' }).click();
      await expect(page.locator('.what-if-panel')).toBeVisible();

      const vb = page.locator('.what-if-panel .what-if-fld', { hasText: 'Vb' }).locator('input');
      await vb.fill('33');

      // Blur by focusing a sibling field in the same panel.
      await page.locator('.what-if-panel .what-if-fld', { hasText: 'Fs' }).locator('input').first().focus();
      await expect(vb).toHaveValue(/^33(\.0+)?$/);
    });

    test('switching focus to a different open project closes an open What-if panel', async ({ page }) => {
      await duplicateFocusedProject(page, 'Copy');

      await page.locator('li', { hasText: 'Driver' }).click();
      await page.locator('button.edit-btn', { hasText: 'What-if' }).click();
      const whatIfPanel = page.locator('.what-if-panel');
      await expect(whatIfPanel).toBeVisible();

      // What-if? is a DOCKED panel, not a modal — the rows stay clickable, and switching focus closes it.
      const projectRows = page.locator('.project-row');
      await expect(projectRows).toHaveCount(2);
      const volume = await shownBoxVolume(page);
      const vb = whatIfField(page, 'Vb').locator('input');
      await vb.click();
      await vb.press('Control+a');
      await vb.pressSequentially('42');
      await expect.poll(() => shownBoxVolume(page)).toBeCloseTo(42, 2);

      // The rows sort newest first, so the other project is the one not selected.
      await page.locator('.project-row:not(.selected)').click();
      await expect(whatIfPanel).toBeHidden();

      // The project left behind is as it was: its What-if ended with the panel.
      await projectRows.nth(1).click();
      expect(await shownBoxVolume(page)).toBe(volume);
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

    // T744, QO535 (John, 11 Nov 2026): "I only want to add inputs": Qts and Sensitivity in the main group, Cms and Rms beside Bl and Mms.
    test('the panel has Qts and Sensitivity in the main group and Cms and Rms in Derived, all typed boxes', async ({ page }) => {
      const whatIf = await openWhatIf(page, COMPLETE_DRIVER_PROJECT_OWPR);
      const groups = await whatIf.evaluate(el => {
        const out: Record<string, string[]> = {};
        let heading = '';
        for (const child of [...el.querySelectorAll('.what-if-content > *')]) {
          if (child.classList.contains('what-if-subsect')) heading = child.textContent?.trim() ?? '';
          else if (child.classList.contains('what-if-grid')) out[heading] = [...child.querySelectorAll('.what-if-fld label')].map(l => l.textContent?.trim() ?? '');
        }
        return out;
      });
      expect(groups['Driver']).toEqual(expect.arrayContaining(['Qts', 'Sensitivity']));
      expect(groups['Derived']).toEqual(expect.arrayContaining(['Bl', 'Mms', 'Cms', 'Rms']));
      for (const label of ['Qts', 'Sensitivity', 'Cms', 'Rms']) await expect(whatIfField(page, label).locator('input')).toBeEditable();
    });

    test('typing Mms moves Fs and leaves Vas, and no box carries a warning mark', async ({ page }) => {
      await openWhatIf(page, COMPLETE_DRIVER_PROJECT_OWPR);
      const fs = whatIfField(page, 'Fs').locator('input');
      const vas = whatIfField(page, 'Vas').locator('input');
      const fsBefore = await fs.inputValue();
      const vasBefore = await vas.inputValue();
      const mms = whatIfField(page, 'Mms').locator('input');
      const mmsBefore = Number(await mms.inputValue());
      await mms.click();
      await mms.press('Control+a');
      await mms.pressSequentially(String(Math.round(mmsBefore * 1.5 * 10) / 10));
      await mms.press('Tab');
      await expect(fs).not.toHaveValue(fsBefore);
      await expect(vas).toHaveValue(vasBefore);
      await expect(page.locator('.what-if-panel .dq-flag')).toHaveCount(0);
    });

    test('opened on a driver whose stated figures disagree (W5-1138SMF), no What-if box carries a warning mark', async ({ page }) => {
      await page.goto('/');
      await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();
      await page.getByRole('button', { name: /^Select driver$/i }).click();
      await page.getByText('Tang Band W5-1138SMF', { exact: true }).click();
      await page.locator('.driver-library .use-btn').click();
      await expect(page.getByText(/values disagree/).first()).toBeVisible();
      await page.locator('.edit-btn', { hasText: 'What-if' }).click();
      await expect(page.locator('.what-if-panel')).toBeVisible();
      await expect(page.locator('.what-if-panel .dq-flag')).toHaveCount(0);
    });

    // John, 8 Nov 2026: "Try values and watch the charts. The design is not changed. becomes Experiment - Try values & watch the charts. Your project will not be updated."
    test('the hint and the Close buttons say the project will not be updated', async ({ page }) => {
      await openWhatIf(page, COMPLETE_DRIVER_PROJECT_OWPR);
      await expect(page.locator('.what-if-panel .what-if-hint')).toHaveText('Experiment - Try values & watch the charts. Your project will not be updated.');
      for (const close of await page.locator('.what-if-panel').getByRole('button', { name: /Close/ }).all()) await expect(close).toHaveAttribute('title', 'Close. Your project will not be updated.');
      await expect(page.locator('.what-if-btn')).toHaveAttribute('title', 'Try values & watch the charts. Your project will not be updated.');
    });

    test('only Cms and Rms get wider boxes and unit chips', async ({ page }) => {
      await openWhatIf(page, COMPLETE_DRIVER_PROJECT_OWPR);
      const named = await page.locator('.what-if-panel .what-if-fld:not(.what-if-ro) input').evaluateAll(
        async els => {
          await document.fonts.ready;
          return els.map(input => {
            const row = input.closest('.what-if-fld');
            const unit = row?.querySelector('.ui-field-unit');
            const chip = unit?.getBoundingClientRect();
            const text = document.createRange();
            if (unit) text.selectNodeContents(unit);
            const glyphs = text.getBoundingClientRect();
            return {
              label: row?.querySelector('label')?.textContent?.trim() ?? '',
              rowWidth: row?.getBoundingClientRect().width ?? 0,
              width: Math.round(input.getBoundingClientRect().width),
              symbol: unit?.textContent?.trim() ?? '',
              chipWidth: Math.round(chip?.width ?? 0),
              unitFits: chip !== undefined && glyphs.left >= chip.left - 0.5 && glyphs.right <= chip.right + 0.5,
              chipPadding: parseFloat(getComputedStyle(input).paddingRight),
            };
          });
        });
      expect(named.length).toBeGreaterThan(8);
      expect(named.find(row => row.label === 'Cms')?.symbol).toBe('mm/N');
      expect(named.find(row => row.label === 'Rms')?.symbol).toBe('Ns/m');
      for (const {label, rowWidth, width} of named) {
        const wide = label === 'Cms' || label === 'Rms';
        expect(width, label).toBe(wide ? 102 : 93);
        expect(width, label).toBeLessThan(rowWidth);
      }
      for (const {label, width, symbol, chipWidth, unitFits, chipPadding} of named.filter(row => row.symbol !== '')) {
        const wide = label === 'Cms' || label === 'Rms';
        expect(chipWidth, label).toBe(wide ? 38 : 29);
        expect(unitFits, `${label} ${symbol}`).toBe(true);
        expect(width - chipPadding, `${label} numeric rail`).toBe(64);
      }
    });

    test('a blank Q autocalculates from the other two, with the editor E/C/N marks and red border', async ({ page }) => {
      const whatIf = await openWhatIf(page, COMPLETE_DRIVER_PROJECT_OWPR);
      // QO535 (John, 11 Nov 2026): the panel has a Qts box beside Qes and Qms.
      const qts = whatIfField(page, 'Qts').locator('input');
      const qes = whatIfField(page, 'Qes').locator('input');
      const qms = whatIfField(page, 'Qms').locator('input');

      // Both entered to begin with.
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

      // A typed Qes keeps the other results (Qms) and Qts follows it (QO535).
      const before = await qms.inputValue();
      const qtsBefore = await qts.inputValue();
      await qes.click();
      await qes.press('Control+a');
      await qes.pressSequentially('0.55');
      await expect(qts).not.toHaveValue(qtsBefore);
      await expect(qms).toHaveValue(before);

      // Clear Qes again: the solver does not use a calculated Qms as a new stated input, so Qms
      // becomes unavailable too.
      await qes.press('Control+a');
      await qes.press('Delete');
      await qes.blur();
      await expect(qes).toHaveClass(/value-n/);
      await expect(qes).toHaveValue('');
      await expect(qms).toHaveClass(/value-n/);
      await expect(qms).toHaveValue('');
      await expect(whatIf).toBeVisible();
    });

    test('box volume is on the panel, shows on the charts, and Close puts it back', async ({ page }) => {
      const whatIf = await openWhatIf(page, COMPLETE_DRIVER_PROJECT_OWPR);
      const vb = whatIfField(page, 'Vb').locator('input');
      await expect(vb).toBeVisible();

      const before = await shownBoxVolume(page);
      await vb.click();
      await vb.press('Control+a');
      await vb.pressSequentially('42');
      expect(await shownBoxVolume(page)).toBeCloseTo(42, 2);   // the What-if's volume, read by the charts
      expect(await focusedIsModified(page)).toBe(false);

      await whatIf.locator('button', { hasText: 'Close' }).click();
      await expect(whatIf).toBeHidden();
      expect(await shownBoxVolume(page)).toBeCloseTo(before, 2);  // Close puts the project's volume back
    });

    test('a box volume changed outside the open What-if panel shows in the panel', async ({ page }) => {
      await openWhatIf(page, COMPLETE_DRIVER_PROJECT_OWPR);
      const vb = whatIfField(page, 'Vb').locator('input');
      await setFocusedBoxVolume(page, 0.0777);
      await expect(vb).toHaveValue(/77\.7/);
    });

    test('a driver spec changed outside the open What-if panel shows in the panel', async ({ page }) => {
      await page.setViewportSize({ width: 1900, height: 1100 });
      await openWhatIf(page, COMPLETE_DRIVER_PROJECT_OWPR);
      const fs = whatIfField(page, 'Fs').locator('input');
      await setFocusedDriverSpecs(page, { Fs_hz: 61.5 });
      await expect(fs).toHaveValue(/61\.5/);
    });

    test('a box volume typed on the Box tab shows in the open What-if panel', async ({ page }) => {
      await openWhatIf(page, COMPLETE_DRIVER_PROJECT_OWPR);
      await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
      const boxVol = page.locator('.field', { has: page.locator('label', { hasText: /^Volume$/ }) }).locator('input').first();
      await boxVol.click();
      await boxVol.press('Control+a');
      await boxVol.pressSequentially('55');
      await expect(whatIfField(page, 'Vb').locator('input')).toHaveValue(/55/);
    });

    test('after editing in the What-if panel, a later Box tab edit still shows in the panel', async ({ page }) => {
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

test('the Optional rows (Le, Xmax, Pe) are labelled like every other row: the heading says they are optional', async ({ page }) => {
  await openWhatIf(page);
  const look = (label: string) => whatIfField(page, label).locator('label').evaluate(el => {
    const s = getComputedStyle(el);
    return `${s.color} ${s.fontStyle} ${s.fontSize}`;
  });
  const fs = await look('Fs');
  for (const label of ['Le', 'Xmax', 'Pe']) expect(await look(label), label).toBe(fs);
});

test('every row fits inside the panel: no unit label runs past its right edge', async ({ page }) => {
  const whatIf = await openWhatIf(page);
  const panel = await whatIf.evaluate(el => {
    const r = el.getBoundingClientRect();
    return { right: r.right - parseFloat(getComputedStyle(el).paddingRight), scrollX: el.scrollWidth - el.clientWidth };
  });
  expect(panel.scrollX).toBe(0);
  const rows = whatIf.locator('.what-if-fld');
  for (let i = 0; i < await rows.count(); i++) {
    const right = await rows.nth(i).evaluate(el => Math.max(...[...el.querySelectorAll('*')].map(c => c.getBoundingClientRect().right)));
    expect(right, await rows.nth(i).locator('label').innerText()).toBeLessThanOrEqual(panel.right + 0.5);
  }
});

for (const size of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 1024, height: 700 }]) {
  test(`the panel does not clip or scroll sideways at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    const whatIf = await openWhatIf(page);
    const m = await whatIf.evaluate(el => {
      const r = el.getBoundingClientRect();
      const rows = [...el.querySelectorAll('.what-if-fld')].map(f => f.getBoundingClientRect());
      return { scrollX: el.scrollWidth - el.clientWidth, left: r.left, right: r.right, top: r.top, bottom: r.bottom, rowsRight: Math.max(...rows.map(x => x.right)), rowsLeft: Math.min(...rows.map(x => x.left)), width: r.width };
    });
    test.info().annotations.push({ type: "layout", description: JSON.stringify(m) });
    expect(m.scrollX, 'sideways scroll').toBe(0);
    expect(m.left).toBeGreaterThanOrEqual(0);
    expect(m.right).toBeLessThanOrEqual(size.width);
    expect(m.top).toBeGreaterThanOrEqual(0);
    expect(m.bottom).toBeLessThanOrEqual(size.height);
    expect(m.rowsRight).toBeLessThanOrEqual(m.right);
  });
}


test('desktop Mms has the selected solid unit affordance and inverse digit cursor', async ({page}) => {
  const panel = await openWhatIf(page, COMPLETE_DRIVER_PROJECT_OWPR);
  const row = whatIfField(page, 'Mms');
  const unit = row.locator('.unit-toggle');
  await expect(unit).toHaveAttribute('role', 'button');
  await expect(unit).toHaveCSS('text-decoration-style', 'solid');
  await expect(unit).toHaveCSS('text-decoration-color', 'rgb(24, 104, 209)');
  const before = await unit.innerText();
  await unit.click();
  await expect(unit).not.toHaveText(before);
  const input = row.locator('input');
  await input.focus();
  await input.evaluate(element => { if (element instanceof HTMLInputElement) element.setSelectionRange(0, 1); });
  const marker = panel.locator('.num-mark-underline');
  await expect(marker).toBeVisible();
  await expect(marker).toHaveCSS('animation-name', 'joined-inverse-blink');
  expect((await input.evaluate(measureCursorOrdinaryInk)).issues).toEqual([]);
});
