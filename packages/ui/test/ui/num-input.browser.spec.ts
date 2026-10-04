import {expect, focusedBoxVolume, openAProject, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
import {fillAndBlur} from '../fixtures/numField.js';

/**
 * NumInput.vue (shared by both skins) as the Original shell drives it: the display precision is
 * screen formatting only (the model keeps full precision), a spinner step never gains decimal
 * places, and an invalid entry is flagged while typing and never reaches the model.
 */

// Decimal places shown in a numeric-input string ("6.10" → 2, "55" → 0, "" → 0).
function decimalsOf(s: string): number {
  const m = s.trim().match(/^-?\d*\.(\d+)$/);
  return m ? m[1].length : 0;
}

// Class-level spinner invariant: a spinner step (Arrow Up/Down) must never GAIN decimal
// places over what the field shows at rest. Each field has a fixed display precision; a
// step that turns "6.00" into "8.94924452476786" is the bug. Asserted over every
// input[type=number] so no field (or second spinner mechanism) can regress unnoticed.
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
  // A number input whose current step attr has no ALLOWED value step (dynamic stepAttr — a power
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
  const inputs = await page.locator('.original-root .tab-section.active input[type="number"]').all();
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
    const vb = await focusedBoxVolume(page); // stored in m³ (display L ÷ 1000)
    expect(vb).toBeCloseTo(0.006123456, 9); // MODEL retains full precision — never the 2-dp "0.00612"
  });

  test('no spinner gains decimal places while spinning (all fields, all box types)', async ({ page }) => {
    test.setTimeout(120_000); // exhaustive sweep: 4 box types × every tab × 18 key-presses per field
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
    // The docked Tune panel (v-expo-step T/S fields) — the highest-risk fractional-value spinners.
    await page.locator('.project-nav li', { hasText: 'Driver' }).click();
    await page.locator('.save-rail .tune-btn').click();
    const tuneInputs = await page.locator('.tune-panel input[type="number"]').all();
    for (let i = 0; i < tuneInputs.length; i++) checked += await assertSpinnerHoldsDp(tuneInputs[i], `Tune #${i}`);

    // Guard against a selector that silently matches nothing (which would make the sweep a no-op
    // and pass vacuously). The Original skin has well over a dozen numeric spinners across types.
    expect(checked, 'class-level sweep visited too few spinners — selector likely drifted').toBeGreaterThan(12);
  });

  test('negative or out-of-range entry is rejected, flagged or clamped, per the field contract', async ({ page }) => {
    // 1. NumInput (registry-bound): typing a negative into Box Volume must flag it and NOT
    //    reach the model; blur reverts to the last valid value.
    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    const vb = page.locator('.tab-section.active .field', { hasText: 'Volume' }).locator('input').first();
    const before = await vb.inputValue();
    await vb.fill('-5');
    await expect(vb).toHaveClass(/inp-bad/); // rejected, red-flagged
    await vb.blur();
    await expect(vb).toHaveValue(before);    // model never took the negative
    // 2. Air fields are DIFFERENT by design (human ruling 2026-09-17): they accept the
    //    out-of-range entry and signal it with a dq-flag + tooltip rather than clamping
    //    (OriginalShell.vue :allow-out-of-range="true" — the app's chosen contract).
    await page.locator('.project-nav li', { hasText: 'Advanced' }).click();
    const rh = page.locator('.tab-section.active .field', { hasText: 'Relative humidity' }).locator('input');
    await rh.fill('-20');
    await expect(rh).toHaveClass(/dq-flag/);           // flagged, not clamped
    await expect(rh).toHaveAttribute('title', /outside the sane range/);
    await rh.fill('250');
    await expect(rh).toHaveClass(/dq-flag/);           // ceiling too, not just the floor
    // 3. Tune panel (scaled registry bounds): Fs typed negative clamps to the 1 Hz floor.
    await page.locator('.project-nav li', { hasText: 'Driver' }).click();
    await page.locator('.save-rail .tune-btn').click();
    const fs = page.locator('.tune-panel .tune-fld', { hasText: 'Fs' }).first().locator('input');
    await fs.fill('-40');
    await expect(fs).toHaveValue('1');
    await page.locator('.tune-panel .close-btn').click();
  });

  test('an out-of-range value typed character-by-character goes red before blur', async ({ page }) => {
    await page.locator('.project-nav li', { hasText: 'Box' }).click();

    const vb = page.locator('.tab-section.active .field', { hasText: 'Volume' }).locator('input').first();
    const before = await vb.inputValue();
    const goodVb = await focusedBoxVolume(page);
    await vb.click();
    await vb.press('Control+a');

    // ONE keystroke. `<input type="number">` reports value === '' for a lone '-', which is the
    // exact moment the field became un-numeric — it must say so, and it must NOT be mistaken for
    // the field having been emptied (which would clear the model out from under the charts).
    await vb.pressSequentially('-');
    await expect(vb).toHaveClass(/inp-bad/);
    await expect(vb).toBeFocused();
    expect(await focusedBoxVolume(page)).toBeCloseTo(goodVb, 9);

    // Typed, not filled: pressSequentially fires the keydowns that put NumInput on its raw-echo
    // path, which is the path `fill()` never exercises.
    await vb.pressSequentially('5');
    await expect(vb).toHaveValue('-5');                 // the keystrokes are echoed, caret intact
    await expect(vb).toHaveClass(/inp-bad/);            // red WHILE the caret is still in the field
    await expect(vb).toBeFocused();
    expect(await focusedBoxVolume(page)).toBeCloseTo(goodVb, 9);  // ...and the bad value never reached the model

    await vb.blur();
    await expect(vb).toHaveValue(before);               // blur reverts to the last good value
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
    expect(await focusedBoxVolume(page)).toBeCloseTo(0.012345678, 12);
    await vb.blur();
    expect(await focusedBoxVolume(page)).toBeCloseTo(0.012345678, 12);
  });
});
