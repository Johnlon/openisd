import {expect, openAProject, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
import {fillAndBlur} from '../fixtures/numField.js';

/**
 * NumInput.vue (shared by both skins) as the Original shell drives it: the display precision is
 * screen formatting only (the model keeps full precision), a spinner step never gains decimal
 * places, and an invalid entry is flagged while typing and never reaches the model.
 */

/** The Box volume as the field shows it in cm³ (the unit label clicked round from L), then back to L. */
async function volumeInCm3(page: Page): Promise<string> {
  const field = page.locator('.tab-section.active .ui-field', { hasText: 'Volume' }).first();
  const unit = field.locator('.ui-field-unit');
  for (let i = 0; i < 3; i++) await unit.click();
  await expect(unit).toHaveText('cm³');
  const shown = await field.locator('input').first().inputValue();
  await unit.click();
  await expect(unit).toHaveText('L');
  return shown;
}

/** Every other number the open Box tab shows beside the Volume field: the calculated readouts follow the
 *  volume, so they change when the model takes a new volume. */
async function otherBoxReadouts(page: Page): Promise<string[]> {
  return page.locator('.tab-section.active .ui-field:not(:has(.ui-field-label:text-is("Volume"))) input').evaluateAll(
    inputs => inputs.map(i => i instanceof HTMLInputElement ? i.value : ''));
}

// Decimal places shown in a numeric-input string ("6.10" → 2, "55" → 0, "" → 0).
function decimalsOf(s: string): number {
  const m = s.trim().match(/^-?\d*\.(\d+)$/);
  return m ? m[1].length : 0;
}

// Class-level spinner invariant: a spinner step (Arrow Up/Down) must never GAIN decimal
// places over what the field shows at rest. Each field has a fixed display precision; a
// step that turns "6.00" into "8.94924452476786" is the bug. Asserted over every
// number box (NumInput or raw input[type=number]) so no field (or second spinner mechanism) can regress unnoticed.
// Returns 1 if the field was actually spun-and-checked, 0 if skipped (hidden / non-numeric).
async function assertSpinnerHoldsDp(input: Locator, label: string): Promise<number> {
  if (!(await input.isVisible()) || !(await input.isEditable())) return 0;
  await input.scrollIntoViewIfNeeded();
  const fieldName = await input.evaluate((el) => el.closest('.field')?.querySelector('label')?.textContent?.trim() || el.getAttribute('aria-label') || '?');
  label = `${label} [${fieldName}]`;
  const before = (await input.inputValue()).trim();
  if (!/^-?\d+(\.\d+)?$/.test(before)) return 0; // skip empty / non-numeric fields
  const dpBefore = decimalsOf(before);
  await input.focus();
  if ((await input.getAttribute('data-numinput')) !== null) {
    // A NumInput steps from the caret: the last digit shown, with the caret at the end.
    await input.press('End');
    for (let i = 0; i < 6; i++) await input.press('ArrowUp');
    const up = await input.inputValue();
    for (let i = 0; i < 12; i++) await input.press('ArrowDown');
    const down = await input.inputValue();
    expect(decimalsOf(up), `${label}: gained decimals spinning UP  "${before}" → "${up}"`).toBeLessThanOrEqual(dpBefore);
    expect(decimalsOf(down), `${label}: gained decimals spinning DOWN "${before}" → "${down}"`).toBeLessThanOrEqual(dpBefore);
    return 1;
  }
  // A raw number input whose current step attr has no ALLOWED value step (dynamic stepAttr — a power
  // of ten off the value's magnitude, clamped at the field precision → 'any' near zero, see
  // NumInput.vue) throws InvalidStateError from stepUp()/stepDown(). Such a field cannot gain
  // decimals by native stepping, so there is nothing to check: run the whole up/down sequence
  // as one probe and skip the field if the DOM rejects any step.
  const spun = await input.evaluate(el => {
    if (!(el instanceof HTMLInputElement)) return null;
    const step = (goingUp: boolean, n: number) => {
      for (let i = 0; i < n; i++) {
        if (goingUp) el.stepUp(); else el.stepDown();
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };
    try {
      step(true, 6);
      const up = el.value;
      step(false, 12);
      return { up, down: el.value };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'InvalidStateError') return null;
      throw e;
    }
  });
  if (!spun) return 0;
  expect(decimalsOf(spun.up), `${label}: gained decimals spinning UP  "${before}" → "${spun.up}"`).toBeLessThanOrEqual(dpBefore);
  expect(decimalsOf(spun.down), `${label}: gained decimals spinning DOWN "${before}" → "${spun.down}"`).toBeLessThanOrEqual(dpBefore);
  return 1;
}

// Sweep every visible numeric spinner on the currently-active project tab; returns the count checked.
async function sweepActiveTab(page: Page, context: string): Promise<number> {
  const inputs = await page.locator('.original-root .tab-section.active input[data-numinput], .original-root .tab-section.active input[type="number"]').all();
  let n = 0;
  for (let i = 0; i < inputs.length; i++) n += await assertSpinnerHoldsDp(inputs[i], `${context} #${i}`);
  return n;
}

test.describe('NumInput', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await openAProject(page);
  });

  test('exponential-step fields keep clean decimals while spinning (grid-aligned step)', async ({ page }) => {
    await page.locator('.project-nav li', { hasText: 'Advanced' }).click();
    const hum = page.locator('.tab-section.active .field', { hasText: 'Relative humidity' }).locator('input');
    await hum.click();
    await hum.fill('50');
    for (let i = 0; i < 4; i++) await hum.press('ArrowUp'); // compounding steps
    const val = await hum.inputValue();
    expect(val).toMatch(/^\d+(\.\d{1,2})?$/); // clean grid value, never a long compounding float
  });

  test('spinner keeps fixed decimal places (no compounding float precision)', async ({ page }) => {
    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    const vol = page.locator('.tab-section.active .field', { hasText: 'Volume' }).locator('input').first();
    await vol.click();
    await vol.fill('6');
    for (let i = 0; i < 3; i++) await vol.press('ArrowUp'); // native spinner steps, compounding
    const val = await vol.inputValue();
    expect(val).toMatch(/^\d+(\.\d{1,2})?$/); // at most 2 dp — never a long compounding float
  });

  test('dp is screen-formatting only — the model keeps FULL precision (not truncated to dp)', async ({ page }) => {
    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    const vol = page.locator('.tab-section.active .field', { hasText: 'Volume' }).locator('input').first();
    await vol.click();
    await fillAndBlur(vol, '6.123456'); // more decimals than the field's 2 dp
    await expect(vol).toHaveValue('6.12'); // DISPLAY is formatted to 2 dp
    // Rotating the unit to cm³ shows what the model holds: 6123, never the 2-dp "6.12" L (6120).
    expect(await volumeInCm3(page)).toBe('6123');
  });

  test('no spinner gains decimal places while spinning (all fields, all box types)', async ({ page }) => {
    // Box tab across every box type — exposes the type-specific spinners (vents, PR, chambers)
    // as well as the shared Volume/Signal/Advanced fields. Covers NumInput and v-expo-step at once.
    let checked = 0;
    for (const boxType of ['sealed', 'vented', 'box-passive-radiator', 'bandpass4'] as const) {
      await page.locator('.project-nav li', { hasText: 'Box' }).click();
      await page.locator('select#og-box-type').selectOption(boxType);
      // Sweep every project tab that exists for this box type (the tab set changes per type).
      const tabCount = await page.locator('.project-nav li').count();
      for (let t = 0; t < tabCount; t++) {
        const li = page.locator('.project-nav li').nth(t);
        const name = ((await li.textContent()) || `tab${t}`).trim();
        await li.click();
        checked += await sweepActiveTab(page, `${boxType}/${name}`);
      }
    }
    // The docked What-if panel (v-expo-step T/S fields) — the highest-risk fractional-value spinners.
    await page.locator('.project-nav li', { hasText: 'Driver' }).click();
    await page.locator('.save-rail .what-if-btn').click();
    const whatIfInputs = await page.locator('.what-if-panel input[data-numinput]').all();
    for (let i = 0; i < whatIfInputs.length; i++) checked += await assertSpinnerHoldsDp(whatIfInputs[i], `What-if #${i}`);

    // Guard against a selector that silently matches nothing (which would make the sweep a no-op
    // and pass vacuously). The Original skin has well over a dozen numeric spinners across types.
    expect(checked, 'class-level sweep visited too few spinners — selector likely drifted').toBeGreaterThan(12);
  });

  test('negative or out-of-range entry is rejected, flagged or clamped, per the field contract', async ({ page }) => {
    // 1. NumInput (registry-bound): typing a negative into Box Volume must flag it and NOT
    //    reach the model. Ruling "b" (John, 2026-10-06): leaving the box keeps the refused entry
    //    and its flag; Esc puts the stored value back.
    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    const vb = page.locator('.tab-section.active .field', { hasText: 'Volume' }).locator('input').first();
    const before = await vb.inputValue();
    const goodReadouts = await otherBoxReadouts(page);
    expect(goodReadouts.length, 'the Box tab shows readouts beside Volume').toBeGreaterThan(0);
    await vb.fill('-5');
    await expect(vb).toHaveClass(/inp-bad/); // rejected, red-flagged
    await vb.blur();
    await expect(vb).toHaveValue('-5');      // the refused entry stays, still flagged
    await expect(vb).toHaveClass(/inp-bad/);
    expect(await otherBoxReadouts(page)).toEqual(goodReadouts);  // the calculated readouts never took the negative
    await vb.focus();
    await vb.press('Escape');
    await expect(vb).toHaveValue(before);
    // 2. Air fields are DIFFERENT by design (human ruling 2026-09-17): they accept the
    //    out-of-range entry and signal it with a dq-flag + tooltip rather than clamping
    //    (OriginalShell.vue :allow-out-of-range="true" — the app's chosen contract).
    await page.locator('.project-nav li', { hasText: 'Advanced' }).click();
    const rh = page.locator('.tab-section.active .field', { hasText: 'Relative humidity' }).locator('input');
    await rh.fill('-20');
    await expect(rh).toHaveClass(/dq-flag/);           // flagged, not clamped
    await expect(page.locator('.tab-section.active .ui-field', { hasText: 'Relative humidity' }).locator('.ui-field-dq-btn')).toHaveAttribute('title', /outside the sane range/);
    await rh.fill('250');
    await expect(rh).toHaveClass(/dq-flag/);           // ceiling too, not just the floor
    // 3. What-if panel (NumInput since T222): Fs typed negative is refused and red-flagged, as in every field.
    await page.locator('.project-nav li', { hasText: 'Driver' }).click();
    await page.locator('.save-rail .what-if-btn').click();
    const fs = page.locator('.what-if-panel .what-if-fld', { hasText: 'Fs' }).first().locator('input');
    await fs.fill('-40');
    await fs.press('Enter');
    await expect(fs).toHaveClass(/inp-bad/); // refused and flagged like every NumInput; Esc restores
    await page.locator('.what-if-panel .close-btn').click();
  });

  test('an out-of-range value typed character-by-character goes red before blur', async ({ page }) => {
    await page.locator('.project-nav li', { hasText: 'Box' }).click();

    const vb = page.locator('.tab-section.active .field', { hasText: 'Volume' }).locator('input').first();
    const before = await vb.inputValue();
    const goodReadouts = await otherBoxReadouts(page);
    expect(goodReadouts.length, 'the Box tab shows readouts beside Volume').toBeGreaterThan(0);
    await vb.click();
    await vb.press('Control+a');

    // ONE keystroke. A lone '-' is not a number, which is the
    // exact moment the field became un-numeric — it must say so, and it must NOT be mistaken for
    // the field having been emptied (which would clear the model out from under the charts).
    await vb.pressSequentially('-');
    await expect(vb).toHaveClass(/inp-bad/);
    await expect(vb).toBeFocused();
    expect(await otherBoxReadouts(page)).toEqual(goodReadouts);

    // Typed, not filled: pressSequentially fires the keydowns that put NumInput on its raw-echo
    // path, which is the path `fill()` never exercises.
    await vb.pressSequentially('5');
    await expect(vb).toHaveValue('-5');                 // the keystrokes are echoed, caret intact
    await expect(vb).toHaveClass(/inp-bad/);            // red WHILE the caret is still in the field
    await expect(vb).toBeFocused();
    expect(await otherBoxReadouts(page)).toEqual(goodReadouts);  // ...and the bad value never reached the calculated readouts

    await vb.blur();
    await expect(vb).toHaveValue('-5');                 // ruling "b": leaving keeps the refused entry
    await expect(vb).toHaveClass(/inp-bad/);
    await vb.focus();
    await vb.press('Escape');                           // Esc restores the last good value
    await expect(vb).toHaveValue(before);
    await expect(vb).not.toHaveClass(/inp-bad/);
  });

  test('a full-precision value survives typing and blur — dp is presentation only', async ({ page }) => {
    await page.locator('.project-nav li', { hasText: 'Box' }).click();

    const vb = page.locator('.tab-section.active .field', { hasText: 'Volume' }).locator('input').first();
    await vb.click();
    await vb.press('Control+a');
    // 6 significant decimals in a field whose display precision is far coarser: the model must
    // keep every one of them, before AND after blur.
    await vb.pressSequentially('12.345678');
    await vb.blur();
    expect(await volumeInCm3(page)).toBe('12346');
  });
});
